'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Copy,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  Lock,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
type Status = 'trial' | 'active' | 'suspended' | 'expired'
type Vertical = 'restaurant' | 'gym' | 'hospital' | 'school' | 'crm'

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
  status: Status
  is_frozen: boolean
  freeze_reason: string | null
  subscription_status: Status | null
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

function getDaysRemaining(expiresAt: string | null): { days: number; text: string; isDanger: boolean } {
  if (!expiresAt) return { days: 0, text: 'No expiry set', isDanger: false }
  const expiry = new Date(expiresAt)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days < 0) return { days, text: `Expired ${Math.abs(days)}d ago`, isDanger: true }
  if (days === 0) return { days, text: 'Expires today', isDanger: true }
  if (days <= 7) return { days, text: `${days}d left`, isDanger: true }
  return { days, text: `${days}d left`, isDanger: false }
}

export default function AdminDashboardPage() {
  const supabase = createClient()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [dbPing, setDbPing] = useState<number>(14)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditLogEvent[]>([])
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modals & Drawers
  const [upiModalOpen, setUpiModalOpen] = useState(false)
  const [upiInput, setUpiInput] = useState('')
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

  // JSON viewer toggle in audit stream
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // --- Data Loading ---
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
      setDbPing(latency > 0 ? latency : 12)

      if (tenantsErr) {
        toast.error(`Error loading tenants: ${tenantsErr.message}`)
      }

      // Map Profiles to Tenants
      const profilesMap = new Map<string, Profile>()
      profilesData?.forEach((p) => {
        if (p.tenant_id) profilesMap.set(p.tenant_id, p as Profile)
      })

      const fullTenants: Tenant[] = (tenantsData || []).map((t) => ({
        ...t,
        owner: profilesMap.get(t.id) || null,
      }))

      setTenants(fullTenants)
      setPlans((plansData as Plan[]) || [])
      setPaymentRequests((requestsData as PaymentRequest[]) || [])
      setPlatformSettings((settingsData as PlatformSettings) || null)
      if (settingsData?.rvc_upi_id) setUpiInput(settingsData.rvc_upi_id)
      if (settingsData?.rvc_upi_qr_url) setUpiQrInput(settingsData.rvc_upi_qr_url)

      // Merge Audit Logs & Tenant Audit Events
      const mergedEvents: AuditLogEvent[] = []

      // Map profiles for actor names
      const profileById = new Map<string, Profile>()
      profilesData?.forEach((p) => profileById.set(p.id, p as Profile))

      const tenantById = new Map<string, Tenant>()
      fullTenants.forEach((t) => tenantById.set(t.id, t))

      auditLogsData?.forEach((log) => {
        const actor = log.actor_id ? profileById.get(log.actor_id) : null
        mergedEvents.push({
          id: log.id,
          actor_id: log.actor_id,
          actor_name: actor?.full_name || 'Super Admin',
          actor_role: actor?.role || 'super_admin',
          action: log.action?.toUpperCase() || 'SYSTEM_ACTION',
          target_tenant_id: log.target_tenant_id,
          tenant_name: log.target_tenant_id ? tenantById.get(log.target_tenant_id)?.name : undefined,
          details: log.details || {},
          created_at: log.created_at,
        })
      })

      tenantAuditData?.forEach((evt) => {
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

      // Sort by timestamp desc
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
    // Sum monthly subscription values of active non-frozen tenants
    return tenants
      .filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen)
      .reduce((sum, t) => sum + Number(t.saas_plans?.price_monthly || 999), 0)
  }, [tenants])

  const arr = mrr * 12

  const fleetStats = useMemo(() => {
    const active = tenants.filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen).length
    const trial = tenants.filter((t) => (t.subscription_status || t.status) === 'trial' && !t.is_frozen).length
    const frozen = tenants.filter((t) => t.is_frozen || (t.subscription_status || t.status) === 'suspended').length
    return { active, trial, frozen, total: tenants.length }
  }, [tenants])

  const pendingPaymentsCount = useMemo(() => {
    return paymentRequests.filter((r) => r.status === 'pending').length
  }, [paymentRequests])

  const churnRiskCount = useMemo(() => {
    return tenants.filter((t) => {
      const { days } = getDaysRemaining(t.subscription_expires_at)
      return days <= 7
    }).length
  }, [tenants])

  // --- Filtered Tenant List ---
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      // Search
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchLower) ||
        t.slug.toLowerCase().includes(searchLower) ||
        (t.owner?.full_name || '').toLowerCase().includes(searchLower) ||
        (t.owner?.phone || '').toLowerCase().includes(searchLower)

      // Vertical Filter
      const matchesVertical = verticalFilter === 'all' || t.vertical.toLowerCase() === verticalFilter.toLowerCase()

      // Status Filter
      const currentStatus = t.is_frozen ? 'frozen' : t.subscription_status || t.status
      const matchesStatus = statusFilter === 'all' || currentStatus.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesVertical && matchesStatus
    })
  }, [tenants, searchQuery, verticalFilter, statusFilter])

  // --- Quick Actions Handlers ---
  const handleToggleMaintenanceMode = async () => {
    if (!platformSettings) return
    const nextMode = !platformSettings.maintenance_mode

    // Optimistic Update
    setPlatformSettings({ ...platformSettings, maintenance_mode: nextMode })

    const { error } = await supabase.from('platform_settings').update({ maintenance_mode: nextMode }).eq('id', true)

    if (error) {
      toast.error(`Failed to toggle maintenance mode: ${error.message}`)
      setPlatformSettings(platformSettings) // Rollback
    } else {
      toast.success(`Platform maintenance mode is now ${nextMode ? 'ENABLED (System Locked)' : 'DISABLED (Operational)'}`)
      // Log audit
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'MAINTENANCE_MODE_TOGGLED',
        details: { maintenance_mode: nextMode },
      })
    }
  }

  const handleSaveUpiConfig = async () => {
    setSavingUpi(true)
    const { error } = await supabase
      .from('platform_settings')
      .update({
        rvc_upi_id: upiInput.trim() || null,
        rvc_upi_qr_url: upiQrInput.trim() || null,
      })
      .eq('id', true)

    setSavingUpi(false)
    if (error) {
      toast.error(`Failed to update UPI settings: ${error.message}`)
    } else {
      toast.success('Platform UPI Payment Config updated!')
      setPlatformSettings((prev) => (prev ? { ...prev, rvc_upi_id: upiInput.trim(), rvc_upi_qr_url: upiQrInput.trim() } : null))
      setUpiModalOpen(false)
    }
  }

  const handleImpersonateTenant = (tenant: Tenant) => {
    setImpersonatingTenant(tenant)
    toast.info(`⚡ Impersonation Active: Simulating session as owner of ${tenant.name}`, {
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

      // Insert audit log
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: shouldFreeze ? 'TENANT_FROZEN' : 'TENANT_UNFROZEN',
        target_tenant_id: freezeModalTenant.id,
        details: { reason, is_frozen: shouldFreeze },
      })

      // Also log tenant audit event
      await supabase.rpc('log_tenant_audit_event', {
        p_tenant_id: freezeModalTenant.id,
        p_action: shouldFreeze ? 'TENANT_FROZEN' : 'TENANT_UNFROZEN',
        p_details: { reason },
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

        if (error) throw new Error(error.message)

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

        if (error) throw new Error(error.message)

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
    const note = rejectionNoteInput.trim() || null

    const { error } = await supabase.rpc('admin_reject_tenant_payment', {
      p_invoice_id: rejectModalRequest.id,
      p_note: note,
    })

    setRejecting(false)

    if (error) {
      toast.error(`Rejection failed: ${error.message}`)
    } else {
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
  }

  const handleExportCSV = () => {
    if (!auditEvents.length) {
      toast.error('No audit events available to export')
      return
    }

    const headers = ['Timestamp', 'Actor Name', 'Role', 'Action Tag', 'Tenant Name', 'Details JSON']
    const rows = auditEvents.map((evt) => [
      new Date(evt.created_at).toLocaleString('en-IN'),
      `"${evt.actor_name || 'System'}"`,
      `"${evt.actor_role || 'system'}"`,
      `"${evt.action}"`,
      `"${evt.tenant_name || 'Global'}"`,
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

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-2 sm:p-4 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Impersonation Banner */}
      {impersonatingTenant && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300"
        >
          <div className="flex items-center gap-2 font-mono">
            <Zap className="size-4 animate-pulse text-amber-400" />
            <span>
              Impersonating Session: <strong className="text-white">{impersonatingTenant.name}</strong> ({impersonatingTenant.slug}) as Owner
            </span>
          </div>
          <button
            onClick={() => setImpersonatingTenant(null)}
            className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-semibold hover:bg-amber-500/30 hover:text-white"
          >
            End Impersonation
          </button>
        </motion.div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">
            <ShieldCheck className="size-4" />
            <span>RVC Command Center • Tier-1 Operations</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Platform Command Hub
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Telemetry
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-60 transition-all shadow-sm"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh Matrix
          </button>
        </div>
      </div>

      {/* ---------------- 1. TOP ROW KPI TELEMETRY BAR (6 DENSE METRIC CARDS) ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: MRR & ARR */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg transition-all duration-200 hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">MRR Telemetry</span>
            <CircleDollarSign className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black tracking-tight text-white">{inr(mrr)}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              +18.4%
            </span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
            <span>ARR Run-rate</span>
            <strong className="text-slate-200">{inr(arr)}</strong>
          </p>
        </div>

        {/* Card 2: Fleet Matrix */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg transition-all duration-200 hover:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Fleet Matrix</span>
            <Building2 className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black tracking-tight text-white">{fleetStats.total}</span>
            <span className="text-[11px] font-mono text-slate-400">Tenants Active</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-400" /> {fleetStats.active} Active
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-400" /> {fleetStats.trial} Trial
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-400" /> {fleetStats.frozen} Frozen
            </span>
          </div>
        </div>

        {/* Card 3: Pending Payment Approvals */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg transition-all duration-200 hover:border-amber-500/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Pending UTRs</span>
            <span className="relative flex size-2.5">
              {pendingPaymentsCount > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex size-2.5 rounded-full ${pendingPaymentsCount > 0 ? 'bg-amber-400' : 'bg-slate-600'}`} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black tracking-tight text-white">{pendingPaymentsCount}</span>
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              Needs Verification
            </span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400">Live UTR Queue Ready</p>
        </div>

        {/* Card 4: Churn / Expiry Risk */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg transition-all duration-200 hover:border-rose-500/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Expiry Risk</span>
            <AlertTriangle className="size-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black tracking-tight text-white">{churnRiskCount}</span>
            <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
              ≤ 7 Days Risk
            </span>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400">Requires Extension</p>
        </div>

        {/* Card 5: System Telemetry & Maintenance Mode */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg transition-all duration-200 hover:border-indigo-500/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">System Ping</span>
            <Activity className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-white font-mono">{dbPing}ms</span>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Operational
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span className="text-[10px] font-mono text-slate-400">Maintenance</span>
            <button
              onClick={() => void handleToggleMaintenanceMode()}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold transition-all ${
                platformSettings?.maintenance_mode
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {platformSettings?.maintenance_mode ? 'LOCKED' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Card 6: Platform UPI Config Popover Trigger */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg transition-all duration-200 hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">Platform UPI</span>
            <QrCode className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="truncate font-mono text-xs font-bold text-slate-200 max-w-[110px]" title={platformSettings?.rvc_upi_id || 'Not set'}>
              {platformSettings?.rvc_upi_id || 'rvc@upi'}
            </span>
            <button
              onClick={() => setUpiModalOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40"
            >
              Update
            </button>
          </div>
          <p className="mt-2 text-[11px] font-mono text-slate-400 truncate">1-Click QR Config</p>
        </div>
      </div>

      {/* ---------------- MAIN GRID LAYOUT (65% LEFT / 35% RIGHT) ---------------- */}
      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        {/* ---------------- 2. LEFT GRID (65% WIDTH) - MULTI-VERTICAL TENANT COMMAND CENTER ---------------- */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
            {/* Header & Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="size-4 text-indigo-400" />
                  Tenant Fleet Command Center
                </h2>
                <p className="text-xs text-slate-400">Manage all business workspaces across RVC platform verticals.</p>
              </div>

              {/* Full-text Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tenant, slug, phone, owner..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-white">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3 text-xs font-mono">
              {/* Vertical Filter Tabs */}
              <div className="flex flex-wrap gap-1">
                {['all', 'restaurant', 'gym', 'hospital', 'school', 'crm'].map((vert) => (
                  <button
                    key={vert}
                    onClick={() => setVerticalFilter(vert)}
                    className={`rounded-lg px-2.5 py-1 uppercase font-semibold transition-all ${
                      verticalFilter === vert
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    [{vert === 'crm' ? 'CRM / ERP' : vert}]
                  </button>
                ))}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap gap-1">
                {['all', 'active', 'trial', 'frozen', 'expired'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2 py-1 capitalize font-semibold transition-all ${
                      statusFilter === st
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    [{st}]
                  </button>
                ))}
              </div>
            </div>

            {/* Tenant Fleet Cards / Rows */}
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-900/60 border border-slate-800" />
                  ))}
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500 font-mono">
                  No tenants match the current search & vertical filter options.
                </div>
              ) : (
                filteredTenants.map((tenant) => {
                  const { text: expiryText, isDanger: expiryDanger } = getDaysRemaining(tenant.subscription_expires_at)
                  const curStatus = tenant.is_frozen ? 'frozen' : tenant.subscription_status || tenant.status

                  return (
                    <motion.div
                      layout
                      key={tenant.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group rounded-xl border border-slate-800/90 bg-[#0a0e17] p-3.5 transition-all duration-200 hover:border-indigo-500/40 hover:bg-[#0f172a]/60 shadow-md"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                            {tenant.name}
                          </span>

                          {/* Vertical Badge */}
                          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 uppercase">
                            {tenant.vertical}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold capitalize ${
                              curStatus === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : curStatus === 'trial'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : curStatus === 'frozen'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {curStatus}
                          </span>

                          {/* Expiry Countdown */}
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-semibold ${
                              expiryDanger ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {expiryText}
                          </span>
                        </div>

                        {/* Quick Action Toolbar */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono">
                          {/* ⚡ Impersonate */}
                          <button
                            onClick={() => handleImpersonateTenant(tenant)}
                            title="Impersonate auth session as tenant owner"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all"
                          >
                            <Zap className="size-3 text-indigo-400" />
                            Impersonate
                          </button>

                          {/* ❄️ Freeze / Unfreeze */}
                          <button
                            onClick={() => {
                              setFreezeModalTenant(tenant)
                              setFreezeReasonInput(tenant.freeze_reason || '')
                            }}
                            title={tenant.is_frozen ? 'Unfreeze tenant account' : 'Freeze tenant account'}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                              tenant.is_frozen
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                            }`}
                          >
                            <ShieldAlert className="size-3" />
                            {tenant.is_frozen ? 'Unfreeze' : 'Freeze'}
                          </button>

                          {/* 📅 Add +30 Days */}
                          <button
                            onClick={() => void handleAdd30Days(tenant)}
                            title="Instant +30 days subscription extension"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <Calendar className="size-3 text-emerald-400" />
                            +30d
                          </button>

                          {/* ⚙️ Manage Drawer */}
                          <button
                            onClick={() => setManageDrawerTenant(tenant)}
                            title="Open full tenant management drawer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <SlidersHorizontal className="size-3 text-slate-400" />
                            Manage
                          </button>
                        </div>
                      </div>

                      {/* Sub-row Info */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-400 border-t border-slate-800/40 pt-2">
                        <span>
                          ID: <code className="text-indigo-400">{tenant.slug || tenant.id.slice(0, 8)}</code>
                        </span>
                        <span>
                          Owner: <strong className="text-slate-200">{tenant.owner?.full_name || 'Not assigned'}</strong>
                        </span>
                        {tenant.owner?.phone && (
                          <span>
                            Phone: <span className="text-slate-300">{tenant.owner.phone}</span>
                          </span>
                        )}
                        <span>
                          Plan: <span className="text-emerald-400">{tenant.saas_plans?.name || 'Basic'}</span>
                        </span>
                        <span className="ml-auto text-[11px] text-slate-500">
                          Joined {new Date(tenant.created_at).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT COLUMN (35% WIDTH) - UTR QUEUE & AUDIT STREAM ---------------- */}
        <div className="space-y-6">
          {/* ---------------- 3. RIGHT UPPER GRID - LIVE UTR VERIFICATION QUEUE ---------------- */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="size-4 text-amber-400" />
                  Live UTR Verification Queue
                </h2>
                <p className="text-[11px] text-slate-400">Manual UPI payment requests pending review.</p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-amber-400 border border-amber-500/30">
                {paymentRequests.filter((r) => r.status === 'pending').length} Pending
              </span>
            </div>

            <div className="mt-3 space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {paymentRequests.filter((r) => r.status === 'pending').length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No pending UTR verification requests.
                </div>
              ) : (
                paymentRequests
                  .filter((r) => r.status === 'pending')
                  .map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-slate-800 bg-[#0a0e17] p-3 shadow-md hover:border-amber-500/40 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-xs text-white">{req.tenants?.name || 'Tenant'}</strong>
                          <span className="ml-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 uppercase">
                            {req.tenants?.vertical || 'SaaS'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{formatRelativeTime(req.created_at)}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">
                          Plan: <strong className="text-indigo-400">{req.saas_plans?.name || 'Sub'}</strong> ({req.billing_cycle})
                        </span>
                        <span className="font-bold text-emerald-400">{inr(req.amount)}</span>
                      </div>

                      {/* UTR Copyable Chip */}
                      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-950 px-2.5 py-1.5 border border-slate-800">
                        <code className="text-xs font-mono text-amber-300 tracking-wider font-bold">{req.utr_reference}</code>
                        <button
                          onClick={() => copyToClipboard(req.utr_reference, 'UTR Reference')}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Copy UTR"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>

                      {/* Approve / Reject Actions */}
                      <div className="mt-3 flex items-center justify-end gap-2 font-mono">
                        <button
                          onClick={() => void handleApprovePayment(req)}
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
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* ---------------- 4. RIGHT LOWER GRID - AUDITABLE ACTIVITY & SECURITY STREAM ---------------- */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="size-4 text-indigo-400" />
                  Auditable Activity & Security Stream
                </h2>
                <p className="text-[11px] text-slate-400">Real-time immutable platform event feed.</p>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              >
                <Download className="size-3 text-indigo-400" />
                Export CSV
              </button>
            </div>

            <div className="mt-3 space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {auditEvents.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No audit events recorded yet.
                </div>
              ) : (
                auditEvents.map((evt) => (
                  <div key={evt.id} className="rounded-xl border border-slate-800/80 bg-[#0a0e17] p-3 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      {/* Action Tag Badge */}
                      <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                        {evt.action}
                      </span>
                      <span className="text-[10px] text-slate-500" title={new Date(evt.created_at).toLocaleString('en-IN')}>
                        {formatRelativeTime(evt.created_at)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-slate-300">
                      <span>
                        Actor: <strong className="text-slate-100">{evt.actor_name}</strong>
                      </span>
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-slate-400 capitalize">
                        {evt.actor_role}
                      </span>
                    </div>

                    {evt.tenant_name && (
                      <p className="mt-1 text-slate-400">
                        Target: <strong className="text-emerald-400">{evt.tenant_name}</strong>
                      </p>
                    )}

                    {/* Collapsible Details Payload */}
                    {evt.details && Object.keys(evt.details).length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedLogId(expandedLogId === evt.id ? null : evt.id)}
                          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:underline"
                        >
                          <ChevronRight className={`size-3 transition-transform ${expandedLogId === evt.id ? 'rotate-90' : ''}`} />
                          {expandedLogId === evt.id ? 'Hide Metadata' : 'View Payload JSON'}
                        </button>
                        {expandedLogId === evt.id && (
                          <pre className="mt-1.5 max-h-32 overflow-x-auto rounded-lg bg-slate-950 p-2 text-[10px] text-emerald-300 border border-slate-800">
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
                  <span className="text-slate-300 font-semibold">Platform UPI VPA Handle</span>
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value)}
                    placeholder="e.g. rvc@upi"
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

      {/* 2. Freeze / Unfreeze Confirmation Modal */}
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
                  {freezeModalTenant.is_frozen ? 'Unfreeze Account' : 'Freeze Account Access'}
                </h3>
                <button onClick={() => setFreezeModalTenant(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-mono">
                Updating status for <strong className="text-white">{freezeModalTenant.name}</strong> ({freezeModalTenant.slug}).
              </p>

              <label className="block text-xs font-mono">
                <span className="text-slate-300 font-semibold">Reason for action (logged to Audit stream):</span>
                <textarea
                  value={freezeReasonInput}
                  onChange={(e) => setFreezeReasonInput(e.target.value)}
                  placeholder="e.g. Non-payment, violation of terms, or requested reactivation"
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
                <span className="text-slate-300 font-semibold">Rejection Reason (Visible to Tenant):</span>
                <textarea
                  value={rejectionNoteInput}
                  onChange={(e) => setRejectionNoteInput(e.target.value)}
                  placeholder="e.g. Invalid UTR reference, amount mismatch, or transaction not found"
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
                    Full Name: <strong className="text-white">{manageDrawerTenant.owner?.full_name || 'Not assigned'}</strong>
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
                    className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
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
