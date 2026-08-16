'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  CloudSun,
  DollarSign,
  Flame,
  Minus,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { printReceipt, type ReceiptOrder } from '@/components/restaurant/order-receipt'

type Item = {
  id: string
  name: string
  price: number
  description: string | null
  image_url?: string | null
  category?: string | null
  is_vegetarian?: boolean | null
  rating?: number
  prep_time?: string
  variants?: { name: string; price: number }[]
}

type Order = {
  id: string
  order_number: number
  status: string
  payment_status: string
  payment_method?: string | null
  total: number
  discount_amount?: number
  tax_amount?: number
  dining_type?: string
  notes?: string | null
  bill_requested?: boolean
  requested_payment_mode?: string | null
  created_at?: string
  items?: { name: string; quantity: number; unit_price?: number; line_total?: number; notes?: string | null }[]
}

type Menu = {
  restaurant: { name: string; tax_rate: number; merchant_upi_id?: string | null; merchant_upi_qr_url?: string | null }
  table: { number: string; token: string }
  items: Item[]
}

const fallbackFood = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80'
const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function OrderPage() {
  const params = useParams<{ restaurantSlug: string; tableNumber: string }>()
  const db = useMemo(() => createClient(), [])

  const [menu, setMenu] = useState<Menu | null>(null)
  const [error, setError] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [itemVariants, setItemVariants] = useState<Record<string, { name: string; price: number }>>({})
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non_veg' | 'egg'>('all')
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'popular' | 'special' | 'under100'>('all')

  // Modals & Panels
  const [checkout, setCheckout] = useState(false)
  const [history, setHistory] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Checkout Form
  const [utr, setUtr] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')
  const [dining, setDining] = useState<'dine_in' | 'takeaway'>('dine_in')
  const [coupon, setCoupon] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponText, setCouponText] = useState('')
  const [orders, setOrders] = useState<Order[]>([])

  // Load menu data
  useEffect(() => {
    if (!params?.restaurantSlug || !params?.tableNumber) return
    const load = async () => {
      try {
        setError('')
        const response = await fetch(`/api/public-menu/${params.restaurantSlug}/${params.tableNumber}`)
        const payload = await response.json()
        if (!response.ok || !payload?.restaurant) throw new Error(payload?.error || 'QR ordering is currently paused.')
        setMenu(payload)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load menu')
      }
    }
    void load()
  }, [params.restaurantSlug, params.tableNumber])

  // Live session order refetching
  useEffect(() => {
    if (!menu) return
    const refresh = async () => {
      const { data } = await db.rpc('public_restaurant_table_session_orders', { p_table_token: menu.table.token })
      setOrders((data ?? []) as Order[])
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 6000)
    return () => clearInterval(timer)
  }, [menu, db])

  // Smart Weather & Time Recommendation
  const recommendation = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) {
      return {
        title: '☀️ Morning Refreshers & Breakfast',
        subtitle: 'Freshly brewed coffee paired with warm dosas.',
        pairing: ['Filter Coffee', 'Masala Dosa'],
      }
    }
    if (hour >= 12 && hour < 16) {
      return {
        title: '🍱 Afternoon Chef Specials',
        subtitle: 'Popular lunch combos recommended for your table.',
        pairing: ['Paneer Butter Masala', 'Butter Naan'],
      }
    }
    if (hour >= 16 && hour < 19) {
      return {
        title: '☕ Evening High-Tea & Snacks',
        subtitle: 'Snack pairings for a relaxing evening.',
        pairing: ['Cold Coffee', 'French Fries'],
      }
    }
    return {
      title: '🌙 Dinner Delicacies',
      subtitle: 'Savor our top-rated dinner pairings tonight.',
      pairing: ['Chicken Biryani', 'Gulab Jamun'],
    }
  }, [])

  if (!menu) {
    return (
      <main className="grid min-h-screen place-items-center bg-amber-50/70 p-5 text-center dark:bg-slate-950">
        <section className="rounded-3xl bg-card p-8 shadow-xl border border-border max-w-sm w-full dark:bg-slate-900">
          <Utensils className="mx-auto size-12 text-primary animate-pulse" />
          <h1 className="mt-4 text-xl font-black">{error ? 'QR Menu Unavailable' : 'Preparing Menu…'}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {error || 'Syncing live restaurant prices & digital kitchen queue.'}
          </p>
        </section>
      </main>
    )
  }

  // Categories list
  const categories = ['All', ...Array.from(new Set(menu.items.map((item) => item.category || 'Recommended')))]

  // Filtered dishes
  const visibleItems = menu.items.filter((item) => {
    const catMatch = category === 'All' || (item.category || 'Recommended') === category

    // Dietary filter
    const desc = (item.description || '').toLowerCase()
    const isEgg = desc.includes('egg')
    const isVeg = item.is_vegetarian !== false && !isEgg

    const dietaryMatch =
      dietaryFilter === 'all' ||
      (dietaryFilter === 'veg' && isVeg) ||
      (dietaryFilter === 'non_veg' && item.is_vegetarian === false) ||
      (dietaryFilter === 'egg' && isEgg)

    // Badge filter
    const itemPrice = item.price
    const badgeMatch =
      badgeFilter === 'all' ||
      (badgeFilter === 'under100' && itemPrice <= 100) ||
      (badgeFilter === 'popular' && (item.rating || 4.8) >= 4.8) ||
      (badgeFilter === 'special' && (item.description || '').toLowerCase().includes('special'))

    const searchMatch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase())

    return catMatch && dietaryMatch && badgeMatch && searchMatch
  })

  // Selected items & Cart calculations
  const selectedItems = menu.items.filter((item) => cart[item.id])
  const cartItemCount = Object.values(cart).reduce((sum, q) => sum + q, 0)
  const subtotal = selectedItems.reduce((sum, item) => {
    const unitPrice = itemVariants[item.id]?.price || item.price
    return sum + unitPrice * cart[item.id]
  }, 0)
  const tax = Math.round((subtotal - discount) * (menu.restaurant.tax_rate || 0)) / 100
  const total = Math.max(0, subtotal - discount + tax)

  // Active session orders
  const activeOrders = orders.filter(
    (order) => order.payment_status !== 'paid' && !['completed', 'closed'].includes(order.status)
  )
  const billRequested = activeOrders.some((order) => order.bill_requested)

  // Quantity control
  const updateQuantity = (id: string, amount: number) => {
    setCart((prev) => {
      const next = (prev[id] || 0) + amount
      if (next <= 0) {
        const copy = { ...prev }
        delete copy[id]
        return copy
      }
      return { ...prev, [id]: next }
    })
  }

  // Call Waiter Button Action
  const handleCallWaiter = async () => {
    setRequesting(true)
    const { error } = await db.rpc('public_request_restaurant_bill', {
      p_table_token: menu.table.token,
      p_payment_mode: 'waiter_call',
      p_payment_reference: 'Waiter Assistance Needed at Table',
    })
    setRequesting(false)
    if (error) setToastMessage(error.message)
    else setToastMessage('🔔 Waiter alerted! A staff member is heading to your table.')
  }

  // Request Bill Action
  const handleRequestBill = async (mode: 'cash' | 'upi') => {
    setRequesting(true)
    const { error } = await db.rpc('public_request_restaurant_bill', {
      p_table_token: menu.table.token,
      p_payment_mode: mode,
      p_payment_reference: utr || null,
    })
    setRequesting(false)
    if (error) {
      setCouponText(error.message)
    } else {
      setToastMessage(`🧾 Bill requested for ${mode === 'upi' ? 'UPI' : 'Cash'} payment. Staff alerted.`)
      setBillModal(false)
    }
  }

  // Apply Coupon Code
  const applyCoupon = async () => {
    if (!coupon.trim()) return
    const { data, error } = await db.rpc('public_validate_restaurant_coupon', {
      p_table_token: menu.table.token,
      p_code: coupon,
      p_subtotal: subtotal,
    })
    if (error || !data?.valid) {
      setDiscount(0)
      setCouponText(data?.message || error?.message || 'Coupon code is invalid')
      return
    }
    setDiscount(Number(data.discount || 0))
    setCouponText(data.message || 'Coupon code applied!')
  }

  // Place Order
  const handlePlaceOrder = async () => {
    if (!selectedItems.length) return
    const { error } = await db.rpc('create_public_restaurant_order', {
      p_table_token: menu.table.token,
      p_customer_phone: phone,
      p_customer_name: name,
      p_items: selectedItems.map((item) => ({
        id: item.id,
        quantity: cart[item.id],
        notes: itemNotes[item.id] || null,
      })),
      p_notes: generalNotes || null,
      p_coupon_code: coupon || null,
      p_dining_type: dining,
    })

    if (error) {
      setCouponText(error.message)
    } else {
      setCart({})
      setCheckout(false)
      setHistory(true)
      setToastMessage('🎉 Order placed successfully! Kitchen is preparing your dishes.')
    }
  }

  // 1-Click Add Combo to Cart
  const addComboToCart = () => {
    const comboDishes = menu.items.filter((item) =>
      recommendation.pairing.some((p) => item.name.toLowerCase().includes(p.toLowerCase()))
    )
    comboDishes.forEach((item) => {
      setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
    })
    setToastMessage('⚡ Combo items added to your order!')
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-amber-50/60 pb-36 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 relative">
      {/* STICKY TOP HEADER WITH TABLE TAG & SERVICE ACTIONS */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/90 p-4 backdrop-blur-md dark:bg-slate-900/90 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-1.5">
              {menu.restaurant.name}
              <Sparkles className="size-4 text-amber-500" />
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Kitchen Open
              </span>
              <span>·</span>
              <span className="font-extrabold text-foreground">Table {menu.table.number}</span>
            </div>
          </div>

          {/* SERVICE ACTION BUTTONS */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void handleCallWaiter()}
              disabled={requesting}
              className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-100 flex items-center gap-1 shadow-2xs"
              title="Call Waiter to Table"
            >
              <Bell className="size-3.5 text-amber-600 animate-bounce" />
              <span>Call Waiter</span>
            </button>

            <button
              onClick={() => setHistory(true)}
              className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xs dark:bg-slate-800 flex items-center gap-1"
            >
              <Receipt className="size-3.5" />
              <span>Orders</span>
            </button>
          </div>
        </div>

        {/* SEARCH INPUT */}
        <label className="relative mt-3 block">
          <Search className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search food, beverages, desserts…"
            className="w-full rounded-2xl border border-border bg-slate-100/80 py-2 pl-10 pr-4 text-xs font-medium outline-none focus:border-primary dark:bg-slate-800"
          />
        </label>
      </header>

      {/* TOAST NOTIFICATION BANNER */}
      {toastMessage && (
        <div className="mx-4 mt-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs font-bold text-primary flex items-center justify-between shadow-2xs">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="p-1 hover:opacity-70">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* BILL REQUESTED ALERT BANNER */}
      {billRequested && (
        <button
          onClick={() => setBillModal(true)}
          className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-amber-400 bg-amber-500/10 p-3 text-left text-xs font-bold text-amber-900 dark:text-amber-200 shadow-2xs animate-pulse"
        >
          <BellRing className="size-5 text-amber-500" />
          <div>
            <p className="font-extrabold text-sm">Bill Requested!</p>
            <p className="font-medium text-[11px]">Staff is processing your table settlement.</p>
          </div>
        </button>
      )}

      {/* SMART WEATHER & TIME-BASED RECOMMENDATION CARD */}
      <section className="mx-4 mt-4 rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/50 p-4 shadow-xs dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <CloudSun className="size-4" />
            {recommendation.title}
          </span>
          <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Smart Pairing
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 font-medium">{recommendation.subtitle}</p>

        <div className="mt-3 flex items-center justify-between border-t border-amber-200/60 pt-3 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {recommendation.pairing.join(' + ')}
          </div>

          <button
            onClick={addComboToCart}
            className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow-xs hover:bg-amber-400 flex items-center gap-1"
          >
            <Zap className="size-3.5" />
            Add Combo +
          </button>
        </div>
      </section>

      {/* DIETARY SEGMENTED SWITCH & QUICK FILTER BADGES */}
      <section className="px-4 mt-4 space-y-2.5">
        {/* DIETARY SEGMENTED CONTROL */}
        <div className="flex rounded-2xl border border-border bg-card p-1 shadow-2xs text-xs font-bold dark:bg-slate-900">
          <button
            onClick={() => setDietaryFilter('all')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              dietaryFilter === 'all' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground'
            }`}
          >
            All Dishes
          </button>
          <button
            onClick={() => setDietaryFilter('veg')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              dietaryFilter === 'veg' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-muted-foreground'
            }`}
          >
            🟢 Pure Veg
          </button>
          <button
            onClick={() => setDietaryFilter('non_veg')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              dietaryFilter === 'non_veg' ? 'bg-red-600 text-white shadow-2xs' : 'text-muted-foreground'
            }`}
          >
            🔴 Non-Veg
          </button>
          <button
            onClick={() => setDietaryFilter('egg')}
            className={`flex-1 py-1.5 rounded-xl transition-all ${
              dietaryFilter === 'egg' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'text-muted-foreground'
            }`}
          >
            🟡 Egg
          </button>
        </div>

        {/* QUICK BADGES */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setBadgeFilter(badgeFilter === 'popular' ? 'all' : 'popular')}
            className={`whitespace-nowrap rounded-full px-3 py-1 font-extrabold transition-all flex items-center gap-1 ${
              badgeFilter === 'popular'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-card border border-border text-foreground hover:bg-secondary'
            }`}
          >
            <Flame className="size-3 text-orange-500" /> Bestsellers
          </button>

          <button
            onClick={() => setBadgeFilter(badgeFilter === 'under100' ? 'all' : 'under100')}
            className={`whitespace-nowrap rounded-full px-3 py-1 font-extrabold transition-all flex items-center gap-1 ${
              badgeFilter === 'under100'
                ? 'bg-emerald-600 text-white'
                : 'bg-card border border-border text-foreground hover:bg-secondary'
            }`}
          >
            <Zap className="size-3 text-emerald-400" /> Under ₹100
          </button>

          <button
            onClick={() => setBadgeFilter(badgeFilter === 'special' ? 'all' : 'special')}
            className={`whitespace-nowrap rounded-full px-3 py-1 font-extrabold transition-all flex items-center gap-1 ${
              badgeFilter === 'special'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground hover:bg-secondary'
            }`}
          >
            <Star className="size-3 text-amber-400" /> Chef's Special
          </button>
        </div>

        {/* CATEGORY NAV STRIP */}
        <div className="flex gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                category === cat ? 'bg-slate-900 text-white shadow-2xs dark:bg-slate-800' : 'bg-card border border-border text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* MODERN FOOD CARDS GRID */}
      <section className="px-4 mt-4 space-y-3.5">
        {visibleItems.map((item) => {
          const desc = (item.description || '').toLowerCase()
          const isEgg = desc.includes('egg')
          const isVeg = item.is_vegetarian !== false && !isEgg

          return (
            <article
              key={item.id}
              className="group flex gap-3.5 rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800"
            >
              {/* IMAGE THUMBNAIL WITH ZOOM TRIGGER */}
              <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl border border-border/60">
                <img
                  src={item.image_url || fallbackFood}
                  onError={(e) => {
                    e.currentTarget.src = fallbackFood
                  }}
                  alt={item.name}
                  onClick={() => setZoomImage(item.image_url || fallbackFood)}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs flex items-center gap-0.5">
                  <Star className="size-2.5 text-amber-400 fill-amber-400" />
                  {item.rating || 4.8}
                </span>
              </div>

              {/* DISH INFORMATION */}
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-extrabold text-foreground text-sm tracking-tight line-clamp-1">{item.name}</h3>

                    {/* FSSAI DIETARY BADGE */}
                    {isVeg ? (
                      <span className="inline-grid size-4 shrink-0 place-items-center rounded-xs border border-emerald-600 p-0.5">
                        <span className="size-2 rounded-full bg-emerald-600" />
                      </span>
                    ) : isEgg ? (
                      <span className="inline-grid size-4 shrink-0 place-items-center rounded-xs border border-amber-500 p-0.5">
                        <span className="size-2 rounded-full bg-amber-500" />
                      </span>
                    ) : (
                      <span className="inline-grid size-4 shrink-0 place-items-center rounded-xs border border-red-600 p-0.5">
                        <span className="size-2 rounded-full bg-red-600" />
                      </span>
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                    {item.description || 'Delicately crafted dish prepared fresh in our kitchen.'}
                  </p>

                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                    <span className="flex items-center gap-0.5">
                      <Clock className="size-3 text-primary" /> 12-15 mins
                    </span>
                  </div>
                </div>

                {/* PRICE & ADD TO CART STEPPER */}
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
                  <span className="text-base font-extrabold text-foreground">{money(item.price)}</span>

                  {cart[item.id] ? (
                    <div className="flex items-center gap-2 rounded-xl bg-primary px-2 py-1 text-xs font-bold text-primary-foreground shadow-2xs">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 hover:opacity-80">
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-4 text-center font-black">{cart[item.id]}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 hover:opacity-80">
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="rounded-xl border border-primary bg-primary/10 px-3.5 py-1.5 text-xs font-extrabold text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                    >
                      ADD +
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}

        {!visibleItems.length && (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-border bg-card dark:bg-slate-900">
            <Utensils className="size-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-bold">No dishes match your filters</h3>
            <p className="mt-1 text-xs text-muted-foreground">Try clearing dietary or category selection.</p>
            <button
              onClick={() => {
                setCategory('All')
                setDietaryFilter('all')
                setBadgeFilter('all')
                setSearch('')
              }}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </section>

      {/* FLOATING BOTTOM CART ACTION BAR */}
      {(selectedItems.length > 0 || activeOrders.length > 0) && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md gap-2">
          <button
            onClick={() => setBillModal(true)}
            className="flex-1 rounded-2xl border border-amber-400 bg-amber-500/10 py-3 text-xs font-extrabold text-amber-900 dark:text-amber-200 shadow-xl backdrop-blur-md hover:bg-amber-500/20 flex items-center justify-center gap-1.5"
          >
            <DollarSign className="size-4 text-amber-600" />
            Request Bill / Pay
          </button>

          {selectedItems.length > 0 && (
            <button
              onClick={() => setCheckout(true)}
              className="flex-1 rounded-2xl bg-slate-900 py-3 px-4 text-xs font-extrabold text-white shadow-2xl dark:bg-slate-800 hover:bg-slate-800 flex items-center justify-between animate-pulse"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-slate-950 font-black">
                  {cartItemCount}
                </span>
                <span>View Cart</span>
              </div>
              <span className="text-amber-400">{money(total)} →</span>
            </button>
          )}
        </div>
      )}

      {/* IMAGE ZOOM PREVIEW MODAL */}
      {zoomImage && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative max-w-sm w-full">
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-10 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
            >
              <X className="size-5" />
            </button>
            <img src={zoomImage} alt="Zoom Preview" className="w-full rounded-3xl object-cover shadow-2xl" />
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {checkout && (
        <CheckoutModal
          close={() => setCheckout(false)}
          dining={dining}
          setDining={setDining}
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          generalNotes={generalNotes}
          setGeneralNotes={setGeneralNotes}
          coupon={coupon}
          setCoupon={setCoupon}
          couponText={couponText}
          applyCoupon={applyCoupon}
          subtotal={subtotal}
          discount={discount}
          tax={tax}
          total={total}
          taxRate={menu.restaurant.tax_rate || 0}
          placeOrder={handlePlaceOrder}
          selectedItems={selectedItems}
          cart={cart}
          updateQuantity={updateQuantity}
        />
      )}

      {/* BILL REQUEST MODAL */}
      {billModal && (
        <BillRequestModal
          close={() => setBillModal(false)}
          menu={menu}
          utr={utr}
          setUtr={setUtr}
          requesting={requesting}
          requestBill={handleRequestBill}
        />
      )}

      {/* SESSION ORDERS & LIVE TRACKING MODAL */}
      {history && <SessionHistoryModal orders={orders} menu={menu} close={() => setHistory(false)} />}
    </main>
  )
}

function CheckoutModal(props: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs">
      <section className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xl font-extrabold">Confirm Order</h2>
          <button onClick={props.close} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        {/* DINING TYPE */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => props.setDining('dine_in')}
            className={`rounded-2xl p-3 text-xs font-bold transition-all ${
              props.dining === 'dine_in'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'border border-border bg-background text-foreground'
            }`}
          >
            🍽️ Dine-In
          </button>

          <button
            type="button"
            onClick={() => props.setDining('takeaway')}
            className={`rounded-2xl p-3 text-xs font-bold transition-all ${
              props.dining === 'takeaway'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'border border-border bg-background text-foreground'
            }`}
          >
            🛍️ Takeaway
          </button>
        </div>

        {/* CART ITEMS SUMMARY */}
        <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border bg-muted/30 p-3 max-h-36 overflow-y-auto">
          {props.selectedItems.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between py-2 text-xs">
              <span className="font-bold text-foreground">
                {item.name} × {props.cart[item.id]}
              </span>
              <span className="font-black text-primary">{money(item.price * props.cart[item.id])}</span>
            </div>
          ))}
        </div>

        {/* GUEST INFO */}
        <div className="mt-3 space-y-2">
          <input
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="Guest Name (optional)"
            className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
          />

          <input
            value={props.phone}
            onChange={(e) => props.setPhone(e.target.value)}
            placeholder="Phone Number for Live SMS Updates"
            className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
          />

          <textarea
            rows={2}
            value={props.generalNotes}
            onChange={(e) => props.setGeneralNotes(e.target.value)}
            placeholder="Cooking notes: e.g. Extra spicy, less sugar..."
            className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
          />
        </div>

        {/* COUPON SECTION */}
        <div className="mt-3 rounded-2xl border border-border bg-amber-500/10 p-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
            <span className="flex items-center gap-1">
              <Tag className="size-3.5 text-amber-500" /> Apply Promo Code
            </span>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={props.coupon}
              onChange={(e) => props.setCoupon(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background p-2 text-xs font-bold uppercase outline-none"
            />
            <button
              onClick={props.applyCoupon}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs dark:bg-slate-800"
            >
              Apply
            </button>
          </div>
          {props.couponText && <small className="block pt-1.5 text-xs font-bold text-primary">{props.couponText}</small>}
        </div>

        {/* BILL BREAKDOWN */}
        <div className="mt-4 space-y-1.5 text-xs border-t border-border pt-3">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{money(props.subtotal)}</span>
          </div>
          {props.discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Coupon Discount</span>
              <span>-{money(props.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>GST ({props.taxRate}%)</span>
            <span>{money(props.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-black text-foreground">
            <span>Grand Total</span>
            <span>{money(props.total)}</span>
          </div>
        </div>

        <button
          onClick={props.placeOrder}
          className="mt-5 w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground shadow-lg hover:opacity-90 flex items-center justify-center gap-2"
        >
          <ShoppingBag className="size-4" />
          <span>Place Order · {money(props.total)}</span>
        </button>
      </section>
    </div>
  )
}

function BillRequestModal({
  close,
  menu,
  utr,
  setUtr,
  requesting,
  requestBill,
}: {
  close: () => void
  menu: Menu
  utr: string
  setUtr: (value: string) => void
  requesting: boolean
  requestBill: (mode: 'cash' | 'upi') => void
}) {
  const [upi, setUpi] = useState(false)

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-xs">
      <section className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xl font-extrabold">Request Bill / Pay</h2>
          <button onClick={close} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">Choose your payment mode to alert the cashier at Table {menu.table.number}.</p>

        <button
          disabled={requesting}
          onClick={() => requestBill('cash')}
          className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-left hover:bg-emerald-500/20"
        >
          <DollarSign className="size-6 text-emerald-600" />
          <div>
            <b className="font-extrabold text-sm text-foreground">Pay via Cash</b>
            <span className="block text-[11px] text-muted-foreground">Staff will bring printed thermal receipt to table.</span>
          </div>
        </button>

        <button
          onClick={() => setUpi((v) => !v)}
          className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left hover:bg-primary/20"
        >
          <QrCode className="size-6 text-primary" />
          <div>
            <b className="font-extrabold text-sm text-foreground">Pay via UPI QR</b>
            <span className="block text-[11px] text-muted-foreground">Scan UPI QR code and enter payment UTR.</span>
          </div>
        </button>

        {upi && (
          <div className="mt-3 rounded-2xl border border-border p-4 text-center bg-muted/30 space-y-3">
            {menu.restaurant.merchant_upi_qr_url ? (
              <img
                src={menu.restaurant.merchant_upi_qr_url}
                alt="UPI QR"
                className="mx-auto size-48 rounded-xl object-contain border bg-white p-2"
              />
            ) : (
              <p className="rounded-xl bg-amber-500/10 p-3 text-xs font-bold text-amber-900 dark:text-amber-200">
                UPI QR code will be presented by staff.
              </p>
            )}

            <p className="text-xs font-bold text-foreground">UPI ID: {menu.restaurant.merchant_upi_id || 'Pay at Counter'}</p>

            <input
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="Enter UTR / Ref Number (optional)"
              className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
            />

            <button
              disabled={requesting}
              onClick={() => requestBill('upi')}
              className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              {requesting ? 'Notifying Staff…' : 'I Have Completed UPI Payment'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function SessionHistoryModal({ orders, menu, close }: { orders: Order[]; menu: Menu; close: () => void }) {
  const totalAmount = orders.reduce((sum, order) => sum + Number(order.total), 0)

  const getStageBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Order Received 🟡</span>
      case 'accepted':
      case 'preparing':
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Kitchen Preparing 🔵</span>
      case 'ready':
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Ready to Serve 🟢</span>
      case 'served':
      case 'completed':
        return <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">Served 🟣</span>
      default:
        return <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{status}</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-4 backdrop-blur-xs">
      <section className="ml-auto min-h-full w-full max-w-md bg-card p-6 rounded-3xl shadow-2xl dark:bg-slate-900 border border-border relative">
        <button onClick={close} className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-secondary">
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
          <Receipt className="size-4" />
          Live Table Orders
        </div>
        <h2 className="text-xl font-extrabold mt-1">Table {menu.table.number} History</h2>

        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-border bg-background p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <b className="font-extrabold text-sm text-foreground">Order #{order.order_number}</b>
                {getStageBadge(order.status)}
              </div>

              {order.bill_requested && (
                <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-2 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  ⚠️ Bill requested ({order.requested_payment_mode?.toUpperCase() || 'CASH'})
                </div>
              )}

              <div className="space-y-1 text-muted-foreground border-t border-border/60 pt-2">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    {item.line_total && <span>{money(item.line_total)}</span>}
                  </div>
                ))}
              </div>

              <div className="flex justify-between border-t border-border/60 pt-2 font-extrabold text-foreground text-sm">
                <span>Order Total:</span>
                <span>{money(order.total)}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex justify-between text-base font-black text-foreground">
            <span>Session Grand Total</span>
            <span>{money(totalAmount)}</span>
          </div>

          <button
            onClick={() =>
              printReceipt({
                restaurant: menu.restaurant.name,
                table: menu.table.number,
                orders: orders as ReceiptOrder[],
                discount: orders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0),
                tax: orders.reduce((sum, order) => sum + Number(order.tax_amount || 0), 0),
              })
            }
            className="mt-4 w-full rounded-2xl border border-border py-3 text-xs font-bold hover:bg-secondary flex items-center justify-center gap-1.5"
          >
            <Printer className="size-4 text-primary" />
            Print Receipt / PDF
          </button>
        </div>
      </section>
    </div>
  )
}
