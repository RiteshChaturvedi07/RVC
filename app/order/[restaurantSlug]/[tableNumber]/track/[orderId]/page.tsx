'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  DollarSign,
  Flame,
  Plus,
  Receipt,
  Sparkles,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OrderItem = {
  name: string
  quantity: number
  unit_price?: number
  line_total?: number
  notes?: string | null
  is_vegetarian?: boolean | null
}

type OrderStatusData = {
  id: string
  order_number: number
  status: string
  payment_status: string
  payment_method?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  table_number: string
  table_token?: string
  tenant_slug?: string
  total: number
  subtotal?: number
  tax_amount?: number
  discount_amount?: number
  bill_requested?: boolean
  created_at: string
  restaurant: {
    name: string
    currency?: string
    merchant_upi_id?: string | null
    merchant_upi_qr_url?: string | null
  }
  items: OrderItem[]
}

type SessionOrder = {
  id: string
  order_number: number
  status: string
  payment_status: string
  total: number
  items: OrderItem[]
}

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// Robust helper to trigger redirect without UI freeze
const triggerFeedbackRedirect = (orderId: string, restaurantSlug: string, tableNumber: string) => {
  const targetUrl = `/order/${restaurantSlug}/${tableNumber}/feedback?orderId=${orderId}`
  if (typeof window !== 'undefined') {
    window.location.href = targetUrl
  }
}

export default function OrderTrackerPage() {
  const params = useParams<{ restaurantSlug: string; tableNumber: string; orderId: string }>()
  const router = useRouter()
  const db = useMemo(() => createClient(), [])

  const [order, setOrder] = useState<OrderStatusData | null>(null)
  const [sessionOrders, setSessionOrders] = useState<SessionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [requestingWaiter, setRequestingWaiter] = useState(false)
  const [requestingBill, setRequestingBill] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [billSuccessToast, setBillSuccessToast] = useState(false)
  const [settledCelebration, setSettledCelebration] = useState(false)

  const { restaurantSlug, tableNumber, orderId } = params

  // 1. Fetch main order status
  const fetchOrderStatus = async () => {
    try {
      const { data, error: rpcErr } = await db.rpc('public_restaurant_order_status', {
        p_order_id: orderId,
      })

      if (rpcErr || !data) {
        const { data: directOrder, error: directErr } = await db
          .from('restaurant_orders')
          .select('*, restaurant_tables(table_number, public_token), tenants(name, slug), restaurant_order_items(*)')
          .eq('id', orderId)
          .single()

        if (directErr || !directOrder) {
          throw new Error(rpcErr?.message || directErr?.message || 'Unable to load order details.')
        }

        const formatted: OrderStatusData = {
          id: directOrder.id,
          order_number: directOrder.order_number,
          status: directOrder.status,
          payment_status: directOrder.payment_status,
          payment_method: directOrder.payment_method,
          customer_name: directOrder.customer_name,
          customer_phone: directOrder.customer_phone,
          table_number: directOrder.restaurant_tables?.table_number || tableNumber,
          table_token: directOrder.restaurant_tables?.public_token,
          tenant_slug: directOrder.tenants?.slug || restaurantSlug,
          total: directOrder.total,
          subtotal: directOrder.subtotal,
          tax_amount: directOrder.tax_amount,
          discount_amount: directOrder.discount_amount,
          bill_requested: directOrder.bill_requested,
          created_at: directOrder.created_at,
          restaurant: {
            name: directOrder.tenants?.name || 'Restaurant',
          },
          items: (directOrder.restaurant_order_items || []).map((i: any) => ({
            name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: i.line_total,
            notes: i.notes,
          })),
        }
        setOrder(formatted)
        if (formatted.table_token) {
          void fetchSessionOrders(formatted.table_token)
        }
      } else {
        const parsed = data as OrderStatusData
        setOrder(parsed)
        if (parsed.table_token) {
          void fetchSessionOrders(parsed.table_token)
        }
      }
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching order tracker.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch all live session orders for consolidated table bill
  const fetchSessionOrders = async (tableToken: string) => {
    try {
      const { data } = await db.rpc('public_restaurant_table_session_orders', { p_table_token: tableToken })
      if (data && Array.isArray(data)) {
        setSessionOrders(data as SessionOrder[])
      }
    } catch {
      // Fallback stays silent
    }
  }

  // Handle Realtime updates
  const handleStatusUpdate = (updatedRow: any) => {
    setOrder((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        status: updatedRow.status ?? prev.status,
        payment_status: updatedRow.payment_status ?? prev.payment_status,
        payment_method: updatedRow.payment_method ?? prev.payment_method,
        total: updatedRow.total ?? prev.total,
        bill_requested: updatedRow.bill_requested ?? prev.bill_requested,
      }
    })
  }

  // Subscriptions & Polling
  useEffect(() => {
    if (!orderId) return
    void fetchOrderStatus()

    const channel = db
      .channel(`order-tracker-live-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
        },
        (payload: any) => {
          if (payload.new) {
            if (payload.new.id === orderId) {
              handleStatusUpdate(payload.new)
            }
            void fetchOrderStatus()
          }
        }
      )
      .subscribe()

    const pollInterval = setInterval(() => {
      void fetchOrderStatus()
    }, 3000)

    return () => {
      void db.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [orderId, db])

  // Check for Settle & Trigger Smooth Redirect to Feedback page
  useEffect(() => {
    if (!order && sessionOrders.length === 0) return

    const isOrderSettled = order?.status === 'completed' || order?.payment_status === 'paid'
    const isSessionSettled =
      sessionOrders.length > 0 &&
      sessionOrders.every((so) => so.status === 'completed' || so.payment_status === 'paid')

    if (isOrderSettled || isSessionSettled) {
      if (!settledCelebration) {
        setSettledCelebration(true)
      }

      const timer = setTimeout(() => {
        triggerFeedbackRedirect(orderId, restaurantSlug, tableNumber)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [order, sessionOrders, settledCelebration, orderId, restaurantSlug, tableNumber])

  // Call Waiter Action
  const handleCallWaiter = async () => {
    if (requestingWaiter) return
    setRequestingWaiter(true)
    try {
      if (order?.table_token) {
        await db.rpc('public_call_restaurant_waiter', { p_table_token: order.table_token })
      }
      setToastMessage('🔔 Waiter alerted! A staff member is heading to your table.')
    } catch {
      setToastMessage('🔔 Waiter alerted for your table!')
    } finally {
      setRequestingWaiter(false)
    }
  }

  // Request Bill Action
  const handleRequestBill = async (mode: 'cash' | 'upi') => {
    if (requestingBill || !order?.table_token) return
    setRequestingBill(true)
    try {
      const { error } = await db.rpc('public_request_restaurant_bill', {
        p_table_token: order.table_token,
        p_payment_mode: mode,
      })
      if (error) {
        setToastMessage(error.message)
      } else {
        setBillModal(false)
        setBillSuccessToast(true)
        setOrder((prev) => (prev ? { ...prev, bill_requested: true } : prev))
      }
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : 'Error requesting bill')
    } finally {
      setRequestingBill(false)
    }
  }

  // Consolidated items & total across table session
  const consolidated = useMemo(() => {
    if (sessionOrders.length > 0) {
      const itemsMap: Record<string, OrderItem> = {}
      let grandTotal = 0

      sessionOrders.forEach((so) => {
        grandTotal += Number(so.total || 0)
        ;(so.items || []).forEach((item) => {
          const key = item.name.toLowerCase()
          if (itemsMap[key]) {
            itemsMap[key].quantity += item.quantity
            itemsMap[key].line_total = (itemsMap[key].line_total || 0) + (item.line_total || (item.unit_price || 0) * item.quantity)
          } else {
            itemsMap[key] = { ...item }
          }
        })
      })

      return {
        items: Object.values(itemsMap),
        total: grandTotal > 0 ? grandTotal : order?.total || 0,
        roundsCount: sessionOrders.length,
      }
    }

    return {
      items: order?.items || [],
      total: order?.total || 0,
      roundsCount: 1,
    }
  }, [sessionOrders, order])

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-amber-50/70 p-5 text-center dark:bg-slate-950 font-sans">
        <section className="rounded-3xl bg-card p-8 shadow-xl border border-border max-w-sm w-full dark:bg-slate-900 space-y-4">
          <ChefHat className="mx-auto size-12 text-orange-500 animate-pulse" />
          <h1 className="text-xl font-black">Connecting Live Tracker…</h1>
          <p className="text-xs text-muted-foreground">Syncing kitchen status & real-time updates.</p>
        </section>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="grid min-h-screen place-items-center bg-amber-50/70 p-5 text-center dark:bg-slate-950 font-sans">
        <section className="rounded-3xl bg-card p-8 shadow-xl border border-border max-w-sm w-full dark:bg-slate-900 space-y-4">
          <ChefHat className="mx-auto size-12 text-destructive" />
          <h1 className="text-xl font-black">Order Tracker Error</h1>
          <p className="text-xs text-muted-foreground">{error || 'Order not found.'}</p>
          <button
            onClick={() => router.push(`/order/${restaurantSlug}/${tableNumber}`)}
            className="w-full rounded-2xl bg-orange-500 py-3 text-xs font-extrabold text-white shadow-md hover:bg-orange-600"
          >
            Back to Menu
          </button>
        </section>
      </main>
    )
  }

  // Stepper calculations
  const steps = [
    { key: 'received', label: 'Placed', icon: Clock },
    { key: 'preparing', label: 'Cooking', icon: ChefHat },
    { key: 'ready', label: 'Ready', icon: Sparkles },
    { key: 'served', label: 'Served', icon: UtensilsCrossed },
    { key: 'completed', label: 'Settled', icon: CheckCircle2 },
  ]

  const getStepIndex = () => {
    const s = (order.status || '').toLowerCase()
    const p = (order.payment_status || '').toLowerCase()

    if (s === 'completed' || p === 'paid') return 4
    if (s === 'served') return 3
    if (s === 'ready') return 2
    if (s === 'preparing' || s === 'accepted') return 1
    return 0
  }

  const currentStepIndex = getStepIndex()

  // Hero Card Gradient & Visual Style based on step
  const getHeroTheme = () => {
    if (currentStepIndex === 4) {
      return {
        bg: 'from-purple-500/10 via-indigo-500/5 to-purple-500/10 border-purple-200 dark:from-purple-950/40 dark:border-purple-800',
        badgeBg: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
        iconBg: 'bg-purple-600 text-white shadow-purple-500/20',
        title: 'Bill Settled & Completed',
        subtitle: 'Thank you for dining with us! Hope to see you soon.',
        Icon: CheckCircle2,
      }
    }
    if (currentStepIndex === 3) {
      return {
        bg: 'from-blue-500/15 via-indigo-500/10 to-teal-500/10 border-blue-200 dark:from-blue-950/40 dark:border-blue-800',
        badgeBg: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
        iconBg: 'bg-blue-600 text-white shadow-blue-500/20',
        title: 'Food Served to Table',
        subtitle: 'Hot dishes delivered to your table. Enjoy your meal!',
        Icon: UtensilsCrossed,
      }
    }
    if (currentStepIndex === 2) {
      return {
        bg: 'from-emerald-500/15 via-green-500/10 to-teal-500/10 border-emerald-200 dark:from-emerald-950/40 dark:border-emerald-800',
        badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
        iconBg: 'bg-emerald-600 text-white shadow-emerald-500/20',
        title: 'Dishes Fresh & Ready!',
        subtitle: 'Chef has prepared your order! Server is bringing it to your table now.',
        Icon: Sparkles,
      }
    }
    if (currentStepIndex === 1) {
      return {
        bg: 'from-orange-500/20 via-red-500/10 to-amber-500/10 border-orange-200 dark:from-orange-950/40 dark:border-orange-800',
        badgeBg: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
        iconBg: 'bg-orange-500 text-white shadow-orange-500/20',
        title: 'Preparing Fresh Food',
        subtitle: 'Chef is preparing your order with fresh ingredients now.',
        Icon: Flame,
      }
    }
    return {
      bg: 'from-amber-50 to-orange-50 border-orange-100 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-900/40',
      badgeBg: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
      iconBg: 'bg-amber-500 text-white shadow-amber-500/20',
      title: 'Order Placed & Confirmed',
      subtitle: 'Kitchen has received your order details.',
      Icon: Clock,
    }
  }

  const heroTheme = getHeroTheme()

  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50/60 pb-36 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 relative">
      {/* FULL-SCREEN SETTLEMENT CELEBRATION OVERLAY */}
      <AnimatePresence>
        {settledCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/90 backdrop-blur-md p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="rounded-3xl bg-card p-8 shadow-2xl border border-emerald-500/30 max-w-xs w-full dark:bg-slate-900 space-y-4"
            >
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40">
                <Sparkles className="size-10 animate-spin" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground">Bill Settled! 🎉</h2>
                <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Thank you for dining with us at {order.restaurant.name}.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground animate-pulse">Redirecting to quick feedback…</p>
              <button
                type="button"
                onClick={() => triggerFeedbackRedirect(orderId, restaurantSlug, tableNumber)}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Provide Feedback Now</span>
                <span>→</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BRAND BAR */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/90 p-4 backdrop-blur-md dark:bg-slate-900/90 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => router.push(`/order/${restaurantSlug}/${tableNumber}`)}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-secondary transition-all flex items-center gap-1.5"
            title="Back to Menu"
          >
            <ArrowLeft className="size-3.5" />
            <span>Menu</span>
          </button>

          <div className="text-center min-w-0">
            <h1 className="text-base font-black tracking-tight flex items-center justify-center gap-1 truncate">
              {order.restaurant.name}
              <Sparkles className="size-3.5 text-amber-500 shrink-0" />
            </h1>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="font-extrabold text-foreground">Table {order.table_number || tableNumber}</span>
              <span>·</span>
              <span className="text-primary font-bold">#{order.order_number}</span>
            </div>
          </div>

          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </header>

      {/* TOAST & BILL FEEDBACK NOTIFICATION */}
      <div className="mx-4 mt-3 space-y-2">
        {toastMessage && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs font-bold text-primary flex items-center justify-between shadow-2xs">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage('')} className="p-1 hover:opacity-70">
              <X className="size-4" />
            </button>
          </div>
        )}

        {billSuccessToast && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-start gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-extrabold">Bill Requested Successfully!</p>
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 mt-0.5">
                Staff alerted. Server is bringing the bill to Table {order.table_number || tableNumber}.
              </p>
            </div>
            <button onClick={() => setBillSuccessToast(false)} className="p-0.5 hover:opacity-70">
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* HERO ANIMATED STATUS CARD (SWIGGY / DOMINO'S LOOK) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 bg-gradient-to-br ${heroTheme.bg} border shadow-sm relative overflow-hidden`}
        >
          <div className="flex justify-between items-center mb-4">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${heroTheme.badgeBg}`}>
              Table {order.table_number || tableNumber} • Order #{order.order_number}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-full border border-emerald-500/30 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Kitchen Live
            </span>
          </div>

          <div className="flex items-center gap-4 my-2">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: currentStepIndex === 1 ? 1.5 : 3 }}
              className={`h-16 w-16 ${heroTheme.iconBg} rounded-2xl flex items-center justify-center shadow-md shrink-0`}
            >
              <heroTheme.Icon className="h-8 w-8" />
            </motion.div>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{heroTheme.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-0.5">{heroTheme.subtitle}</p>
            </div>
          </div>

          {/* STEPPER DOTS & PROGRESS LINE */}
          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 flex justify-between relative">
            {steps.map((step, idx) => {
              const Icon = step.icon
              const isCompleted = idx <= currentStepIndex
              const isCurrent = idx === currentStepIndex
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 z-10">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                    } ${isCurrent ? 'ring-4 ring-orange-200 dark:ring-orange-950 scale-110' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      isCurrent
                        ? 'text-orange-600 dark:text-orange-400 font-bold'
                        : isCompleted
                        ? 'text-slate-800 dark:text-slate-200 font-semibold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* CONSOLIDATED TABLE BILL & DISHES SUMMARY */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
              <Receipt className="size-4 text-orange-500" />
              Consolidated Table Bill
            </h4>
            {consolidated.roundsCount > 1 && (
              <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900 px-2 py-0.5 rounded-full">
                {consolidated.roundsCount} Ordering Rounds
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {consolidated.items.map((item, i) => {
              const isVeg = item.is_vegetarian !== false
              return (
                <div key={i} className="flex justify-between items-center text-xs py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Food type indicator dot */}
                    {isVeg ? (
                      <span className="inline-grid size-3.5 shrink-0 place-items-center rounded-xs border border-emerald-600 p-0.5" title="Veg">
                        <span className="size-1.5 rounded-full bg-emerald-600" />
                      </span>
                    ) : (
                      <span className="inline-grid size-3.5 shrink-0 place-items-center rounded-xs border border-red-600 p-0.5" title="Non-Veg">
                        <span className="size-1.5 rounded-full bg-red-600" />
                      </span>
                    )}
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate">
                      {item.name} <span className="text-slate-400 font-bold ml-1">× {item.quantity}</span>
                    </span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                    {money(item.line_total || (item.unit_price || 0) * item.quantity)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* GRAND TOTAL PRICE BANNER */}
          <div className="pt-3 flex justify-between items-center font-black text-base border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-700 dark:text-slate-300">Grand Total</span>
            <span className="text-orange-600 dark:text-orange-400 text-lg">{money(consolidated.total)}</span>
          </div>
        </div>

        {/* DUAL HELPER BUTTONS */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCallWaiter}
            disabled={requestingWaiter}
            className="py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs disabled:opacity-50"
          >
            <Bell className="h-4 w-4 text-amber-500 animate-bounce" />
            <span>Call Waiter</span>
          </button>

          <button
            onClick={() => router.push(`/order/${restaurantSlug}/${tableNumber}`)}
            className="py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs"
          >
            <Plus className="h-4 w-4 text-orange-500" />
            <span>Add Dishes</span>
          </button>
        </div>

        {/* PRIMARY "REQUEST BILL / PAY" FULL-WIDTH BUTTON */}
        <button
          onClick={() => setBillModal(true)}
          disabled={requestingBill || order.bill_requested}
          className={`w-full py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            order.bill_requested
              ? 'bg-emerald-600 text-white opacity-90 cursor-default'
              : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 shadow-slate-900/10'
          }`}
        >
          {order.bill_requested ? (
            <>
              <Check className="h-5 w-5 text-white" />
              <span>Bill Requested (₹{consolidated.total})</span>
            </>
          ) : (
            <>
              <Receipt className="h-5 w-5 text-amber-400" />
              <span>Request Bill • {money(consolidated.total)}</span>
            </>
          )}
        </button>
      </div>

      {/* BILL PAYMENT MODE MODAL */}
      {billModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black flex items-center gap-2">
                <CreditCard className="size-5 text-orange-500" />
                Select Payment Mode
              </h3>
              <button onClick={() => setBillModal(false)} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Choose how you would like to settle your table bill of <b className="text-slate-900 dark:text-slate-100">{money(consolidated.total)}</b>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void handleRequestBill('cash')}
                disabled={requestingBill}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all text-center"
              >
                <DollarSign className="size-8 text-emerald-600" />
                <span className="text-xs font-extrabold">Pay Cash</span>
                <span className="text-[10px] text-slate-400 font-medium">Pay staff at table</span>
              </button>

              <button
                onClick={() => void handleRequestBill('upi')}
                disabled={requestingBill}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all text-center"
              >
                <CreditCard className="size-8 text-orange-500" />
                <span className="text-xs font-extrabold">Pay UPI / QR</span>
                <span className="text-[10px] text-slate-400 font-medium">Scan merchant UPI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
