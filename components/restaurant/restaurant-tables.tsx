'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Coffee,
  CreditCard,
  Download,
  Edit3,
  Grid,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  Users,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

type Table = {
  id: string
  table_number: string
  display_name: string | null
  status: string
  seats: number | null
  created_at?: string
  bill_requested?: boolean
  requested_payment_mode?: string | null
}

type Order = {
  id: string
  order_number: number
  status: string
  payment_status: string
  payment_method: string | null
  requested_payment_mode?: 'cash' | 'upi' | null
  bill_requested?: boolean
  bill_requested_at?: string | null
  total: number
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  restaurant_order_items: { item_name: string; quantity: number }[]
}

const db = () => createClient()

export function formatTableBadge(num: string | null | undefined): string {
  if (!num) return 'T-01'
  const trimmed = num.trim()
  if (/^\d+$/.test(trimmed)) {
    return `T-${trimmed.padStart(2, '0')}`
  }
  return trimmed
}

const money = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export function printTableQrStand(table: Table, restaurantName: string, qrDataUrl: string) {
  const windowRef = window.open('', '_blank', 'width=460,height=680')
  if (!windowRef) return

  const tableTag = formatTableBadge(table.table_number)

  windowRef.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>QR Stand - ${tableTag}</title>
        <style>
          @page { size: A6 portrait; margin: 8mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 16px;
            text-align: center;
            background: #ffffff;
            color: #0f172a;
          }
          .stand-card {
            border: 3px double #0284c7;
            border-radius: 24px;
            padding: 24px 16px;
            max-width: 320px;
            margin: 0 auto;
            background: #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          }
          .logo-icon {
            font-size: 26px;
            margin-bottom: 4px;
          }
          .brand {
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            color: #0284c7;
            margin: 0;
          }
          .table-title {
            font-size: 30px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #0f172a;
            margin: 10px 0 4px 0;
          }
          .seat-tag {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            background: #f1f5f9;
            padding: 3px 12px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .qr-wrapper {
            background: #ffffff;
            border: 2px solid #e2e8f0;
            border-radius: 20px;
            padding: 12px;
            display: inline-block;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
          }
          .qr-img {
            width: 220px;
            height: 220px;
            display: block;
            border-radius: 12px;
          }
          .instructions {
            margin-top: 16px;
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
          }
          .sub {
            font-size: 10px;
            font-weight: 600;
            color: #64748b;
            margin-top: 3px;
          }
          .cut-guide {
            border-top: 1px dashed #cbd5e1;
            margin-top: 24px;
            padding-top: 8px;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="stand-card">
          <div class="logo-icon">☕</div>
          <div class="brand">${restaurantName}</div>
          <div class="table-title">TABLE ${tableTag}</div>
          <div class="seat-tag">👥 ${table.seats || 4} SEATS CAPACITY</div>

          <div class="qr-wrapper">
            <img src="${qrDataUrl}" class="qr-img" alt="QR Code" onload="window.print();" />
          </div>

          <div class="instructions">📱 Point Camera to View Menu & Order</div>
          <div class="sub">⚡ No app download required • Instant Kitchen Sync</div>
          <div class="cut-guide">✂ CUT / INSERT INTO ACRYLIC STAND (A6 FORMAT)</div>
        </div>
      </body>
    </html>
  `)
  windowRef.document.close()
}

export function RestaurantTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [tenant, setTenant] = useState('')
  const [restaurantName, setRestaurantName] = useState('Restaurant Workspace')
  const [restaurantSlug, setRestaurantSlug] = useState('')
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'bill_req'>('all')
  const [query, setQuery] = useState('')
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [inspectOrders, setInspectOrders] = useState<Order[]>([])
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [clearingId, setClearingId] = useState('')
  const [settling, setSettling] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<Table | null>(null)
  const [showQrStandModal, setShowQrStandModal] = useState<Table | null>(null)
  const [formNumber, setFormNumber] = useState('')
  const [formSeats, setFormSeats] = useState('4')
  const [formNotice, setFormNotice] = useState('')
  const previousRequestsRef = useRef('')

  const load = async () => {
    const currentTenant = tenant || (await currentRestaurantTenant())
    setTenant(currentTenant)

    const [{ data: tableData }, { data: settings }, { data: tenantData }, { data: requestedOrders }] =
      await Promise.all([
        db().from('restaurant_tables').select('*').eq('tenant_id', currentTenant).order('table_number'),
        db().from('restaurant_settings').select('display_name').eq('tenant_id', currentTenant).single(),
        db().from('tenants').select('slug').eq('id', currentTenant).single(),
        db()
          .from('restaurant_orders')
          .select('table_id,requested_payment_mode')
          .eq('tenant_id', currentTenant)
          .eq('bill_requested', true)
          .neq('payment_status', 'paid')
          .in('status', ['new', 'accepted', 'preparing', 'ready', 'served']),
      ])

    const requestByTable = new Map(
      (requestedOrders ?? []).map((order: any) => [order.table_id, order.requested_payment_mode])
    )

    const nextTables = (tableData ?? []).map((table: any) => ({
      ...table,
      bill_requested: requestByTable.has(table.id),
      requested_payment_mode: requestByTable.get(table.id),
    })) as Table[]

    const requests = nextTables
      .filter((table) => table.bill_requested)
      .map((table) => table.id)
      .join(',')

    if (requests && requests !== previousRequestsRef.current) {
      previousRequestsRef.current = requests
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
      } catch {
        // Audio Context muted
      }
    }

    previousRequestsRef.current = requests
    setTables(nextTables)
    setRestaurantName(settings?.display_name || 'RVC Restaurant')
    setRestaurantSlug(tenantData?.slug || '')
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 8000)
    return () => clearInterval(timer)
  }, [tenant])

  // Counts for Top KPI Summary Band
  const totalTables = tables.length
  const availableCount = tables.filter((t) => t.status === 'available' && !t.bill_requested).length
  const billReqCount = tables.filter((t) => t.bill_requested).length
  const occupiedCount = totalTables - availableCount - billReqCount

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const isBillReq = t.bill_requested
      const isOccupied = t.status === 'occupied' || (t.status !== 'available' && !isBillReq)
      const isAvail = t.status === 'available' && !isBillReq

      const matchesFilter =
        filter === 'all' ||
        (filter === 'available' && isAvail) ||
        (filter === 'occupied' && isOccupied) ||
        (filter === 'bill_req' && isBillReq)

      const badgeName = formatTableBadge(t.table_number).toLowerCase()
      const displayName = (t.display_name || '').toLowerCase()
      const searchOk = !query || badgeName.includes(query.toLowerCase()) || displayName.includes(query.toLowerCase())

      return matchesFilter && searchOk
    })
  }, [tables, filter, query])

  const inspectTable = async (table: Table) => {
    setSelectedTable(table)
    const { data: orderData } = await db()
      .from('restaurant_orders')
      .select('id,order_number,status,payment_status,payment_method,requested_payment_mode,bill_requested,bill_requested_at,total,created_at,customer_name,customer_phone,restaurant_order_items(item_name,quantity)')
      .eq('table_id', table.id)
      .in('status', ['new', 'accepted', 'preparing', 'ready', 'served'])
      .order('created_at', { ascending: false })

    const nextOrders = (orderData ?? []) as unknown as Order[]
    setInspectOrders(nextOrders)

    if (restaurantSlug) {
      const fullUrl = `${window.location.origin}/order/${restaurantSlug}/${encodeURIComponent(table.table_number)}`
      setQrCodeDataUrl(await QRCode.toDataURL(fullUrl, { width: 600, margin: 2 }))
    }
  }

  const openQrStandModal = async (table: Table) => {
    setShowQrStandModal(table)
    if (restaurantSlug) {
      const fullUrl = `${window.location.origin}/order/${restaurantSlug}/${encodeURIComponent(table.table_number)}`
      setQrCodeDataUrl(await QRCode.toDataURL(fullUrl, { width: 600, margin: 2 }))
    }
  }

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanNum = formNumber.trim()
    if (!cleanNum) {
      setFormNotice('Enter a table number or name.')
      return
    }

    const { error } = await db().from('restaurant_tables').insert({
      tenant_id: tenant,
      table_number: cleanNum,
      display_name: `Table ${formatTableBadge(cleanNum)}`,
      seats: Number(formSeats) || 4,
    })

    if (error) {
      setFormNotice(error.code === '23505' ? 'A table with this number already exists.' : error.message)
    } else {
      setFormNumber('')
      setFormSeats('4')
      setFormNotice('')
      setShowAddModal(false)
      void load()
    }
  }

  const handleEditTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showEditModal) return

    const { error } = await db()
      .from('restaurant_tables')
      .update({
        display_name: formNumber.trim() || `Table ${formatTableBadge(showEditModal.table_number)}`,
        seats: Number(formSeats) || 4,
      })
      .eq('id', showEditModal.id)

    if (error) {
      setFormNotice(error.message)
    } else {
      setShowEditModal(null)
      void load()
    }
  }

  const handleDeleteTable = async (table: Table) => {
    if (!confirm(`Delete ${formatTableBadge(table.table_number)}? Existing order records will be preserved.`)) return
    const { error } = await db().from('restaurant_tables').delete().eq('id', table.id)
    if (error) alert(error.message)
    else void load()
  }

  const clearTable = async (table: Table) => {
    if (!confirm(`Clear ${formatTableBadge(table.table_number)}? Table will become available.`)) return
    setClearingId(table.id)
    const { error } = await db().rpc('clear_restaurant_table', {
      p_table_id: table.id,
      p_tenant_id: tenant,
    })
    setClearingId('')
    if (error) alert(error.message)
    else {
      if (selectedTable?.id === table.id) setSelectedTable(null)
      void load()
    }
  }

  const settleOrders = async (method: 'cash' | 'online') => {
    if (!inspectOrders.length) return
    setSettling(true)
    const results = await Promise.all(
      inspectOrders
        .filter((o) => o.payment_status !== 'paid')
        .map((o) => db().rpc('complete_restaurant_order', { p_order_id: o.id, p_method: method, p_reference: null }))
    )
    setSettling(false)
    const failed = results.find((r) => r.error)?.error
    if (failed) alert(failed.message)
    else {
      setSelectedTable(null)
      void load()
    }
  }

  const downloadQrCode = (tableNumber: string) => {
    if (!qrCodeDataUrl) return
    const a = document.createElement('a')
    a.href = qrCodeDataUrl
    a.download = `QR-Stand-${formatTableBadge(tableNumber)}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* TITLE & PROMINENT HEADER BUTTON (SINGLE PRIMARY ADD TABLE BUTTON) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tables & QR Command Center</h2>
          <p className="text-sm text-muted-foreground">
            Manage floor capacity, view real-time table bills, and print branded acrylic QR stand cards.
          </p>
        </div>

        <button
          onClick={() => {
            setFormNumber('')
            setFormSeats('4')
            setFormNotice('')
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90"
        >
          <Plus className="size-4" />
          <span>Add New Table</span>
        </button>
      </div>

      {/* TOP KPI METRICS BAND */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Grid className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Total Capacity</span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Tables</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{totalTables}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Ready
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Available Tables</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{availableCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Users className="size-5" />
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Seated
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Occupied Tables</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{occupiedCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <BellRing className="size-5 animate-bounce" />
            </span>
            {billReqCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-slate-950 animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Bill Requested</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{billReqCount}</p>
        </article>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-secondary text-foreground hover:bg-muted'
            }`}
          >
            All Tables ({totalTables})
          </button>

          <button
            onClick={() => setFilter('available')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filter === 'available'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            🟢 Available ({availableCount})
          </button>

          <button
            onClick={() => setFilter('occupied')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filter === 'occupied'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20'
            }`}
          >
            🔴 Occupied ({occupiedCount})
          </button>

          <button
            onClick={() => setFilter('bill_req')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              filter === 'bill_req'
                ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
                : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            🟡 Bill Req ({billReqCount})
          </button>
        </div>

        <label className="relative min-w-[220px]">
          <Search className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search table number or name…"
            className="w-full rounded-xl border border-border bg-background py-2 pl-10 text-xs outline-none focus:border-primary"
          />
        </label>
      </section>

      {/* ENHANCED TABLE CARDS GRID */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTables.map((table) => {
          const isBillReq = table.bill_requested
          const isOccupied = table.status === 'occupied' || (table.status !== 'available' && !isBillReq)

          return (
            <article
              key={table.id}
              className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:shadow-md dark:bg-slate-900 ${
                isBillReq
                  ? 'border-2 border-amber-500/90 shadow-amber-500/10 bg-amber-500/5'
                  : isOccupied
                  ? 'border-red-200 bg-red-50/20 dark:border-red-900/40 dark:bg-red-950/20'
                  : 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/20'
              }`}
            >
              {/* CARD HEADER */}
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight">
                      {table.display_name || formatTableBadge(table.table_number)}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Users className="size-3" />
                      {table.seats || 4} Seats Capacity
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold capitalize ${
                      isBillReq
                        ? 'bg-amber-500 text-slate-950 animate-pulse'
                        : isOccupied
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        isBillReq ? 'bg-slate-950 animate-ping' : isOccupied ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                    />
                    {isBillReq ? 'Bill Req' : isOccupied ? 'Occupied' : 'Available'}
                  </span>
                </div>

                {/* CARD BODY CONTENT */}
                <div className="py-4 space-y-2">
                  {isBillReq && (
                    <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200 font-bold flex items-center gap-2 animate-pulse">
                      <BellRing className="size-4 text-amber-500" />
                      <span>Guest requested payment ({table.requested_payment_mode?.toUpperCase() || 'CASH'})</span>
                    </div>
                  )}

                  {isOccupied && !isBillReq && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1 text-foreground font-semibold">
                        <Clock className="size-3.5 text-primary" />
                        Seated & Ordering
                      </p>
                    </div>
                  )}

                  {!isOccupied && !isBillReq && (
                    <p className="text-xs text-muted-foreground">Ready for new guests to scan & order.</p>
                  )}
                </div>
              </div>

              {/* CARD FOOTER & ACTIONS */}
              <div className="border-t border-border/60 pt-3 space-y-2">
                <div className="flex gap-2">
                  {isOccupied || isBillReq ? (
                    <button
                      onClick={() => void inspectTable(table)}
                      className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5"
                    >
                      <Receipt className="size-3.5" />
                      Inspect Live Bill
                    </button>
                  ) : (
                    <button
                      onClick={() => void openQrStandModal(table)}
                      className="flex-1 rounded-xl border border-border bg-background py-2 text-xs font-semibold hover:bg-secondary flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="size-3.5 text-primary" />
                      View QR Stand
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFormNumber(table.table_number)
                        setFormSeats(String(table.seats || 4))
                        setFormNotice('')
                        setShowEditModal(table)
                      }}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                      title="Edit Seats / Name"
                    >
                      <Edit3 className="size-3.5" /> Edit
                    </button>

                    <button
                      onClick={() => void handleDeleteTable(table)}
                      className="text-red-500 hover:underline flex items-center gap-1"
                      title="Delete Table"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>

                  {(isOccupied || isBillReq) && (
                    <button
                      disabled={clearingId === table.id}
                      onClick={() => void clearTable(table)}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {clearingId === table.id ? 'Clearing…' : 'Clear Table'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {!filteredTables.length && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-2xs dark:bg-slate-900 dark:border-slate-800">
          <Grid className="size-10 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-bold">No tables found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try clearing your filters or create a new table.</p>
        </div>
      )}

      {/* ADD TABLE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleAddTable}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xl font-extrabold">Add New Table</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            {formNotice && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{formNotice}</p>}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Table Number or Identifier:</label>
                <input
                  required
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="e.g. 2, 05, or A-01"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Seating Capacity (Seats):</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formSeats}
                  onChange={(e) => setFormSeats(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
                Create Table
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT TABLE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleEditTable}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xl font-extrabold">Edit Table Details</h3>
              <button type="button" onClick={() => setShowEditModal(null)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            {formNotice && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{formNotice}</p>}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Table Display Name:</label>
                <input
                  required
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Seats Capacity:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formSeats}
                  onChange={(e) => setFormSeats(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PREMIUM ACRYLIC TABLE STAND PREVIEW MODAL */}
      {showQrStandModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
          <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl dark:bg-slate-900 relative">
            <button
              onClick={() => setShowQrStandModal(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-secondary text-muted-foreground"
            >
              <X className="size-5" />
            </button>

            {/* HEADER CARD */}
            <div className="mt-1 flex items-center justify-center gap-2 text-primary font-black uppercase text-xs tracking-widest">
              <Coffee className="size-4" />
              {restaurantName}
            </div>

            <h3 className="mt-2 text-3xl font-black tracking-tight text-foreground">
              TABLE {formatTableBadge(showQrStandModal.table_number)}
            </h3>

            <div className="mt-1 inline-block rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-muted-foreground">
              👥 {showQrStandModal.seats || 4} Seats Capacity
            </div>

            {/* QR CENTERPIECE CONTAINER */}
            <div className="mt-4 rounded-2xl border border-border/80 bg-white p-4 shadow-md inline-block">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Stand ${formatTableBadge(showQrStandModal.table_number)}`}
                  className="size-56 rounded-xl object-contain"
                />
              ) : (
                <div className="size-56 animate-pulse rounded-xl bg-slate-100" />
              )}
            </div>

            {/* FOOTER CAPTION */}
            <div className="mt-4 space-y-1 text-center">
              <p className="text-xs font-extrabold text-foreground">📱 Scan with Camera to View Menu & Order</p>
              <p className="text-[11px] font-medium text-muted-foreground">
                ⚡ No app download required • Instant Kitchen Sync
              </p>
            </div>

            {/* ACTION CONTROLS */}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => downloadQrCode(showQrStandModal.table_number)}
                className="flex-1 rounded-xl border border-border bg-background py-2.5 text-xs font-bold hover:bg-secondary flex items-center justify-center gap-1.5"
              >
                <Download className="size-3.5" />
                Download PNG
              </button>

              <button
                onClick={() => printTableQrStand(showQrStandModal, restaurantName, qrCodeDataUrl)}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5"
              >
                <Printer className="size-3.5" />
                Print Stand (A6)
              </button>
            </div>
          </section>
        </div>
      )}

      {/* LIVE TABLE INSPECTOR & BILL MODAL */}
      {selectedTable && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-xs">
          <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-xl font-extrabold">
                  {formatTableBadge(selectedTable.table_number)} Live Inspector
                </h3>
                <p className="text-xs text-muted-foreground capitalize">Status: {selectedTable.status}</p>
              </div>
              <button onClick={() => setSelectedTable(null)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            {inspectOrders.length > 0 ? (
              <div className="mt-4 space-y-4">
                {selectedTable.bill_requested && (
                  <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 animate-pulse font-bold flex items-center gap-2">
                    <BellRing className="size-4 text-amber-500" />
                    <span>Guest requested bill ({selectedTable.requested_payment_mode?.toUpperCase() || 'CASH'})</span>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-sm">
                    <span>Active Order #{inspectOrders[0]?.order_number}</span>
                    <span className="capitalize text-primary">{inspectOrders[0]?.status}</span>
                  </div>

                  <div className="space-y-1">
                    {inspectOrders
                      .flatMap((o) => o.restaurant_order_items)
                      .map((item, idx) => (
                        <div key={idx} className="flex justify-between text-muted-foreground">
                          <span>
                            {item.item_name} × {item.quantity}
                          </span>
                        </div>
                      ))}
                  </div>

                  <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-extrabold text-foreground">
                    <span>Total Unbilled Amount:</span>
                    <span>{money(inspectOrders.reduce((sum, o) => sum + Number(o.total), 0))}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={settling}
                    onClick={() => void settleOrders('cash')}
                    className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1"
                  >
                    <CreditCard className="size-4" /> Settle Cash
                  </button>

                  <button
                    disabled={settling}
                    onClick={() => void settleOrders('online')}
                    className="rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1"
                  >
                    <Zap className="size-4" /> Settle UPI
                  </button>

                  <button
                    disabled={clearingId === selectedTable.id}
                    onClick={() => void clearTable(selectedTable)}
                    className="col-span-2 rounded-xl border border-emerald-500 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                  >
                    {clearingId === selectedTable.id ? 'Clearing…' : 'Clear Table & Free Capacity'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No active unbilled order on {formatTableBadge(selectedTable.table_number)}.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
