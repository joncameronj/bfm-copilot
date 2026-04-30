import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_NEXT_PATHS: Record<string, string> = {
  recovery: '/update-password',
  invite: '/update-password',
  email_change: '/settings',
}

const SUPPORTED_EMAIL_OTP_TYPES = new Set<string>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

interface RouteContext {
  params: Promise<unknown>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestUrl = new URL(request.url)
  const { type, tokenHash } = (await context.params) as {
    type?: string
    tokenHash?: string
  }
  const decodedTokenHash = decodeURIComponent(tokenHash || '')
  const authType = getEmailOtpType(type)

  if (!decodedTokenHash) {
    return redirectToInvalidLink(requestUrl, authType)
  }

  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get('next'),
    authType || 'signup'
  )
  const redirectTo = new URL(nextPath, requestUrl.origin)

  if (!authType) {
    return redirectToInvalidLink(requestUrl, authType)
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: authType,
      token_hash: decodedTokenHash,
    })

    if (error) {
      console.error('Auth link verification failed:', error)
      return redirectToInvalidLink(requestUrl, authType)
    }
  } catch (error) {
    console.error('Auth link verification crashed:', error)
    return NextResponse.redirect(
      new URL('/login?error=auth_configuration_error', requestUrl.origin)
    )
  }

  return NextResponse.redirect(redirectTo)
}

function getEmailOtpType(type: string | undefined): EmailOtpType | null {
  if (!type || !SUPPORTED_EMAIL_OTP_TYPES.has(type)) return null
  return type as EmailOtpType
}

function redirectToInvalidLink(
  requestUrl: URL,
  type: EmailOtpType | null
): NextResponse {
  if (type === 'recovery' || type === 'invite') {
    return NextResponse.redirect(
      new URL('/reset-password?error=auth_link_invalid', requestUrl.origin)
    )
  }

  return NextResponse.redirect(
    new URL('/login?error=auth_link_invalid', requestUrl.origin)
  )
}

function getSafeNextPath(next: string | null, type: string): string {
  if (!next) return DEFAULT_NEXT_PATHS[type] || '/'

  try {
    const parsed = new URL(next, 'https://copilot.local')
    if (parsed.origin !== 'https://copilot.local') {
      return DEFAULT_NEXT_PATHS[type] || '/'
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return DEFAULT_NEXT_PATHS[type] || '/'
  }
}
