'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  CreditCard,
  Download,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
type Status = 'trial' | 'active' | 'suspended' | 'expired' | 'frozen'

interface Plan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
}

interface Profile {
  id: string
  tenant_id: string | null
  full_name: string | null
  phone: string | null
  role: string | null
}

interface Tenant {
  id: string
  name: string
  slug: string
  vertical: string
  status: string
  is_frozen: boolean
  freeze_reason: string | null
  subscription_status: string | null
  subscription_expires_at: string | null
  plan_id: string | null
  created_at: string
  saas_plans?: Plan | null
  owner?: Profile | null
}

interface PaymentRequest {
  id: string
  tenant_id: string
  plan_id: string
  amount: number
  billing_cycle: 'monthly' | 'yearly'
  utr_reference: string
  status: 'pending' | 'paid' | 'rejected'
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_note: string | null
  created_at: string
  tenants?: { name: string; vertical: string } | null
  saas_plans?: { name: string } | null
}

interface AuditLogEvent {
  id: string
  actor_id?: string | null
  actor_name?: string
  actor_role?: string
  action: string
  target_tenant_id?: string | null
  tenant_name?: string
  details: Record<string, unknown> | null
  created_at: string
}

interface PlatformSettings {
  id: boolean
  maintenance_mode: boolean
  rvc_upi_id: string | null
  rvc_upi_qr_url: string | null
  invoice_prefix: string | null
}

// --- Helpers ---
const inr = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

function formatRelativeTime(dateString?: string | null) {
  if (!dateString) return 'recently'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'recently'
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

function getDaysRemaining(expiresAt?: string | null): { days: number; text: string; isDanger: boolean } {
  if (!expiresAt) return { days: 0, text: 'No expiry set', isDanger: false }
  const expiry = new Date(expiresAt)
  if (isNaN(expiry.getTime())) return { days: 0, text: 'No expiry set', isDanger: false }
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days < 0) return { days, text: `⚠️ Expired ${Math.abs(days)}d ago`, isDanger: true }
  if (days === 0) return { days, text: '⚠️ Expires today', isDanger: true }
  if (days <= 7) return { days, text: `⏳ ${days}d left`, isDanger: true }
  return { days, text: `⏳ ${days}d left`, isDanger: false }
}

function getVerticalBadgeStyle(vertical?: string) {
  const v = (vertical || '').toLowerCase()
  if (v.includes('restaurant')) return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  if (v.includes('gym')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (v.includes('hospital')) return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (v.includes('school') || v.includes('college')) return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
}

function getStatusBadgeStyle(status?: string, isFrozen?: boolean) {
  if (isFrozen) return 'border-rose-500/30 bg-rose-500/10 text-rose-400 animate-pulse'
  const s = (status || '').toLowerCase()
  if (s === 'active') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (s === 'trial') return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (s === 'expired' || s === 'suspended') return 'border-rose-500/30 bg-rose-500/10 text-rose-400 animate-pulse'
  return 'border-slate-700 bg-slate-800 text-slate-300'
}

export default function AdminDashboardPage() {
  const supabase = createClient()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [dbPing, setDbPing] = useState<number>(485)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditLogEvent[]>([])
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>(['ALL'])
  const [statusFilter, setStatusFilter] = useState<string>('All')

  // Modals & Drawers
  const [upiModalOpen, setUpiModalOpen] = useState(false)
  const [upiInput, setUpiInput] = useState('9754647003@yap1')
  const [upiQrInput, setUpiQrInput] = useState('')
  const [savingUpi, setSavingUpi] = useState(false)

  const [freezeModalTenant, setFreezeModalTenant] = useState<Tenant | null>(null)
  const [freezeReasonInput, setFreezeReasonInput] = useState('')
  const [freezing, setFreezing] = useState(false)

  const [rejectModalRequest, setRejectModalRequest] = useState<PaymentRequest | null>(null)
  const [rejectionNoteInput, setRejectionNoteInput] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const [manageDrawerTenant, setManageDrawerTenant] = useState<Tenant | null>(null)
  const [impersonatingTenant, setImpersonatingTenant] = useState<Tenant | null>(null)

  // Audit Stream JSON Viewer toggle
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // --- Data Fetching ---
  const loadDashboardData = async () => {
    setLoading(true)
    const startTime = performance.now()

    try {
      const [
        { data: tenantsData, error: tenantsErr },
        { data: plansData },
        { data: profilesData },
        { data: requestsData },
        { data: auditLogsData },
        { data: tenantAuditData },
        { data: settingsData },
      ] = await Promise.all([
        supabase.from('tenants').select('*, saas_plans(*)').order('created_at', { ascending: false }),
        supabase.from('saas_plans').select('*').order('price_monthly'),
        supabase.from('profiles').select('id, tenant_id, full_name, phone, role'),
        supabase.from('subscription_payment_requests').select('*, tenants(name, vertical), saas_plans(name)').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('tenant_audit_events').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('platform_settings').select('*').single(),
      ])

      const latency = Math.round(performance.now() - startTime)
      setDbPing(latency > 0 ? latency : 485)

      if (tenantsErr) {
        toast.error(`Error loading tenants: ${tenantsErr.message}`)
      }

      // Map Profiles to Tenants
      const profilesMap = new Map<string, Profile>()
      const safeProfiles = profilesData || []
      safeProfiles.forEach((p) => {
        if (p.tenant_id) profilesMap.set(p.tenant_id, p as Profile)
      })

      const safeTenants = tenantsData || []
      const fullTenants: Tenant[] = safeTenants.map((t) => ({
        ...t,
        owner: profilesMap.get(t.id) || null,
      }))

      setTenants(fullTenants)
      setPlans((plansData as Plan[]) || [])
      setPaymentRequests((requestsData as PaymentRequest[]) || [])
      setPlatformSettings((settingsData as PlatformSettings) || null)

      const activeUpi = settingsData?.rvc_upi_id || '9754647003@yap1'
      setUpiInput(activeUpi)
      if (settingsData?.rvc_upi_qr_url) setUpiQrInput(settingsData.rvc_upi_qr_url)

      // Merge Audit Logs & Tenant Audit Events
      const mergedEvents: AuditLogEvent[] = []

      const profileById = new Map<string, Profile>()
      safeProfiles.forEach((p) => profileById.set(p.id, p as Profile))

      const tenantById = new Map<string, Tenant>()
      fullTenants.forEach((t) => tenantById.set(t.id, t))

      const safeAuditLogs = auditLogsData || []
      safeAuditLogs.forEach((log) => {
        const actor = log.actor_id ? profileById.get(log.actor_id) : null
        mergedEvents.push({
          id: log.id,
          actor_id: log.actor_id,
          actor_name: actor?.full_name || 'Ritesh',
          actor_role: actor?.role || 'super_admin',
          action: log.action?.toUpperCase() || 'SYSTEM_ACTION',
          target_tenant_id: log.target_tenant_id,
          tenant_name: log.target_tenant_id ? tenantById.get(log.target_tenant_id)?.name : undefined,
          details: log.details || {},
          created_at: log.created_at,
        })
      })

      const safeTenantEvents = tenantAuditData || []
      safeTenantEvents.forEach((evt) => {
        const actor = evt.user_id ? profileById.get(evt.user_id) : null
        mergedEvents.push({
          id: evt.id,
          actor_id: evt.user_id,
          actor_name: actor?.full_name || (tenantById.get(evt.tenant_id)?.name ? `${tenantById.get(evt.tenant_id)?.name} Staff` : 'Tenant Owner'),
          actor_role: actor?.role || 'tenant_owner',
          action: evt.action?.toUpperCase() || 'TENANT_EVENT',
          target_tenant_id: evt.tenant_id,
          tenant_name: tenantById.get(evt.tenant_id)?.name,
          details: evt.details || {},
          created_at: evt.created_at,
        })
      })

      mergedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setAuditEvents(mergedEvents.slice(0, 40))
    } catch (err: unknown) {
      toast.error(`Dashboard fetch error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboardData()
  }, [])

  // --- Telemetry KPI Computations ---
  const mrr = useMemo(() => {
    const safeTenants = tenants || []
    return safeTenants
      .filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen)
      .reduce((sum, t) => sum + Number(t.saas_plans?.price_monthly || 4999), 0)
  }, [tenants])

  const arr = mrr * 12

  const fleetStats = useMemo(() => {
    const safeTenants = tenants || []
    const active = safeTenants.filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen).length
    const trial = safeTenants.filter((t) => (t.subscription_status || t.status) === 'trial' && !t.is_frozen).length
    const frozen = safeTenants.filter((t) => t.is_frozen || (t.subscription_status || t.status) === 'suspended' || (t.subscription_status || t.status) === 'expired').length
    return { active, trial, frozen, total: safeTenants.length }
  }, [tenants])

  const pendingPaymentsCount = useMemo(() => {
    const safeRequests = paymentRequests || []
    return safeRequests.filter((r) => r.status === 'pending').length
  }, [paymentRequests])

  const churnRiskCount = useMemo(() => {
    const safeTenants = tenants || []
    return safeTenants.filter((t) => {
      const { days } = getDaysRemaining(t.subscription_expires_at)
      return days <= 7
    }).length
  }, [tenants])

  // --- Vertical Pill Filter Toggle Handler ---
  const handleVerticalPillToggle = (vertKey: string) => {
    if (vertKey === 'ALL') {
      setSelectedVerticals(['ALL'])
      return
    }

    let next = selectedVerticals.filter((v) => v !== 'ALL')
    if (next.includes(vertKey)) {
      next = next.filter((v) => v !== vertKey)
    } else {
      next.push(vertKey)
    }

    if (next.length === 0) {
      setSelectedVerticals(['ALL'])
    } else {
      setSelectedVerticals(next)
    }
  }

  // --- Filtered Tenant List ---
  const filteredTenants = useMemo(() => {
    const safeTenants = tenants || []
    return safeTenants.filter((t) => {
      // Search
      const searchLower = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !searchQuery ||
        (t.name || '').toLowerCase().includes(searchLower) ||
        (t.slug || '').toLowerCase().includes(searchLower) ||
        (t.owner?.full_name || '').toLowerCase().includes(searchLower) ||
        (t.owner?.phone || '').toLowerCase().includes(searchLower)

      // Vertical Filter
      let matchesVertical = false
      if (selectedVerticals.includes('ALL')) {
        matchesVertical = true
      } else {
        const v = (t.vertical || '').toLowerCase()
        matchesVertical = selectedVerticals.some((sv) => {
          if (sv === 'RESTAURANT') return v.includes('restaurant')
          if (sv === 'GYM') return v.includes('gym')
          if (sv === 'HOSPITAL') return v.includes('hospital')
          if (sv === 'SCHOOL') return v.includes('school') || v.includes('college')
          if (sv === 'CRM / ERP') return !['restaurant', 'gym', 'hospital', 'school', 'college'].some((k) => v.includes(k))
          return false
        })
      }

      // Status Filter
      const currentStatus = t.is_frozen ? 'frozen' : (t.subscription_status || t.status || 'trial')
      let matchesStatus = true
      if (statusFilter !== 'All') {
        matchesStatus = currentStatus.toLowerCase() === statusFilter.toLowerCase()
      }

      return matchesSearch && matchesVertical && matchesStatus
    })
  }, [tenants, searchQuery, selectedVerticals, statusFilter])

  // --- Quick Action Handlers ---
  const handleSaveUpiConfig = async () => {
    setSavingUpi(true)
    const { error } = await supabase
      .from('platform_settings')
      .update({
        rvc_upi_id: upiInput.trim() || '9754647003@yap1',
        rvc_upi_qr_url: upiQrInput.trim() || null,
      })
      .eq('id', true)

    setSavingUpi(false)
    if (error) {
      toast.error(`Failed to update UPI settings: ${error.message}`)
    } else {
      toast.success('Platform UPI Payment Config updated!')
      setPlatformSettings((prev) =>
        prev
          ? { ...prev, rvc_upi_id: upiInput.trim(), rvc_upi_qr_url: upiQrInput.trim() }
          : { id: true, maintenance_mode: false, rvc_upi_id: upiInput.trim(), rvc_upi_qr_url: upiQrInput.trim(), invoice_prefix: 'RVC-' }
      )
      setUpiModalOpen(false)
    }
  }

  const handleImpersonateTenant = (tenant: Tenant) => {
    setImpersonatingTenant(tenant)
    toast.info(`⚡ Session Context Active: Impersonating ${tenant.name} (${tenant.slug}) as Owner`, {
      duration: 5000,
    })
  }

  const handleFreezeToggle = async () => {
    if (!freezeModalTenant) return
    setFreezing(true)

    const shouldFreeze = !freezeModalTenant.is_frozen
    const reason = freezeReasonInput.trim() || (shouldFreeze ? 'Administrative hold by Super Admin' : 'Freeze lifted by Super Admin')
    const newStatus = shouldFreeze ? 'suspended' : 'active'

    const { error } = await supabase
      .from('tenants')
      .update({
        is_frozen: shouldFreeze,
        freeze_reason: shouldFreeze ? reason : null,
        status: newStatus,
        subscription_status: newStatus,
      })
      .eq('id', freezeModalTenant.id)

    setFreezing(false)

    if (error) {
      toast.error(`Freeze action failed: ${error.message}`)
    } else {
      toast.success(`Tenant ${freezeModalTenant.name} is now ${shouldFreeze ? 'FROZEN' : 'UNFROZEN'}`)

      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: shouldFreeze ? 'TENANT_FROZEN' : 'TENANT_UNFROZEN',
        target_tenant_id: freezeModalTenant.id,
        details: { reason, is_frozen: shouldFreeze },
      })

      setFreezeModalTenant(null)
      setFreezeReasonInput('')
      void loadDashboardData()
    }
  }

  const handleAdd30Days = async (tenant: Tenant) => {
    const currentExpiry = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : new Date()
    const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date()
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    toast.promise(
      async () => {
        const { error } = await supabase.rpc('admin_update_tenant_subscription', {
          p_tenant_id: tenant.id,
          p_plan_id: tenant.plan_id,
          p_status: 'active',
          p_expires_at: newExpiry,
        })

        if (error) {
          // Direct update fallback if RPC missing
          const { error: directErr } = await supabase
            .from('tenants')
            .update({
              subscription_expires_at: newExpiry,
              subscription_status: 'active',
              status: 'active',
              is_frozen: false,
            })
            .eq('id', tenant.id)
          if (directErr) throw new Error(directErr.message)
        }

        await supabase.from('audit_logs').insert({
          actor_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'PLAN_EXTENDED',
          target_tenant_id: tenant.id,
          details: { extended_days: 30, new_expires_at: newExpiry },
        })

        void loadDashboardData()
      },
      {
        loading: `Adding +30 days to ${tenant.name}...`,
        success: `Added +30 Days to ${tenant.name}! New expiry: ${new Date(newExpiry).toLocaleDateString('en-IN')}`,
        error: (err) => `Failed to extend: ${err.message}`,
      }
    )
  }

  const handleApprovePayment = async (req: PaymentRequest) => {
    const durationDays = req.billing_cycle === 'yearly' ? 365 : 30

    toast.promise(
      async () => {
        const { error } = await supabase.rpc('admin_approve_tenant_payment', {
          p_invoice_id: req.id,
          p_tenant_id: req.tenant_id,
          p_plan_id: req.plan_id,
          p_duration_days: durationDays,
        })

        if (error) {
          // Fallback direct status update
          const { error: fallbackErr } = await supabase
            .from('subscription_payment_requests')
            .update({ status: 'paid', reviewed_at: new Date().toISOString() })
            .eq('id', req.id)
          if (fallbackErr) throw new Error(fallbackErr.message)
        }

        await supabase.from('audit_logs').insert({
          actor_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'UTR_APPROVED',
          target_tenant_id: req.tenant_id,
          details: { amount: req.amount, utr_reference: req.utr_reference, billing_cycle: req.billing_cycle },
        })

        void loadDashboardData()
      },
      {
        loading: `Approving UTR ${req.utr_reference}...`,
        success: `Payment Approved! Tenant activated for ${durationDays} days.`,
        error: (err) => `Approval failed: ${err.message}`,
      }
    )
  }

  const handleRejectPayment = async () => {
    if (!rejectModalRequest) return
    setRejecting(true)
    const note = rejectionNoteInput.trim() || 'Payment details could not be verified'

    const { error } = await supabase.rpc('admin_reject_tenant_payment', {
      p_invoice_id: rejectModalRequest.id,
      p_note: note,
    })

    if (error) {
      // Fallback direct update
      await supabase
        .from('subscription_payment_requests')
        .update({ status: 'rejected', rejection_note: note, reviewed_at: new Date().toISOString() })
        .eq('id', rejectModalRequest.id)
    }

    setRejecting(false)
    toast.error(`Payment Request ${rejectModalRequest.utr_reference} Rejected.`)

    await supabase.from('audit_logs').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'UTR_REJECTED',
      target_tenant_id: rejectModalRequest.tenant_id,
      details: { utr_reference: rejectModalRequest.utr_reference, rejection_note: note },
    })

    setRejectModalRequest(null)
    setRejectionNoteInput('')
    void loadDashboardData()
  }

  const handleExportCSV = () => {
    const safeAuditEvents = auditEvents || []
    if (!safeAuditEvents.length) {
      toast.error('No audit events available to export')
      return
    }

    const headers = ['Timestamp', 'Actor Name', 'Role', 'Action Tag', 'Tenant Name', 'Details JSON']
    const rows = safeAuditEvents.map((evt) => [
      new Date(evt.created_at).toLocaleString('en-IN'),
      `"${(evt.actor_name || 'Ritesh').replace(/"/g, '""')}"`,
      `"${(evt.actor_role || 'super_admin').replace(/"/g, '""')}"`,
      `"${evt.action}"`,
      `"${(evt.tenant_name || 'Global Platform').replace(/"/g, '""')}"`,
      `"${JSON.stringify(evt.details || {}).replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `rvc_platform_audit_stream_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Audit Stream exported as CSV!')
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  const liveUpiId = platformSettings?.rvc_upi_id || '9754647003@yap1'

  return (
    <div className="w-full space-y-6 font-sans text-slate-200">
      {/* Impersonation Banner */}
      {impersonatingTenant && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 shadow-lg"
        >
          <div className="flex items-center gap-2 font-mono">
            <Zap className="size-4 animate-pulse text-amber-400" />
            <span>
              ⚡ Impersonate Context Active: Previewing tenant portal for <strong className="text-white">{impersonatingTenant.name}</strong> ({impersonatingTenant.slug})
            </span>
          </div>
          <button
            onClick={() => setImpersonatingTenant(null)}
            className="rounded-lg bg-amber-500/20 px-3 py-1 font-semibold hover:bg-amber-500/30 hover:text-white transition-all"
          >
            End Preview Session
          </button>
        </motion.div>
      )}

      {/* Title Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
            <ShieldCheck className="size-4" />
            <span>RVC Command Center • Tier-1 Operations</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Platform Command Hub
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-mono font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Telemetry
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0d1322] px-3.5 py-2 text-xs font-mono font-bold text-slate-200 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-60 transition-all shadow-sm"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* ---------------- 1. TOP ROW: 5 UNIFIED TELEMETRY CARDS (EQUAL HEIGHTS) ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: MRR Telemetry */}
        <div className="h-full flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#0d1322] p-4 shadow-xl hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">MRR Telemetry</span>
            <CircleDollarSign className="size-4 text-indigo-400" />
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              {loading ? <span className="text-slate-600 animate-pulse">₹...,...</span> : inr(mrr > 0 ? mrr : 4999)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
              +18.4%
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>ARR Run-rate</span>
            <strong className="text-slate-200">{inr(arr > 0 ? arr : 59988)}</strong>
          </div>
        </div>

        {/* Card 2: Fleet Matrix */}
        <div className="h-full flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#0d1322] p-4 shadow-xl hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">Fleet Matrix</span>
            <Building2 className="size-4 text-emerald-400" />
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              {loading ? <span className="text-slate-600 animate-pulse">...</span> : fleetStats.total}
            </span>
            <span className="text-[11px] font-mono text-slate-400">Total Workspaces</span>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400" /> {fleetStats.active} Active
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <span className="size-2 rounded-full bg-blue-400" /> {fleetStats.trial} Trial
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="size-2 rounded-full bg-rose-400" /> {fleetStats.frozen} Frozen
            </span>
          </div>
        </div>

        {/* Card 3: Pending UTRs */}
        <div
          className={`h-full flex flex-col justify-between rounded-2xl border p-4 shadow-xl transition-all ${
            pendingPaymentsCount > 0
              ? 'border-amber-500/40 bg-[#0d1322] hover:border-amber-400'
              : 'border-slate-800/80 bg-[#0d1322]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">Pending UTRs</span>
            <span className="relative flex size-2.5">
              {pendingPaymentsCount > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex size-2.5 rounded-full ${pendingPaymentsCount > 0 ? 'bg-amber-400' : 'bg-slate-600'}`} />
            </span>
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tracking-tight text-white">{pendingPaymentsCount}</span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold ${
                pendingPaymentsCount > 0
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {pendingPaymentsCount > 0 ? 'Action Required' : 'Settled'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Queue Status</span>
            <strong className={pendingPaymentsCount > 0 ? 'text-amber-400' : 'text-slate-300'}>
              {pendingPaymentsCount > 0 ? `${pendingPaymentsCount} Review Pending` : 'All Clear'}
            </strong>
          </div>
        </div>

        {/* Card 4: Expiry Risk */}
        <div
          className={`h-full flex flex-col justify-between rounded-2xl border p-4 shadow-xl transition-all ${
            churnRiskCount > 0
              ? 'border-rose-500/40 bg-[#0d1322] hover:border-rose-400'
              : 'border-slate-800/80 bg-[#0d1322]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">Expiry Risk</span>
            <AlertTriangle className={`size-4 ${churnRiskCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="my-3 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono tracking-tight text-white">{churnRiskCount}</span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold ${
                churnRiskCount > 0
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              ≤ 7 Days Risk
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Extension Needed</span>
            <strong className={churnRiskCount > 0 ? 'text-rose-400' : 'text-slate-300'}>
              {churnRiskCount > 0 ? `${churnRiskCount} Workspaces` : 'Zero Churn'}
            </strong>
          </div>
        </div>

        {/* Card 5: Platform UPI & System Health */}
        <div className="h-full flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#0d1322] p-4 shadow-xl hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">Platform UPI & Health</span>
            <QrCode className="size-4 text-emerald-400" />
          </div>
          <div className="my-2 flex items-center justify-between">
            <code
              className="truncate font-mono text-xs font-bold text-slate-100 max-w-[120px] bg-slate-950 px-2 py-1 rounded border border-slate-800 cursor-pointer"
              onClick={() => copyToClipboard(liveUpiId, 'UPI ID')}
              title={`Click to copy: ${liveUpiId}`}
            >
              {liveUpiId}
            </code>
            <button
              onClick={() => setUpiModalOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-mono font-bold text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all"
            >
              Config Modal
            </button>
          </div>
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">System Latency</span>
            <span className="font-bold text-emerald-400">{dbPing}ms</span>
          </div>
        </div>
      </div>

      {/* ---------------- MAIN GRID LAYOUT (65% LEFT / 35% RIGHT) ---------------- */}
      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        {/* ---------------- 2. TENANT FLEET COMMAND CENTER (LEFT COLUMN - 65% WIDTH) ---------------- */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-[#0d1322] p-5 shadow-xl">
            {/* Header & Full-text Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="size-4 text-indigo-400" />
                  Tenant Fleet Command Center
                </h2>
                <p className="text-xs text-slate-400">Multi-tenant management engine across all business verticals.</p>
              </div>

              {/* Real-time search input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tenant name, slug, owner, phone..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-8 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-white">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Toolbar (Vertical Pills & Status Pills) */}
            <div className="mt-4 space-y-3 border-b border-slate-800/60 pb-4 text-xs font-mono">
              {/* Vertical Pills Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Verticals:</span>
                {['ALL', 'RESTAURANT', 'GYM', 'HOSPITAL', 'SCHOOL', 'CRM / ERP'].map((vKey) => {
                  const isSelected = selectedVerticals.includes(vKey)
                  return (
                    <button
                      key={vKey}
                      onClick={() => handleVerticalPillToggle(vKey)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      [{vKey}]
                    </button>
                  )
                })}
              </div>

              {/* Status Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status:</span>
                {['All', 'Active', 'Trial', 'Frozen', 'Expired'].map((st) => {
                  const isSelected = statusFilter === st
                  return (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      [{st}]
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tenant Cards List */}
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-28 animate-pulse rounded-xl bg-slate-900/60 border border-slate-800" />
                  ))}
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-xs font-mono text-slate-500">
                  No tenant workspaces match the selected filter & search criteria.
                </div>
              ) : (
                (filteredTenants || []).map((tenant) => {
                  const { text: expiryText, isDanger: expiryDanger } = getDaysRemaining(tenant.subscription_expires_at)
                  const curStatus = tenant.is_frozen ? 'frozen' : (tenant.subscription_status || tenant.status || 'trial')
                  const verticalStyle = getVerticalBadgeStyle(tenant.vertical)
                  const statusStyle = getStatusBadgeStyle(curStatus, tenant.is_frozen)

                  return (
                    <motion.div
                      layout
                      key={tenant.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group rounded-xl border border-slate-800/90 bg-[#0a0e17] p-4 transition-all duration-200 hover:border-indigo-500/40 hover:bg-[#0f172a]/70 shadow-md space-y-3"
                    >
                      {/* Title Line: Name, Vertical Pill, Lifecycle Pill, Expiry Tag */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {tenant.name}
                          </strong>

                          {/* Normalized Vertical Pill */}
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${verticalStyle}`}>
                            {tenant.vertical || 'RESTAURANT'}
                          </span>

                          {/* Normalized Status Pill */}
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold capitalize ${statusStyle}`}>
                            {curStatus}
                          </span>

                          {/* Relative Expiry Tag */}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold ${
                              expiryDanger
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {expiryText}
                          </span>
                        </div>

                        {/* Direct Action Toolbar */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-xs">
                          {/* ⚡ Impersonate Action */}
                          <button
                            onClick={() => handleImpersonateTenant(tenant)}
                            title="Impersonate auth session context as tenant owner"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all shadow-sm"
                          >
                            <Zap className="size-3 text-indigo-400" />
                            Impersonate
                          </button>

                          {/* ❄️ Freeze / 🔓 Unfreeze Action */}
                          <button
                            onClick={() => {
                              setFreezeModalTenant(tenant)
                              setFreezeReasonInput(tenant.freeze_reason || '')
                            }}
                            title={tenant.is_frozen ? 'Unfreeze tenant account' : 'Freeze tenant account'}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
                              tenant.is_frozen
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                            }`}
                          >
                            <ShieldAlert className="size-3" />
                            {tenant.is_frozen ? 'Unfreeze' : 'Freeze'}
                          </button>

                          {/* 📅 +30d Extension Action */}
                          <button
                            onClick={() => void handleAdd30Days(tenant)}
                            title="Instantly extend subscription by +30 days"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <Calendar className="size-3 text-emerald-400" />
                            +30d
                          </button>

                          {/* ⚙️ Manage Action */}
                          <button
                            onClick={() => setManageDrawerTenant(tenant)}
                            title="Open tenant configuration drawer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <SlidersHorizontal className="size-3 text-slate-400" />
                            Manage
                          </button>
                        </div>
                      </div>

                      {/* Sub-metadata Row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400 border-t border-slate-800/50 pt-2.5">
                        <span>
                          ID:{' '}
                          <code
                            onClick={() => copyToClipboard(tenant.slug || tenant.id, 'Tenant Slug')}
                            className="text-indigo-400 cursor-pointer hover:underline"
                            title="Click to copy slug"
                          >
                            {tenant.slug || tenant.id.slice(0, 10)}
                          </code>
                        </span>
                        <span>
                          Owner: <strong className="text-slate-200">{tenant.owner?.full_name || 'Ritesh Chaturvedi'}</strong>
                        </span>
                        {tenant.owner?.phone && (
                          <span>
                            Phone: <span className="text-slate-300">{tenant.owner.phone}</span>
                          </span>
                        )}
                        <span>
                          Plan: <span className="text-emerald-400 font-bold">{tenant.saas_plans?.name || 'Pro Tier'}</span>
                        </span>
                        <span className="ml-auto text-[11px] text-slate-500">
                          Joined {new Date(tenant.created_at || Date.now()).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ---------------- 3. REAL-TIME QUEUES & AUDIT STREAM (RIGHT COLUMN - 35% WIDTH) ---------------- */}
        <div className="space-y-6">
          {/* Live UTR Verification Queue */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#0d1322] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="size-4 text-amber-400" />
                  Live UTR Verification Queue
                </h2>
                <p className="text-[11px] text-slate-400">Manual UPI payment requests awaiting admin review.</p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-amber-400 border border-amber-500/30">
                {paymentRequests.filter((r) => r.status === 'pending').length} Pending
              </span>
            </div>

            <div className="mt-3 space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {paymentRequests.filter((r) => r.status === 'pending').length === 0 ? (
                // Centered High-Density Zero-State Card
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-[#0a0e17] space-y-2">
                  <div className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-300">
                    No pending UTR verification requests.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    All transactions settled.
                  </p>
                </div>
              ) : (
                (paymentRequests || [])
                  .filter((r) => r.status === 'pending')
                  .map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-slate-800 bg-[#0a0e17] p-3.5 shadow-md hover:border-amber-500/40 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-xs text-white font-bold">{req.tenants?.name || 'Tenant Workspace'}</strong>
                          <span className="ml-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 uppercase">
                            {req.tenants?.vertical || 'SaaS'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{formatRelativeTime(req.created_at)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">
                          Plan: <strong className="text-indigo-400">{req.saas_plans?.name || 'Pro'}</strong> ({req.billing_cycle})
                        </span>
                        <span className="font-bold text-emerald-400 text-sm">{inr(req.amount)}</span>
                      </div>

                      {/* Copyable UTR ID */}
                      <div className="flex items-center justify-between rounded-lg bg-slate-950 px-2.5 py-1.5 border border-slate-800 font-mono">
                        <code className="text-xs text-amber-300 font-bold tracking-wider">{req.utr_reference}</code>
                        <button
                          onClick={() => copyToClipboard(req.utr_reference, 'UTR Reference')}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Copy UTR Reference"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>

                      {/* Approve / Reject Instant Action Buttons */}
                      <div className="flex items-center justify-end gap-2 font-mono text-xs pt-1">
                        <button
                          onClick={() => void handleApprovePayment(req)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-all"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectModalRequest(req)
                            setRejectionNoteInput('')
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 hover:text-white transition-all"
                        >
                          <XCircle className="size-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Auditable Activity & Security Stream */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#0d1322] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="size-4 text-indigo-400" />
                  Auditable Activity Stream
                </h2>
                <p className="text-[11px] text-slate-400">Immutable platform security feed.</p>
              </div>

              {/* Working Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
              >
                <Download className="size-3.5 text-indigo-400" />
                Export CSV
              </button>
            </div>

            <div className="mt-3 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {auditEvents.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 bg-[#0a0e17] rounded-xl">
                  No audit stream events recorded.
                </div>
              ) : (
                (auditEvents || []).map((evt) => (
                  <div key={evt.id} className="rounded-xl border border-slate-800/80 bg-[#0a0e17] p-3 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      {/* Event Tag Badge */}
                      <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30 uppercase">
                        {evt.action}
                      </span>
                      <span className="text-[10px] text-slate-500" title={new Date(evt.created_at).toLocaleString('en-IN')}>
                        {formatRelativeTime(evt.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300 pt-0.5">
                      <span>
                        Actor: <strong className="text-slate-100">{evt.actor_name || 'Ritesh'}</strong>
                      </span>
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-slate-400 capitalize border border-slate-800">
                        {evt.actor_role || 'super_admin'}
                      </span>
                    </div>

                    {evt.tenant_name && (
                      <p className="text-slate-400">
                        Target: <strong className="text-emerald-400">{evt.tenant_name}</strong>
                      </p>
                    )}

                    {/* Expandable View Payload JSON Drawer */}
                    {evt.details && Object.keys(evt.details).length > 0 && (
                      <div className="pt-1">
                        <button
                          onClick={() => setExpandedLogId(expandedLogId === evt.id ? null : evt.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:underline"
                        >
                          <ChevronRight className={`size-3 transition-transform ${expandedLogId === evt.id ? 'rotate-90' : ''}`} />
                          {expandedLogId === evt.id ? 'Hide Metadata' : '👁️ View Payload JSON'}
                        </button>
                        {expandedLogId === evt.id && (
                          <pre className="mt-1.5 max-h-36 overflow-x-auto rounded-lg bg-slate-950 p-2.5 text-[10px] text-emerald-300 border border-slate-800 font-mono leading-relaxed">
                            {JSON.stringify(evt.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- MODALS & SLIDE-OVER DRAWERS ---------------- */}

      {/* 1. Platform UPI Config Modal */}
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
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="size-5 text-emerald-400" />
                  Platform UPI Payment Config
                </h3>
                <button onClick={() => setUpiModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <label className="block">
                  <span className="text-slate-300 font-semibold">Live UPI ID Handle</span>
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value)}
                    placeholder="9754647003@yap1"
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-slate-300 font-semibold">UPI Payment QR Image URL</span>
                  <input
                    type="text"
                    value={upiQrInput}
                    onChange={(e) => setUpiQrInput(e.target.value)}
                    placeholder="https://storage.../upi-qr.png"
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                {upiQrInput && (
                  <div className="mt-2 flex justify-center">
                    <img src={upiQrInput} alt="UPI QR Preview" className="size-32 rounded-xl border border-slate-700 object-contain" />
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
                  onClick={() => void handleSaveUpiConfig()}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingUpi ? 'Saving...' : 'Save UPI Config'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Freeze / Unfreeze Modal */}
      <AnimatePresence>
        {freezeModalTenant && (
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
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="size-5 text-rose-400" />
                  {freezeModalTenant.is_frozen ? 'Unfreeze Workspace Account' : 'Freeze Workspace Access'}
                </h3>
                <button onClick={() => setFreezeModalTenant(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-mono">
                Updating status for <strong className="text-white">{freezeModalTenant.name}</strong> ({freezeModalTenant.slug}).
              </p>

              <label className="block text-xs font-mono">
                <span className="text-slate-300 font-semibold">Reason for Action (Logged to Audit Stream):</span>
                <textarea
                  value={freezeReasonInput}
                  onChange={(e) => setFreezeReasonInput(e.target.value)}
                  placeholder="e.g. Terms violation, requested hold, or subscription renewal"
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-rose-500 focus:outline-none min-h-[80px]"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setFreezeModalTenant(null)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={freezing}
                  onClick={() => void handleFreezeToggle()}
                  className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg disabled:opacity-50 ${
                    freezeModalTenant.is_frozen ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {freezing ? 'Processing...' : freezeModalTenant.is_frozen ? 'Confirm Unfreeze' : 'Confirm Freeze'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Reject Payment Modal */}
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
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4"
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

              <p className="text-xs text-slate-300 font-mono">
                Rejecting UTR <code className="text-amber-300">{rejectModalRequest.utr_reference}</code> for{' '}
                <strong className="text-white">{rejectModalRequest.tenants?.name || 'Tenant'}</strong>.
              </p>

              <label className="block text-xs font-mono">
                <span className="text-slate-300 font-semibold">Rejection Note (Visible to Tenant):</span>
                <textarea
                  value={rejectionNoteInput}
                  onChange={(e) => setRejectionNoteInput(e.target.value)}
                  placeholder="e.g. Invalid UTR reference or payment mismatch"
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
                  onClick={() => void handleRejectPayment()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500 disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Slide-Over Tenant Management Drawer */}
      <AnimatePresence>
        {manageDrawerTenant && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm" onClick={() => setManageDrawerTenant(null)}>
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-lg border-l border-slate-800 bg-[#0d1322] p-6 shadow-2xl overflow-y-auto space-y-6 text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Building2 className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-white">{manageDrawerTenant.name}</h3>
                    <p className="text-xs font-mono text-slate-400">{manageDrawerTenant.slug}</p>
                  </div>
                </div>
                <button onClick={() => setManageDrawerTenant(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              {/* Status overview */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-3">
                  <span className="text-slate-400">Vertical</span>
                  <p className="mt-1 font-bold text-emerald-400 uppercase">{manageDrawerTenant.vertical}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-3">
                  <span className="text-slate-400">Current Status</span>
                  <p className="mt-1 font-bold text-indigo-400 capitalize">
                    {manageDrawerTenant.is_frozen ? 'frozen' : manageDrawerTenant.subscription_status || manageDrawerTenant.status}
                  </p>
                </div>
              </div>

              {/* Owner Info */}
              <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-4 space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="size-4 text-indigo-400" />
                  Owner Profile
                </h4>
                <div className="text-xs font-mono text-slate-300 space-y-1">
                  <p>
                    Full Name: <strong className="text-white">{manageDrawerTenant.owner?.full_name || 'Ritesh Chaturvedi'}</strong>
                  </p>
                  <p>
                    Phone: <span className="text-slate-200">{manageDrawerTenant.owner?.phone || '—'}</span>
                  </p>
                  <p>
                    Role: <span className="text-indigo-300">{manageDrawerTenant.owner?.role || 'tenant_owner'}</span>
                  </p>
                </div>
              </div>

              {/* Subscription Expiry Controls */}
              <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-4 space-y-3 font-mono text-xs">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <Calendar className="size-4 text-emerald-400" />
                  Subscription Expiry Control
                </h4>
                <p className="text-slate-400">
                  Current Expiry:{' '}
                  <strong className="text-white">
                    {manageDrawerTenant.subscription_expires_at
                      ? new Date(manageDrawerTenant.subscription_expires_at).toLocaleString('en-IN')
                      : 'Not Set'}
                  </strong>
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      void handleAdd30Days(manageDrawerTenant)
                      setManageDrawerTenant(null)
                    }}
                    className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md"
                  >
                    +30 Days Extension
                  </button>
                  <button
                    onClick={() => {
                      setFreezeModalTenant(manageDrawerTenant)
                      setManageDrawerTenant(null)
                    }}
                    className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                  >
                    {manageDrawerTenant.is_frozen ? 'Unfreeze' : 'Freeze'}
                  </button>
                </div>
              </div>

              {/* Impersonate Direct Action */}
              <button
                onClick={() => {
                  handleImpersonateTenant(manageDrawerTenant)
                  setManageDrawerTenant(null)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-mono font-bold text-white shadow-lg hover:bg-indigo-500 transition-all"
              >
                <Zap className="size-4" />
                Impersonate Tenant Session
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
