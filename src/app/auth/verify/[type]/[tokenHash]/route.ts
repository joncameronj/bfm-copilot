import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const DEFAULT_NEXT_PATHS: Record<string, string> = {
  recovery: '/update-password',
  invite: '/update-password',
  email_change: '/settings',
}

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

  if (!decodedTokenHash) {
    return NextResponse.redirect(
      new URL('/login?error=auth_link_invalid', requestUrl.origin)
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return NextResponse.redirect(
      new URL('/login?error=auth_configuration_error', requestUrl.origin)
    )
  }

  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get('next'),
    type || 'signup'
  )
  const redirectTo = new URL(nextPath, requestUrl.origin)
  const verifyUrl = new URL('/auth/v1/verify', supabaseUrl)
  verifyUrl.searchParams.set('token', decodedTokenHash)
  verifyUrl.searchParams.set('type', type || 'signup')
  verifyUrl.searchParams.set('redirect_to', redirectTo.toString())

  return NextResponse.redirect(verifyUrl)
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
