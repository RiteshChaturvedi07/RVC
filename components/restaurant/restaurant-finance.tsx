'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  IndianRupee,
  Lock,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  Wallet,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'
import { printReceipt } from '@/components/restaurant/order-receipt'
import { printThermalZReport, ZReportExpense } from '@/lib/print-engine'

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export type OrderItem = {
  item_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export type Order = {
  id: string
  order_number: number
  total: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  status: string
  payment_status: string
  payment_method: string | null
  created_at: string
  restaurant_tables: { table_number: string } | null
  restaurant_order_items: OrderItem[]
}

export type PettyExpense = {
  id: string
  category: string
  vendor_note: string
  logged_by: string
  amount: number
  created_at: string
}

export const EXPENSE_CATEGORIES = [
  'Dairy/Milk 🥛',
  'Vegetables/Mandi 🥬',
  'Ice/Water 🧊',
  'Staff Tea ☕',
  'Packaging 📦',
  'Gas/Fuel ⛽',
  'Other 🔧',
]

const money = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export function RestaurantFinance() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [expenses, setExpenses] = useState<PettyExpense[]>([])
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [period, setPeriod] = useState<Period>('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('all')
  const [chosenOrder, setChosenOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cash Register State
  const [openingFloat, setOpeningFloat] = useState<number>(2000)
  const [actualCountedCash, setActualCountedCash] = useState<string>('')
  const [shiftClosed, setShiftClosed] = useState<boolean>(false)
  const [closingNotice, setClosingNotice] = useState<string>('')

  // Modals
  const [expenseModal, setExpenseModal] = useState(false)
  const [floatModal, setFloatModal] = useState(false)

  // Expense Form State
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0])
  const [expenseNote, setExpenseNote] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')

  // Float Input State
  const [newFloatInput, setNewFloatInput] = useState('2000')

  // Load Finance Data
  const loadFinanceData = async () => {
    setLoading(true)
    try {
      const tenant = await currentRestaurantTenant()
      const db = createClient()

      const [{ data: orderData, error: orderErr }, { data: settings }] = await Promise.all([
        db
          .from('restaurant_orders')
          .select(
            'id,order_number,total,subtotal,tax_amount,discount_amount,status,payment_status,payment_method,created_at,restaurant_tables(table_number),restaurant_order_items(item_name,quantity,unit_price,line_total)'
          )
          .eq('tenant_id', tenant)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        db.from('restaurant_settings').select('display_name').eq('tenant_id', tenant).single(),
      ])

      if (orderErr) throw orderErr
      setOrders((orderData ?? []) as unknown as Order[])
      setRestaurantName(settings?.display_name || 'Restaurant')

      // Fetch expenses if table exists, otherwise load local state
      try {
        const { data: expenseData } = await db
          .from('restaurant_expenses')
          .select('*')
          .eq('tenant_id', tenant)
          .order('created_at', { ascending: false })

        if (expenseData) {
          setExpenses(
            expenseData.map((e: any) => ({
              id: e.id,
              category: e.category || 'Other',
              vendor_note: e.vendor_note || e.note || '',
              logged_by: e.logged_by || 'Admin',
              amount: Number(e.amount || 0),
              created_at: e.created_at,
            }))
          )
        }
      } catch {
        // Table fallback
      }

      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load financial transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFinanceData()
    const interval = setInterval(() => void loadFinanceData(), 10000)
    return () => clearInterval(interval)
  }, [])

  // Filtered Orders Calculation
  const filteredOrders = useMemo(() => {
    if (!orders) return []
    const now = new Date()
    const start = new Date(now)
    const end = new Date(now)

    if (period === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (period === 'yesterday') {
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
    } else if (period === 'custom') {
      if (from) start.setTime(new Date(from).getTime())
      if (to) {
        end.setTime(new Date(to).getTime())
        end.setHours(23, 59, 59, 999)
      }
    }

    return orders.filter((o) => {
      const date = new Date(o.created_at)
      const text = `${o.order_number} ${o.restaurant_tables?.table_number || ''} ${o.payment_method || ''}`.toLowerCase()

      const matchMethod =
        method === 'all' ||
        (method === 'cash' && o.payment_method === 'cash' && o.payment_status === 'paid') ||
        (method === 'online' && o.payment_method === 'online' && o.payment_status === 'paid') ||
        (method === 'unpaid' && o.payment_status !== 'paid')

      return date >= start && date <= end && matchMethod && text.includes(query.toLowerCase())
    })
  }, [orders, period, from, to, query, method])

  // Financial Computations
  const settledOrders = filteredOrders.filter((o) => o.payment_status === 'paid')
  const cashSales = settledOrders
    .filter((o) => o.payment_method === 'cash')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)

  const upiSales = settledOrders
    .filter((o) => o.payment_method === 'online' || o.payment_method === 'upi')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)

  const upiCount = settledOrders.filter((o) => o.payment_method === 'online' || o.payment_method === 'upi').length
  const grossRevenue = cashSales + upiSales
  const unpaidDues = filteredOrders
    .filter((o) => o.payment_status !== 'paid')
    .reduce((sum, o) => sum + Number(o.total || 0), 0)

  const totalPettyExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const expectedCashInDrawer = openingFloat + cashSales - totalPettyExpenses

  // GST Calculation (Assuming 5% GST inclusive)
  const taxableSales = grossRevenue / 1.05
  const totalGst = grossRevenue - taxableSales
  const cgst = totalGst / 2
  const sgst = totalGst / 2

  // Discrepancy Calculation
  const actualCashNum = actualCountedCash !== '' ? Number(actualCountedCash) : expectedCashInDrawer
  const discrepancy = actualCashNum - expectedCashInDrawer

  // Add Petty Expense
  const handleAddExpense = async () => {
    const amt = Number(expenseAmount)
    if (isNaN(amt) || amt <= 0) return alert('Enter a valid expense amount.')

    const newExpense: PettyExpense = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
      category: expenseCategory,
      vendor_note: expenseNote.trim() || 'General Petty Cash',
      logged_by: 'Cashier / Admin',
      amount: amt,
      created_at: new Date().toISOString(),
    }

    setExpenses((prev) => [newExpense, ...prev])

    // Try saving to Supabase
    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()
      await db.from('restaurant_expenses').insert({
        id: newExpense.id,
        tenant_id: tenantId,
        category: newExpense.category,
        vendor_note: newExpense.vendor_note,
        logged_by: newExpense.logged_by,
        amount: newExpense.amount,
        created_at: newExpense.created_at,
      })
    } catch {
      // Ignored if table not created
    }

    setExpenseNote('')
    setExpenseAmount('')
    setExpenseModal(false)
  }

  // Delete Petty Expense
  const handleDeleteExpense = async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    try {
      const db = createClient()
      await db.from('restaurant_expenses').delete().eq('id', id)
    } catch {
      // Ignored
    }
  }

  // Save Opening Float
  const handleSaveFloat = () => {
    const val = Number(newFloatInput)
    if (!isNaN(val) && val >= 0) {
      setOpeningFloat(val)
      setFloatModal(false)
    }
  }

  // Trigger Thermal Z-Report Print
  const handlePrintZReport = () => {
    printThermalZReport({
      restaurant: restaurantName,
      date: new Date().toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      shiftStatus: shiftClosed ? 'SHIFT CLOSED & LOCKED' : 'LIVE SHIFT OPEN',
      openingFloat,
      grossRevenue,
      cashSales,
      upiSales,
      unpaidDues,
      pettyExpenses: totalPettyExpenses,
      expectedCash: expectedCashInDrawer,
      actualCash: actualCashNum,
      discrepancy,
      taxableSales,
      cgst,
      sgst,
      totalTax: totalGst,
      expenseLedger: expenses.map((e) => ({
        category: e.category,
        note: e.vendor_note,
        amount: e.amount,
        time: new Date(e.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      })),
    })
  }

  // Close & Lock Register Session
  const handleSettleAndClose = async () => {
    if (!confirm('Are you sure you want to CLOSE & LOCK today’s register shift?')) return
    setShiftClosed(true)
    setClosingNotice(`🔒 Shift Closed & Locked on ${new Date().toLocaleTimeString('en-IN')}.`)

    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()
      await db.from('restaurant_daily_closing').insert({
        tenant_id: tenantId,
        opening_float: openingFloat,
        gross_revenue: grossRevenue,
        cash_sales: cashSales,
        upi_sales: upiSales,
        petty_expenses: totalPettyExpenses,
        expected_cash: expectedCashInDrawer,
        actual_cash: actualCashNum,
        discrepancy,
        closed_at: new Date().toISOString(),
      })
    } catch {
      // Fallback
    }
  }

  // Export Financial CSV Ledger
  const handleExportCsv = () => {
    const rows = [
      'Order Number,Date,Table,Payment Method,Settlement Status,Amount (INR)',
      ...filteredOrders.map(
        (o) =>
          `"#${o.order_number}","${new Date(o.created_at).toLocaleString('en-IN')}","${
            o.restaurant_tables?.table_number ? 'Table ' + o.restaurant_tables.table_number : 'Takeaway'
          }","${o.payment_method || 'unpaid'}","${o.payment_status}",${o.total}`
      ),
    ]

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `financial-ledger-${period}-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export GST CSV
  const handleExportGstCsv = () => {
    const rows = [
      'Tax Period,Gross Revenue (INR),Net Taxable Sales (INR),CGST @ 2.5% (INR),SGST @ 2.5% (INR),Total GST @ 5% (INR)',
      `"${period.toUpperCase()}",${grossRevenue.toFixed(2)},${taxableSales.toFixed(2)},${cgst.toFixed(2)},${sgst.toFixed(2)},${totalGst.toFixed(2)}`,
    ]

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `gst-tax-accounting-${period}-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Settle Order Trigger
  const handleSettleOrder = async (payMethod: 'cash' | 'online') => {
    if (!chosenOrder) return
    try {
      const db = createClient()
      const { error } = await db.rpc('complete_restaurant_order', {
        p_order_id: chosenOrder.id,
        p_method: payMethod,
        p_reference: null,
      })
      if (error) throw error
      setChosenOrder(null)
      await loadFinanceData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to settle order')
    }
  }

  if (loading && !orders) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-semibold">Loading POS Financial Reconciliation Ledger…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white">
      {/* HEADER & TIME FILTER BAR */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Receipt className="size-4" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Finance &amp; POS Reconciliation
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Live cash register balancing, petty cash ledger, GST tax splits, &amp; Day-End Z-Report thermal printing.
            </p>
          </div>

          {/* Action Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
            >
              <Download className="size-4 text-primary" />
              <span>📥 Export Ledger CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['today', 'yesterday', 'week', 'month', 'custom'] as Period[]).map((val) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  period === val
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="size-3.5" />
                <span>
                  {val === 'week'
                    ? 'Last 7 Days'
                    : val === 'month'
                    ? 'This Month'
                    : val === 'custom'
                    ? 'Custom Range'
                    : val[0].toUpperCase() + val.slice(1)}
                </span>
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}
        </div>
      </div>

      {closingNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{closingNotice}</span>
        </div>
      )}

      {/* 1. TOP FINANCIAL SUMMARY BAND (4 KPI Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Gross Revenue */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
              <DollarSign className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 text-xs font-extrabold">
              <span>Gross Total 🟢</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gross Revenue Today
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {money(grossRevenue)}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total settled across all sales channels
          </p>
        </div>

        {/* Card 2: UPI / Online Collections */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
              <CreditCard className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-1 text-xs font-extrabold">
              <span>{grossRevenue ? ((upiSales / grossRevenue) * 100).toFixed(0) : 0}% Share</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              UPI / Online Collections
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {money(upiSales)}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {upiCount} QR scan transactions
          </p>
        </div>

        {/* Card 3: Cash in Drawer */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
              <Wallet className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 text-xs font-extrabold">
              <span>{grossRevenue ? ((cashSales / grossRevenue) * 100).toFixed(0) : 0}% Share</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cash Sales Collected
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {money(cashSales)}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Direct cash received in register
          </p>
        </div>

        {/* Card 4: Petty Expenses */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
              <Coins className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 text-xs font-extrabold">
              <span>{expenses.length} Entries</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Petty Expenses (Paid Out)
            </span>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {money(totalPettyExpenses)}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Daily operational cash payouts
          </p>
        </div>
      </div>

      {/* 2. TWO-COLUMN RECONCILIATION & CLOSING LAYOUT */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN (60% Width - 7 Cols): Petty Cash Ledger & GST Summary */}
        <div className="lg:col-span-7 space-y-6">
          {/* Petty Cash Action Bar & Table */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="size-5 text-amber-500" />
                  <span>Daily Petty Cash Expense Ledger</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Track vendor payouts, Mandi cash, staff tea, and daily emergency outlays.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFloatModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  <Plus className="size-3.5" />
                  <span>Opening Float</span>
                </button>

                <button
                  onClick={() => setExpenseModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-sm transition-all active:scale-95"
                >
                  <Plus className="size-3.5" />
                  <span>Log Petty Expense</span>
                </button>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Vendor / Note</th>
                    <th className="p-3">Time</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{exp.category}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                        {exp.vendor_note}
                        <span className="block text-[10px] text-slate-400">By: {exp.logged_by}</span>
                      </td>
                      <td className="p-3 text-slate-400 font-medium">
                        {new Date(exp.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400">
                        -{money(exp.amount)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => void handleDeleteExpense(exp.id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                          title="Delete expense entry"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!expenses.length && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-slate-400 font-medium">
                        No petty cash expenses logged today. Click "Log Petty Expense" above to add outlays.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Tax / GST Accounting Card */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-black text-slate-900 dark:text-white">Daily GST Tax Accounting</h3>
              </div>

              <button
                onClick={handleExportGstCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700/80 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/20 transition-all"
              >
                <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export GST CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Net Taxable Sales</span>
                <b className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                  {money(taxableSales)}
                </b>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">CGST (2.5%)</span>
                <b className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">{money(cgst)}</b>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">SGST (2.5%)</span>
                <b className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">{money(sgst)}</b>
              </div>

              <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold block uppercase text-[10px]">
                  Total GST (5%)
                </span>
                <b className="text-sm font-black mt-0.5 block">{money(totalGst)}</b>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (40% Width - 5 Cols): Cash Register Closing & Z-Report */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
            {/* Shift Status Badge */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <h3 className="font-black text-slate-900 dark:text-white">Cash Register Shift Closing</h3>
              </div>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black uppercase ${
                  shiftClosed
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                }`}
              >
                {shiftClosed ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                <span>{shiftClosed ? 'Shift Closed' : 'Shift Open'}</span>
              </span>
            </div>

            {/* Real-Time Cash Balancing Formula Card */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold">
                <span>(+) Opening Float:</span>
                <b className="text-slate-900 dark:text-white">{money(openingFloat)}</b>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold">
                <span>(+) Cash Sales Collected:</span>
                <b className="text-emerald-600 dark:text-emerald-400">+{money(cashSales)}</b>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-semibold">
                <span>(-) Petty Expenses Paid:</span>
                <b className="text-rose-600 dark:text-rose-400">-{money(totalPettyExpenses)}</b>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm font-black text-slate-900 dark:text-white">
                <span>(=) Expected Cash in Drawer:</span>
                <span className="text-primary font-mono text-base">{money(expectedCashInDrawer)}</span>
              </div>
            </div>

            {/* Actual Counted Cash Input & Discrepancy Pill */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actual Counted Cash in Register Drawer (₹)
              </label>

              <div className="relative">
                <IndianRupee className="absolute left-3.5 top-3 size-4 text-slate-400" />
                <input
                  type="number"
                  value={actualCountedCash}
                  onChange={(e) => setActualCountedCash(e.target.value)}
                  placeholder={expectedCashInDrawer.toString()}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-sm font-mono font-black text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Discrepancy Pill */}
              <div className="pt-1">
                {discrepancy === 0 ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>Audit Result:</span>
                    </span>
                    <span className="font-mono">🟢 Exact Match (₹0.00)</span>
                  </div>
                ) : discrepancy < 0 ? (
                  <div className="flex items-center justify-between rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="size-4 text-rose-600" />
                      <span>Audit Result:</span>
                    </span>
                    <span className="font-mono">🔴 Shortage (-{money(Math.abs(discrepancy))})</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="size-4 text-amber-600" />
                      <span>Audit Result:</span>
                    </span>
                    <span className="font-mono">🟡 Surplus (+{money(discrepancy)})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons: Z-Report & Settle/Close */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <button
                onClick={handlePrintZReport}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
              >
                <Printer className="size-4 text-primary" />
                <span>🖨️ Print Day-End Z-Report (Thermal)</span>
              </button>

              <button
                disabled={shiftClosed}
                onClick={() => void handleSettleAndClose()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-3 text-xs font-bold text-white shadow-md transition-all active:scale-95"
              >
                <Lock className="size-4" />
                <span>🔒 Settle &amp; Close Register Shift</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TRANSACTION LEDGER TABLE WITH UNPAID SETTLEMENT ACTION */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            <span>Detailed Order Transaction Ledger ({filteredOrders.length})</span>
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search order # or table…"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash Only</option>
              <option value="online">Online / UPI Only</option>
              <option value="unpaid">Unpaid Dues</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-3">Order Number</th>
                <th className="p-3">Date &amp; Time</th>
                <th className="p-3">Table / Channel</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-extrabold text-slate-900 dark:text-white">#{o.order_number}</td>
                  <td className="p-3 text-slate-500 font-medium">
                    {new Date(o.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {o.restaurant_tables?.table_number ? `Table ${o.restaurant_tables.table_number}` : 'Takeaway'}
                    </span>
                  </td>
                  <td className="p-3">
                    {o.payment_status !== 'paid' ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-bold">
                        ⏳ Pending / Unpaid
                      </span>
                    ) : o.payment_method === 'cash' ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold">
                        💵 Cash
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-0.5 text-[11px] font-bold">
                        💳 UPI / Online
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-black text-slate-900 dark:text-white">{money(o.total)}</td>
                  <td className="p-3 font-bold">
                    <span
                      className={
                        o.payment_status === 'paid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {o.payment_status === 'paid' ? (
                      <button
                        onClick={() =>
                          printReceipt({
                            restaurant: restaurantName,
                            table: o.restaurant_tables?.table_number || 'Takeaway',
                            orders: [
                              {
                                ...o,
                                items: o.restaurant_order_items.map((i) => ({
                                  name: i.item_name,
                                  quantity: i.quantity,
                                  unit_price: i.unit_price,
                                  line_total: i.line_total,
                                })),
                              },
                            ],
                            discount: Number(o.discount_amount || 0),
                            tax: Number(o.tax_amount || 0),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                      >
                        <Printer className="size-3.5 text-primary" />
                        <span>Print Bill</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setChosenOrder(o)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary hover:opacity-90 px-3 py-1 text-xs font-bold text-primary-foreground shadow-xs"
                      >
                        ⚡ Settle Bill
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {!filteredOrders.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-400 font-medium">
                    No transactions match the selected time filter and payment status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: LOG PETTY EXPENSE MODAL */}
      {expenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="size-5 text-amber-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Log Daily Petty Cash Expense</h3>
              </div>
              <button
                onClick={() => setExpenseModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Category Preset
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Vendor Name / Description Note
              </label>
              <input
                type="text"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                placeholder="e.g. Mandi Vegetable vendor, 20L water cans"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Paid Out Amount (₹) *
              </label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="e.g. 450"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-sm font-mono font-black text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpenseModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddExpense()}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2 text-xs font-bold text-slate-950 shadow-md"
              >
                Log Outlay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OPENING FLOAT MODAL */}
      {floatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="size-5 text-primary" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Set Register Opening Float</h3>
              </div>
              <button
                onClick={() => setFloatModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Opening Cash Float (₹)
              </label>
              <input
                type="number"
                value={newFloatInput}
                onChange={(e) => setNewFloatInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-sm font-mono font-black text-slate-900 dark:text-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Initial change/cash loaded into the cash drawer at shift start.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFloatModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFloat}
                className="rounded-xl bg-primary hover:opacity-90 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md"
              >
                Save Float
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SETTLE ORDER MODAL */}
      {chosenOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Settle Order #{chosenOrder.order_number}
              </h3>
              <button
                onClick={() => setChosenOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-semibold">
              Select payment method to mark this ticket as settled:
            </p>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-bold uppercase block">Amount Due</span>
              <b className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {money(chosenOrder.total)}
              </b>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => void handleSettleOrder('cash')}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-extrabold text-white shadow-md active:scale-95"
              >
                💵 Cash Settlement
              </button>

              <button
                onClick={() => void handleSettleOrder('online')}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-extrabold text-white shadow-md active:scale-95"
              >
                💳 UPI / Online Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
