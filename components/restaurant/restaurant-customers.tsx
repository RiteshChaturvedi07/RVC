'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Download,
  FileText,
  Heart,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

export type CustomerOrder = {
  id: string
  order_number: number
  customer_name?: string | null
  customer_phone?: string | null
  total: number
  status: string
  payment_status: string
  payment_method: string | null
  created_at: string
  restaurant_tables?: { table_number: string } | null
  restaurant_order_items: { item_name: string; quantity: number }[]
}

export type CustomerProfile = {
  name: string
  phone: string
  ordersCount: number
  totalSpent: number
  aov: number
  firstVisit: string
  lastVisit: string
  lastTable: string
  favoriteDishes: { name: string; count: number }[]
  isVegDiner: boolean
  staffNotes: string
  history: CustomerOrder[]
}

const money = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
}

function getSegmentTag(c: CustomerProfile) {
  const diffDays = Math.floor((Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24))

  if (c.totalSpent >= 1500 || c.ordersCount >= 4) {
    return { label: '👑 VIP Gold', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300' }
  }
  if (diffDays > 30) {
    return { label: '⚠️ At-Risk', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300' }
  }
  if (c.ordersCount >= 2) {
    return { label: '🔁 Regular', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300' }
  }
  return { label: '⚡ New Guest', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300' }
}

export function RestaurantCustomers() {
  const [customers, setCustomers] = useState<CustomerProfile[] | null>(null)
  const [restaurantName, setRestaurantName] = useState('Indian Coffee House')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filterSegment, setFilterSegment] = useState<'all' | 'vip' | 'repeat' | 'inactive' | 'veg'>('all')

  // Selected Guest 360° Drawer
  const [selectedGuest, setSelectedGuest] = useState<CustomerProfile | null>(null)

  // WhatsApp Broadcast Modal
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')

  // Staff Notes Local State
  const [staffNotesMap, setStaffNotesMap] = useState<Record<string, string>>({})

  // Load CRM Data from Supabase
  const loadCrmData = async () => {
    setLoading(true)
    try {
      const tenant = await currentRestaurantTenant()
      const db = createClient()

      const [{ data: rawOrders, error: orderErr }, { data: settings }] = await Promise.all([
        db
          .from('restaurant_orders')
          .select(
            'id,order_number,customer_name,customer_phone,total,status,payment_status,payment_method,created_at,restaurant_tables(table_number),restaurant_order_items(item_name,quantity)'
          )
          .eq('tenant_id', tenant)
          .not('customer_phone', 'is', null)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        db.from('restaurant_settings').select('display_name').eq('tenant_id', tenant).single(),
      ])

      if (orderErr) throw orderErr

      setRestaurantName(settings?.display_name || 'Our Restaurant')

      // Group Orders by Phone Number
      const profileMap = new Map<string, CustomerProfile>()

      ;((rawOrders ?? []) as unknown as CustomerOrder[]).forEach((order) => {
        const phone = order.customer_phone?.trim()
        if (!phone) return

        const existing = profileMap.get(phone) || {
          name: order.customer_name?.trim() || 'Guest',
          phone,
          ordersCount: 0,
          totalSpent: 0,
          aov: 0,
          firstVisit: order.created_at,
          lastVisit: order.created_at,
          lastTable: order.restaurant_tables?.table_number ? `Table ${order.restaurant_tables.table_number}` : 'Takeaway',
          favoriteDishes: [],
          isVegDiner: true,
          staffNotes: staffNotesMap[phone] || 'Prefers quick service & window seating.',
          history: [],
        }

        if (existing.name === 'Guest' && order.customer_name) {
          existing.name = order.customer_name.trim()
        }

        existing.ordersCount += 1
        existing.totalSpent += Number(order.total || 0)
        existing.lastVisit = existing.lastVisit > order.created_at ? existing.lastVisit : order.created_at
        existing.firstVisit = existing.firstVisit < order.created_at ? existing.firstVisit : order.created_at
        existing.history.push(order)

        profileMap.set(phone, existing)
      })

      // Calculate AOV, Favorite Dishes, Veg Diner status per customer
      const processedProfiles = Array.from(profileMap.values()).map((p) => {
        p.aov = p.ordersCount ? p.totalSpent / p.ordersCount : 0

        // Favorite Dishes Map
        const dishMap = new Map<string, number>()
        let nonVegCount = 0

        p.history.forEach((ord) => {
          ord.restaurant_order_items?.forEach((item) => {
            dishMap.set(item.item_name, (dishMap.get(item.item_name) || 0) + Number(item.quantity || 1))
            const lower = item.item_name.toLowerCase()
            if (lower.includes('chicken') || lower.includes('mutton') || lower.includes('fish') || lower.includes('egg') || lower.includes('prawn')) {
              nonVegCount++
            }
          })
        })

        p.favoriteDishes = Array.from(dishMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4)

        p.isVegDiner = nonVegCount === 0

        return p
      })

      setCustomers(processedProfiles.sort((a, b) => b.totalSpent - a.totalSpent))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load customer CRM profile data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCrmData()
  }, [])

  // Update Guest Note
  const handleSaveStaffNote = (phone: string, notes: string) => {
    setStaffNotesMap((prev) => ({ ...prev, [phone]: notes }))
    if (selectedGuest && selectedGuest.phone === phone) {
      setSelectedGuest({ ...selectedGuest, staffNotes: notes })
    }
  }

  // Filtered Customer List
  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    return customers.filter((c) => {
      const text = `${c.name} ${c.phone}`.toLowerCase()
      const matchesSearch = text.includes(query.toLowerCase())
      if (!matchesSearch) return false

      const diffDays = Math.floor((Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24))

      if (filterSegment === 'vip') return c.totalSpent >= 1500 || c.ordersCount >= 3
      if (filterSegment === 'repeat') return c.ordersCount >= 2
      if (filterSegment === 'inactive') return diffDays > 30
      if (filterSegment === 'veg') return c.isVegDiner

      return true
    })
  }, [customers, query, filterSegment])

  // CRM Aggregations
  const totalProfiles = customers?.length || 0
  const totalRevenueAll = customers?.reduce((sum, c) => sum + c.totalSpent, 0) || 0
  const avgLtv = totalProfiles ? totalRevenueAll / totalProfiles : 0
  const vipCount = customers?.filter((c) => c.totalSpent >= 1500 || c.ordersCount >= 3).length || 0
  const repeatersCount = customers?.filter((c) => c.ordersCount >= 2).length || 0
  const repeatRate = totalProfiles ? ((repeatersCount / totalProfiles) * 100).toFixed(1) : '0.0'

  // Format WhatsApp Link
  const getWhatsAppUrl = (phone: string, message: string) => {
    const clean = phone.replace(/[^0-9]/g, '')
    const formatted = clean.length === 10 ? `91${clean}` : clean
    return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`
  }

  // Export Customer CSV
  const handleExportCsv = () => {
    if (!filteredCustomers.length) return alert('No customers to export.')
    const headers = ['Guest Name,Phone Number,Total Orders,Lifetime Spend (INR),AOV (INR),Last Visited,Segment']
    const rows = filteredCustomers.map((c) => {
      const tag = getSegmentTag(c).label
      return `"${c.name}","${c.phone}",${c.ordersCount},${c.totalSpent.toFixed(2)},${c.aov.toFixed(2)},"${new Date(
        c.lastVisit
      ).toLocaleDateString('en-IN')}","${tag}"`
    })

    const csvContent = [headers, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `customer-crm-${filterSegment}-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Open WhatsApp Broadcast Modal
  const openBroadcastModal = () => {
    setBroadcastMessage(
      `Hello! Greetings from ${restaurantName} 🍽️. We miss you! Enjoy an exclusive 15% OFF on your next dine-in or takeaway order. Show this message at checkout!`
    )
    setBroadcastModalOpen(true)
  }

  if (loading && !customers) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-semibold">Loading Commercial Restaurant CRM Database…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white">
      {/* HEADER & ACTION BAR */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Users className="size-4" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Customer CRM &amp; Guest Loyalty
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Guest profiles, lifetime value (LTV) metrics, WhatsApp engagement, &amp; 360° order history.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openBroadcastModal}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
            >
              <MessageCircle className="size-4" />
              <span>📲 WhatsApp Broadcast</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
            >
              <Download className="size-4 text-primary" />
              <span>📥 Export Guest CSV</span>
            </button>
          </div>
        </div>

        {/* Search & Segment Filter Pills */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest name or mobile number…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFilterSegment('all')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                filterSegment === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Guests ({totalProfiles})
            </button>
            <button
              onClick={() => setFilterSegment('vip')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                filterSegment === 'vip'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              👑 VIPs ({vipCount})
            </button>
            <button
              onClick={() => setFilterSegment('repeat')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                filterSegment === 'repeat'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-sky-700 dark:text-sky-400 hover:bg-sky-500/10'
              }`}
            >
              🔁 Repeaters ({repeatersCount})
            </button>
            <button
              onClick={() => setFilterSegment('inactive')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                filterSegment === 'inactive'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 dark:text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              ⚠️ Inactive (&gt;30 Days)
            </button>
            <button
              onClick={() => setFilterSegment('veg')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                filterSegment === 'veg'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              🟢 Pure Veg Diners
            </button>
          </div>
        </div>
      </div>

      {/* 1. SUMMARY KPI BAND */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Guest Profiles */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Users className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-2.5 py-1 text-xs font-extrabold">
              <span>Database</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Guest Profiles
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {totalProfiles} <span className="text-sm font-bold text-slate-400">Guests</span>
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Unique phone numbers from QR orders
          </p>
        </div>

        {/* KPI 2: VIP Regulars */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
              <Crown className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 text-xs font-extrabold">
              <span>Spend &gt; ₹1.5k 👑</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              VIP Regular Diners
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {vipCount} <span className="text-sm font-bold text-slate-400">VIPs</span>
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Top revenue generating customers
          </p>
        </div>

        {/* KPI 3: Repeat Visitor Rate */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/20">
              <TrendingUp className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2.5 py-1 text-xs font-extrabold">
              <span>{repeatersCount} Guests</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Repeat Visitor Rate
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {repeatRate}%
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Percentage of guests with 2+ visits
          </p>
        </div>

        {/* KPI 4: Average Guest LTV */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 text-xs font-extrabold">
              <span>Avg LTV</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Average Guest LTV
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {money(avgLtv)}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Lifetime value per registered guest
          </p>
        </div>
      </div>

      {/* 2. RICH CUSTOMER DATA TABLE */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4">Guest &amp; Contact</th>
                <th className="p-4">Customer Tag</th>
                <th className="p-4">Visits &amp; Orders</th>
                <th className="p-4">Lifetime Spend</th>
                <th className="p-4">Last Visited</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredCustomers.map((c) => {
                const tag = getSegmentTag(c)
                const initials = c.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)

                const defaultWhatsAppMsg = `Hello ${c.name}, warm greetings from ${restaurantName}! 🍽️ We loved serving you at ${c.lastTable}. Hope to see you again soon!`

                return (
                  <tr key={c.phone} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Guest Avatar & Name */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-black text-xs shadow-sm">
                          {initials}
                        </span>
                        <div>
                          <b className="text-sm font-bold text-slate-900 dark:text-white block">{c.name}</b>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                            <Phone className="mr-1 inline size-3" />
                            {c.phone}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Customer Tag */}
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider border ${tag.tone}`}>
                        {tag.label}
                      </span>
                    </td>

                    {/* Visits & AOV */}
                    <td className="p-4">
                      <b className="text-slate-900 dark:text-white font-bold block">{c.ordersCount} Orders</b>
                      <span className="text-slate-400 font-medium block">AOV: {money(c.aov)}</span>
                    </td>

                    {/* Lifetime Spend */}
                    <td className="p-4">
                      <b className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
                        {money(c.totalSpent)}
                      </b>
                      {c.totalSpent >= 1500 && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                          Top 5% Spender 🌟
                        </span>
                      )}
                    </td>

                    {/* Last Visited */}
                    <td className="p-4">
                      <b className="text-slate-900 dark:text-white font-bold block">
                        {formatRelativeTime(c.lastVisit)}
                      </b>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {c.lastTable}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={getWhatsAppUrl(c.phone, defaultWhatsAppMsg)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-700/80 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition-all shadow-xs"
                          title="Send Direct WhatsApp Message"
                        >
                          <MessageCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>

                        <button
                          onClick={() => setSelectedGuest(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs"
                        >
                          <span>👁️ View 360°</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!filteredCustomers.length && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No matching customer profiles found in this segment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. GUEST 360° DRAWER */}
      {selectedGuest && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setSelectedGuest(null)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto border-l-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-6 font-sans text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedGuest.name}</h2>
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${getSegmentTag(selectedGuest).tone}`}>
                    {getSegmentTag(selectedGuest).label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  <Phone className="mr-1 inline size-3.5 text-primary" />
                  {selectedGuest.phone}
                </p>
              </div>

              <button
                onClick={() => setSelectedGuest(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Visits</span>
                <b className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {selectedGuest.ordersCount}
                </b>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Lifetime LTV</span>
                <b className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {money(selectedGuest.totalSpent)}
                </b>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Spend</span>
                <b className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {money(selectedGuest.aov)}
                </b>
              </div>
            </div>

            {/* Favorite Dishes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Heart className="size-4 text-rose-500" />
                <span>Top Favorite Dishes</span>
              </h3>

              <div className="space-y-2">
                {selectedGuest.favoriteDishes.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                  >
                    <span className="text-slate-900 dark:text-white">{d.name}</span>
                    <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 font-mono text-[11px]">
                      Ordered {d.count}x
                    </span>
                  </div>
                ))}
                {!selectedGuest.favoriteDishes.length && (
                  <p className="text-xs text-slate-400 italic">No favorite dish records yet.</p>
                )}
              </div>
            </div>

            {/* Editable Staff Notes */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="size-4 text-amber-500" />
                <span>Staff Private Notes</span>
              </h3>
              <textarea
                value={selectedGuest.staffNotes}
                onChange={(e) => handleSaveStaffNote(selectedGuest.phone, e.target.value)}
                placeholder="Add private guest preferences e.g. likes table near window, extra spicy..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Order History Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="size-4 text-sky-500" />
                <span>Recent Order Timeline ({selectedGuest.history.length})</span>
              </h3>

              <div className="space-y-3">
                {selectedGuest.history.slice(0, 5).map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900 dark:text-white">Order #{ord.order_number}</span>
                      <span
                        className={
                          ord.payment_status === 'paid'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {ord.payment_status === 'paid' ? `Paid · ${ord.payment_method || 'Cash'}` : 'Unpaid'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>{new Date(ord.created_at).toLocaleString('en-IN')}</span>
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        {ord.restaurant_tables?.table_number
                          ? `Table ${ord.restaurant_tables.table_number}`
                          : 'Takeaway'}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 font-medium pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      {ord.restaurant_order_items?.map((i) => `${i.item_name} (x${i.quantity})`).join(', ')}
                    </p>

                    <div className="text-right font-black text-slate-900 dark:text-white text-sm">
                      {money(ord.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Promo Trigger */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href={getWhatsAppUrl(
                  selectedGuest.phone,
                  `Hello ${selectedGuest.name}! Here is an exclusive VIP Promo Code [SPECIAL15] for 15% OFF your next visit at ${restaurantName}! 🎁`
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-xs font-bold text-white shadow-md transition-all active:scale-95"
              >
                <Send className="size-4" />
                <span>🎁 Send Exclusive WhatsApp Promo Coupon</span>
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* 4. WHATSAPP BROADCAST MODAL */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 text-emerald-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  WhatsApp Segment Broadcast
                </h3>
              </div>
              <button
                onClick={() => setBroadcastModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Broadcast message to target segment: <b className="text-primary">{filterSegment.toUpperCase()}</b> ({filteredCustomers.length} recipients)
            </p>

            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
            />

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBroadcastModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <a
                href={getWhatsAppUrl(filteredCustomers[0]?.phone || '', broadcastMessage)}
                target="_blank"
                rel="noreferrer"
                onClick={() => setBroadcastModalOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-md active:scale-95"
              >
                <Send className="size-4" />
                <span>Launch Broadcast</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
