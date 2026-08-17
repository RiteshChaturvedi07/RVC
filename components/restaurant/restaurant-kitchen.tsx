'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChefHat,
  Clock,
  AlertCircle,
  CheckSquare,
  Square,
  Printer,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Flame,
  Utensils,
  History,
  BellRing,
  User,
  Phone,
  ArrowRight,
  ShieldAlert,
  MapPin,
  Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'
import { printThermalKOT } from '@/lib/print-engine'

export type OrderItem = {
  item_name: string
  quantity: number
  notes?: string | null
}

export type Order = {
  id: string
  order_number: number
  status: string
  created_at: string
  updated_at?: string | null
  dining_type?: 'dine_in' | 'takeaway'
  notes?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  restaurant_tables?: { table_number: string } | null
  restaurant_order_items: OrderItem[]
}

export function formatTableBadge(num: string | null | undefined): string {
  if (!num) return 'TAKEAWAY'
  const trimmed = num.trim()
  if (/^\d+$/.test(trimmed)) {
    return `TABLE A-${trimmed.padStart(2, '0')}`
  }
  return `TABLE ${trimmed.toUpperCase()}`
}

function getDietaryBadge(itemName: string) {
  const lower = itemName.toLowerCase()
  if (
    lower.includes('chicken') ||
    lower.includes('mutton') ||
    lower.includes('fish') ||
    lower.includes('egg') ||
    lower.includes('non-veg') ||
    lower.includes('non veg') ||
    lower.includes('meat') ||
    lower.includes('prawn') ||
    lower.includes('pork') ||
    lower.includes('beef')
  ) {
    return (
      <span className="inline-flex items-center text-xs font-bold text-rose-500 mr-1.5" title="Non-Vegetarian">
        🔴
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-xs font-bold text-emerald-500 mr-1.5" title="Vegetarian">
      🟢
    </span>
  )
}

function playKitchenChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const now = ctx.currentTime

    // Note 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'triangle'
    osc1.frequency.setValueAtTime(523.25, now)
    gain1.gain.setValueAtTime(0.35, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    // Note 2: E5 (659.25 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(659.25, now + 0.12)
    gain2.gain.setValueAtTime(0.4, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.45)

    // Note 3: G5 (783.99 Hz)
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(783.99, now + 0.24)
    gain3.gain.setValueAtTime(0.45, now + 0.24)
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.65)
    osc3.connect(gain3)
    gain3.connect(ctx.destination)
    osc3.start(now + 0.24)
    osc3.stop(now + 0.65)
  } catch (e) {
    console.error('Audio chime playback error:', e)
  }
}

export function RestaurantKitchen() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'preparing' | 'ready' | 'history'>('all')
  const [now, setNow] = useState<number>(Date.now())
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [lastSync, setLastSync] = useState<Date>(new Date())
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(true)
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string>('Commercial Kitchen KDS')
  const [newOrderToast, setNewOrderToast] = useState<string | null>(null)

  const audioEnabledRef = useRef(audioEnabled)
  useEffect(() => {
    audioEnabledRef.current = audioEnabled
  }, [audioEnabled])

  // Unlock AudioContext on initial browser click/touch
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          const dummy = new AudioCtx()
          if (dummy.state === 'suspended') {
            void dummy.resume()
          }
        }
      } catch {}
    }
    window.addEventListener('click', unlockAudio, { once: true })
    window.addEventListener('touchstart', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('click', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
    }
  }, [])

  // Load orders & restaurant name from Supabase
  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const tenant = await currentRestaurantTenant()
      const db = createClient()

      // Fetch restaurant settings if available
      const { data: settings } = await db
        .from('restaurant_settings')
        .select('display_name')
        .eq('tenant_id', tenant)
        .single()

      if (settings?.display_name) {
        setRestaurantName(settings.display_name)
      }

      // Fetch orders with updated_at included
      const { data, error: dbError } = await db
        .from('restaurant_orders')
        .select(
          'id,order_number,status,created_at,updated_at,dining_type,notes,customer_name,customer_phone,restaurant_tables(table_number),restaurant_order_items(item_name,quantity,notes)'
        )
        .eq('tenant_id', tenant)
        .order('created_at', { ascending: true })

      if (dbError) throw dbError
      setOrders((data ?? []) as unknown as Order[])
      setError('')
      setLastSync(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load kitchen queue')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Initial load, 10s fallback polling & 1s count-up ticker
  useEffect(() => {
    void fetchOrders()

    const pollInterval = setInterval(() => {
      void fetchOrders(true)
    }, 10000)

    const timerInterval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      clearInterval(pollInterval)
      clearInterval(timerInterval)
    }
  }, [])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('kds-orders-realtime-sub')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
        },
        (payload) => {
          setLastSync(new Date())
          if (payload.eventType === 'INSERT') {
            const orderNum = (payload.new as { order_number?: number }).order_number || ''
            setNewOrderToast(`🔔 New Order #${orderNum} Received!`)
            if (audioEnabledRef.current) {
              playKitchenChime()
            }
            setTimeout(() => setNewOrderToast(null), 6000)
          }
          void fetchOrders(true)
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Fullscreen request failed:', err)
      })
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error('Exit fullscreen failed:', err)
        })
      }
    }
  }

  const toggleAudio = () => {
    const nextState = !audioEnabled
    setAudioEnabled(nextState)
    if (nextState) {
      playKitchenChime()
    }
  }

  const updateOrderStatus = async (order: Order, nextState: string) => {
    setIsUpdatingId(order.id)
    try {
      const { error: updateError } = await createClient()
        .from('restaurant_orders')
        .update({ status: nextState, updated_at: new Date().toISOString() })
        .eq('id', order.id)

      if (updateError) throw updateError
      await fetchOrders(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update order status')
    } finally {
      setIsUpdatingId(null)
    }
  }

  const handlePrintKOT = (order: Order) => {
    printThermalKOT({
      restaurant: restaurantName,
      table: order.restaurant_tables?.table_number
        ? formatTableBadge(order.restaurant_tables.table_number)
        : order.dining_type === 'takeaway'
        ? 'TAKEAWAY'
        : 'DINE-IN',
      orderNumber: order.order_number,
      createdAt: order.created_at,
      diningType: order.dining_type,
      items: order.restaurant_order_items.map((item) => ({
        name: item.item_name,
        quantity: item.quantity,
        notes: item.notes,
      })),
    })
  }

  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading && !orders) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-semibold">Initializing Commercial KDS Workspace…</p>
      </div>
    )
  }

  if (error && !orders) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-rose-300 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 p-12 text-rose-600 dark:text-rose-400">
        <AlertCircle className="size-10" />
        <p className="mt-3 text-lg font-bold">Kitchen Queue Load Error</p>
        <p className="mt-1 text-sm">{error}</p>
        <button
          onClick={() => void fetchOrders()}
          className="mt-4 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 shadow-lg"
        >
          Retry Connection
        </button>
      </div>
    )
  }

  const allOrders = orders || []

  // Active vs History orders
  const activeOrders = allOrders.filter(
    (o) => !['served', 'completed', 'closed', 'cancelled'].includes(o.status)
  )
  const historyOrders = allOrders.filter((o) =>
    ['served', 'completed'].includes(o.status)
  )

  // Counts
  const countActive = activeOrders.length
  const countNew = activeOrders.filter(
    (o) => o.status === 'new' || o.status === 'received' || o.status === 'accepted'
  ).length
  const countPreparing = activeOrders.filter((o) => o.status === 'preparing').length
  const countReady = activeOrders.filter((o) => o.status === 'ready').length

  const countDelayed15m = activeOrders.filter((o) => {
    const elapsed = Math.floor((now - new Date(o.created_at).getTime()) / 1000)
    return elapsed > 900
  }).length

  // Filtered queue display
  let displayedOrders: Order[] = []
  if (activeTab === 'all') {
    displayedOrders = activeOrders
  } else if (activeTab === 'new') {
    displayedOrders = activeOrders.filter(
      (o) => o.status === 'new' || o.status === 'received' || o.status === 'accepted'
    )
  } else if (activeTab === 'preparing') {
    displayedOrders = activeOrders.filter((o) => o.status === 'preparing')
  } else if (activeTab === 'ready') {
    displayedOrders = activeOrders.filter((o) => o.status === 'ready')
  } else if (activeTab === 'history') {
    displayedOrders = historyOrders.slice(-20).reverse()
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white relative">
      {/* REAL-TIME NEW ORDER SOUND TOAST ALERT */}
      {newOrderToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-amber-500 text-slate-950 px-5 py-3.5 font-black shadow-2xl animate-bounce border-2 border-slate-950">
          <BellRing className="size-6 text-slate-950 animate-pulse" />
          <span>{newOrderToast}</span>
        </div>
      )}

      {/* 1. KDS TOP COMMAND BAR (LIGHT + DARK MODE) */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-lg dark:shadow-2xl space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Side: Title + Active Stats Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 dark:bg-primary/20 p-2.5 text-primary border border-primary/20 dark:border-primary/30 shadow-inner">
                <ChefHat className="size-6" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{restaurantName}</span>
                  <span className="rounded-full bg-primary/10 dark:bg-primary/20 px-3 py-0.5 text-xs font-bold text-primary border border-primary/30 dark:border-primary/40">
                    {countActive} Active
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Live Commercial Kitchen Display System (KDS)
                </p>
              </div>
            </div>

            {/* Status Dots Badges */}
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-800 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                {countNew} Received
              </span>
              <span className="inline-flex items-center gap-1.5 text-sky-800 dark:text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 rounded-lg">
                <span className="size-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-spin" />
                {countPreparing} Preparing
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                {countReady} Ready
              </span>
              {countDelayed15m > 0 && (
                <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-lg animate-pulse">
                  <AlertCircle className="size-3.5 text-rose-600 dark:text-rose-400" />
                  {countDelayed15m} Late (&gt;15m)
                </span>
              )}
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {/* Audio Chime Toggle */}
            <button
              onClick={toggleAudio}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 ${
                audioEnabled
                  ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="Toggle Audio Chime Alert on Incoming Orders"
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="size-4 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                  <span>🔊 Sound: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="size-4 text-slate-400" />
                  <span>🔇 Sound: OFF</span>
                </>
              )}
            </button>

            {/* Fullscreen Trigger */}
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
              title="Toggle Fullscreen Commercial TV Display"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="size-4" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize className="size-4" />
                  <span className="hidden sm:inline">🖥️ Fullscreen</span>
                </>
              )}
            </button>

            {/* Live Sync Pulse */}
            <div
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              title={`Last synced: ${lastSync.toLocaleTimeString()}`}
            >
              <span className="relative flex size-2.5">
                <span
                  className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${
                    realtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex size-2.5 rounded-full ${
                    realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="hidden md:inline">
                {realtimeConnected ? '🟢 Live Pulse' : '🟡 Polling'}
              </span>
            </div>
          </div>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Active ({countActive})
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'new'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400" />
            🟡 Received ({countNew})
          </button>

          <button
            onClick={() => setActiveTab('preparing')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'preparing'
                ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950 shadow-md font-black'
                : 'text-sky-700 dark:text-sky-400 hover:bg-sky-500/10'
            }`}
          >
            <span className="size-2 rounded-full bg-sky-500 dark:bg-sky-400" />
            🔵 Preparing ({countPreparing})
          </button>

          <button
            onClick={() => setActiveTab('ready')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'ready'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-md font-black'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            🟢 Ready ({countReady})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white dark:bg-slate-700 dark:text-white shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="size-3.5" />
            📜 Recently Served ({historyOrders.length})
          </button>
        </div>
      </div>

      {/* 2. MODERN TOUCH TICKET CARDS (KDS GRID VIEW - LIGHT & DARK MODE) */}
      {displayedOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedOrders.map((order) => {
            const statusLower = order.status.toLowerCase()
            const isServed = statusLower === 'served' || statusLower === 'completed'
            const isNew = statusLower === 'new' || statusLower === 'received' || statusLower === 'accepted'
            const isPrep = statusLower === 'preparing'
            const isReady = statusLower === 'ready'

            // Freeze timer when served (calculating elapsed time up to updated_at if available)
            const createdMs = new Date(order.created_at).getTime()
            let endMs = now
            if (isServed) {
              if (order.updated_at && new Date(order.updated_at).getTime() > createdMs) {
                endMs = new Date(order.updated_at).getTime()
              } else {
                endMs = createdMs
              }
            }

            const elapsedSec = Math.max(0, Math.floor((endMs - createdMs) / 1000))
            const elapsedMins = Math.floor(elapsedSec / 60)
            const elapsedSecRem = elapsedSec % 60
            const timerStr = elapsedMins > 0 ? `${elapsedMins}m ${elapsedSecRem}s` : `${elapsedSecRem}s`

            // CRITICAL FIX: Served tickets are NEVER late!
            const isLate = !isServed && elapsedSec > 900 // > 15m
            const isWarning = !isServed && elapsedSec >= 600 && elapsedSec <= 900 // 10–15m

            const tableDisplay = order.restaurant_tables?.table_number
              ? formatTableBadge(order.restaurant_tables.table_number)
              : order.dining_type === 'takeaway'
              ? 'TAKEAWAY'
              : 'DINE-IN'

            return (
              <article
                key={order.id}
                className={`relative flex flex-col justify-between rounded-2xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md dark:shadow-xl overflow-hidden transition-all duration-300 hover:border-slate-400 dark:hover:border-slate-500 ${
                  isServed
                    ? 'border-slate-200 dark:border-slate-800 opacity-90'
                    : isLate
                    ? 'border-rose-500 dark:border-red-500 shadow-rose-500/20'
                    : isPrep
                    ? 'border-sky-400 dark:border-sky-500/80 shadow-sky-500/10'
                    : isReady
                    ? 'border-emerald-400 dark:border-emerald-500/80 shadow-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-700/80'
                }`}
              >
                {/* Dynamic Top Status Urgency Accent Line */}
                <div
                  className={`h-1.5 w-full ${
                    isServed
                      ? 'bg-emerald-600'
                      : isLate
                      ? 'bg-gradient-to-r from-red-600 via-rose-500 to-pink-600 animate-pulse'
                      : isReady
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-600'
                      : isPrep
                      ? 'bg-gradient-to-r from-sky-500 via-blue-400 to-indigo-600'
                      : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600'
                  }`}
                />

                {/* Ticket Header Banner */}
                <div
                  className={`p-4 border-b ${
                    isServed
                      ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'
                      : isLate
                      ? 'bg-red-500/10 dark:bg-red-500/20 border-red-200 dark:border-red-500/40'
                      : isPrep
                      ? 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/30'
                      : isReady
                      ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-xs">
                        #{order.order_number}
                      </span>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/40 px-2.5 py-1 text-xs font-black uppercase tracking-wider shadow-inner">
                          <MapPin className="size-3 text-amber-600 dark:text-amber-400" />
                          {tableDisplay}
                        </span>

                        <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-bold">
                          {order.dining_type === 'takeaway' ? '🛍️ Takeaway' : '🍽️ Dine-In'}
                        </span>
                      </div>
                    </div>

                    {/* Timer Badge: Frozen when served, live count-up when active */}
                    {isServed ? (
                      <div className="inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-mono font-bold border border-emerald-300 dark:border-emerald-500/40 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 shadow-sm">
                        <CheckCircle2 className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>⏱️ {timerStr !== '0s' ? timerStr : 'Served'}</span>
                        <span className="ml-1 text-[9px] uppercase tracking-wider font-extrabold text-emerald-700 dark:text-emerald-400">
                          SERVED
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-mono font-bold border transition-all ${
                          isLate
                            ? 'bg-red-100 dark:bg-red-500/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-500 animate-pulse shadow-sm shadow-red-500/20'
                            : isWarning
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                        }`}
                      >
                        <Clock className="size-3.5 mr-1 shrink-0" />
                        <span>⏱️ {timerStr}</span>
                        {isLate && (
                          <span className="ml-1 rounded bg-red-600 px-1 py-0.2 text-[9px] font-black text-white uppercase tracking-wider">
                            LATE ALERT
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Customer Info Sub-row */}
                  {(order.customer_name || order.customer_phone) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                      {order.customer_name && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <User className="size-3 text-primary shrink-0" />
                          <span className="font-semibold text-slate-900 dark:text-white">{order.customer_name}</span>
                        </span>
                      )}
                      {order.customer_phone && (
                        <span className="inline-flex items-center gap-1 shrink-0 text-slate-500 dark:text-slate-400">
                          <Phone className="size-3 shrink-0" />
                          <span>{order.customer_phone}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. TOUCH-FRIENDLY ITEM CHECKLIST */}
                <div className="p-4 flex-1 space-y-2">
                  {order.restaurant_order_items.map((item, idx) => {
                    const itemKey = `${order.id}-${idx}`
                    const isChecked = !!checkedItems[itemKey]

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleItemCheck(order.id, idx)}
                        className={`group flex items-start gap-3 rounded-xl p-3 border select-none transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-slate-100 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800/80 opacity-60'
                            : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/60'
                        }`}
                      >
                        {/* Checkbox Indicator */}
                        <div className="pt-0.5 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="size-5 text-emerald-600 dark:text-emerald-400 fill-emerald-500/20" />
                          ) : (
                            <Square className="size-5 text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={`text-sm font-bold tracking-wide uppercase leading-tight transition-all ${
                                isChecked
                                  ? 'line-through opacity-40 text-slate-500 dark:text-slate-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {getDietaryBadge(item.item_name)}
                              {item.item_name}
                            </span>

                            {/* Bold Quantity Badge */}
                            <span className="rounded-lg bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground px-2.5 py-1 text-xs font-black shrink-0 shadow-sm">
                              [ {item.quantity}x ]
                            </span>
                          </div>

                          {/* Cooking Notes / Modifications */}
                          {item.notes && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs italic font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
                              <AlertCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>Notes: {item.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 4. FOOTER & ACTION PROGRESSION */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/90 space-y-3">
                  {/* General Special Instructions Banner */}
                  {order.notes && (
                    <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300 font-medium">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200 mb-1">
                        <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Special Order Instructions:</span>
                      </div>
                      <p className="leading-relaxed italic">{order.notes}</p>
                    </div>
                  )}

                  {/* Card Footer Action Row */}
                  <div className="flex items-center gap-2">
                    {/* Thermal Print KOT Button */}
                    <button
                      onClick={() => handlePrintKOT(order)}
                      className="p-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95"
                      title="Print Thermal KOT Ticket"
                    >
                      <Printer className="size-4 text-slate-600 dark:text-slate-300" />
                      <span className="hidden sm:inline">KOT</span>
                    </button>

                    {/* Primary Lifecycle Action Button */}
                    <div className="flex-1">
                      {isNew && (
                        <button
                          disabled={isUpdatingId === order.id}
                          onClick={() => void updateOrderStatus(order, 'preparing')}
                          className="w-full bg-blue-600 hover:bg-blue-500 font-black py-3.5 px-4 rounded-xl text-white shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isUpdatingId === order.id ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <Flame className="size-4" />
                          )}
                          <span>[ 🔵 START COOKING (PREPARING) → ]</span>
                        </button>
                      )}

                      {isPrep && (
                        <button
                          disabled={isUpdatingId === order.id}
                          onClick={() => void updateOrderStatus(order, 'ready')}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 font-black py-3.5 px-4 rounded-xl text-white shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isUpdatingId === order.id ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                          <span>[ 🟢 MARK ORDER READY (NOTIFY WAITER) → ]</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          disabled={isUpdatingId === order.id}
                          onClick={() => void updateOrderStatus(order, 'served')}
                          className="w-full bg-purple-600 hover:bg-purple-500 font-black py-3.5 px-4 rounded-xl text-white shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isUpdatingId === order.id ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <Utensils className="size-4" />
                          )}
                          <span>[ 🟣 MARK SERVED & CLEAR TICKET ✓ ]</span>
                        </button>
                      )}

                      {isServed && (
                        <div className="w-full text-center py-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span>✓ Served &amp; Completed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        /* EMPTY STATE POLISH */
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-12 text-center shadow-md dark:shadow-xl">
          <div className="relative mb-4 flex size-20 items-center justify-center rounded-3xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/30 shadow-inner">
            <ChefHat className="size-10" />
            <Sparkles className="absolute -top-1 -right-1 size-6 text-amber-500 dark:text-amber-400 animate-pulse" />
          </div>

          <h3 className="text-2xl font-black text-slate-900 dark:text-white">
            Kitchen Queue is Clear!
          </h3>

          <p className="mt-2 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
            {activeTab === 'history'
              ? 'No recently served orders in queue history.'
              : 'All tickets have been cooked and served. Waiting for new orders.'}
          </p>

          <button
            onClick={() => void fetchOrders()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-5 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className="size-4 text-primary" />
            Refresh Queue Now
          </button>
        </div>
      )}
    </div>
  )
}
