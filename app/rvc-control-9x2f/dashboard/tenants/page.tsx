'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Eye,
  Globe,
  Layers,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Unlock,
  UserPlus,
  Users,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
type Status = 'active' | 'trial' | 'frozen' | 'expired' | 'suspended'

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

interface TenantOperationalMetrics {
  tablesCount: number
  activeOrdersCount: number
  staffCount: number
}

interface Tenant {
  id: string
  name: string
  slug: string
  vertical: string
  status: string
  is_frozen: boolean
  freeze_reason: string | null
  subscription_plan: string | null
  subscription_status: string | null
  subscription_expires_at: string | null
  plan_id: string | null
  created_at: string
  saas_plans?: Plan | null
  owner?: Profile | null
  metrics?: TenantOperationalMetrics
}

// Helpers
const inr = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

function getVerticalBadgeStyle(vertical: string) {
  const v = vertical.toLowerCase()
  if (v.includes('restaurant')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (v.includes('gym')) return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
  if (v.includes('hospital')) return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (v.includes('school') || v.includes('college')) return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
}

function getDaysRemaining(expiresAt: string | null): { days: number; text: string; isDanger: boolean; isWarning: boolean } {
  if (!expiresAt) return { days: 0, text: 'No Expiry Set', isDanger: false, isWarning: false }
  const expiry = new Date(expiresAt)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days < 0) return { days, text: `Expired ${Math.abs(days)}d ago`, isDanger: true, isWarning: false }
  if (days === 0) return { days, text: 'Expires today', isDanger: true, isWarning: false }
  if (days <= 3) return { days, text: `${days}d left`, isDanger: false, isWarning: true }
  if (days <= 7) return { days, text: `${days}d left`, isDanger: false, isWarning: false }
  return { days, text: `${days}d left`, isDanger: false, isWarning: false }
}

export default function TenantsPage() {
  const supabase = createClient()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [impersonatingTenant, setImpersonatingTenant] = useState<Tenant | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expiryFilter, setExpiryFilter] = useState<string>('all')

  // Modals & Drawers
  const [onboardModalOpen, setOnboardModalOpen] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    slug: '',
    vertical: 'restaurant',
    plan_id: '',
    status: 'active',
    owner_name: '',
    owner_phone: '',
  })

  const [freezeModalTenant, setFreezeModalTenant] = useState<Tenant | null>(null)
  const [freezeReasonInput, setFreezeReasonInput] = useState('')
  const [freezing, setFreezing] = useState(false)

  const [settingsDrawerTenant, setSettingsDrawerTenant] = useState<Tenant | null>(null)
  const [settingsPlanId, setSettingsPlanId] = useState('')
  const [settingsExpiryDate, setSettingsExpiryDate] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  // --- Data Fetching ---
  const loadTenantsData = async () => {
    setLoading(true)
    try {
      const [
        { data: tenantsData, error: tenantsErr },
        { data: plansData },
        { data: profilesData },
        { data: tablesData },
        { data: ordersData },
      ] = await Promise.all([
        supabase.from('tenants').select('*, saas_plans(*)').order('created_at', { ascending: false }),
        supabase.from('saas_plans').select('*').order('price_monthly'),
        supabase.from('profiles').select('id, tenant_id, full_name, phone, role'),
        supabase.from('restaurant_tables').select('id, tenant_id'),
        supabase.from('restaurant_orders').select('id, tenant_id, status'),
      ])

      if (tenantsErr) {
        toast.error(`Failed to fetch tenants: ${tenantsErr.message}`)
      }

      // Map Profiles by Tenant
      const profilesMap = new Map<string, Profile>()
      const staffCountMap = new Map<string, number>()

      profilesData?.forEach((p) => {
        if (p.tenant_id) {
          if (p.role === 'tenant_owner' || !profilesMap.has(p.tenant_id)) {
            profilesMap.set(p.tenant_id, p as Profile)
          }
          staffCountMap.set(p.tenant_id, (staffCountMap.get(p.tenant_id) || 0) + 1)
        }
      })

      // Count Tables & Active Orders by Tenant
      const tablesCountMap = new Map<string, number>()
      tablesData?.forEach((t) => {
        tablesCountMap.set(t.tenant_id, (tablesCountMap.get(t.tenant_id) || 0) + 1)
      })

      const activeOrdersCountMap = new Map<string, number>()
      ordersData?.forEach((o) => {
        if (o.status === 'new' || o.status === 'preparing') {
          activeOrdersCountMap.set(o.tenant_id, (activeOrdersCountMap.get(o.tenant_id) || 0) + 1)
        }
      })

      const fullTenants: Tenant[] = (tenantsData || []).map((t) => ({
        ...t,
        owner: profilesMap.get(t.id) || null,
        metrics: {
          tablesCount: tablesCountMap.get(t.id) || 0,
          activeOrdersCount: activeOrdersCountMap.get(t.id) || 0,
          staffCount: staffCountMap.get(t.id) || 1,
        },
      }))

      setTenants(fullTenants)
      const fetchedPlans = (plansData as Plan[]) || []
      setPlans(fetchedPlans)
      if (fetchedPlans.length > 0 && !onboardForm.plan_id) {
        setOnboardForm((prev) => ({ ...prev, plan_id: fetchedPlans[0].id }))
      }
    } catch (err: unknown) {
      toast.error(`Data loading error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTenantsData()
  }, [])

  // Sync settings drawer state
  useEffect(() => {
    if (settingsDrawerTenant) {
      setSettingsPlanId(settingsDrawerTenant.plan_id || '')
      setSettingsExpiryDate(
        settingsDrawerTenant.subscription_expires_at
          ? new Date(settingsDrawerTenant.subscription_expires_at).toISOString().slice(0, 16)
          : ''
      )
    }
  }, [settingsDrawerTenant])

  // --- Computations ---
  const activeMrr = useMemo(() => {
    return tenants
      .filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen)
      .reduce((sum, t) => sum + Number(t.saas_plans?.price_monthly || 999), 0)
  }, [tenants])

  const frozenCount = useMemo(() => tenants.filter((t) => t.is_frozen || t.status === 'suspended').length, [tenants])

  // --- Filtering ---
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.owner?.full_name || '').toLowerCase().includes(q) ||
        (t.owner?.phone || '').toLowerCase().includes(q)

      // 2. Vertical Filter
      const v = verticalFilter.toLowerCase()
      const matchesVertical =
        v === 'all' ||
        (v === 'restaurant' && t.vertical.toLowerCase().includes('restaurant')) ||
        (v === 'gym' && t.vertical.toLowerCase().includes('gym')) ||
        (v === 'hospital' && t.vertical.toLowerCase().includes('hospital')) ||
        (v === 'school' && (t.vertical.toLowerCase().includes('school') || t.vertical.toLowerCase().includes('college'))) ||
        (v === 'other' && !['restaurant', 'gym', 'hospital', 'school', 'college'].some((k) => t.vertical.toLowerCase().includes(k)))

      // 3. Status Filter
      const curStatus = t.is_frozen ? 'frozen' : t.subscription_status || t.status
      const matchesStatus = statusFilter === 'all' || curStatus.toLowerCase() === statusFilter.toLowerCase()

      // 4. Expiry Filter
      const { days } = getDaysRemaining(t.subscription_expires_at)
      let matchesExpiry = true
      if (expiryFilter === 'expiring_7') {
        matchesExpiry = days >= 0 && days <= 7
      } else if (expiryFilter === 'expired') {
        matchesExpiry = days < 0 || curStatus === 'expired'
      }

      return matchesSearch && matchesVertical && matchesStatus && matchesExpiry
    })
  }, [tenants, searchQuery, verticalFilter, statusFilter, expiryFilter])

  // --- Actions ---

  // 1. Impersonate
  const handleImpersonate = (tenant: Tenant) => {
    setImpersonatingTenant(tenant)
    toast.info(`⚡ Session Switched: Impersonating ${tenant.name} (${tenant.slug}) as Owner`, {
      duration: 6000,
    })
  }

  // 2. Freeze / Unfreeze
  const handleToggleFreeze = async () => {
    if (!freezeModalTenant) return
    setFreezing(true)

    const shouldFreeze = !freezeModalTenant.is_frozen
    const reason = freezeReasonInput.trim() || (shouldFreeze ? 'Administrative freeze by Super Admin' : 'Freeze lifted by Super Admin')
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
      toast.success(`Tenant "${freezeModalTenant.name}" is now ${shouldFreeze ? 'FROZEN' : 'UNFROZEN'}`)

      // Log to audit_logs
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: shouldFreeze ? 'TENANT_FROZEN' : 'TENANT_UNFROZEN',
        target_tenant_id: freezeModalTenant.id,
        details: { freeze_reason: reason, is_frozen: shouldFreeze },
      })

      setFreezeModalTenant(null)
      setFreezeReasonInput('')
      void loadTenantsData()
    }
  }

  // 3. Instant +30 Days Extension
  const handleAdd30Days = async (tenant: Tenant) => {
    const currentExpiry = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : new Date()
    const baseTime = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date()
    const newExpiry = new Date(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

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

        void loadTenantsData()
      },
      {
        loading: `Extending subscription for ${tenant.name}...`,
        success: `Extended subscription by +30 Days for "${tenant.name}"! Expiry: ${new Date(newExpiry).toLocaleDateString('en-IN')}`,
        error: (err) => `Extension failed: ${err.message}`,
      }
    )
  }

  // 4. Onboard New Tenant
  const handleOnboardTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onboardForm.name.trim()) {
      toast.error('Business Name is required')
      return
    }

    setOnboarding(true)
    try {
      const generatedSlug =
        onboardForm.slug.trim() ||
        `ten_${onboardForm.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 12)}_${Math.floor(1000 + Math.random() * 9000)}`

      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      // Insert into public.tenants
      const { data: newTenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          name: onboardForm.name.trim(),
          slug: generatedSlug,
          vertical: onboardForm.vertical,
          plan_id: onboardForm.plan_id || null,
          status: onboardForm.status,
          subscription_status: onboardForm.status,
          subscription_expires_at: expiryDate,
          is_frozen: false,
        })
        .select()
        .single()

      if (tenantErr) throw new Error(tenantErr.message)

      // Create owner profile if phone/name supplied
      if (onboardForm.owner_name.trim()) {
        const { error: profileErr } = await supabase.from('profiles').insert({
          tenant_id: newTenant.id,
          full_name: onboardForm.owner_name.trim(),
          phone: onboardForm.owner_phone.trim() || null,
          role: 'tenant_owner',
        })
        if (profileErr) console.warn('Owner profile creation notice:', profileErr.message)
      }

      // Log to audit_logs
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'TENANT_ONBOARDED',
        target_tenant_id: newTenant.id,
        details: { name: newTenant.name, slug: newTenant.slug, vertical: newTenant.vertical },
      })

      toast.success(`Tenant "${newTenant.name}" onboarded successfully!`)
      setOnboardModalOpen(false)
      setOnboardForm({
        name: '',
        slug: '',
        vertical: 'restaurant',
        plan_id: plans[0]?.id || '',
        status: 'active',
        owner_name: '',
        owner_phone: '',
      })
      void loadTenantsData()
    } catch (err: unknown) {
      toast.error(`Onboarding failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setOnboarding(false)
    }
  }

  // 5. Save Settings Drawer
  const handleSaveSettingsDrawer = async () => {
    if (!settingsDrawerTenant) return
    setSavingSettings(true)

    const newExpiry = settingsExpiryDate ? new Date(settingsExpiryDate).toISOString() : null

    const { error } = await supabase.rpc('admin_update_tenant_subscription', {
      p_tenant_id: settingsDrawerTenant.id,
      p_plan_id: settingsPlanId || null,
      p_status: settingsDrawerTenant.status,
      p_expires_at: newExpiry,
    })

    setSavingSettings(false)

    if (error) {
      toast.error(`Settings update failed: ${error.message}`)
    } else {
      toast.success(`Settings updated for "${settingsDrawerTenant.name}"!`)

      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'TENANT_SETTINGS_UPDATED',
        target_tenant_id: settingsDrawerTenant.id,
        details: { plan_id: settingsPlanId, expires_at: newExpiry },
      })

      setSettingsDrawerTenant(null)
      void loadTenantsData()
    }
  }

  // 6. CSV Export
  const handleExportCSV = () => {
    if (!filteredTenants.length) {
      toast.error('No tenant records available to export')
      return
    }

    const headers = ['Business Name', 'Slug', 'Vertical', 'Status', 'Is Frozen', 'Freeze Reason', 'Plan Name', 'Monthly Price', 'Owner Name', 'Owner Phone', 'Expires At', 'Created At']
    const rows = filteredTenants.map((t) => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.slug}"`,
      `"${t.vertical}"`,
      `"${t.subscription_status || t.status}"`,
      `"${t.is_frozen}"`,
      `"${(t.freeze_reason || '').replace(/"/g, '""')}"`,
      `"${t.saas_plans?.name || 'Basic'}"`,
      `"${t.saas_plans?.price_monthly || 999}"`,
      `"${(t.owner?.full_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${t.owner?.phone || ''}"`,
      `"${t.subscription_expires_at ? new Date(t.subscription_expires_at).toLocaleString('en-IN') : 'Not Set'}"`,
      `"${new Date(t.created_at).toLocaleDateString('en-IN')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `rvc_fleet_tenants_export_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Fleet data exported as CSV!')
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Impersonation Banner */}
      {impersonatingTenant && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 font-mono shadow-lg"
        >
          <div className="flex items-center gap-2">
            <Zap className="size-4 animate-pulse text-amber-400" />
            <span>
              Session Impersonation Active: <strong className="text-white">{impersonatingTenant.name}</strong> ({impersonatingTenant.slug}) as Owner
            </span>
          </div>
          <button
            onClick={() => setImpersonatingTenant(null)}
            className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-semibold hover:bg-amber-500/30 hover:text-white"
          >
            End Session
          </button>
        </motion.div>
      )}

      {/* Header Controls & Summary Telemetry Counters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">
            <Building2 className="size-4" />
            <span>RVC Multi-Tenant Command Console</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Business Accounts Fleet
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              {tenants.length} Workspaces Registered
            </span>
          </h1>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <Download className="size-3.5 text-indigo-400" />
            Export Fleet Data (CSV)
          </button>

          <button
            onClick={() => setOnboardModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-mono font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <UserPlus className="size-4" />
            + Onboard New Tenant
          </button>

          <button
            onClick={() => void loadTenantsData()}
            disabled={loading}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh Fleet Matrix"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Telemetry Counters */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {/* Counter 1: Active MRR */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Active Fleet MRR</span>
            <p className="mt-1 text-2xl font-black text-white">{inr(activeMrr)}</p>
            <p className="mt-0.5 text-[11px] font-mono text-emerald-400">Run-rate: {inr(activeMrr * 12)} / yr</p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="size-6" />
          </div>
        </div>

        {/* Counter 2: Fleet Count */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Total Businesses</span>
            <p className="mt-1 text-2xl font-black text-white">{tenants.length}</p>
            <p className="mt-0.5 text-[11px] font-mono text-indigo-400">
              Active: {tenants.filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen).length} | Trial:{' '}
              {tenants.filter((t) => (t.subscription_status || t.status) === 'trial' && !t.is_frozen).length}
            </p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="size-6" />
          </div>
        </div>

        {/* Counter 3: Frozen Count */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Frozen Accounts</span>
            <p className="mt-1 text-2xl font-black text-white">{frozenCount}</p>
            <p className="mt-0.5 text-[11px] font-mono text-rose-400">
              {frozenCount > 0 ? 'Requires Administrative Review' : 'No Frozen Accounts'}
            </p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="size-6" />
          </div>
        </div>
      </div>

      {/* ---------------- SEARCH, FILTER PILLS & CONTROLS ---------------- */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl space-y-3">
        {/* Top Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Real-time filter across business name, slug (ten_xxxx), owner name, phone number..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Filter Pills Groups */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs font-mono">
          {/* Vertical Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Vertical:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'restaurant', label: 'Restaurant' },
              { id: 'gym', label: 'Gym' },
              { id: 'hospital', label: 'Hospital' },
              { id: 'school', label: 'School' },
              { id: 'other', label: 'Other / CRM' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVerticalFilter(v.id)}
                className={`rounded-lg px-2.5 py-1 uppercase font-semibold transition-all ${
                  verticalFilter === v.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Status:</span>
            {['all', 'active', 'trial', 'frozen', 'expired'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 capitalize font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Expiry Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Expiry Risk:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'expiring_7', label: 'Expiring ≤ 7d' },
              { id: 'expired', label: 'Expired / Overdue' },
            ].map((ex) => (
              <button
                key={ex.id}
                onClick={() => setExpiryFilter(ex.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  expiryFilter === ex.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 3. RICH DATA ROWS & COLUMN SPECIFICATIONS ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs font-mono">
            <thead className="bg-[#0a0e17] uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">1. Tenant Entity & Owner</th>
                <th className="p-4">2. Vertical & Plan Tier</th>
                <th className="p-4">3. Operational Metrics</th>
                <th className="p-4">4. Subscription Expiry</th>
                <th className="p-4 text-right">5. Direct Action Toolbar</th>
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
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Building2 className="mx-auto size-8 text-slate-600" />
                      <p className="font-semibold text-sm text-slate-400">No tenants matched your search criteria.</p>
                      <p className="text-xs text-slate-500">Try clearing filters or search query.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const { text: expiryText, isDanger: expiryDanger, isWarning: expiryWarning } = getDaysRemaining(
                    tenant.subscription_expires_at
                  )
                  const curStatus = tenant.is_frozen ? 'frozen' : tenant.subscription_status || tenant.status
                  const verticalStyle = getVerticalBadgeStyle(tenant.vertical)

                  return (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group hover:bg-[#0f172a]/60 transition-colors"
                    >
                      {/* Column 1: Tenant Entity & Identity */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {tenant.name}
                            </strong>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <code
                              onClick={() => copyToClipboard(tenant.slug, 'Slug')}
                              className="rounded bg-slate-950 px-2 py-0.5 text-[10px] text-indigo-400 border border-slate-800 cursor-pointer hover:border-indigo-500/50"
                              title="Click to copy slug"
                            >
                              {tenant.slug}
                            </code>
                          </div>
                          <div className="text-[11px] text-slate-400 pt-0.5">
                            Owner: <strong className="text-slate-200">{tenant.owner?.full_name || 'Unassigned'}</strong>
                            {tenant.owner?.phone && <span className="ml-1 text-slate-400">({tenant.owner.phone})</span>}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Vertical & Plan Tier */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${verticalStyle}`}>
                            {tenant.vertical}
                          </span>
                          <p className="text-xs text-slate-200 font-bold">
                            {tenant.saas_plans?.name || tenant.subscription_plan || 'Basic Plan'}
                          </p>
                          <p className="text-[11px] text-emerald-400 font-bold">
                            {inr(tenant.saas_plans?.price_monthly || 999)} <span className="text-[10px] text-slate-400 font-normal">/ mo</span>
                          </p>
                        </div>
                      </td>

                      {/* Column 3: Operational Metrics */}
                      <td className="p-4 align-top">
                        {tenant.vertical.toLowerCase().includes('restaurant') ? (
                          <div className="space-y-1 text-[11px] text-slate-300">
                            <p className="flex items-center gap-1.5">
                              <Utensils className="size-3 text-emerald-400" />
                              Tables: <strong className="text-white">{tenant.metrics?.tablesCount || 0}</strong>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Sparkles className="size-3 text-amber-400" />
                              Active Orders: <strong className="text-white">{tenant.metrics?.activeOrdersCount || 0}</strong>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Users className="size-3 text-indigo-400" />
                              Staff: <strong className="text-white">{tenant.metrics?.staffCount || 1}</strong>
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 text-[11px] text-slate-400">
                            <p>Created: {new Date(tenant.created_at).toLocaleDateString('en-IN')}</p>
                            <p className="text-slate-300">Operational: Active</p>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Subscription Status & Expiry */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          {/* Status Tag */}
                          <div>
                            {curStatus === 'active' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-400" /> 🟢 Active
                              </span>
                            )}
                            {curStatus === 'trial' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                                <span className="size-1.5 rounded-full bg-amber-400" /> 🟡 Trial
                              </span>
                            )}
                            {curStatus === 'frozen' && (
                              <span
                                title={tenant.freeze_reason || 'Administrative freeze'}
                                className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 cursor-help"
                              >
                                <span className="size-1.5 rounded-full bg-rose-400 animate-pulse" /> 🔴 Frozen
                              </span>
                            )}
                            {curStatus === 'expired' && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                                ⚪ Expired
                              </span>
                            )}
                          </div>

                          {/* Expiry Pill */}
                          <div className="text-[11px]">
                            <span
                              className={`rounded px-2 py-0.5 ${
                                expiryDanger
                                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                                  : expiryWarning
                                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                                  : 'text-slate-400'
                              }`}
                            >
                              {expiryText}
                            </span>
                          </div>

                          {tenant.is_frozen && tenant.freeze_reason && (
                            <p className="text-[10px] text-rose-400/90 truncate max-w-[180px]" title={tenant.freeze_reason}>
                              Reason: {tenant.freeze_reason}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Direct Action Controls Toolbar */}
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* ⚡ Impersonate */}
                          <button
                            onClick={() => handleImpersonate(tenant)}
                            title="Impersonate tenant session as owner"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all"
                          >
                            <Zap className="size-3 text-indigo-400" />
                            Impersonate
                          </button>

                          {/* ❄️ Freeze / 🔓 Unfreeze */}
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
                            {tenant.is_frozen ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                            {tenant.is_frozen ? 'Unfreeze' : 'Freeze'}
                          </button>

                          {/* 📅 Extend (+30 Days) */}
                          <button
                            onClick={() => void handleAdd30Days(tenant)}
                            title="Instant +30 days subscription extension"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <CalendarPlus className="size-3 text-emerald-400" />
                            +30d
                          </button>

                          {/* ⚙️ Settings */}
                          <button
                            onClick={() => setSettingsDrawerTenant(tenant)}
                            title="Open tenant settings drawer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <SlidersHorizontal className="size-3 text-slate-400" />
                            Settings
                          </button>
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

      {/* ---------------- MODALS & SLIDE-OUT DRAWERS ---------------- */}

      {/* 1. Onboard New Tenant Modal */}
      <AnimatePresence>
        {onboardModalOpen && (
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
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <UserPlus className="size-5 text-indigo-400" />
                  Onboard New Tenant Workspace
                </h3>
                <button onClick={() => setOnboardModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={(e) => void handleOnboardTenant(e)} className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Business Name *</span>
                    <input
                      type="text"
                      required
                      value={onboardForm.name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                      placeholder="e.g. Spice Route Bistro"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Slug Tag (Auto if blank)</span>
                    <input
                      type="text"
                      value={onboardForm.slug}
                      onChange={(e) => setOnboardForm({ ...onboardForm, slug: e.target.value })}
                      placeholder="ten_spiceroute"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Platform Vertical</span>
                    <select
                      value={onboardForm.vertical}
                      onChange={(e) => setOnboardForm({ ...onboardForm, vertical: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="restaurant">Restaurant</option>
                      <option value="gym">Gym & Fitness</option>
                      <option value="hospital">Hospital / Clinic</option>
                      <option value="school">School / College</option>
                      <option value="crm">CRM / Enterprise ERP</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Initial SaaS Plan</span>
                    <select
                      value={onboardForm.plan_id}
                      onChange={(e) => setOnboardForm({ ...onboardForm, plan_id: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({inr(p.price_monthly)}/mo)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="border-t border-slate-800/80 pt-3 space-y-2">
                  <p className="text-[11px] font-bold text-indigo-400">Owner Contact Profile (Optional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={onboardForm.owner_name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_name: e.target.value })}
                      placeholder="Owner Full Name"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={onboardForm.owner_phone}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_phone: e.target.value })}
                      placeholder="Owner Phone Number"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setOnboardModalOpen(false)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboarding}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {onboarding ? 'Onboarding...' : 'Confirm Tenant Onboarding'}
                  </button>
                </div>
              </form>
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
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <ShieldAlert className="size-5 text-rose-400" />
                  {freezeModalTenant.is_frozen ? 'Lift Freeze Access' : 'Freeze Tenant Workspace'}
                </h3>
                <button onClick={() => setFreezeModalTenant(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-mono">
                Modifying access state for <strong className="text-white">{freezeModalTenant.name}</strong> ({freezeModalTenant.slug}).
              </p>

              <label className="block text-xs font-mono">
                <span className="text-slate-300 font-semibold">Reason for Action (Recorded in Audit Logs):</span>
                <textarea
                  value={freezeReasonInput}
                  onChange={(e) => setFreezeReasonInput(e.target.value)}
                  placeholder="e.g. Non-payment, terms violation, or manual reactivation"
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-rose-500 focus:outline-none min-h-[80px]"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 font-mono">
                <button
                  onClick={() => setFreezeModalTenant(null)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={freezing}
                  onClick={() => void handleToggleFreeze()}
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

      {/* 3. Slide-Out Tenant Settings Drawer */}
      <AnimatePresence>
        {settingsDrawerTenant && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm" onClick={() => setSettingsDrawerTenant(null)}>
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-lg border-l border-slate-800 bg-[#0d1322] p-6 shadow-2xl overflow-y-auto space-y-6 text-slate-100 font-mono"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Building2 className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">{settingsDrawerTenant.name}</h3>
                    <p className="text-xs text-slate-400">{settingsDrawerTenant.slug}</p>
                  </div>
                </div>
                <button onClick={() => setSettingsDrawerTenant(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              {/* Owner Info Profile */}
              <div className="rounded-xl border border-slate-800 bg-[#0a0e17] p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="size-4 text-indigo-400" />
                  Owner Contact Profile
                </h4>
                <div className="text-xs text-slate-300 space-y-1">
                  <p>
                    Full Name: <strong className="text-white">{settingsDrawerTenant.owner?.full_name || 'Unassigned'}</strong>
                  </p>
                  <p>
                    Phone: <span className="text-slate-200">{settingsDrawerTenant.owner?.phone || '—'}</span>
                  </p>
                </div>
              </div>

              {/* Plan Assignment & Subscription Expiry */}
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-slate-300">
                  Assigned SaaS Plan
                  <select
                    value={settingsPlanId}
                    onChange={(e) => setSettingsPlanId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">No Plan Assigned</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {inr(p.price_monthly)}/month ({inr(p.price_yearly)}/yr)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-300">
                  Exact Subscription Expiry Timestamp
                  <input
                    type="datetime-local"
                    value={settingsExpiryDate}
                    onChange={(e) => setSettingsExpiryDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 30)
                      setSettingsExpiryDate(d.toISOString().slice(0, 16))
                    }}
                    className="rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    Set +30 Days
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date()
                      d.setDate(d.getDate() + 365)
                      setSettingsExpiryDate(d.toISOString().slice(0, 16))
                    }}
                    className="rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    Set +1 Year
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-800/80 pt-4 space-y-2">
                <button
                  disabled={savingSettings}
                  onClick={() => void handleSaveSettingsDrawer()}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingSettings ? 'Saving Settings...' : 'Save Tenant Settings'}
                </button>

                <button
                  onClick={() => {
                    handleImpersonate(settingsDrawerTenant)
                    setSettingsDrawerTenant(null)
                  }}
                  className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 py-3 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20"
                >
                  ⚡ Impersonate Tenant Owner Session
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
