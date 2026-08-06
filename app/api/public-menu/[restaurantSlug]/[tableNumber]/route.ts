import { NextResponse } from 'next/server'

type Context = { params: Promise<{ restaurantSlug: string; tableNumber: string }> }

export async function GET(_: Request, { params }: Context) {
  const { restaurantSlug, tableNumber } = await params
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Restaurant service is not configured.' }, { status: 500 })

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
    if (!response.ok) return NextResponse.json({ error: payload?.message || 'Unable to load restaurant menu.' }, { status: response.status })
    if (!payload) return NextResponse.json({ error: 'This QR code is unavailable or no longer accepts orders.' }, { status: 404 })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Restaurant service is temporarily unavailable.' }, { status: 503 })
  }
}
