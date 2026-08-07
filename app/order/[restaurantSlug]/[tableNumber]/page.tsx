'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Loader2, Minus, Plus, Search, ShoppingBag, UtensilsCrossed, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type MenuItem = { id: string; name: string; description: string | null; price: number; category: string | null; category_id: string | null; image_url?: string | null; is_featured: boolean }
type MenuResponse = { restaurant: { name: string; currency: string; tax_rate: number }; table: { id: string; number: string; token: string }; categories: { id: string; name: string }[]; items: MenuItem[] }
type Cart = Record<string, number>
type CustomerOrder = { id: string; order_number: number; status: string; payment_status: string; payment_method?: string | null; total: number; items?: { name: string; quantity: number }[] }

const money = (value: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

export default function DinerOrderPage() {
  const params = useParams<{ restaurantSlug: string; tableNumber: string }>()
  // Keep one client for this page. Recreating it on every render restarts the
  // menu-loading effect and leaves a QR visitor on the loading screen.
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<MenuResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [lastOrder, setLastOrder] = useState<CustomerOrder | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('')
      try {
        const request = fetch(`/api/public-menu/${encodeURIComponent(params.restaurantSlug)}/${encodeURIComponent(params.tableNumber)}`, { cache: 'no-store' })
        const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('The menu service took too long to respond. Please try again.')), 15000))
        const response = await Promise.race([request, timeout])
        const menu = await response.json()
        if (!response.ok || !menu) setError(menu?.error || 'This QR menu is unavailable. Ask the restaurant team for a current code.')
        else setData(menu as MenuResponse)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load this QR menu.')
      } finally {
        setLoading(false)
      }
    }
    if (params.restaurantSlug && params.tableNumber) load()
  }, [params.restaurantSlug, params.tableNumber, supabase])

  useEffect(() => {
    if (!data?.table.token) return
    const saved = window.localStorage.getItem(`rvc-last-order:${data.table.token}`)
    if (!saved) return
    try {
      const localOrder = JSON.parse(saved) as CustomerOrder
      const refresh = () => supabase.rpc('public_restaurant_order_status', { p_table_token: data.table.token, p_order_id: localOrder.id }).then(({ data: tracked }) => {
        if (tracked) setLastOrder(tracked as CustomerOrder)
      })
      refresh()
      const interval = window.setInterval(refresh, 10_000)
      return () => window.clearInterval(interval)
    } catch { window.localStorage.removeItem(`rvc-last-order:${data.table.token}`) }
  }, [data?.table.token, supabase])

  const items = useMemo(() => (data?.items ?? []).filter((item) => (category === 'All' || item.category_id === category) && item.name.toLowerCase().includes(search.toLowerCase())), [data, category, search])
  const cartItems = (data?.items ?? []).filter((item) => cart[item.id])
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * cart[item.id], 0)
  const tax = subtotal * (data?.restaurant.tax_rate ?? 0) / 100
  const total = subtotal + tax
  const update = (id: string, amount: number) => setCart((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + amount) }))

  const placeOrder = async () => {
    if (!data || !count) return
    setPlacing(true); setError('')
    const { data: created, error: rpcError } = await supabase.rpc('create_public_restaurant_order', {
      p_table_token: data.table.token,
      p_customer_phone: phone.trim(),
      p_items: cartItems.map((item) => ({ id: item.id, quantity: cart[item.id] })),
      p_notes: null,
    })
    setPlacing(false)
    if (rpcError) { setError(rpcError.message); return }
    const createdOrder = created as CustomerOrder
    window.localStorage.setItem(`rvc-last-order:${data.table.token}`, JSON.stringify(createdOrder))
    setLastOrder(createdOrder); setOrder(createdOrder); setCartOpen(false); setCart({})
  }

  if (loading) return <State icon={<Loader2 className="animate-spin" />} text="Loading the restaurant menu…" />
  if (error && !data) return <State icon={<UtensilsCrossed />} text={error} />
  if (!data) return null
  if (order) return <main className="grid min-h-screen place-items-center bg-[#fffaf4] p-6 text-[#2f2119]"><section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={34} /></span><p className="mt-6 text-sm font-semibold text-emerald-700">ORDER RECEIVED</p><h1 className="mt-2 text-3xl font-semibold">Thank you!</h1><p className="mt-3 text-orange-950/60">Order #{order.order_number} has been sent to the kitchen for Table {data.table.number}.</p><p className="mt-3 capitalize text-primary">Current status: {order.status}</p><p className="mt-4 text-xl font-semibold">{money(Number(order.total), data.restaurant.currency)}</p><button onClick={() => setOrder(null)} className="mt-7 w-full rounded-2xl bg-[#3e2b20] py-3 font-semibold text-white">Back to menu</button></section></main>

  return <main className="min-h-screen bg-[#fffaf4] pb-28 text-[#2f2119]"><div className="mx-auto max-w-2xl"><header className="border-b border-orange-950/10 bg-white/75 px-5 py-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-orange-700">Table {data.table.number}</p><h1 className="mt-1 text-2xl font-semibold capitalize">{data.restaurant.name}</h1><p className="mt-1 text-sm text-orange-950/55">Scan, choose, and send your order directly to the kitchen.</p></header>{lastOrder&&<button onClick={()=>setOrder(lastOrder)} className="mx-5 mt-5 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-2xl bg-emerald-50 p-4 text-left text-emerald-900"><span><b>Last order #{lastOrder.order_number}</b><small className="mt-1 block capitalize">Status: {lastOrder.status} · Payment: {lastOrder.payment_status}</small></span><span className="text-sm font-semibold">Track order</span></button>}<section className="px-5 pt-6"><label className="text-sm font-medium">Mobile number <span className="font-normal text-orange-950/45">(optional, for updates)</span></label><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))} inputMode="tel" placeholder="Your mobile number" className="mt-2 w-full rounded-xl border border-orange-950/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-orange-600/30" /></section><section className="px-5 pt-6"><label className="flex items-center gap-2 rounded-xl border border-orange-950/10 bg-white px-4 py-3"><Search size={17} className="text-orange-950/45" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu" className="w-full bg-transparent outline-none" /></label><div className="mt-4 flex gap-2 overflow-x-auto pb-1"><button onClick={() => setCategory('All')} className={`shrink-0 rounded-full px-4 py-2 text-sm ${category === 'All' ? 'bg-[#3e2b20] text-white' : 'bg-white'}`}>All</button>{data.categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm ${category === item.id ? 'bg-[#3e2b20] text-white' : 'bg-white'}`}>{item.name}</button>)}</div></section><section className="grid gap-3 px-5 pt-5">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-orange-950/10 bg-white"><div className="flex gap-4 p-4">{item.image_url&&<img src={item.image_url} alt={item.name} className="size-24 shrink-0 rounded-xl object-cover"/>}<div className="flex-1"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{item.name}</h2>{item.is_featured&&<span className="text-xs text-orange-700">Popular</span>}<p className="mt-1 text-sm text-orange-950/55">{item.description}</p></div><p className="font-semibold">{money(Number(item.price),data.restaurant.currency)}</p></div><div className="mt-3 flex justify-end">{cart[item.id]?<Quantity value={cart[item.id]} onChange={(delta)=>update(item.id,delta)}/>:<button onClick={()=>update(item.id,1)} className="rounded-xl bg-[#3e2b20] px-4 py-2 text-sm text-white">Add</button>}</div></div></div></article>)}{items.length === 0 && <p className="py-10 text-center text-orange-950/55">No menu items match your search.</p>}</section></div>{error && <p className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}{count > 0 && <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl p-4"><button onClick={() => setCartOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-[#3e2b20] px-5 py-4 text-white shadow-xl"><span className="flex items-center gap-3"><ShoppingBag size={18} />{count} item{count > 1 ? 's' : ''}</span><span>View order · {money(total, data.restaurant.currency)}</span></button></div>}{cartOpen && <div className="fixed inset-0 z-50 bg-black/40"><section className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl rounded-t-3xl bg-[#fffaf4] p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Your order</h2><button onClick={() => setCartOpen(false)} aria-label="Close"><X /></button></div><div className="mt-5 space-y-3">{cartItems.map((item) => <div key={item.id} className="flex items-center justify-between"><div><p className="font-medium">{item.name}</p><p className="text-sm text-orange-950/55">{money(item.price, data.restaurant.currency)}</p></div><Quantity value={cart[item.id]} onChange={(delta) => update(item.id, delta)} /></div>)}</div><div className="mt-6 border-t border-orange-950/10 pt-4 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, data.restaurant.currency)}</span></p><p className="mt-2 flex justify-between"><span>Tax</span><span>{money(tax, data.restaurant.currency)}</span></p><p className="mt-3 flex justify-between text-lg font-semibold"><span>Total</span><span>{money(total, data.restaurant.currency)}</span></p><button disabled={placing} onClick={placeOrder} className="mt-5 w-full rounded-2xl bg-[#3e2b20] py-4 font-semibold text-white">{placing ? 'Sending order…' : `Place order · ${money(total, data.restaurant.currency)}`}</button></div></section></div>}</main>
}

function Quantity({ value, onChange }: { value: number; onChange: (amount: number) => void }) { return <div className="flex h-fit items-center gap-3 rounded-xl bg-orange-100 px-2 py-1"><button aria-label="Remove one" onClick={() => onChange(-1)} className="p-1"><Minus size={15} /></button><span className="w-4 text-center text-sm font-semibold">{value}</span><button aria-label="Add one" onClick={() => onChange(1)} className="rounded-lg bg-[#3e2b20] p-1 text-white"><Plus size={15} /></button></div> }
function State({ icon, text }: { icon: React.ReactNode; text: string }) { return <main className="grid min-h-screen place-items-center bg-[#fffaf4] p-6 text-center text-[#2f2119]"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-100 text-orange-800">{icon}</span><p className="mt-5 max-w-sm text-orange-950/65">{text}</p></div></main> }
