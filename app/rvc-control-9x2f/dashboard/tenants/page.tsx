'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Calendar,
  CalendarPlus,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Eye,
  Globe,
  Layers,
  Lock,
  Plus,
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

// --- Helpers ---
const inr = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

function getVerticalBadgeStyle(vertical?: string) {
  const v = (vertical || '').toLowerCase()
  if (v.includes('restaurant')) return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  if (v.includes('gym')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (v.includes('hospital')) return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (v.includes('school') || v.includes('college')) return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
}

function getStatusBadgeStyle(status?: string, isFrozen?: boolean) {
  if (isFrozen) return 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-semibold animate-pulse'
  const s = (status || '').toLowerCase()
  if (s === 'active') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-medium'
  if (s === 'trial') return 'border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium'
  if (s === 'expired' || s === 'suspended') return 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-semibold animate-pulse'
  return 'border-slate-700 bg-slate-800 text-slate-300 font-medium'
}

function getDaysRemaining(expiresAt?: string | null): { days: number; text: string; isDanger: boolean; isWarning: boolean } {
  if (!expiresAt) return { days: 0, text: 'No Expiry Set', isDanger: false, isWarning: false }
  const expiry = new Date(expiresAt)
  if (isNaN(expiry.getTime())) return { days: 0, text: 'No Expiry Set', isDanger: false, isWarning: false }
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (days < 0) return { days, text: `⚠️ Expired ${Math.abs(days)}d ago`, isDanger: true, isWarning: false }
  if (days === 0) return { days, text: '⚠️ Expires today', isDanger: true, isWarning: false }
  if (days <= 3) return { days, text: `⏳ ${days}d left`, isDanger: false, isWarning: true }
  if (days <= 7) return { days, text: `⏳ ${days}d left`, isDanger: false, isWarning: false }
  return { days, text: `⏳ ${days}d left`, isDanger: false, isWarning: false }
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
  const [autoSlugEdited, setAutoSlugEdited] = useState(false)
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    slug: '',
    vertical: 'restaurant',
    plan_id: '',
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

      const safeProfiles = profilesData || []
      safeProfiles.forEach((p) => {
        if (p.tenant_id) {
          if (p.role === 'tenant_owner' || !profilesMap.has(p.tenant_id)) {
            profilesMap.set(p.tenant_id, p as Profile)
          }
          staffCountMap.set(p.tenant_id, (staffCountMap.get(p.tenant_id) || 0) + 1)
        }
      })

      // Count Tables & Active Orders by Tenant
      const tablesCountMap = new Map<string, number>()
      const safeTables = tablesData || []
      safeTables.forEach((t) => {
        tablesCountMap.set(t.tenant_id, (tablesCountMap.get(t.tenant_id) || 0) + 1)
      })

      const activeOrdersCountMap = new Map<string, number>()
      const safeOrders = ordersData || []
      safeOrders.forEach((o) => {
        if (o.status === 'new' || o.status === 'preparing') {
          activeOrdersCountMap.set(o.tenant_id, (activeOrdersCountMap.get(o.tenant_id) || 0) + 1)
        }
      })

      const safeTenants = tenantsData || []
      const fullTenants: Tenant[] = safeTenants.map((t) => ({
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

  // --- Auto-slugify business name ---
  const handleNameChange = (nameVal: string) => {
    if (!autoSlugEdited) {
      const slugified = `ten_${nameVal
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 18)}`
      setOnboardForm((prev) => ({ ...prev, name: nameVal, slug: slugified }))
    } else {
      setOnboardForm((prev) => ({ ...prev, name: nameVal }))
    }
  }

  // --- Telemetry Computations ---
  const activeMrr = useMemo(() => {
    const safeTenants = tenants || []
    return safeTenants
      .filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen)
      .reduce((sum, t) => sum + Number(t.saas_plans?.price_monthly || 4999), 0)
  }, [tenants])

  const frozenCount = useMemo(() => {
    const safeTenants = tenants || []
    return safeTenants.filter((t) => t.is_frozen || (t.subscription_status || t.status) === 'suspended').length
  }, [tenants])

  // --- Filtering ---
  const filteredTenants = useMemo(() => {
    const safeTenants = tenants || []
    return safeTenants.filter((t) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (t.name || '').toLowerCase().includes(q) ||
        (t.slug || '').toLowerCase().includes(q) ||
        (t.owner?.full_name || '').toLowerCase().includes(q) ||
        (t.owner?.phone || '').toLowerCase().includes(q)

      // 2. Vertical Filter
      const v = verticalFilter.toLowerCase()
      const matchesVertical =
        v === 'all' ||
        (v === 'restaurant' && (t.vertical || '').toLowerCase().includes('restaurant')) ||
        (v === 'gym' && (t.vertical || '').toLowerCase().includes('gym')) ||
        (v === 'hospital' && (t.vertical || '').toLowerCase().includes('hospital')) ||
        (v === 'school' && ((t.vertical || '').toLowerCase().includes('school') || (t.vertical || '').toLowerCase().includes('college'))) ||
        (v === 'other' && !['restaurant', 'gym', 'hospital', 'school', 'college'].some((k) => (t.vertical || '').toLowerCase().includes(k)))

      // 3. Status Filter
      const curStatus = t.is_frozen ? 'frozen' : (t.subscription_status || t.status || 'trial')
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

  // 1. Impersonate Tenant
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

        if (error) {
          // Fallback direct update
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

        void loadTenantsData()
      },
      {
        loading: `Extending subscription for ${tenant.name}...`,
        success: `Extended subscription by +30 Days for "${tenant.name}"! Expiry: ${new Date(newExpiry).toLocaleDateString('en-IN')}`,
        error: (err) => `Extension failed: ${err.message}`,
      }
    )
  }

  // 4. Onboard New Tenant Modal Handler
  const handleOnboardTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onboardForm.name.trim()) {
      toast.error('Business Name is required')
      return
    }

    // Phone validation if provided
    if (onboardForm.owner_phone.trim()) {
      const cleanPhone = onboardForm.owner_phone.replace(/\D/g, '')
      if (cleanPhone.length < 10) {
        toast.error('Owner Phone Number must be a valid 10-digit number')
        return
      }
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

      // Direct insert to public.tenants
      const { data: newTenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          name: onboardForm.name.trim(),
          slug: generatedSlug,
          vertical: onboardForm.vertical,
          plan_id: onboardForm.plan_id || null,
          status: 'active',
          subscription_status: 'active',
          subscription_expires_at: expiryDate,
          is_frozen: false,
        })
        .select()
        .single()

      if (tenantErr) throw new Error(tenantErr.message)

      // Create owner profile if owner details supplied
      if (onboardForm.owner_name.trim() || onboardForm.owner_phone.trim()) {
        const { error: profileErr } = await supabase.from('profiles').insert({
          tenant_id: newTenant.id,
          full_name: onboardForm.owner_name.trim() || 'Owner',
          phone: onboardForm.owner_phone.trim() || null,
          role: 'tenant_owner',
        })
        if (profileErr) console.warn('Owner profile creation notice:', profileErr.message)
      }

      // Add event to public.audit_logs
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'TENANT_CREATED',
        target_tenant_id: newTenant.id,
        details: { name: newTenant.name, slug: newTenant.slug, vertical: newTenant.vertical },
      })

      toast.success(`Tenant "${newTenant.name}" onboarded successfully!`)
      setOnboardModalOpen(false)
      setAutoSlugEdited(false)
      setOnboardForm({
        name: '',
        slug: '',
        vertical: 'restaurant',
        plan_id: plans[0]?.id || '',
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
    const safeFiltered = filteredTenants || []
    if (!safeFiltered.length) {
      toast.error('No tenant records available to export')
      return
    }

    const headers = ['Business Name', 'Slug', 'Vertical', 'Status', 'Is Frozen', 'Freeze Reason', 'Plan Name', 'Monthly Price', 'Owner Name', 'Owner Phone', 'Expires At', 'Created At']
    const rows = safeFiltered.map((t) => [
      `"${(t.name || '').replace(/"/g, '""')}"`,
      `"${t.slug || ''}"`,
      `"${t.vertical || ''}"`,
      `"${t.subscription_status || t.status || ''}"`,
      `"${t.is_frozen}"`,
      `"${(t.freeze_reason || '').replace(/"/g, '""')}"`,
      `"${t.saas_plans?.name || 'Basic'}"`,
      `"${t.saas_plans?.price_monthly || 4999}"`,
      `"${(t.owner?.full_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${t.owner?.phone || ''}"`,
      `"${t.subscription_expires_at ? new Date(t.subscription_expires_at).toLocaleString('en-IN') : 'Not Set'}"`,
      `"${new Date(t.created_at || Date.now()).toLocaleDateString('en-IN')}"`,
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
    <div className="w-full space-y-6 text-slate-200 font-sans">
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
            className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-semibold hover:bg-amber-500/30 hover:text-white transition-all"
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-mono font-medium text-emerald-400">
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
            Export Fleet CSV
          </button>

          <button
            onClick={() => {
              setAutoSlugEdited(false)
              setOnboardModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-mono font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <UserPlus className="size-4" />
            + Onboard New Tenant Workspace
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

      {/* ---------------- 1. HEADER METRIC STRIP (TOP ROW: 3 CARDS) ---------------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: ACTIVE FLEET MRR */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-5 shadow-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Active Fleet MRR</span>
            <p className="mt-1 text-2xl font-black font-mono tracking-tight text-white">
              {loading ? <span className="text-slate-600 animate-pulse">₹...,...</span> : inr(activeMrr > 0 ? activeMrr : 4999)}
            </p>
            <p className="mt-1 text-[11px] font-mono text-emerald-400 font-semibold">
              Run-rate: {inr((activeMrr > 0 ? activeMrr : 4999) * 12)} / yr
            </p>
          </div>
          <div className="grid size-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="size-6" />
          </div>
        </div>

        {/* Card 2: TOTAL BUSINESSES */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-5 shadow-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Total Businesses</span>
            <p className="mt-1 text-2xl font-black font-mono tracking-tight text-white">
              {loading ? <span className="text-slate-600 animate-pulse">...</span> : tenants.length}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300 font-medium">
                Active: {tenants.filter((t) => (t.subscription_status || t.status) === 'active' && !t.is_frozen).length}
              </span>
              <span className="text-slate-500">|</span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300 font-medium">
                Trial: {tenants.filter((t) => (t.subscription_status || t.status) === 'trial' && !t.is_frozen).length}
              </span>
            </div>
          </div>
          <div className="grid size-12 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="size-6" />
          </div>
        </div>

        {/* Card 3: FROZEN ACCOUNTS */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-5 shadow-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Frozen Accounts</span>
            <p className="mt-1 text-2xl font-black font-mono tracking-tight text-white">{frozenCount}</p>
            <p className={`mt-1 text-[11px] font-mono font-semibold ${frozenCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {frozenCount > 0 ? 'Requires Administrative Review' : 'No Frozen Accounts'}
            </p>
          </div>
          <div className={`grid size-12 place-items-center rounded-xl border ${frozenCount > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'}`}>
            <ShieldAlert className="size-6" />
          </div>
        </div>
      </div>

      {/* ---------------- 2. SEARCH & FILTER TOOLBAR ---------------- */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-4 shadow-2xl space-y-3">
        {/* Real-time Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenant name, slug (ten_xxxx), owner name, phone number..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
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
              { id: 'all', label: '[ ALL ]' },
              { id: 'restaurant', label: '[ RESTAURANT ]' },
              { id: 'gym', label: '[ GYM ]' },
              { id: 'hospital', label: '[ HOSPITAL ]' },
              { id: 'school', label: '[ SCHOOL ]' },
              { id: 'other', label: '[ OTHER / CRM ]' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVerticalFilter(v.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                  verticalFilter === v.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Status:</span>
            {[
              { id: 'all', label: '[ ALL ]' },
              { id: 'active', label: '[ Active ]' },
              { id: 'trial', label: '[ Trial ]' },
              { id: 'frozen', label: '[ Frozen ]' },
              { id: 'expired', label: '[ Expired ]' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  statusFilter === st.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Expiry Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Expiry Risk:</span>
            {[
              { id: 'all', label: '[ ALL ]' },
              { id: 'expiring_7', label: '[ Expiring ≤ 7d ]' },
              { id: 'expired', label: '[ Expired / Overdue ]' },
            ].map((ex) => (
              <button
                key={ex.id}
                onClick={() => setExpiryFilter(ex.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  expiryFilter === ex.id
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 3. TENANT FLEET DATA TABLE ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs font-mono">
            <thead className="bg-slate-950/90 uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
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
                      <div className="h-10 animate-pulse rounded-xl bg-slate-800/40" />
                    </td>
                  </tr>
                ))
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Building2 className="mx-auto size-8 text-slate-600" />
                      <p className="font-semibold text-sm text-slate-400">No tenants matched your search criteria.</p>
                      <p className="text-xs text-slate-500">Try clearing active filters or search query.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (filteredTenants || []).map((tenant) => {
                  const { text: expiryText, isDanger: expiryDanger, isWarning: expiryWarning } = getDaysRemaining(
                    tenant.subscription_expires_at
                  )
                  const curStatus = tenant.is_frozen ? 'frozen' : (tenant.subscription_status || tenant.status || 'trial')
                  const verticalStyle = getVerticalBadgeStyle(tenant.vertical)
                  const statusStyle = getStatusBadgeStyle(curStatus, tenant.is_frozen)

                  return (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Column 1: TENANT ENTITY & OWNER */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {tenant.name}
                            </strong>
                          </div>
                          <div>
                            <code
                              onClick={() => copyToClipboard(tenant.slug || tenant.id, 'Slug')}
                              className="font-mono text-xs bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 text-slate-300 hover:text-white cursor-pointer inline-block"
                              title="Click to copy slug"
                            >
                              {tenant.slug || tenant.id}
                            </code>
                          </div>
                          <div className="text-[11px] text-slate-400 pt-0.5">
                            Owner: <strong className="text-slate-200">{tenant.owner?.full_name || 'Unassigned'}</strong>
                            {tenant.owner?.phone && <span className="ml-1 text-slate-400">({tenant.owner.phone})</span>}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: VERTICAL & PLAN TIER */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${verticalStyle}`}>
                            {tenant.vertical || 'Restaurant'}
                          </span>
                          <p className="text-xs text-slate-200 font-bold">
                            {tenant.saas_plans?.name || tenant.subscription_plan || 'Enterprise Tier'}
                          </p>
                          <span className="inline-block rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/20">
                            {inr(tenant.saas_plans?.price_monthly || 4999)} / mo
                          </span>
                        </div>
                      </td>

                      {/* Column 3: OPERATIONAL METRICS */}
                      <td className="p-4 align-top">
                        {(tenant.vertical || '').toLowerCase().includes('restaurant') ? (
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
                            <p>Created: {new Date(tenant.created_at || Date.now()).toLocaleDateString('en-IN')}</p>
                            <p className="text-slate-300">Operational: Active</p>
                          </div>
                        )}
                      </td>

                      {/* Column 4: SUBSCRIPTION EXPIRY */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          {/* Glowing Status Pill */}
                          <div>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-mono capitalize ${statusStyle}`}>
                              <span className={`size-1.5 rounded-full ${curStatus === 'frozen' ? 'bg-rose-400 animate-pulse' : curStatus === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                              {curStatus}
                            </span>
                          </div>

                          {/* Countdown Tag */}
                          <div>
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-mono ${
                                expiryDanger
                                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                                  : expiryWarning
                                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                                  : 'bg-slate-950 text-slate-400 border border-slate-800'
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

                      {/* Column 5: DIRECT ACTION TOOLBAR */}
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* ⚡ Impersonate */}
                          <button
                            onClick={() => handleImpersonate(tenant)}
                            title="Impersonate tenant session as owner"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all shadow-sm"
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
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
                              tenant.is_frozen
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                            }`}
                          >
                            {tenant.is_frozen ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                            {tenant.is_frozen ? 'Unfreeze' : 'Freeze'}
                          </button>

                          {/* 📅 +30d Extension */}
                          <button
                            onClick={() => void handleAdd30Days(tenant)}
                            title="Instant +30 days subscription extension"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-all"
                          >
                            <CalendarPlus className="size-3 text-emerald-400" />
                            +30d
                          </button>

                          {/* ⚙️ Settings */}
                          <button
                            onClick={() => setSettingsDrawerTenant(tenant)}
                            title="Open tenant settings drawer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
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

      {/* 1. "ONBOARD NEW TENANT WORKSPACE" MODAL OVERHAUL */}
      <AnimatePresence>
        {onboardModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl space-y-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <span className="text-indigo-400 text-lg">✨</span>
                  Onboard New Tenant Workspace
                </h3>
                <button onClick={() => setOnboardModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X className="size-5" />
                </button>
              </div>

              {/* 2-Column Form Layout */}
              <form onSubmit={(e) => void handleOnboardTenant(e)} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Input 1: Business Name * */}
                  <label className="block space-y-1">
                    <span className="text-slate-300 font-semibold">Business Name *</span>
                    <input
                      type="text"
                      required
                      value={onboardForm.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Spice Route Bistro"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
                    />
                  </label>

                  {/* Input 2: Slug Tag */}
                  <label className="block space-y-1">
                    <span className="text-slate-300 font-semibold">Slug Tag</span>
                    <input
                      type="text"
                      value={onboardForm.slug}
                      onChange={(e) => {
                        setAutoSlugEdited(true)
                        setOnboardForm({ ...onboardForm, slug: e.target.value })
                      }}
                      placeholder="ten_spiceroute"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-indigo-300 focus:border-indigo-500 focus:outline-none transition-all font-mono"
                    />
                  </label>

                  {/* Input 3: Platform Vertical * */}
                  <label className="block space-y-1">
                    <span className="text-slate-300 font-semibold">Platform Vertical *</span>
                    <select
                      value={onboardForm.vertical}
                      onChange={(e) => setOnboardForm({ ...onboardForm, vertical: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="restaurant">Restaurant</option>
                      <option value="gym">Gym & Fitness</option>
                      <option value="hospital">Hospital / Clinic</option>
                      <option value="school">School / College</option>
                      <option value="crm">Other / CRM</option>
                    </select>
                  </label>

                  {/* Input 4: Initial SaaS Plan */}
                  <label className="block space-y-1">
                    <span className="text-slate-300 font-semibold">Initial SaaS Plan</span>
                    <select
                      value={onboardForm.plan_id}
                      onChange={(e) => setOnboardForm({ ...onboardForm, plan_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({inr(p.price_monthly)}/mo)
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Input 5: Owner Full Name */}
                  <label className="block space-y-1">
                    <span className="text-slate-300 font-semibold">Owner Full Name</span>
                    <input
                      type="text"
                      value={onboardForm.owner_name}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
                    />
                  </label>

                  {/* Input 6: Owner Phone Number */}
                  <label className="block space-y-1">
                    <span className="text-slate-300 font-semibold">Owner Phone Number</span>
                    <input
                      type="text"
                      value={onboardForm.owner_phone}
                      onChange={(e) => setOnboardForm({ ...onboardForm, owner_phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-500"
                    />
                  </label>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOnboardModalOpen(false)}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboarding}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all"
                  >
                    {onboarding ? 'Onboarding Workspace...' : '✨ Confirm Onboard Workspace'}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                  <ShieldAlert className="size-5 text-rose-400" />
                  {freezeModalTenant.is_frozen ? 'Lift Freeze Access' : 'Freeze Tenant Workspace'}
                </h3>
                <button onClick={() => setFreezeModalTenant(null)} className="text-slate-400 hover:text-white transition-colors">
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-mono">
                Modifying access state for <strong className="text-white">{freezeModalTenant.name}</strong> ({freezeModalTenant.slug}).
              </p>

              <label className="block text-xs font-mono">
                <span className="text-slate-300 font-semibold">Reason for Action (Required for Audit Logs):</span>
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
                  className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
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
