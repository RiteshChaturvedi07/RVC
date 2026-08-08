import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter } from '@/lib/rate-limit'

type Context = { params: Promise<{ restaurantSlug: string; tableNumber: string }> }

export async function GET(request: NextRequest, { params }: Context) {
  const { restaurantSlug, tableNumber } = await params
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1'
  const { success, limit, remaining, reset } = await rateLimiter.limit(ip)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rateLimitHeaders },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Restaurant service is not configured.' }, { status: 500, headers: rateLimitHeaders })

  try {
    const response = await fetch(`${url}/rest/v1/rpc/public_restaurant_menu`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'public',
      },
      body: JSON.stringify({ p_slug: restaurantSlug, p_table_number: tableNumber }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return NextResponse.json({ error: payload?.message || 'Unable to load restaurant menu.' }, { status: response.status, headers: rateLimitHeaders })
    if (!payload) return NextResponse.json({ error: 'This QR code is unavailable or no longer accepts orders.' }, { status: 404, headers: rateLimitHeaders })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders } })
  } catch {
    return NextResponse.json({ error: 'Restaurant service is temporarily unavailable.' }, { status: 503, headers: rateLimitHeaders })
  }
}
