import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyWhopWebhook,
  WebhookVerificationError,
} from '@/lib/whop/verify-signature'

export const dynamic = 'force-dynamic'

// Whop product IDs that grant Copilot member access
function getCopilotProductIds(): string[] {
  const ids = process.env.WHOP_COPILOT_PRODUCT_IDS || ''
  return ids
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function isCopilotProduct(productId: string): boolean {
  const allowedIds = getCopilotProductIds()
  // If no product IDs configured, accept all (dev convenience)
  if (allowedIds.length === 0) return true
  return allowedIds.includes(productId)
}

function getRecoveryRedirectTo(): string | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (!appUrl) return undefined

  return `${appUrl.replace(/\/+$/, '')}/api/auth/callback?next=/update-password`
}

// Retry helper for profile lookup after auth.admin.createUser()
// The profiles trigger may have a brief delay
async function waitForProfile(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  maxRetries = 3,
  delayMs = 500
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (data) return true

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return false
}

interface WhopWebhookPayload {
  action: string
  data: {
    id: string // membership ID
    product: { id: string }
    user: {
      id: string
      email: string
      name?: string
      username?: string
    }
    status?: string
    [key: string]: unknown
  }
}

function extractPayload(raw: unknown): WhopWebhookPayload | null {
  const payload = raw as Record<string, unknown>
  if (!payload || typeof payload !== 'object') return null

  const action = payload.action as string | undefined
  const data = payload.data as Record<string, unknown> | undefined

  if (!action || !data) return null

  const user = data.user as Record<string, unknown> | undefined
  const product = data.product as Record<string, unknown> | undefined

  if (!user?.id || !user?.email || !product?.id || !data.id) return null

  return {
    action,
    data: {
      id: data.id as string,
      product: { id: product.id as string },
      user: {
        id: user.id as string,
        email: user.email as string,
        name: (user.name as string) || undefined,
        username: (user.username as string) || undefined,
      },
      status: data.status as string | undefined,
    },
  }
}

async function handleMembershipActivated(
  supabase: ReturnType<typeof createAdminClient>,
  payload: WhopWebhookPayload,
  rawBody: string
) {
  const { data } = payload
  const { email, name, id: whopUserId } = data.user
  const membershipId = data.id
  const productId = data.product.id

  // Idempotency: check if subscription already exists
  const { data: existing } = await supabase
    .from('whop_subscriptions')
    .select('id')
    .eq('whop_membership_id', membershipId)
    .single()

  if (existing) {
    return NextResponse.json({ status: 'already_processed' })
  }

  // Look up existing profile by email
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  let profileId: string

  if (existingUser) {
    profileId = existingUser.id

    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', profileId)
      .single()

    // Reactivate if inactive
    if (profile?.status === 'inactive') {
      await supabase
        .from('profiles')
        .update({
          status: 'active',
          whop_user_id: whopUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
    } else {
      // Active user (possibly practitioner/admin) — just link whop_user_id, don't change role
      await supabase
        .from('profiles')
        .update({
          whop_user_id: whopUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
    }
  } else {
    // Create new auth user
    const tempPassword = crypto.randomUUID()
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: name || '' },
      })

    if (authError || !authData?.user) {
      console.error('Failed to create auth user:', authError)
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    profileId = authData.user.id

    // Wait for profiles trigger to create the row
    const profileExists = await waitForProfile(supabase, profileId)
    if (!profileExists) {
      console.error('Profile not created after retries for user:', profileId)
      return NextResponse.json(
        { error: 'Profile creation timeout' },
        { status: 500 }
      )
    }

    // Set role=member + whop_user_id
    await supabase
      .from('profiles')
      .update({
        role: 'member',
        full_name: name || null,
        whop_user_id: whopUserId,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    // Send password reset email so user can set their own password
    // Use the Supabase auth admin API to generate a recovery link
    const redirectTo = getRecoveryRedirectTo()
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    })

    if (resetError) {
      console.error('Failed to send password reset:', resetError)
      // Non-fatal: user can still use "forgot password" flow
    }
  }

  // Insert subscription record
  const { error: subError } = await supabase
    .from('whop_subscriptions')
    .insert({
      profile_id: profileId,
      whop_user_id: whopUserId,
      whop_membership_id: membershipId,
      whop_product_id: productId,
      status: 'active',
      activated_at: new Date().toISOString(),
      raw_webhook_data: JSON.parse(rawBody),
    })

  if (subError) {
    console.error('Failed to insert subscription:', subError)
    return NextResponse.json(
      { error: 'Failed to record subscription' },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'ok', profile_id: profileId })
}

async function handleMembershipDeactivated(
  supabase: ReturnType<typeof createAdminClient>,
  payload: WhopWebhookPayload,
  rawBody: string
) {
  const membershipId = payload.data.id

  // Find the subscription
  const { data: subscription } = await supabase
    .from('whop_subscriptions')
    .select('id, profile_id')
    .eq('whop_membership_id', membershipId)
    .single()

  if (!subscription) {
    // No subscription found — possibly a product we don't track
    return NextResponse.json({ status: 'not_found' })
  }

  // Update subscription status
  await supabase
    .from('whop_subscriptions')
    .update({
      status: 'canceled',
      deactivated_at: new Date().toISOString(),
      raw_webhook_data: JSON.parse(rawBody),
    })
    .eq('id', subscription.id)

  // Check if user has any OTHER active subscriptions
  const { data: activeSubscriptions } = await supabase
    .from('whop_subscriptions')
    .select('id')
    .eq('profile_id', subscription.profile_id)
    .eq('status', 'active')
    .neq('id', subscription.id)

  // If no other active subscriptions, deactivate profile
  if (!activeSubscriptions || activeSubscriptions.length === 0) {
    // Check if user is a practitioner/admin — don't deactivate them
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', subscription.profile_id)
      .single()

    if (profile?.role === 'member') {
      await supabase
        .from('profiles')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.profile_id)
    }
  }

  return NextResponse.json({ status: 'ok' })
}

export async function POST(request: Request) {
  // Read raw body for signature verification
  const rawBody = await request.text()

  // Extract headers for Standard Webhooks verification
  const headers: Record<string, string> = {}
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value
  }

  // Verify signature
  let payload: unknown
  try {
    payload = verifyWhopWebhook(rawBody, headers)
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 401 }
    )
  }

  // Parse and validate payload
  const parsed = extractPayload(payload)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 })
  }

  // Product filtering: only process webhooks for Copilot products
  if (!isCopilotProduct(parsed.data.product.id)) {
    return NextResponse.json({ status: 'ignored', reason: 'non-copilot product' })
  }

  const supabase = createAdminClient()

  switch (parsed.action) {
    case 'membership.activated':
      return handleMembershipActivated(supabase, parsed, rawBody)

    case 'membership.deactivated':
      return handleMembershipDeactivated(supabase, parsed, rawBody)

    default:
      // Acknowledge unknown events without error
      return NextResponse.json({ status: 'ignored', action: parsed.action })
  }
}
