import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { type UserRole, canAccessRouteForRole, getHomeRoute } from '@/types/roles'

interface CookieToSet {
  name: string
  value: string
  options?: CookieOptions
}

const AUTH_COOKIE_PREFIX = 'sb-'
const AUTH_COOKIE_KEY_FRAGMENT = '-auth-token'

function getAuthCookieNames(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .filter(
      ({ name }) =>
        name.startsWith(AUTH_COOKIE_PREFIX) &&
        name.includes(AUTH_COOKIE_KEY_FRAGMENT)
    )
    .map(({ name }) => name)
}

function isMissingRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const authError = error as { code?: string }
  return authError.code === 'refresh_token_not_found'
}

function clearAuthCookies(
  request: NextRequest,
  response: NextResponse,
  cookieNames: string[]
) {
  cookieNames.forEach((cookieName) => {
    request.cookies.delete(cookieName)
    response.cookies.delete(cookieName)
  })
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname
  const authCookieNames = getAuthCookieNames(request)
  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/reset-password')
  const isPublicPage =
    isAuthPage ||
    pathname.startsWith('/auth/verify') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/purchase-success')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  if (authCookieNames.length > 0) {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError && isMissingRefreshTokenError(authError)) {
        // Clear stale auth cookies so logged-out users don't trigger refresh errors repeatedly.
        clearAuthCookies(request, supabaseResponse, authCookieNames)
      } else {
        user = authUser
      }
    } catch (error) {
      if (isMissingRefreshTokenError(error)) {
        clearAuthCookies(request, supabaseResponse, authCookieNames)
      } else {
        throw error
      }
    }
  }

  // If user is not logged in and trying to access protected route
  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in
  if (user) {
    // Get user profile with role and status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    const userRole = (profile?.role as UserRole) || 'member'
    const userStatus = profile?.status || 'active'

    // Check if user is inactive - log them out
    if (userStatus === 'inactive') {
      // Sign out the user
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'account_inactive')
      return NextResponse.redirect(url)
    }

    // If user is on auth page, redirect to their home
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = getHomeRoute(userRole)
      return NextResponse.redirect(url)
    }

    // Check role-based route access
    if (!canAccessRouteForRole(pathname, userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = getHomeRoute(userRole)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
