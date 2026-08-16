'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Flame,
  Grid,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'
import { AddTableButton } from '@/components/restaurant/add-table-button'
import { KOTPrintModal, CustomerBillPrintModal } from '@/components/restaurant/kot-receipt-modal'
import { KOTData, CustomerBillData } from '@/lib/print-engine'

type OrderItem = {
  id?: string
  item_name: string
  quantity: number
  notes?: string | null
  unit_price?: number
  line_total?: number
}

type Order = {
  id: string
  order_number: number
  status: string
  total: number
  subtotal?: number
  tax_amount?: number
  customer_name?: string | null
  customer_phone?: string | null
  notes?: string | null
  bill_requested?: boolean
  bill_requested_at?: string | null
  requested_payment_mode?: string | null
  payment_status: string
  payment_method: string | null
  created_at: string
  table_id?: string
  restaurant_tables: { id?: string; table_number: string } | null
  restaurant_order_items: OrderItem[]
}

type Table = {
  id: string
  table_number: string
  display_name?: string | null
  seats?: number | null
  status: string
  public_token?: string
}

const money = (value: number) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const elapsed = (value: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  return mins < 1 ? 'Just now' : `${mins} min ago`
}

/**
 * Normalizes table number display format across all badges:
 * e.g., "2" -> "T-02", "12" -> "T-12", "A-01" -> "A-01"
 */
export function formatTableBadge(num: string | null | undefined): string {
  if (!num) return 'T-01'
  const trimmed = num.trim()
  if (/^\d+$/.test(trimmed)) {
    return `T-${trimmed.padStart(2, '0')}`
  }
  return trimmed
}

// Order incoming chime (D5 -> A5)
function playAudioChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio Context not allowed until user interaction
  }
}

// Urgent Bill Alert Chime (E5 -> B5 double chime)
function playBillAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
    osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.15) // B5
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // Audio Context muted until interaction
  }
}

export default function RestaurantOverview() {
  const [data, setData] = useState<{
    orders: Order[]
    tables: Table[]
    settings: any
    yesterday: number
    slug: string
  } | null>(null)
  const [error, setError] = useState('')
  const [audioMuted, setAudioMuted] = useState(false)
  const [kotModalData, setKotModalData] = useState<KOTData | null>(null)
  const [billModalData, setBillModalData] = useState<CustomerBillData | null>(null)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedQrTable, setSelectedQrTable] = useState<Table | null>(null)
  const previousOrderCountRef = useRef<number | null>(null)
  const previousBillRequestCountRef = useRef<number | null>(null)

  useEffect(() => {
    const savedAudio = localStorage.getItem('rvc-audio-muted')
    if (savedAudio !== null) {
      setAudioMuted(savedAudio === 'true')
    }
  }, [])

  const toggleAudioMute = () => {
    const next = !audioMuted
    setAudioMuted(next)
    localStorage.setItem('rvc-audio-muted', String(next))
  }

  const load = async () => {
    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const [ordersRes, tablesRes, settingsRes, tenantRes, priorRes] = await Promise.all([
        db
          .from('restaurant_orders')
          .select('*,restaurant_tables(id,table_number),restaurant_order_items(item_name,quantity,notes,unit_price,line_total)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100),
        db.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('table_number'),
        db.from('restaurant_settings').select('*').eq('tenant_id', tenantId).single(),
        db.from('tenants').select('slug').eq('id', tenantId).single(),
        db
          .from('restaurant_orders')
          .select('total')
          .eq('tenant_id', tenantId)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString()),
      ])

      if (ordersRes.error) throw ordersRes.error

      const fetchedOrders = (ordersRes.data ?? []) as Order[]
      const activeCount = fetchedOrders.filter((o) => ['new', 'accepted', 'preparing', 'ready'].includes(o.status)).length
      const billReqCount = fetchedOrders.filter(
        (o) => o.bill_requested && o.payment_status !== 'paid' && o.status !== 'cancelled'
      ).length

      // Trigger sounds if count increased
      if (
        previousBillRequestCountRef.current !== null &&
        billReqCount > previousBillRequestCountRef.current &&
        !audioMuted
      ) {
        playBillAlertSound()
      } else if (
        previousOrderCountRef.current !== null &&
        activeCount > previousOrderCountRef.current &&
        !audioMuted
      ) {
        playAudioChime()
      }

      previousOrderCountRef.current = activeCount
      previousBillRequestCountRef.current = billReqCount

      setData({
        orders: fetchedOrders,
        tables: (tablesRes.data ?? []) as Table[],
        settings: settingsRes.data,
        yesterday: (priorRes.data ?? []).reduce((sum: number, row: any) => sum + Number(row.total || 0), 0),
        slug: tenantRes.data?.slug || '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load restaurant overview')
    }
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 10000)
    return () => clearInterval(timer)
  }, [audioMuted])

  if (!data) {
    return (
      <div className="grid min-h-[400px] place-items-center rounded-2xl border border-border bg-card p-8 text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="font-medium">{error || 'Loading restaurant command center…'}</p>
        </div>
      </div>
    )
  }

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const todayOrders = data.orders.filter(
    (order) => new Date(order.created_at) >= startOfDay && order.status !== 'cancelled'
  )
  const paidOrders = todayOrders.filter((order) => order.payment_status === 'paid' || order.status === 'completed')
  const revenueToday = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const activeOrders = data.orders.filter((order) =>
    ['new', 'accepted', 'preparing', 'ready'].includes(order.status)
  )
  const billRequestOrders = data.orders.filter(
    (o) => o.bill_requested && o.payment_status !== 'paid' && o.status !== 'cancelled'
  )

  const occupiedTablesCount = data.tables.filter((t) => ['occupied', 'bill_requested'].includes(t.status)).length
  const occupiedPercentage = data.tables.length
    ? Math.round((occupiedTablesCount / data.tables.length) * 100)
    : 0
  const aov = todayOrders.length ? todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) / todayOrders.length : 0
  const trend = data.yesterday ? ((revenueToday - data.yesterday) / data.yesterday) * 100 : 0

  const toggleService = async () => {
    const db = createClient()
    const isCurrentlyOpen = data.settings?.ordering_enabled ?? true
    const rpcName = isCurrentlyOpen ? 'restaurant_close_service' : 'restaurant_open_service'
    const result = isCurrentlyOpen ? await db.rpc(rpcName) : await db.rpc(rpcName, { p_closes_at: null })

    if (result.error) {
      setError(result.error.message)
    } else {
      void load()
    }
  }

  const updateOrderStatus = async (orderId: string, nextStatus: string) => {
    const db = createClient()
    const { error } = await db
      .from('restaurant_orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      alert(error.message)
    } else {
      void load()
    }
  }

  const settleOrder = async (orderId: string, method: string) => {
    const db = createClient()
    const { error } = await db.rpc('complete_restaurant_order', {
      p_order_id: orderId,
      p_method: method,
      p_reference: null,
    })

    if (error) {
      alert(error.message)
    } else {
      setSelectedTable(null)
      void load()
    }
  }

  const openKotPrint = (order: Order) => {
    setKotModalData({
      restaurant: data.settings?.display_name || 'Restaurant Workspace',
      table: formatTableBadge(order.restaurant_tables?.table_number),
      orderNumber: order.order_number,
      createdAt: order.created_at,
      items: order.restaurant_order_items.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        notes: i.notes,
      })),
    })
  }

  const openBillPrint = (order: Order) => {
    const subtotal = order.subtotal || order.total
    setBillModalData({
      restaurant: data.settings?.display_name || 'Restaurant Workspace',
      address: data.settings?.address || 'GST Registered Restaurant',
      phone: data.settings?.phone || undefined,
      gstin: data.settings?.gstin || undefined,
      fssaiNo: data.settings?.fssai_no || undefined,
      table: formatTableBadge(order.restaurant_tables?.table_number),
      orderNumber: order.order_number,
      createdAt: order.created_at,
      items: order.restaurant_order_items.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        unitPrice: i.unit_price || (i.line_total ? i.line_total / i.quantity : 0),
        lineTotal: i.line_total || Number(order.total),
      })),
      subtotal,
      taxRate: data.settings?.tax_rate || 5,
      taxAmount: order.tax_amount || 0,
      grandTotal: Number(order.total),
      paymentStatus: order.payment_status === 'paid' ? 'PAID' : 'UNPAID',
    })
  }

  // Calculate top sold dishes today
  const dishesMap = new Map<string, number>()
  todayOrders.forEach((o) =>
    o.restaurant_order_items.forEach((item) =>
      dishesMap.set(item.item_name, (dishesMap.get(item.item_name) || 0) + item.quantity)
    )
  )
  const topDishes = [...dishesMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const maxDishSold = topDishes[0]?.[1] || 1

  // Recent settlements
  const recentSettlements = data.orders
    .filter((o) => o.payment_status === 'paid' || o.status === 'completed')
    .slice(0, 4)

  const isServiceOpen = data.settings?.ordering_enabled ?? true

  return (
    <div className="space-y-6">
      {/* HEADER TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Live Command Center · Auto-synced
            </p>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {data.settings?.display_name || 'Restaurant Overview'}
          </h1>
        </div>

        {/* SERVICE TOGGLE & CHIME */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void toggleService()}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${
              isServiceOpen
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                : 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500'
            }`}
          >
            <span className="size-2 rounded-full bg-white animate-pulse" />
            {isServiceOpen ? 'Service Open (QR Active)' : 'Service Closed'}
          </button>
        </div>
      </div>

      {/* BILL / PAYMENT REQUEST ALERT BANNER */}
      {billRequestOrders.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-5 shadow-lg backdrop-blur-md dark:bg-amber-950/40 dark:border-amber-500/80">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-500 text-slate-950 font-bold animate-bounce">
                <BellRing className="size-6" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-amber-900 dark:text-amber-200">
                  🚨 {billRequestOrders.length} Table{billRequestOrders.length > 1 ? 's' : ''} Requested Bill / Payment!
                </h2>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Guests have tapped "Request Bill" on their QR menu. Action required to print invoice & settle payment.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-extrabold text-amber-800 dark:text-amber-200 animate-pulse">
              ● SOUND ALERT PLAYED
            </span>
          </div>

          <div className="mt-3 divide-y divide-amber-500/20">
            {billRequestOrders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 pt-3 first:pt-0">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-amber-500 px-3.5 py-1 text-sm font-black text-slate-950 shadow-xs">
                    {formatTableBadge(order.restaurant_tables?.table_number)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-sm font-bold text-foreground">Order #{order.order_number}</b>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        {order.requested_payment_mode === 'upi' ? '📱 UPI Mode' : '💵 Cash Mode'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Bill Total: <b>{money(order.total)}</b> · Requested {elapsed(order.bill_requested_at || order.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openBillPrint(order)}
                    className="rounded-xl border border-amber-500/40 bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary flex items-center gap-1.5"
                  >
                    <Printer className="size-3.5 text-emerald-600" />
                    Print Bill
                  </button>

                  <button
                    onClick={() => void settleOrder(order.id, 'cash')}
                    className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <CreditCard className="size-3.5" />
                    Cash Settle
                  </button>

                  <button
                    onClick={() => void settleOrder(order.id, 'online')}
                    className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center gap-1"
                  >
                    <Zap className="size-3.5" />
                    UPI Settle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP KPI SUMMARY ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Revenue Today */}
        <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <DollarSign className="size-5" />
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                trend >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}
            >
              <TrendingUp className="size-3" />
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}% vs yesterday
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue Today</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{money(revenueToday)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{paidOrders.length} settled orders today</p>
        </article>

        {/* 2. Live Active Orders */}
        <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <ShoppingBag className="size-5" />
            </span>
            {activeOrders.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 animate-pulse dark:bg-amber-950 dark:text-amber-300">
                ● Live
              </span>
            )}
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Active Orders</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{activeOrders.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">Received · preparing · ready</p>
        </article>

        {/* 3. Occupied Tables */}
        <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Grid className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{occupiedPercentage}% Capacity</span>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Occupied Tables</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">
            {occupiedTablesCount} <span className="text-lg font-normal text-muted-foreground">/ {data.tables.length}</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${Math.min(100, occupiedPercentage)}%` }}
            />
          </div>
        </article>

        {/* 4. Average Order Value (AOV) */}
        <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Zap className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Today</span>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Average Order Value (AOV)</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{money(aov)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{todayOrders.length} total orders recorded</p>
        </article>
      </div>

      {/* QUICK ACTION & CONTROL TOOLBAR */}
      <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-md backdrop-blur-md dark:bg-slate-900/95 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <AddTableButton />

          <Link
            href="/restaurant-dashboard/kitchen"
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary"
          >
            <ChefHat className="size-4 text-primary" />
            <span>Kitchen Queue</span>
            {activeOrders.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {activeOrders.length}
              </span>
            )}
          </Link>

          <Link
            href="/restaurant-dashboard/tables"
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-all hover:bg-secondary"
          >
            <CreditCard className="size-4 text-emerald-600" />
            <span>Settle Bill</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleAudioMute}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              audioMuted
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
            title="Toggle audio notification chimes for new incoming orders and bill requests"
          >
            {audioMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            <span>Chime: {audioMuted ? 'Muted' : 'Enabled'}</span>
          </button>
        </div>
      </div>

      {/* DUAL-COLUMN LIVE OPERATIONAL PIPELINE */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Live Kitchen & Order Pipeline (65% width) */}
        <section className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Live Kitchen & Order Pipeline</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {activeOrders.length} Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Sorted by live queue order</p>
          </div>

          {/* ACTIVE ORDER CARDS LIST */}
          <div className="space-y-4">
            {activeOrders.map((order) => {
              const isReceived = ['new', 'accepted'].includes(order.status)
              const isPreparing = order.status === 'preparing'
              const isReady = order.status === 'ready'
              const isBillRequested = order.bill_requested && order.payment_status !== 'paid'

              return (
                <article
                  key={order.id}
                  className={`rounded-2xl border bg-card p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 ${
                    isBillRequested
                      ? 'border-2 border-amber-500/80 shadow-amber-500/10'
                      : 'border-border dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-primary px-3 py-1.5 text-sm font-extrabold text-primary-foreground">
                        {formatTableBadge(order.restaurant_tables?.table_number)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <b className="text-base font-bold">Order #{order.order_number}</b>
                          {order.customer_phone && (
                            <span className="text-xs text-muted-foreground">
                              ({order.customer_name || 'Guest'} · {order.customer_phone})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="size-3" />
                          {elapsed(order.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isBillRequested && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-slate-950 animate-pulse">
                          <BellRing className="size-3" />
                          Bill Requested ({order.requested_payment_mode?.toUpperCase() || 'CASH'})
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize ${
                          isReady
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : isPreparing
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        <span
                          className={`size-2 rounded-full ${
                            isReady ? 'bg-emerald-500' : isPreparing ? 'bg-blue-500 animate-spin' : 'bg-amber-500 animate-pulse'
                          }`}
                        />
                        {order.status === 'new' ? 'Received' : order.status}
                      </span>
                    </div>
                  </div>

                  {/* ITEM BREAKDOWN ACCORDION */}
                  <OrderItemsAccordion items={order.restaurant_order_items} notes={order.notes} />

                  {/* ACTION BAR */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <b className="text-base font-extrabold">{money(order.total)}</b>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openKotPrint(order)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary flex items-center gap-1.5"
                        title="Print Thermal Kitchen Ticket"
                      >
                        <Printer className="size-3.5" />
                        KOT
                      </button>

                      <button
                        onClick={() => openBillPrint(order)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                        title="Print Customer Tax Bill"
                      >
                        <Receipt className="size-3.5" />
                        Bill
                      </button>

                      {isReceived && (
                        <button
                          onClick={() => void updateOrderStatus(order.id, 'preparing')}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-1.5"
                        >
                          <Flame className="size-3.5" />
                          Start Preparing
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => void updateOrderStatus(order.id, 'ready')}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Mark Ready
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => void updateOrderStatus(order.id, 'served')}
                          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
                        >
                          <Utensils className="size-3.5" />
                          Mark Served
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {/* POLISHED EMPTY STATE */}
            {activeOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 className="size-8" />
                </span>
                <h3 className="mt-4 text-xl font-bold">All orders served and clear!</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  There are no active or preparing orders in the kitchen pipeline right now. New QR orders will show up here automatically.
                </p>
                <Link
                  href="/restaurant-dashboard/orders"
                  className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
                >
                  <span>View Order History & Settled Bills</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Floor Plan & Real-time Insights (35% width) */}
        <aside className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* FLOOR PLAN VISUALIZER */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-base">Floor Plan & Tables</h3>
                <p className="text-xs text-muted-foreground">{data.tables.length} Total Tables</p>
              </div>
              <Link
                href="/restaurant-dashboard/tables"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Manage →
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {data.tables.map((table) => {
                const tableActiveOrder = data.orders.find(
                  (o) => o.restaurant_tables?.id === table.id && !['completed', 'cancelled'].includes(o.status)
                )

                const isBillReq =
                  table.status === 'bill_requested' || (tableActiveOrder && tableActiveOrder.bill_requested && tableActiveOrder.payment_status !== 'paid')
                const isOccupied = table.status === 'occupied' || (tableActiveOrder && !isBillReq)
                const isAvailable = !isOccupied && !isBillReq

                return (
                  <button
                    key={table.id}
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedQrTable(table)
                      } else {
                        setSelectedTable(table)
                      }
                    }}
                    className={`group relative flex flex-col items-center justify-between rounded-xl p-3 text-center transition-all border ${
                      isBillReq
                        ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 animate-pulse font-bold'
                        : isOccupied
                        ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                  >
                    <b className="text-base font-extrabold">{formatTableBadge(table.table_number)}</b>
                    <small className="mt-1 text-[11px] font-semibold capitalize tracking-tight">
                      {isBillReq ? 'Bill Req' : isOccupied ? 'Occupied' : 'Available'}
                    </small>
                    {tableActiveOrder && (
                      <span className="mt-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold">
                        #{tableActiveOrder.order_number}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex justify-around border-t border-border/60 pt-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                <span className="size-2 rounded-full bg-red-500" /> Occupied
              </span>
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" /> Bill Req
              </span>
            </div>
          </section>

          {/* TOP TRENDING DISHES TODAY */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Flame className="size-5 text-orange-500" />
              <h3 className="font-bold text-base">Top Trending Dishes Today</h3>
            </div>

            <div className="mt-4 space-y-3">
              {topDishes.map(([dishName, qty], index) => (
                <div key={dishName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">
                      #{index + 1} {dishName}
                    </span>
                    <span className="font-semibold text-muted-foreground">{qty} sold</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (qty / maxDishSold) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!topDishes.length && (
                <p className="py-4 text-center text-xs text-muted-foreground">No dishes ordered today yet.</p>
              )}
            </div>
          </section>

          {/* RECENT SETTLEMENTS FEED */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-base">Recent Settlements</h3>
              <CreditCard className="size-4 text-muted-foreground" />
            </div>

            <div className="mt-3 divide-y divide-border/60">
              {recentSettlements.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <b className="font-bold">Order #{order.order_number}</b>
                    <p className="text-muted-foreground mt-0.5">
                      {formatTableBadge(order.restaurant_tables?.table_number)} ·{' '}
                      <span className="capitalize font-semibold text-emerald-600 dark:text-emerald-400">
                        {order.payment_method || 'Paid'}
                      </span>
                    </p>
                  </div>
                  <b className="font-extrabold text-sm">{money(order.total)}</b>
                </div>
              ))}
              {!recentSettlements.length && (
                <p className="py-4 text-center text-xs text-muted-foreground">No settled bills today yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* TABLE INSPECTOR MODAL */}
      {selectedTable && (
        <TableInspectorModal
          table={selectedTable}
          orders={data.orders}
          onClose={() => setSelectedTable(null)}
          onSettle={(orderId, method) => void settleOrder(orderId, method)}
          onPrintBill={(order) => openBillPrint(order)}
        />
      )}

      {/* TABLE QR MODAL */}
      {selectedQrTable && (
        <TableQrModal
          table={selectedQrTable}
          slug={data.slug}
          onClose={() => setSelectedQrTable(null)}
        />
      )}

      {/* THERMAL PRINT MODALS */}
      {kotModalData && <KOTPrintModal data={kotModalData} onClose={() => setKotModalData(null)} />}
      {billModalData && <CustomerBillPrintModal data={billModalData} onClose={() => setBillModalData(null)} />}
    </div>
  )
}

/**
 * Expandable/collapsible order items accordion for large tickets (> 3 items)
 */
function OrderItemsAccordion({ items, notes }: { items: OrderItem[]; notes?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const isLargeTicket = items.length > 3
  const visibleItems = isLargeTicket && !expanded ? items.slice(0, 3) : items
  const remainingCount = items.length - 3

  return (
    <div className="my-4 space-y-2 text-sm">
      {visibleItems.map((item, idx) => (
        <div key={idx} className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{item.item_name}</span>
            <span className="ml-2 font-bold text-primary">×{item.quantity}</span>
            {item.notes && (
              <div className="mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-0.5 inline-block">
                [NOTE: {item.notes}]
              </div>
            )}
          </div>
        </div>
      ))}

      {isLargeTicket && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/10 hover:bg-primary/20 rounded-lg px-2.5 py-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3.5" />
              Collapse items
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />+ {remainingCount} more item{remainingCount > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}

      {notes && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg mt-2">
          Order Note: {notes}
        </p>
      )}
    </div>
  )
}

function TableInspectorModal({
  table,
  orders,
  onClose,
  onSettle,
  onPrintBill,
}: {
  table: Table
  orders: Order[]
  onClose: () => void
  onSettle: (orderId: string, method: string) => void
  onPrintBill: (order: Order) => void
}) {
  const activeOrder =
    orders.find((o) => o.restaurant_tables?.id === table.id && o.bill_requested && o.payment_status !== 'paid') ||
    orders.find((o) => o.restaurant_tables?.id === table.id && !['completed', 'cancelled', 'served'].includes(o.status)) ||
    orders.find((o) => o.restaurant_tables?.id === table.id)

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-xs">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-xl font-extrabold">{formatTableBadge(table.table_number)} Inspector</h3>
            <p className="text-xs text-muted-foreground capitalize">Status: {table.status}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        {activeOrder ? (
          <div className="mt-4 space-y-4">
            {activeOrder.bill_requested && activeOrder.payment_status !== 'paid' && (
              <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 animate-pulse font-bold flex items-center gap-2">
                <BellRing className="size-4 text-amber-500" />
                <span>Guest requested bill ({activeOrder.requested_payment_mode?.toUpperCase() || 'CASH'})</span>
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between font-bold text-sm">
                <span>Order #{activeOrder.order_number}</span>
                <span className="capitalize text-primary">{activeOrder.status}</span>
              </div>
              <div className="mt-2 space-y-1">
                {activeOrder.restaurant_order_items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {i.item_name} × {i.quantity}
                    </span>
                    <span>₹{((i.unit_price || 0) * i.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-extrabold">
                <span>Total Bill:</span>
                <span>{money(activeOrder.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onPrintBill(activeOrder)}
                className="rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-secondary flex items-center justify-center gap-1.5"
              >
                <Printer className="size-4" /> Print Tax Bill
              </button>

              <button
                onClick={() => onSettle(activeOrder.id, 'cash')}
                className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1"
              >
                <CreditCard className="size-4" /> Settle Cash
              </button>

              <button
                onClick={() => onSettle(activeOrder.id, 'online')}
                className="col-span-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1"
              >
                <Zap className="size-4" /> Settle UPI / Online
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p className="text-sm">No active order linked to {formatTableBadge(table.table_number)}.</p>
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full rounded-xl border py-2.5 text-xs font-semibold">
          Close Inspector
        </button>
      </section>
    </div>
  )
}

function TableQrModal({
  table,
  slug,
  onClose,
}: {
  table: Table
  slug: string
  onClose: () => void
}) {
  const [url, setUrl] = useState('')
  const [qrImg, setQrImg] = useState('')

  useEffect(() => {
    const make = async () => {
      const fullUrl = `${window.location.origin}/order/${slug}/${encodeURIComponent(table.table_number)}`
      setUrl(fullUrl)
      setQrImg(await QRCode.toDataURL(fullUrl, { width: 600, margin: 2 }))
    }
    void make()
  }, [table, slug])

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-xs">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl dark:bg-slate-900">
        <h3 className="text-xl font-extrabold">{formatTableBadge(table.table_number)} QR Code</h3>
        <p className="mt-1 text-xs text-muted-foreground">Scan to open public QR menu</p>

        {qrImg && <img src={qrImg} alt={`QR ${formatTableBadge(table.table_number)}`} className="mx-auto mt-4 size-48 rounded-xl border p-2" />}

        <input readOnly value={url} className="mt-3 w-full rounded-lg border bg-muted p-2 text-[11px]" />

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void navigator.clipboard.writeText(url)}
            className="flex-1 rounded-xl border py-2.5 text-xs font-semibold hover:bg-secondary"
          >
            Copy Link
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground"
          >
            <Printer className="mr-1 inline size-3.5" /> Print QR
          </button>
        </div>

        <button onClick={onClose} className="mt-3 text-xs text-muted-foreground hover:underline">
          Close
        </button>
      </section>
    </div>
  )
}
