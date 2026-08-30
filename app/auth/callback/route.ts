import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/reset-password'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardUrl = `${origin}${next.startsWith('/') ? next : `/${next}`}`
      return NextResponse.redirect(forwardUrl)
    }
  }

  // Return the user to an error page if token exchange failed
  return NextResponse.redirect(`${origin}/forgot-password?error_code=otp_expired`)
}
