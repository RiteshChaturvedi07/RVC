import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes = ['/dashboard', '/restaurant-dashboard', '/rvc-control-9x2f/dashboard']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
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
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.redirect(new URL('/login', request.url))

  const { data: factors } = await supabase.auth.mfa.listFactors()
  if (!factors?.totp?.length) return NextResponse.redirect(new URL('/enroll-mfa', request.url))

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return NextResponse.redirect(new URL('/enroll-mfa', request.url))

  if (pathname.startsWith('/rvc-control-9x2f/dashboard') && profile.role !== 'super_admin') return NextResponse.redirect(new URL('/login', request.url))
  if (pathname.startsWith('/restaurant-dashboard')) {
    if (!profile.tenant_id || !['tenant_owner', 'staff'].includes(profile.role)) return NextResponse.redirect(new URL('/login', request.url))
    const { data: tenant } = await supabase.from('tenants').select('vertical,status').eq('id', profile.tenant_id).single()
    if (tenant?.vertical !== 'restaurant') return NextResponse.redirect(new URL('/coming-soon', request.url))
    if (tenant?.status === 'pending') return NextResponse.redirect(new URL('/approval-pending', request.url))
  }
  return response
}

export const config = { matcher: ['/dashboard/:path*', '/restaurant-dashboard/:path*', '/rvc-control-9x2f/dashboard/:path*'] }
