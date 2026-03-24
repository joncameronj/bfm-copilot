# Whop Integration

This document covers the Whop to Copilot purchase and account provisioning flow.

## Goal

When a customer buys the Copilot product through Whop:

1. Whop sends a webhook to Copilot.
2. Copilot creates or links the user in Supabase Auth.
3. Copilot marks the user as an active `member`.
4. Copilot stores the Whop membership in `whop_subscriptions`.
5. Copilot sends the buyer a password setup email.
6. The buyer lands on a success page and then completes account setup from email.

## Current Flow In This Repo

- Webhook endpoint: `POST /api/webhooks/whop`
- Success page: `/purchase-success`
- Password setup page: `/update-password`
- Recovery callback: `/api/auth/callback?next=/update-password`

Relevant files:

- `src/app/api/webhooks/whop/route.ts`
- `src/lib/whop/verify-signature.ts`
- `src/app/(auth)/purchase-success/page.tsx`
- `src/app/(auth)/update-password/page.tsx`
- `supabase/migrations/20260314000000_whop_subscriptions.sql`

## Required Environment Variables

Set these in production:

```env
NEXT_PUBLIC_APP_URL=https://your-copilot-domain.com
WHOP_WEBHOOK_SECRET=whsec_xxx
WHOP_COPILOT_PRODUCT_IDS=prod_xxx,prod_yyy
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Notes:

- `NEXT_PUBLIC_APP_URL` is used to generate the password setup redirect.
- `WHOP_COPILOT_PRODUCT_IDS` should list every Whop product that grants Copilot access.
- `SUPABASE_SERVICE_ROLE_KEY` is required because the webhook creates users and bypasses RLS.

## Whop Setup Steps

### 1. Get the Copilot product ID

In Whop, find the product or access pass that should grant Copilot access.

Add its product ID to:

```env
WHOP_COPILOT_PRODUCT_IDS=prod_xxx
```

If multiple products should unlock Copilot, comma-separate them.

### 2. Create the webhook in Whop

In the Whop dashboard:

1. Open your company developer settings.
2. Create a webhook pointing to:

```text
https://your-copilot-domain.com/api/webhooks/whop
```

3. Subscribe to at least these events:
   - `membership.activated`
   - `membership.deactivated`

Recommended additional event for future billing visibility:

- `membership.cancel_at_period_end_changed`

### 3. Copy the webhook secret

Take the Whop webhook secret and store it as:

```env
WHOP_WEBHOOK_SECRET=whsec_xxx
```

### 4. Set the post-checkout redirect

In Whop checkout settings, set the success redirect URL to:

```text
https://your-copilot-domain.com/purchase-success
```

This page is informational only. The real provisioning logic must come from the webhook.

## Required Whop Permissions

For the current implementation, no Whop API key is required if you configure the webhook manually in the Whop dashboard.

You only need:

- access to your Whop company developer settings
- the ability to create/manage the company webhook

## Optional Whop API Token

You do not need a Whop API token for the current webhook-based flow.

Only create one if you want to add API-based verification or reconciliation later.

Suggested minimum scopes for future API work:

- `member:basic:read`
- `member:email:read`
- `access_pass:basic:read`

Only needed for webhook management by API:

- `developer:manage_webhook`

Do not default to broad admin-style scopes if you are not using them.

## Supabase Requirements

### 1. Database migration

Make sure this migration has been applied:

- `supabase/migrations/20260314000000_whop_subscriptions.sql`

That migration creates:

- `whop_subscriptions`
- `profiles.whop_user_id`

### 2. Auth email flow

The webhook creates a new user, then sends a recovery email with this redirect:

```text
https://your-copilot-domain.com/api/auth/callback?next=/update-password
```

The customer clicks the email link, lands in a valid recovery session, and sets a password on `/update-password`.

### 3. Email delivery

Before launch, confirm Supabase email delivery is configured correctly:

- custom SMTP is set up
- recovery email template is branded
- the redirect domain is allowed in Supabase Auth settings

## How The Provisioning Logic Works

### On `membership.activated`

The webhook handler:

1. Verifies the webhook signature.
2. Rejects non-Copilot product IDs.
3. Checks whether the membership was already processed.
4. Looks for an existing Supabase user by email.
5. If the user exists:
   - links `whop_user_id`
   - reactivates the profile if inactive
   - does not downgrade practitioner or admin roles
6. If the user does not exist:
   - creates a Supabase Auth user
   - waits for the `profiles` row to exist
   - sets role to `member`
   - sends a recovery email for password setup
7. Inserts a row into `whop_subscriptions`

### On `membership.deactivated`

The webhook handler:

1. Finds the matching `whop_subscriptions` row
2. Marks it canceled
3. Checks whether the user has any other active Whop subscriptions
4. Deactivates the profile only if the user is a plain `member`

## Deployment Checklist

1. Deploy the codebase.
2. Apply the Supabase migration if it is not already applied.
3. Set production env vars.
4. Configure the Whop webhook.
5. Set the Whop checkout success redirect.
6. Confirm Supabase Auth redirect URLs allow:
   - `https://your-copilot-domain.com/api/auth/callback`
7. Run a real test purchase in Whop.
8. Confirm:
   - webhook arrives
   - user is created in Supabase Auth
   - profile role becomes `member`
   - `whop_subscriptions` row is created
   - recovery email is delivered
   - customer can set password and sign in

## Local Verification

These checks pass in the repo:

```bash
npm run test:run -- tests/whop-webhook.test.ts tests/whop-verify-signature.test.ts
npm run typecheck
```

## Recommended Support Fallback

If a customer says they did not get the setup email:

1. Have them go to `/reset-password`
2. Enter the same purchase email
3. Complete setup from the new recovery email

## Important Notes

- Do not trust the checkout redirect alone for access provisioning.
- The webhook is the source of truth.
- Keep `WHOP_COPILOT_PRODUCT_IDS` tight so unrelated Whop purchases do not create accounts.
- The current implementation is webhook-first and does not depend on a Whop API token.
