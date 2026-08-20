import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimiter } from '@/lib/rate-limit'

const protectedPrefixes = ['/dashboard', '/restaurant-dashboard', '/rvc-control-9x2f/dashboard']
const publicRateLimitedPrefixes = ['/order', '/api/order', '/api/public-menu']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check rate limiting on public-facing QR & menu endpoints
  const isPublicRateLimited = publicRateLimitedPrefixes.some((prefix) => pathname.startsWith(prefix))
  const isTestEnvironment = process.env.NODE_ENV === 'test' || request.headers.get('x-playwright-test') === 'true'

  if (isPublicRateLimited && !isTestEnvironment) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'

    const result = await rateLimiter.limit(ip)
    if (!result.success) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Too Many Requests - Please wait a moment' },
          { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Limit': String(result.limit) } }
        )
      }
      return new NextResponse('Too Many Requests - Please wait a moment', {
        status: 429,
        headers: { 'Content-Type': 'text/plain', 'Retry-After': '60' },
      })
    }
  }

  const protectedRoute = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
  if (!protectedRoute) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.redirect(new URL('/login', request.url))

  // Root super-admin bypass check (chaturvediritesh07@gmail.com or role = 'super_admin')
  const isRootSuperAdmin = user.email === 'chaturvediritesh07@gmail.com' || profile.role === 'super_admin'

  if (pathname.startsWith('/rvc-control-9x2f/dashboard')) {
    if (!isRootSuperAdmin) return NextResponse.redirect(new URL('/login', request.url))

    const { data: factors } = await supabase.auth.mfa.listFactors()
    if (!factors?.totp?.length) return NextResponse.redirect(new URL('/enroll-mfa', request.url))
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/enroll-mfa', request.url))
    }
  }

  if (pathname.startsWith('/restaurant-dashboard')) {
    if (!isRootSuperAdmin && (!profile.tenant_id || !['tenant_owner', 'staff'].includes(profile.role))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (profile.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('vertical,status,subscription_end_date,subscription_expires_at')
        .eq('id', profile.tenant_id)
        .single()

      if (!isRootSuperAdmin && tenant?.vertical !== 'restaurant') {
        return NextResponse.redirect(new URL('/coming-soon', request.url))
      }
      if (!isRootSuperAdmin && tenant?.status === 'pending') {
        return NextResponse.redirect(new URL('/approval-pending', request.url))
      }

      // Handle trial expiration
      const expiryDate = tenant?.subscription_expires_at || tenant?.subscription_end_date
      const isExpired =
        tenant?.status === 'expired' ||
        (expiryDate && new Date(expiryDate) < new Date() && tenant?.status !== 'active')

      if (!isRootSuperAdmin && isExpired && !pathname.startsWith('/restaurant-dashboard/billing')) {
        return NextResponse.redirect(new URL('/restaurant-dashboard/billing?expired=1', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/restaurant-dashboard/:path*',
    '/rvc-control-9x2f/dashboard/:path*',
    '/order/:path*',
    '/api/order/:path*',
    '/api/public-menu/:path*',
  ],
}
