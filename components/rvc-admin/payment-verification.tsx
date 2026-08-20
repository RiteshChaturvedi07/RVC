'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  Layers,
  Lock,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
export interface PaymentRequest {
  id: string
  tenant_id: string
  plan_id: string
  amount: number
  billing_cycle: 'monthly' | 'yearly'
  utr_reference: string
  status: 'pending' | 'paid' | 'rejected' | 'refunded'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_note: string | null
  tenants?: { id: string; name: string; slug: string; vertical: string; subscription_expires_at: string | null } | null
  saas_plans?: { name: string; price_monthly: number; price_yearly: number } | null
  owner?: { full_name: string | null; phone: string | null } | null
}

interface PlatformSettings {
  id: boolean
  rvc_upi_id: string | null
  rvc_upi_qr_url: string | null
  invoice_prefix: string | null
}

// Helpers
const inr = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSecs < 60) return `${Math.max(1, diffSecs)}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getVerticalBadgeStyle(vertical: string = 'saas') {
  const v = vertical.toLowerCase()
  if (v.includes('restaurant')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (v.includes('gym')) return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
  if (v.includes('hospital')) return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (v.includes('school') || v.includes('college')) return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
}

export function PaymentVerification() {
  const supabase = createClient()
  const router = useRouter()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [activeMrrBaseline, setActiveMrrBaseline] = useState<number>(0)

  // Universal Search & Filter Pills
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [billingCycleFilter, setBillingCycleFilter] = useState<string>('all')
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all')

  // Modals & Drawers
  const [upiModalOpen, setUpiModalOpen] = useState(false)
  const [upiInput, setUpiInput] = useState('')
  const [upiQrInput, setUpiQrInput] = useState('')
  const [qrFile, setQrFile] = useState<File | null>(null)
  const qrFileRef = useRef<HTMLInputElement>(null)
  const [savingUpi, setSavingUpi] = useState(false)

  const [rejectModalRequest, setRejectModalRequest] = useState<PaymentRequest | null>(null)
  const [rejectionNoteInput, setRejectionNoteInput] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const [receiptModalRequest, setReceiptModalRequest] = useState<PaymentRequest | null>(null)
  const [batchApproving, setBatchApproving] = useState(false)

  // --- Data Loading ---
  const loadTreasuryData = async () => {
    setLoading(true)
    try {
      const [
        { data: requestsData, error: requestsErr },
        { data: settingsData },
        { data: profilesData },
        { data: tenantsData },
        { data: plansData },
      ] = await Promise.all([
        supabase
          .from('subscription_payment_requests')
          .select('*, tenants(id, name, slug, vertical, subscription_expires_at), saas_plans(name, price_monthly, price_yearly)')
          .order('created_at', { ascending: false }),
        supabase.from('platform_settings').select('*').single(),
        supabase.from('profiles').select('id, tenant_id, full_name, phone, role'),
        supabase.from('tenants').select('id, plan_id, status, is_frozen'),
        supabase.from('saas_plans').select('id, price_monthly'),
      ])

      if (requestsErr) {
        toast.error(`Failed to load payment requests: ${requestsErr.message}`)
      }

      // Map profiles for tenant owner info
      const profilesMap = new Map<string, { full_name: string | null; phone: string | null }>()
      profilesData?.forEach((p) => {
        if (p.tenant_id) {
          if (!profilesMap.has(p.tenant_id) || p.role === 'tenant_owner') {
            profilesMap.set(p.tenant_id, { full_name: p.full_name, phone: p.phone })
          }
        }
      })

      const fullRequests: PaymentRequest[] = (requestsData || []).map((r) => ({
        ...r,
        owner: r.tenant_id ? profilesMap.get(r.tenant_id) || null : null,
      }))

      setRequests(fullRequests)
      setSettings(settingsData as PlatformSettings)
      if (settingsData?.rvc_upi_id) setUpiInput(settingsData.rvc_upi_id)
      if (settingsData?.rvc_upi_qr_url) setUpiQrInput(settingsData.rvc_upi_qr_url)

      // Calculate active MRR baseline from tenants & plans
      const planPriceMap = new Map<string, number>()
      plansData?.forEach((p) => planPriceMap.set(p.id, Number(p.price_monthly || 0)))

      const mrrSum = (tenantsData || [])
        .filter((t) => (t.status === 'active' || t.status === 'trial') && !t.is_frozen && t.plan_id)
        .reduce((sum, t) => sum + (planPriceMap.get(t.plan_id!) || 999), 0)

      setActiveMrrBaseline(mrrSum)
    } catch (err: unknown) {
      toast.error(`Treasury fetch error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTreasuryData()
  }, [])

  // --- Financial Computations ---
  const telemetry = useMemo(() => {
    const paidRequests = requests.filter((r) => r.status === 'paid')
    const pendingRequests = requests.filter((r) => r.status === 'pending')
    const rejectedRequests = requests.filter((r) => r.status === 'rejected')

    const totalRealizedInflow = paidRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    const pendingUncollectedFunds = pendingRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0)

    return {
      totalRealizedInflow,
      paidCount: paidRequests.length,
      pendingCount: pendingRequests.length,
      pendingUncollectedFunds,
      rejectedCount: rejectedRequests.length,
    }
  }, [requests])

  // --- Filtering ---
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Universal Search Query
      const q = searchQuery.toLowerCase().trim()
      const invoiceId = `${settings?.invoice_prefix || 'RVC-INV'}-${new Date(r.created_at).getFullYear()}-${r.id.slice(0, 5).toUpperCase()}`
      const matchesSearch =
        !q ||
        r.utr_reference.toLowerCase().includes(q) ||
        (r.tenants?.name || '').toLowerCase().includes(q) ||
        (r.tenants?.slug || '').toLowerCase().includes(q) ||
        (r.owner?.full_name || '').toLowerCase().includes(q) ||
        (r.owner?.phone || '').toLowerCase().includes(q) ||
        invoiceId.toLowerCase().includes(q)

      // 2. Status Filter
      const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase()

      // 3. Billing Cycle Filter
      const matchesBilling = billingCycleFilter === 'all' || r.billing_cycle.toLowerCase() === billingCycleFilter.toLowerCase()

      // 4. Date Range Filter
      const requestDate = new Date(r.created_at)
      const now = new Date()
      let matchesDate = true

      if (dateRangeFilter === 'today') {
        matchesDate = requestDate.toDateString() === now.toDateString()
      } else if (dateRangeFilter === 'last_7') {
        const diffMs = now.getTime() - requestDate.getTime()
        matchesDate = diffMs <= 7 * 24 * 60 * 60 * 1000
      } else if (dateRangeFilter === 'current_month') {
        matchesDate = requestDate.getMonth() === now.getMonth() && requestDate.getFullYear() === now.getFullYear()
      }

      return matchesSearch && matchesStatus && matchesBilling && matchesDate
    })
  }, [requests, searchQuery, statusFilter, billingCycleFilter, dateRangeFilter, settings])

  // --- Handlers ---

  // 1. Approve Single UTR
  const handleApprove = async (req: PaymentRequest) => {
    const durationDays = req.billing_cycle === 'yearly' ? 365 : 30

    toast.promise(
      async () => {
        const { error } = await supabase.rpc('admin_approve_tenant_payment', {
          p_invoice_id: req.id,
          p_tenant_id: req.tenant_id,
          p_plan_id: req.plan_id,
          p_duration_days: durationDays,
        })

        if (error) throw new Error(error.message)

        await supabase.from('audit_logs').insert({
          actor_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'UTR_APPROVED',
          target_tenant_id: req.tenant_id,
          details: { invoice_id: req.id, utr_reference: req.utr_reference, amount: req.amount, billing_cycle: req.billing_cycle },
        })

        void loadTreasuryData()
      },
      {
        loading: `Approving UTR ${req.utr_reference}...`,
        success: `UTR ${req.utr_reference} Approved! Tenant activated for ${durationDays} days.`,
        error: (err) => `Approval failed: ${err.message}`,
      }
    )
  }

  // 2. Reject Single UTR
  const handleReject = async () => {
    if (!rejectModalRequest) return
    setRejecting(true)
    const note = rejectionNoteInput.trim() || null

    const { error } = await supabase.rpc('admin_reject_tenant_payment', {
      p_invoice_id: rejectModalRequest.id,
      p_note: note,
    })

    setRejecting(false)

    if (error) {
      toast.error(`Rejection failed: ${error.message}`)
    } else {
      toast.error(`Payment Request ${rejectModalRequest.utr_reference} Marked as Rejected.`)

      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'UTR_REJECTED',
        target_tenant_id: rejectModalRequest.tenant_id,
        details: { invoice_id: rejectModalRequest.id, utr_reference: rejectModalRequest.utr_reference, rejection_note: note },
      })

      setRejectModalRequest(null)
      setRejectionNoteInput('')
      void loadTreasuryData()
    }
  }

  // 3. Batch Approve All Pending
  const handleBatchApprovePending = async () => {
    const pendingList = requests.filter((r) => r.status === 'pending')
    if (pendingList.length === 0) {
      toast.info('No pending UTR requests to batch approve.')
      return
    }

    if (!confirm(`Are you sure you want to batch approve all ${pendingList.length} pending UTR payment requests?`)) return

    setBatchApproving(true)
    toast.info(`Processing batch approval for ${pendingList.length} requests...`)

    let successCount = 0
    for (const req of pendingList) {
      const durationDays = req.billing_cycle === 'yearly' ? 365 : 30
      const { error } = await supabase.rpc('admin_approve_tenant_payment', {
        p_invoice_id: req.id,
        p_tenant_id: req.tenant_id,
        p_plan_id: req.plan_id,
        p_duration_days: durationDays,
      })

      if (!error) {
        successCount++
        await supabase.from('audit_logs').insert({
          actor_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'BATCH_UTR_APPROVED',
          target_tenant_id: req.tenant_id,
          details: { invoice_id: req.id, utr_reference: req.utr_reference },
        })
      }
    }

    setBatchApproving(false)
    toast.success(`Batch settlement complete! ${successCount} / ${pendingList.length} requests approved.`)
    void loadTreasuryData()
  }

  // 4. Save Merchant UPI Config
  const handleSaveUpiSettings = async () => {
    setSavingUpi(true)
    let qrUrl = settings?.rvc_upi_qr_url || null

    if (qrFile) {
      const ext = qrFile.name.split('.').pop() || 'png'
      const filePath = `upi/platform-qr-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('platform_assets').upload(filePath, qrFile, {
        upsert: true,
        contentType: qrFile.type,
      })

      if (uploadErr) {
        toast.error(`QR upload failed: ${uploadErr.message}`)
        setSavingUpi(false)
        return
      }

      qrUrl = supabase.storage.from('platform_assets').getPublicUrl(filePath).data.publicUrl
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        rvc_upi_id: upiInput.trim() || null,
        rvc_upi_qr_url: qrUrl,
      })
      .eq('id', true)

    setSavingUpi(false)

    if (error) {
      toast.error(`Failed to update UPI settings: ${error.message}`)
    } else {
      toast.success('Platform Merchant UPI Settings saved!')
      setSettings((prev) => (prev ? { ...prev, rvc_upi_id: upiInput.trim(), rvc_upi_qr_url: qrUrl } : null))
      setQrFile(null)
      setUpiModalOpen(false)
    }
  }

  // 5. CSV Export
  const handleExportCSV = () => {
    if (!filteredRequests.length) {
      toast.error('No payment settlement records available to export')
      return
    }

    const headers = [
      'Invoice ID',
      'Tenant Name',
      'Vertical',
      'Owner Name',
      'Owner Phone',
      'Plan Name',
      'Billing Cycle',
      'Gross Amount (INR)',
      '18% GST (INR)',
      'UTR Reference',
      'Status',
      'Submitted Timestamp',
      'Reviewed Timestamp',
      'Rejection Note',
    ]

    const rows = filteredRequests.map((r) => {
      const invoiceId = `${settings?.invoice_prefix || 'RVC-INV'}-${new Date(r.created_at).getFullYear()}-${r.id.slice(0, 5).toUpperCase()}`
      const gstAmount = (r.amount * 0.18).toFixed(2)

      return [
        `"${invoiceId}"`,
        `"${(r.tenants?.name || 'Deleted Tenant').replace(/"/g, '""')}"`,
        `"${r.tenants?.vertical || 'SaaS'}"`,
        `"${(r.owner?.full_name || 'Unassigned').replace(/"/g, '""')}"`,
        `"${r.owner?.phone || ''}"`,
        `"${r.saas_plans?.name || 'Plan'}"`,
        `"${r.billing_cycle}"`,
        `"${r.amount}"`,
        `"${gstAmount}"`,
        `"${r.utr_reference}"`,
        `"${r.status}"`,
        `"${new Date(r.created_at).toLocaleString('en-IN')}"`,
        `"${r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-IN') : 'N/A'}"`,
        `"${(r.rejection_note || '').replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `rvc_gst_treasury_settlements_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('GST Settlement CSV exported successfully!')
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} ${text} copied to clipboard!`)
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">
            <Receipt className="size-4" />
            <span>RVC Control • Treasury & Invoicing</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            UTR Settlement Command Center
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Treasury Stream
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void loadTreasuryData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh Treasury
          </button>
        </div>
      </div>

      {/* ---------------- 2. FINANCIAL TELEMETRY & QUICK HEADER KPI GRID (5 CARDS) ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Card 1: Total Realized Inflow */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Realized Inflow</span>
            <CircleDollarSign className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{inr(telemetry.totalRealizedInflow)}</span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
              +14.2%
            </span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400">{telemetry.paidCount} Settled Invoices</p>
        </div>

        {/* Card 2: Contracted MRR */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Contracted MRR</span>
            <TrendingUp className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{inr(activeMrrBaseline)}</span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400">Active Recurring Baseline</p>
        </div>

        {/* Card 3: Pending UTR Queue */}
        <div className="rounded-2xl border border-amber-500/30 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-amber-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Pending Settlement</span>
            <span className="relative flex size-2.5">
              {telemetry.pendingCount > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex size-2.5 rounded-full ${telemetry.pendingCount > 0 ? 'bg-amber-400' : 'bg-slate-600'}`} />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.pendingCount} Pending</span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-amber-300 font-semibold">{inr(telemetry.pendingUncollectedFunds)} Uncollected</p>
        </div>

        {/* Card 4: Disputed / Rejected Count */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Disputed / Rejected</span>
            <XCircle className="size-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.rejectedCount} Requests</span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400">Invalid UTR References</p>
        </div>

        {/* Card 5: Platform Merchant UPI Endpoint */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Merchant UPI</span>
            <QrCode className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="truncate font-mono text-xs font-bold text-slate-200 max-w-[100px]" title={settings?.rvc_upi_id || 'Not set'}>
              {settings?.rvc_upi_id || 'rvc@upi'}
            </span>
            <button
              onClick={() => setUpiModalOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-mono font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40"
            >
              Update
            </button>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400 truncate">1-Click QR Config</p>
        </div>
      </div>

      {/* ---------------- 3. TREASURY FILTER & SEARCH BAR ---------------- */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by UTR reference (e.g. 421098...), tenant name, invoice ID (RVC-INV-...), owner..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 font-mono">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
            >
              <Download className="size-3.5 text-indigo-400" />
              Export GST CSV
            </button>

            <button
              onClick={() => void handleBatchApprovePending()}
              disabled={batchApproving || telemetry.pendingCount === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50 transition-all"
            >
              <Zap className="size-3.5" />
              Batch Approve ({telemetry.pendingCount})
            </button>
          </div>
        </div>

        {/* Filter Pills Groups */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs font-mono">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Status:</span>
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending', label: 'Pending Verification' },
              { id: 'paid', label: 'Paid / Settled' },
              { id: 'rejected', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  statusFilter === st.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Billing Cycle Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Cycle:</span>
            {['all', 'monthly', 'yearly'].map((bc) => (
              <button
                key={bc}
                onClick={() => setBillingCycleFilter(bc)}
                className={`rounded-lg px-2.5 py-1 capitalize font-semibold transition-all ${
                  billingCycleFilter === bc
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {bc}
              </button>
            ))}
          </div>

          {/* Date Range Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Date Range:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'last_7', label: 'Last 7 Days' },
              { id: 'current_month', label: 'Current Month' },
            ].map((dr) => (
              <button
                key={dr.id}
                onClick={() => setDateRangeFilter(dr.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  dateRangeFilter === dr.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 4. INTERACTIVE SETTLEMENT DATA ROWS (GRID) ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs font-mono">
            <thead className="bg-[#0a0e17] uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">1. Invoice & Tenant Identity</th>
                <th className="p-4">2. Plan & Billing Coverage</th>
                <th className="p-4">3. Financials & UTR Reference</th>
                <th className="p-4">4. Verification Status & Meta</th>
                <th className="p-4 text-right">5. Settlement Action Toolbar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <tr key={n}>
                    <td colSpan={5} className="p-4">
                      <div className="h-10 animate-pulse rounded-xl bg-slate-900/60" />
                    </td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Receipt className="mx-auto size-8 text-slate-600" />
                      <p className="font-semibold text-sm text-slate-400">No payment settlement requests found.</p>
                      <p className="text-xs text-slate-500">Try clearing your search query or status filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const invoiceId = `${settings?.invoice_prefix || 'RVC-INV'}-${new Date(req.created_at).getFullYear()}-${req.id.slice(0, 5).toUpperCase()}`
                  const verticalStyle = getVerticalBadgeStyle(req.tenants?.vertical)

                  return (
                    <motion.tr
                      key={req.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group hover:bg-[#0f172a]/60 transition-colors"
                    >
                      {/* Column 1: Invoice & Tenant Identity */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {req.tenants?.name || 'Deleted Tenant'}
                            </strong>
                            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${verticalStyle}`}>
                              {req.tenants?.vertical || 'SaaS'}
                            </span>
                          </div>
                          <code className="block text-[10px] text-slate-400">{invoiceId}</code>
                          <div className="text-[11px] text-slate-400">
                            Owner: <span className="text-slate-200">{req.owner?.full_name || 'Unassigned'}</span>
                            {req.owner?.phone && <span className="ml-1 text-slate-400">({req.owner.phone})</span>}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Plan & Billing Coverage */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <span className="inline-block rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            {req.saas_plans?.name || 'SaaS Plan'}
                          </span>
                          <p className="text-xs text-slate-200 font-bold capitalize">{req.billing_cycle} Cycle</p>
                          <p className="text-[10px] text-slate-400">
                            Period: {req.billing_cycle === 'yearly' ? '12 Months' : '30 Days'}
                          </p>
                        </div>
                      </td>

                      {/* Column 3: Financials & UTR Reference */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          <p className="text-sm font-black text-white">{inr(req.amount)}</p>
                          <div className="flex items-center gap-1.5 rounded-lg bg-slate-950 px-2 py-1 border border-slate-800 w-fit">
                            <code className="text-xs font-bold text-amber-300 tracking-wider">{req.utr_reference}</code>
                            <button
                              onClick={() => copyToClipboard(req.utr_reference, 'UTR')}
                              className="p-0.5 text-slate-400 hover:text-white"
                              title="Copy UTR"
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Verification Status & Meta */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          <div>
                            {req.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                                <span className="size-1.5 rounded-full bg-amber-400" /> Pending Verification
                              </span>
                            )}
                            {req.status === 'paid' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-400" /> Paid / Settled
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400">
                                <span className="size-1.5 rounded-full bg-rose-400" /> Rejected
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] text-slate-400" title={new Date(req.created_at).toLocaleString('en-IN')}>
                            Submitted {formatRelativeTime(req.created_at)}
                          </p>

                          {req.status === 'rejected' && req.rejection_note && (
                            <p className="text-[10px] text-rose-400/90 truncate max-w-[180px]" title={req.rejection_note}>
                              Reason: {req.rejection_note}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Action Controls Toolbar */}
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => void handleApprove(req)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all"
                              >
                                <CheckCircle2 className="size-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModalRequest(req)
                                  setRejectionNoteInput('')
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-white transition-all"
                              >
                                <XCircle className="size-3.5" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              {req.status === 'paid' && (
                                <button
                                  onClick={() => setReceiptModalRequest(req)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text.xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
                                  title="View GST Invoice Receipt"
                                >
                                  <Receipt className="size-3.5 text-indigo-400" />
                                  Invoice PDF
                                </button>
                              )}

                              {req.tenant_id && (
                                <button
                                  onClick={() => router.push(`/rvc-control-9x2f/dashboard/tenants?id=${req.tenant_id}`)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-white"
                                  title="View Tenant Settings"
                                >
                                  <ExternalLink className="size-3.5 text-slate-400" />
                                  Subscription
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- MODALS & DRAWERS ---------------- */}

      {/* 1. Printable GST Invoice Receipt Modal */}
      <AnimatePresence>
        {receiptModalRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="size-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Official Tax Invoice Receipt</h3>
                </div>
                <button onClick={() => setReceiptModalRequest(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              {/* Receipt Content */}
              <div id="printable-gst-receipt" className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-4 text-xs">
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <strong className="text-base font-black text-white tracking-wider">RVC PLATFORM HQ</strong>
                    <p className="text-[10px] text-slate-400">SaaS Multi-Tenant Cloud Operating System</p>
                    <p className="text-[10px] text-slate-400">GSTIN: 27AAAAA0000A1Z5</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      PAID & SETTLED
                    </span>
                    <p className="mt-1 text-[10px] font-bold text-indigo-400">
                      {settings?.invoice_prefix || 'RVC-INV'}-{new Date(receiptModalRequest.created_at).getFullYear()}-
                      {receiptModalRequest.id.slice(0, 5).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase">Billed To (Tenant):</span>
                    <p className="font-bold text-white">{receiptModalRequest.tenants?.name || 'Tenant Workspace'}</p>
                    <p className="text-[11px] text-slate-400">Owner: {receiptModalRequest.owner?.full_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase">Payment Reference:</span>
                    <p className="font-bold text-amber-300">{receiptModalRequest.utr_reference}</p>
                    <p className="text-[11px] text-slate-400">
                      Date: {new Date(receiptModalRequest.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Item Description:</span>
                    <span className="font-bold text-white">
                      {receiptModalRequest.saas_plans?.name || 'SaaS Plan'} ({receiptModalRequest.billing_cycle})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Taxable Value:</span>
                    <span className="text-slate-200">{inr(receiptModalRequest.amount * 0.82)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">18% GST (CGST 9% + SGST 9%):</span>
                    <span className="text-slate-200">{inr(receiptModalRequest.amount * 0.18)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
                    <strong className="text-white">Total Amount Paid:</strong>
                    <strong className="text-emerald-400 font-bold">{inr(receiptModalRequest.amount)}</strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setReceiptModalRequest(null)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print()
                    toast.success('Triggering print dialog...')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500"
                >
                  <Printer className="size-3.5" />
                  Print / Download PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Reject Payment Modal */}
      <AnimatePresence>
        {rejectModalRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <XCircle className="size-5 text-rose-400" />
                  Reject UTR Payment Request
                </h3>
                <button onClick={() => setRejectModalRequest(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300">
                Rejecting UTR <code className="text-amber-300">{rejectModalRequest.utr_reference}</code> for{' '}
                <strong className="text-white">{rejectModalRequest.tenants?.name || 'Tenant'}</strong>.
              </p>

              <label className="block">
                <span className="text-slate-300 font-semibold">Rejection Note (Visible to Tenant):</span>
                <textarea
                  value={rejectionNoteInput}
                  onChange={(e) => setRejectionNoteInput(e.target.value)}
                  placeholder="e.g. Invalid UTR reference, transaction not found in bank statement, or amount mismatch"
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-rose-500 focus:outline-none min-h-[80px]"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectModalRequest(null)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={rejecting}
                  onClick={() => void handleReject()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500 disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Merchant UPI Endpoint Modal */}
      <AnimatePresence>
        {upiModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="size-5 text-emerald-400" />
                  Merchant UPI Payment Endpoint
                </h3>
                <button onClick={() => setUpiModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-slate-300 font-semibold">Platform UPI VPA Handle</span>
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value)}
                    placeholder="e.g. rvc@upi"
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-slate-300 font-semibold">UPI Payment QR Image URL</span>
                  <input
                    type="text"
                    value={upiQrInput}
                    onChange={(e) => setUpiQrInput(e.target.value)}
                    placeholder="https://storage.../upi-qr.png"
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-slate-300 font-semibold">Upload New QR Image File</span>
                  <input
                    ref={qrFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300"
                  />
                </label>

                {upiQrInput && (
                  <div className="mt-2 flex justify-center">
                    <img src={upiQrInput} alt="Merchant UPI QR" className="size-32 rounded-xl border border-slate-700 object-contain" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setUpiModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={savingUpi}
                  onClick={() => void handleSaveUpiSettings()}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingUpi ? 'Saving...' : 'Save UPI Config'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
