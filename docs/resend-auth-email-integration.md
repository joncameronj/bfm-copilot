# Resend Auth Email Integration

Copilot auth email delivery now uses Supabase Auth Send Email Hook plus Resend.

## Runtime Flow

1. Supabase Auth creates the auth token for signup, invite, magic link, recovery, reauthentication, or email change.
2. Supabase calls `supabase/functions/send-auth-email`.
3. The Edge Function verifies the Standard Webhooks signature using `SEND_EMAIL_HOOK_SECRET`.
4. The function builds a Supabase `/auth/v1/verify` URL using `SUPABASE_URL`, the token hash, action type, and `redirect_to`.
5. The function sends the message through Resend.
6. If a matching `RESEND_TEMPLATE_AUTH_*` value is configured, Resend sends the published template with variables. If not, the function sends fallback HTML that matches the Paper email panel for development.

## Required Secrets

Set these in Supabase for the Edge Function:

```bash
supabase secrets set \
  RESEND_API_KEY="re_..." \
  SEND_EMAIL_HOOK_SECRET="v1,whsec_..." \
  AUTH_EMAIL_FROM="Copilot <auth@your-domain.com>" \
  AUTH_EMAIL_REPLY_TO="support@your-domain.com" \
  AUTH_SUPPORT_EMAIL="support@your-domain.com" \
  AUTH_PRODUCT_NAME="Copilot" \
  AUTH_EMAIL_LOGO_URL="https://awdvlfjiusotgbumoojt.supabase.co/storage/v1/object/public/email-assets/copilot-logo-gradient-email-v1.png"
```

Set these after publishing the matching Resend Templates:

```bash
supabase secrets set \
  RESEND_TEMPLATE_AUTH_RECOVERY="copilot-auth-recovery" \
  RESEND_TEMPLATE_AUTH_MAGIC_LINK="copilot-auth-magic-link" \
  RESEND_TEMPLATE_AUTH_SIGNUP="copilot-auth-signup" \
  RESEND_TEMPLATE_AUTH_INVITE="copilot-auth-invite" \
  RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_CURRENT="copilot-auth-email-change-current" \
  RESEND_TEMPLATE_AUTH_EMAIL_CHANGE_NEW="copilot-auth-email-change-new" \
  RESEND_TEMPLATE_AUTH_REAUTHENTICATION="copilot-auth-reauthentication" \
  RESEND_TEMPLATE_AUTH_GENERIC="copilot-auth-generic"
```

`SUPABASE_URL` is automatically available in Supabase Edge Functions. For non-Supabase execution, set `NEXT_PUBLIC_SUPABASE_URL` as a fallback.

## Deploy

```bash
supabase functions deploy send-auth-email --no-verify-jwt
```

Then enable the hook in the Supabase Dashboard:

1. Go to Authentication -> Hooks.
2. Enable Send Email Hook.
3. Set the hook URL to the deployed `send-auth-email` function URL.
4. Generate or paste the same `SEND_EMAIL_HOOK_SECRET` used in function secrets.

## Production Redirects And Assets

Redirects are controlled in two places:

- Supabase Dashboard -> Authentication -> URL Configuration. Set the Site URL to the production app origin and add every allowed auth redirect URL, including `https://copilot.energeticdebt.com/update-password`.
- Application code that triggers auth emails. Recovery flows use the current request origin in `src/app/(auth)/reset-password/page.tsx` and `src/app/api/admin/users/route.ts`; Whop onboarding uses `NEXT_PUBLIC_APP_URL` in `src/app/api/webhooks/whop/route.ts`.

The production logo should eventually live under the deployed app's public asset path:

```text
public/images/copilot-logo-gradient-email-v1.png
https://copilot.energeticdebt.com/images/copilot-logo-gradient-email-v1.png
```

Until `copilot.energeticdebt.com` is live, `AUTH_EMAIL_LOGO_URL` points at the public Supabase Storage copy. After DNS and the app deployment are verified, update `AUTH_EMAIL_LOGO_URL` and republish the Resend templates if you want email previews to use the branded app CDN URL.

## Resend Setup

1. Verify the sending domain in Resend.
2. Create/publish the eight templates from `docs/resend-auth-email-templates.md`.
3. Use the template IDs or aliases in the `RESEND_TEMPLATE_AUTH_*` secrets.
4. Disable click/open tracking for auth emails so Supabase verification links are not rewritten.

Each template receives `action_url`, `otp_code`, `support_email`, `product_name`, `recipient_email`, and `logo_url`. The `logo_url` value must point to a public HTTPS image URL. For production, this uses the hosted Supabase Storage asset at `https://awdvlfjiusotgbumoojt.supabase.co/storage/v1/object/public/email-assets/copilot-logo-gradient-email-v1.png`.

To create or update the eight templates through the Resend API, use a temporary full-access Resend API key and run:

```bash
read -rsp "Resend API key: " RESEND_API_KEY
echo
export RESEND_API_KEY
export AUTH_EMAIL_FROM="Copilot <auth@your-domain.com>"
npm run resend:publish-auth-templates
unset RESEND_API_KEY
```

The script publishes the templates and prints the `supabase secrets set` command for the generated Resend template IDs. Revoke the temporary full-access Resend key after setup; the deployed Edge Function only needs the production sending key as `RESEND_API_KEY`.

## Existing App Flows Covered

- `/reset-password` sends `recovery` and redirects to `/update-password`.
- Whop purchase onboarding creates/links a Supabase user, writes `whop_subscriptions`, and triggers `recovery` for password setup.
- Admin-created users trigger `recovery` for password setup.
- Magic-link, signup, invite, email-change, and reauthentication payloads are supported by the hook for future auth flow changes.
