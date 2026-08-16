'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Eye,
  Filter,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'
import { printThermalCustomerBill, printThermalKOT } from '@/lib/print-engine'
import { KOTPrintModal, CustomerBillPrintModal } from '@/components/restaurant/kot-receipt-modal'
import { KOTData, CustomerBillData } from '@/lib/print-engine'

type OrderItem = {
  item_name: string
  quantity: number
  unit_price: number
  line_total: number
  notes?: string | null
}

type Order = {
  id: string
  order_number: number
  status: string
  payment_status: string
  payment_method: string | null
  total: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  coupon_code: string | null
  dining_type?: 'dine_in' | 'takeaway'
  notes?: string | null
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  restaurant_tables: { table_number: string } | null
  restaurant_order_items: OrderItem[]
}

type Tab = 'live' | 'history'

const statuses = ['new', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled']
const liveStatuses = ['new', 'accepted', 'preparing', 'ready', 'served']

const label = (value: string) => (value === 'new' ? 'Received' : value[0].toUpperCase() + value.slice(1))
const dateKey = (value: Date) => value.toISOString().slice(0, 10)
const money = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const elapsed = (value: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  return mins < 1 ? 'Just now' : `${mins}m ago`
}

function formatTableBadge(num: string | null | undefined): string {
  if (!num) return 'T-01'
  const trimmed = num.trim()
  if (/^\d+$/.test(trimmed)) {
    return `T-${trimmed.padStart(2, '0')}`
  }
  return trimmed
}

function ServiceBadge({ order }: { order: Order }) {
  const takeaway = order.dining_type === 'takeaway'
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
          takeaway
            ? 'bg-violet-500/10 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
            : 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
        }`}
      >
        {takeaway ? '🛍️ Takeaway' : '🍽️ Dine-In'}
      </span>
      {order.notes && (
        <small className="mt-1 block max-w-44 truncate text-[11px] text-amber-600 dark:text-amber-400">
          Note: {order.notes}
        </small>
      )}
    </div>
  )
}

function TableOrderItems({ items }: { items: OrderItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const isLarge = items.length > 3
  const visible = isLarge && !expanded ? items.slice(0, 3) : items
  const remaining = items.length - 3

  return (
    <div className="space-y-1 text-xs min-w-[180px]">
      {visible.map((item, idx) => (
        <div key={idx} className="truncate">
          <span className="font-semibold text-foreground">{item.item_name}</span>
          <span className="ml-1 font-bold text-primary">×{item.quantity}</span>
          {item.notes && <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">({item.notes})</span>}
        </div>
      ))}
      {isLarge && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
        >
          {expanded ? (
            <>Collapse items ▴</>
          ) : (
            <>+ {remaining} more item{remaining > 1 ? 's' : ''} ▾</>
          )}
        </button>
      )}
    </div>
  )
}

export function RestaurantOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [tenant, setTenant] = useState('')
  const [tab, setTab] = useState<Tab>('live')
  const [selected, setSelected] = useState<Order | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'custom' | 'all'>('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kotModalData, setKotModalData] = useState<KOTData | null>(null)
  const [billModalData, setBillModalData] = useState<CustomerBillData | null>(null)

  const load = async () => {
    const db = createClient()
    const id = tenant || (await currentRestaurantTenant())
    setTenant(id)
    const { data, error } = await db
      .from('restaurant_orders')
      .select('*,restaurant_tables(table_number),restaurant_order_items(item_name,quantity,unit_price,line_total,notes)')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
    } else {
      setOrders((data ?? []) as Order[])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!tenant) return
    const interval = setInterval(() => void load(), 10000)
    return () => clearInterval(interval)
  }, [tenant])

  const liveOrdersCount = useMemo(
    () => orders.filter((o) => liveStatuses.includes(o.status) && o.payment_status !== 'paid').length,
    [orders]
  )

  const historyOrdersCount = useMemo(
    () => orders.filter((o) => o.payment_status === 'paid' || ['completed', 'closed'].includes(o.status)).length,
    [orders]
  )

  const filtered = useMemo(() => {
    const now = new Date()
    const today = dateKey(now)
    const yesterday = dateKey(new Date(now.getTime() - 86400000))
    const week = new Date(now.getTime() - 6 * 86400000)

    return orders.filter((order) => {
      const day = dateKey(new Date(order.created_at))
      const dateOk =
        period === 'all' ||
        (period === 'today' && day === today) ||
        (period === 'yesterday' && day === yesterday) ||
        (period === 'week' && new Date(order.created_at) >= week) ||
        (period === 'custom' && (!from || day >= from) && (!to || day <= to))

      const inTab =
        tab === 'live'
          ? liveStatuses.includes(order.status) && order.payment_status !== 'paid'
          : order.payment_status === 'paid' || ['completed', 'closed'].includes(order.status)

      const text = `${order.order_number} ${order.customer_name ?? ''} ${order.customer_phone ?? ''} ${
        order.restaurant_tables?.table_number ?? ''
      }`.toLowerCase()

      return dateOk && inTab && (status === 'all' || order.status === status) && text.includes(query.toLowerCase())
    })
  }, [orders, tab, period, status, query, from, to])

  const changeStatus = async (order: Order, next: string) => {
    const db = createClient()
    const { error } = await db
      .from('restaurant_orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (error) alert(error.message)
    else {
      setSelected(null)
      void load()
    }
  }

  const settle = async (order: Order, method: 'cash' | 'online') => {
    const db = createClient()
    const { error } = await db.rpc('complete_restaurant_order', {
      p_order_id: order.id,
      p_method: method,
      p_reference: null,
    })

    if (error) alert(error.message)
    else {
      setSelected(null)
      void load()
    }
  }

  const triggerKotPrint = (order: Order) => {
    setKotModalData({
      restaurant: 'RVC Restaurant',
      table: formatTableBadge(order.restaurant_tables?.table_number),
      orderNumber: order.order_number,
      createdAt: order.created_at,
      diningType: order.dining_type,
      items: order.restaurant_order_items.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        notes: i.notes,
      })),
    })
  }

  const triggerReceiptPrint = (order: Order) => {
    setBillModalData({
      restaurant: 'RVC Restaurant',
      table: formatTableBadge(order.restaurant_tables?.table_number),
      orderNumber: order.order_number,
      createdAt: order.created_at,
      items: order.restaurant_order_items.map((item) => ({
        name: item.item_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
      })),
      subtotal: Number(order.subtotal || order.total),
      discount: Number(order.discount_amount || 0),
      taxAmount: Number(order.tax_amount || 0),
      grandTotal: Number(order.total),
      paymentStatus: order.payment_status === 'paid' ? 'PAID' : 'UNPAID',
    })
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Orders & Live POS Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Live QR orders, kitchen status, and settled bills update automatically every 10 seconds.
          </p>
        </div>
      </div>

      {/* DYNAMIC TAB CONTROL WITH BADGES */}
      <div className="flex gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
        <button
          onClick={() => {
            setTab('live')
            setStatus('all')
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            tab === 'live'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          {liveOrdersCount > 0 && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <span>Active / Live Orders</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
              tab === 'live' ? 'bg-white/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {liveOrdersCount}
          </span>
        </button>

        <button
          onClick={() => {
            setTab('history')
            setStatus('all')
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            tab === 'history'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <span>Order History & Settlements</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
              tab === 'history' ? 'bg-white/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {historyOrdersCount}
          </span>
        </button>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'yesterday', 'week', 'all', 'custom'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                period === value
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-secondary text-foreground hover:bg-muted'
              }`}
            >
              {value === 'week' ? 'Last 7 days' : value === 'custom' ? 'Date range' : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex gap-2 pt-1">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-border bg-background p-2 text-xs"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-border bg-background p-2 text-xs"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Order ID, guest name, phone or table number…"
              className="w-full rounded-xl border border-border bg-background py-2 pl-10 text-sm outline-none focus:border-primary"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold outline-none"
          >
            <option value="all">All Statuses</option>
            {(tab === 'live' ? liveStatuses : statuses).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* DATA TABLE */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="p-4">Order</th>
                <th className="p-4">Guest / Table</th>
                <th className="p-4">Service</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">{tab === 'live' ? 'Status' : 'Payment'}</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((order) => {
                const isReady = order.status === 'ready'
                const isPreparing = order.status === 'preparing'
                const isServed = order.status === 'served'
                const isPaid = order.payment_status === 'paid' || order.status === 'completed'

                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <b className="font-extrabold text-primary text-base">#{order.order_number}</b>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          {formatTableBadge(order.restaurant_tables?.table_number)}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold text-xs text-foreground">
                        {order.customer_name || 'Guest'}
                      </p>
                      {order.customer_phone && (
                        <p className="text-[11px] text-muted-foreground">{order.customer_phone}</p>
                      )}
                    </td>

                    <td className="p-4">
                      <ServiceBadge order={order} />
                    </td>

                    <td className="p-4">
                      <p className="font-semibold text-xs">{elapsed(order.created_at)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    <td className="p-4">
                      <TableOrderItems items={order.restaurant_order_items} />
                    </td>

                    <td className="p-4">
                      <b className="font-extrabold text-foreground">{money(order.total)}</b>
                      <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                        {order.payment_method || 'Unpaid'}
                      </p>
                    </td>

                    <td className="p-4">
                      {tab === 'live' ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            isReady
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : isPreparing
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : isServed
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          <span
                            className={`size-2 rounded-full ${
                              isReady
                                ? 'bg-emerald-500'
                                : isPreparing
                                ? 'bg-blue-500 animate-spin'
                                : isServed
                                ? 'bg-purple-500'
                                : 'bg-amber-500 animate-pulse'
                            }`}
                          />
                          {label(order.status)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Paid ({order.payment_method || 'Settled'})
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {tab === 'live' ? (
                          <>
                            <button
                              onClick={() => triggerKotPrint(order)}
                              className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary flex items-center gap-1"
                              title="Print Thermal Kitchen Ticket"
                            >
                              <Printer className="size-3.5" />
                              KOT
                            </button>

                            <button
                              onClick={() => setSelected(order)}
                              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center gap-1"
                              title="Settle Bill & Update Status"
                            >
                              <Zap className="size-3.5" />
                              Settle Bill
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => triggerReceiptPrint(order)}
                            className="rounded-xl border border-border px-3.5 py-1.5 text-xs font-semibold hover:bg-secondary flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                          >
                            <Receipt className="size-3.5" />
                            Print Receipt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* HIGH-DENSITY ZERO-STATE / EMPTY SCREEN */}
        {!filtered.length && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-card dark:bg-slate-900">
            <span className="grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="size-8" />
            </span>
            <h3 className="mt-4 text-xl font-bold">All Orders Served & Settled!</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {tab === 'live'
                ? 'There are currently no open kitchen tickets or pending table bills.'
                : 'No historical settled orders match your current filters.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {tab === 'live' ? (
                <>
                  <button
                    onClick={() => {
                      setTab('history')
                      setStatus('all')
                    }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
                  >
                    <Receipt className="size-4" />
                    <span>View Order History & Settlements</span>
                  </button>
                  <Link
                    href="/restaurant-dashboard/tables"
                    className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <Plus className="size-4" />
                    <span>New Table / QR Assignment</span>
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => {
                    setPeriod('all')
                    setQuery('')
                    setStatus('all')
                  }}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ORDER INSPECTION & SETTLEMENT MODAL */}
      {selected && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-xs">
          <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-xl font-extrabold">Order #{selected.order_number}</h3>
                <p className="text-xs text-muted-foreground">
                  {formatTableBadge(selected.restaurant_tables?.table_number)} · {selected.customer_name || 'Guest'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-3">
              <ServiceBadge order={selected} />
            </div>

            {selected.notes && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 font-medium">
                <b>General order instruction</b>
                <p className="mt-1">{selected.notes}</p>
              </div>
            )}

            <div className="mt-4 space-y-1.5 text-sm border-t border-border/60 pt-3">
              {selected.restaurant_order_items.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span>
                    {item.item_name} ×{item.quantity}
                  </span>
                  <span className="font-semibold">{money(item.line_total || item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between border-t border-border pt-3 text-lg font-extrabold">
              <span>Total Amount:</span>
              <span>{money(selected.total)}</span>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs font-semibold text-muted-foreground">
                Update Order Status:
                <select
                  value={selected.status}
                  onChange={(e) => void changeStatus(selected, e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs font-semibold outline-none"
                >
                  {liveStatuses.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void settle(selected, 'cash')}
                  className="rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1"
                >
                  <CreditCard className="size-4" /> Cash & Settle
                </button>
                <button
                  onClick={() => void settle(selected, 'online')}
                  className="rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1"
                >
                  <Zap className="size-4" /> UPI & Settle
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* THERMAL PRINT MODALS */}
      {kotModalData && <KOTPrintModal data={kotModalData} onClose={() => setKotModalData(null)} />}
      {billModalData && <CustomerBillPrintModal data={billModalData} onClose={() => setBillModalData(null)} />}
    </div>
  )
}
