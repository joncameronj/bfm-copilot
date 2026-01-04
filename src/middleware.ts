import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { type UserRole, ROUTE_RULES } from '@/types/roles'

interface CookieToSet {
  name: string
  value: string
  options?: CookieOptions
}

// Get the home route based on user role
function getHomeRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'practitioner':
      return '/'
    case 'member':
      return '/my-health'
    default:
      return '/'
  }
}

// Check if a route is accessible by a given role
function canAccessRoute(pathname: string, role: UserRole): boolean {
  // Check each route rule
  for (const [route, allowedRoles] of Object.entries(ROUTE_RULES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return allowedRoles.includes(role)
    }
  }
  // Default: allow access for routes not in ROUTE_RULES
  return true
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Check if this is an auth page
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset-password')

  // If user is not logged in and trying to access protected route
  if (!user && !isAuthPage) {
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
    if (!canAccessRoute(pathname, userRole)) {
      const url = request.nextUrl.clone()
      url.pathname = getHomeRoute(userRole)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
