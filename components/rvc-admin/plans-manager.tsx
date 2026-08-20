'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
export interface SaaSPlan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
  features: string[] | Record<string, unknown>
  is_popular: boolean
  is_active: boolean
  created_at?: string
}

interface Tenant {
  id: string
  name: string
  plan_id: string | null
  subscription_status: string | null
  status: string
  is_frozen: boolean
}

// Helpers
const inr = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

function calculateAnnualSavings(monthly: number, yearly: number): number {
  if (!monthly || monthly <= 0 || !yearly) return 0
  const fullYearlyFromMonthly = monthly * 12
  if (fullYearlyFromMonthly <= yearly) return 0
  const savingsPercent = Math.round(((fullYearlyFromMonthly - yearly) / fullYearlyFromMonthly) * 100)
  return Math.max(0, Math.min(99, savingsPercent))
}

function parseFeaturesList(rawFeatures: string[] | Record<string, unknown> | null): string[] {
  if (!rawFeatures) return []
  if (Array.isArray(rawFeatures)) return rawFeatures.map(String)
  if (typeof rawFeatures === 'object') {
    return Object.entries(rawFeatures).map(([k, v]) => `${k}: ${v}`)
  }
  return []
}

export function PlansManager() {
  const supabase = createClient()
  const router = useRouter()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])

  // Controls
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Plan Form State
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    price_monthly: '',
    price_yearly: '',
    features_text: '',
    is_popular: false,
    is_active: true,
  })

  // Data Loading
  const loadPlansData = async () => {
    setLoading(true)
    try {
      const [{ data: plansData, error: plansErr }, { data: tenantsData }] = await Promise.all([
        supabase.from('saas_plans').select('*').order('price_monthly'),
        supabase.from('tenants').select('id, name, plan_id, subscription_status, status, is_frozen'),
      ])

      if (plansErr) {
        toast.error(`Failed to load SaaS plans: ${plansErr.message}`)
      }

      setPlans((plansData as SaaSPlan[]) || [])
      setTenants((tenantsData as Tenant[]) || [])
    } catch (err: unknown) {
      toast.error(`Error loading pricing matrix: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlansData()
  }, [])

  // Fleet Attribution Metrics
  const fleetAttribution = useMemo(() => {
    const map = new Map<string, { subscriberCount: number; generatedMrr: number }>()

    plans.forEach((plan) => {
      const activeSubscribers = tenants.filter(
        (t) => t.plan_id === plan.id && (t.subscription_status || t.status) === 'active' && !t.is_frozen
      )
      const subscriberCount = activeSubscribers.length
      const generatedMrr = subscriberCount * Number(plan.price_monthly || 0)

      map.set(plan.id, { subscriberCount, generatedMrr })
    })

    const totalMonetizedFleet = Array.from(map.values()).reduce((sum, item) => sum + item.subscriberCount, 0)
    const totalFleetMrr = Array.from(map.values()).reduce((sum, item) => sum + item.generatedMrr, 0)

    return { map, totalMonetizedFleet, totalFleetMrr }
  }, [plans, tenants])

  // --- Handlers ---

  // 1. Create New Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planForm.name.trim() || !planForm.price_monthly) {
      toast.error('Plan Name and Monthly Price are required')
      return
    }

    setSubmitting(true)
    try {
      const generatedSlug =
        planForm.slug.trim().toLowerCase() ||
        planForm.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')

      const featuresArr = planForm.features_text
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)

      // If set as popular, unset other plans as popular
      if (planForm.is_popular) {
        await supabase.from('saas_plans').update({ is_popular: false }).neq('id', '00000000-0000-0000-0000-000000000000')
      }

      const { data: newPlan, error } = await supabase
        .from('saas_plans')
        .insert({
          name: planForm.name.trim(),
          slug: generatedSlug,
          price_monthly: Number(planForm.price_monthly),
          price_yearly: Number(planForm.price_yearly || Number(planForm.price_monthly) * 10),
          features: featuresArr,
          is_popular: planForm.is_popular,
          is_active: planForm.is_active,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'PLAN_CREATED',
        details: { name: newPlan.name, slug: newPlan.slug, price_monthly: newPlan.price_monthly },
      })

      toast.success(`SaaS Plan "${newPlan.name}" created successfully!`)
      setCreateModalOpen(false)
      resetForm()
      void loadPlansData()
    } catch (err: unknown) {
      toast.error(`Plan creation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 2. Update Plan
  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan || !planForm.name.trim()) return

    setSubmitting(true)
    try {
      const featuresArr = planForm.features_text
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)

      // If set as popular, unset other plans
      if (planForm.is_popular) {
        await supabase.from('saas_plans').update({ is_popular: false }).neq('id', editingPlan.id)
      }

      const { error } = await supabase
        .from('saas_plans')
        .update({
          name: planForm.name.trim(),
          slug: planForm.slug.trim().toLowerCase(),
          price_monthly: Number(planForm.price_monthly),
          price_yearly: Number(planForm.price_yearly),
          features: featuresArr,
          is_popular: planForm.is_popular,
          is_active: planForm.is_active,
        })
        .eq('id', editingPlan.id)

      if (error) throw new Error(error.message)

      // Audit Log
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'PLAN_UPDATED',
        details: { plan_id: editingPlan.id, name: planForm.name, price_monthly: planForm.price_monthly },
      })

      toast.success(`Plan "${planForm.name}" updated successfully!`)
      setEditingPlan(null)
      resetForm()
      void loadPlansData()
    } catch (err: unknown) {
      toast.error(`Plan update failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 3. Set Popular Tier (1-click)
  const handleTogglePopular = async (plan: SaaSPlan) => {
    const nextPopular = !plan.is_popular

    // Unset others if setting true
    if (nextPopular) {
      await supabase.from('saas_plans').update({ is_popular: false }).neq('id', plan.id)
    }

    const { error } = await supabase.from('saas_plans').update({ is_popular: nextPopular }).eq('id', plan.id)

    if (error) {
      toast.error(`Failed to update popular tier: ${error.message}`)
    } else {
      toast.success(nextPopular ? `"${plan.name}" marked as MOST POPULAR tier!` : `Popular flag removed from "${plan.name}"`)

      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'POPULAR_TIER_CHANGED',
        details: { plan_id: plan.id, name: plan.name, is_popular: nextPopular },
      })

      void loadPlansData()
    }
  }

  // 4. Archive / Deactivate Plan
  const handleToggleArchive = async (plan: SaaSPlan) => {
    const nextActive = !plan.is_active

    const { error } = await supabase.from('saas_plans').update({ is_active: nextActive }).eq('id', plan.id)

    if (error) {
      toast.error(`Failed to toggle active status: ${error.message}`)
    } else {
      toast.success(nextActive ? `Plan "${plan.name}" Activated!` : `Plan "${plan.name}" Archived / Deactivated.`)

      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: nextActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
        details: { plan_id: plan.id, name: plan.name },
      })

      void loadPlansData()
    }
  }

  const openEditModal = (plan: SaaSPlan) => {
    setEditingPlan(plan)
    const feat = parseFeaturesList(plan.features)
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      price_monthly: String(plan.price_monthly),
      price_yearly: String(plan.price_yearly),
      features_text: feat.join('\n'),
      is_popular: plan.is_popular,
      is_active: plan.is_active,
    })
  }

  const resetForm = () => {
    setPlanForm({
      name: '',
      slug: '',
      price_monthly: '',
      price_yearly: '',
      features_text: '',
      is_popular: false,
      is_active: true,
    })
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">
            <CreditCard className="size-4" />
            <span>RVC Control • SaaS Monetization & Pricing Console</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Subscription Pricing Tiers
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              {plans.length} Pricing Plans Configured
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              resetForm()
              setCreateModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-mono font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <Plus className="size-4" />
            + Create New Plan
          </button>

          <button
            onClick={() => void loadPlansData()}
            disabled={loading}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh Pricing Matrix"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---------------- 2. HEADER TELEMETRY & CONTROLS ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {/* Metric Badge 1: Total Monetized Fleet */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Monetized Fleet</span>
            <p className="mt-1 text-2xl font-black text-white">{fleetAttribution.totalMonetizedFleet} Active Subscribers</p>
            <p className="mt-0.5 text-[11px] font-mono text-indigo-400">Across All Active Pricing Tiers</p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users className="size-6" />
          </div>
        </div>

        {/* Metric Badge 2: Revenue Attribution */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Monthly Fleet MRR</span>
            <p className="mt-1 text-2xl font-black text-emerald-400">{inr(fleetAttribution.totalFleetMrr)}</p>
            <p className="mt-0.5 text-[11px] font-mono text-slate-400">Annual Run-rate: {inr(fleetAttribution.totalFleetMrr * 12)}</p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="size-6" />
          </div>
        </div>

        {/* Metric Badge 3: Popular Tier Footprint */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Featured Popular Tier</span>
            <p className="mt-1 text-xl font-bold text-amber-400">
              {plans.find((p) => p.is_popular)?.name || 'No Popular Tier Set'}
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-amber-300/80">High-Conversion Anchor</p>
          </div>
          <div className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Star className="size-6" />
          </div>
        </div>
      </div>

      {/* Interactive Toolbar: Billing Cycle Toggle & Vertical Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-[#0d1322] p-3.5 shadow-xl text-xs font-mono">
        {/* Billing Cycle Switch */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
              billingCycle === 'monthly' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Pricing
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
              billingCycle === 'yearly' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Yearly Pricing
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
              Save up to 20%
            </span>
          </button>
        </div>

        {/* Vertical Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Target Vertical:</span>
          {['all', 'restaurant', 'gym', 'hospital', 'school'].map((vert) => (
            <button
              key={vert}
              onClick={() => setVerticalFilter(vert)}
              className={`rounded-lg px-2.5 py-1 uppercase font-semibold transition-all ${
                verticalFilter === vert
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              [{vert}]
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- 3. PLAN CARD SPECIFICATIONS (GRID) ---------------- */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          [1, 2, 3].map((n) => (
            <div key={n} className="h-96 animate-pulse rounded-2xl bg-slate-900/60 border border-slate-800" />
          ))
        ) : plans.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-12 text-center text-xs font-mono text-slate-500">
            No SaaS pricing plans configured yet. Click "+ Create New Plan" to add your first monetization tier.
          </div>
        ) : (
          plans.map((plan) => {
            const attribution = fleetAttribution.map.get(plan.id) || { subscriberCount: 0, generatedMrr: 0 }
            const annualSavings = calculateAnnualSavings(plan.price_monthly, plan.price_yearly)
            const parsedFeatures = parseFeaturesList(plan.features)

            return (
              <motion.div
                layout
                key={plan.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-xl transition-all duration-300 ${
                  plan.is_popular
                    ? 'border-amber-500/50 bg-[#0d1322] shadow-[0_0_30px_rgba(245,158,11,0.12)] hover:border-amber-500'
                    : 'border-slate-800/90 bg-[#0a0e17] hover:border-slate-700'
                } ${!plan.is_active ? 'opacity-60 grayscale-[40%]' : ''}`}
              >
                {/* Amber Top Ribbon for Popular Tier */}
                {plan.is_popular && (
                  <div className="absolute top-0 right-0 rounded-bl-xl bg-amber-500 px-3 py-1 text-[10px] font-mono font-black uppercase text-slate-950 shadow-md flex items-center gap-1">
                    <Star className="size-3 fill-slate-950" />
                    MOST POPULAR TIER
                  </div>
                )}

                <div>
                  {/* Tier Identification */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        {plan.name}
                        {!plan.is_active && (
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono text-rose-400 border border-rose-500/20">
                            Archived
                          </span>
                        )}
                      </h3>
                      <code className="text-[10px] font-mono text-indigo-400">slug: {plan.slug}</code>
                    </div>
                  </div>

                  {/* Pricing Engine */}
                  <div className="mt-4 border-y border-slate-800/80 py-3">
                    <div className="flex items-baseline gap-1 font-mono">
                      <span className="text-3xl font-black text-white">
                        {billingCycle === 'monthly' ? inr(plan.price_monthly) : inr(plan.price_yearly)}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {billingCycle === 'monthly' ? '/ month' : '/ year'}
                      </span>
                    </div>

                    {billingCycle === 'yearly' && annualSavings > 0 && (
                      <p className="mt-1 text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                        <Sparkles className="size-3 text-emerald-400" />
                        Save {annualSavings}% on Yearly Subscription
                      </p>
                    )}

                    <p className="mt-1 text-[11px] font-mono text-slate-400">
                      Standard Monthly: {inr(plan.price_monthly)} • Yearly: {inr(plan.price_yearly)}
                    </p>
                  </div>

                  {/* Fleet Footprint Schema Aggregation */}
                  <div className="mt-3 rounded-xl bg-slate-950/80 p-3 border border-slate-800/80 font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[11px] text-slate-400">Active Subscribers:</span>
                      <strong className="text-white font-bold">{attribution.subscriberCount} Tenants</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[11px] text-slate-400">Generated MRR:</span>
                      <strong className="text-emerald-400 font-bold">{inr(attribution.generatedMrr)} / mo</strong>
                    </div>
                  </div>

                  {/* Features & Entitlements Matrix */}
                  <div className="mt-4 space-y-2">
                    <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Included Entitlements Matrix:
                    </p>
                    <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                      {parsedFeatures.length === 0 ? (
                        <li className="text-slate-500 italic text-[11px]">No feature entitlements listed.</li>
                      ) : (
                        parsedFeatures.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-200">
                            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                {/* Card Footer Action Controls */}
                <div className="mt-6 border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* ✏️ Edit Plan */}
                    <button
                      onClick={() => openEditModal(plan)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
                      title="Edit Plan Prices & Features"
                    >
                      <Edit3 className="size-3 text-indigo-400" />
                      Edit
                    </button>

                    {/* ⭐ Toggle Popular */}
                    <button
                      onClick={() => void handleTogglePopular(plan)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        plan.is_popular
                          ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                      title={plan.is_popular ? 'Unset Popular Tier' : 'Set as Popular Tier'}
                    >
                      <Star className={`size-3 ${plan.is_popular ? 'fill-amber-400 text-amber-400' : ''}`} />
                      {plan.is_popular ? 'Popular' : 'Set Popular'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 👥 View Subscribers */}
                    <button
                      onClick={() => router.push('/rvc-control-9x2f/dashboard/tenants')}
                      className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                      title="View Subscribers in Tenants Console"
                    >
                      <Users className="size-3.5 text-indigo-400" />
                    </button>

                    {/* 🗑️ Archive / Deactivate */}
                    <button
                      onClick={() => void handleToggleArchive(plan)}
                      className={`p-1.5 rounded-lg border text-xs transition-all ${
                        plan.is_active
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                      title={plan.is_active ? 'Archive / Deactivate Plan' : 'Activate Plan'}
                    >
                      <Archive className="size-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* ---------------- MODALS FOR CREATE & EDIT PLAN ---------------- */}

      {/* 1. Create New Plan Modal */}
      <AnimatePresence>
        {createModalOpen && (
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
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="size-5 text-indigo-400" />
                  Create New SaaS Monetization Tier
                </h3>
                <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={(e) => void handleCreatePlan(e)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Plan Name *</span>
                    <input
                      type="text"
                      required
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      placeholder="e.g. Enterprise Tier"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Slug Tag</span>
                    <input
                      type="text"
                      value={planForm.slug}
                      onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                      placeholder="enterprise-tier"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Price Monthly (INR ₹) *</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={planForm.price_monthly}
                      onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })}
                      placeholder="1999"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Price Yearly (INR ₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={planForm.price_yearly}
                      onChange={(e) => setPlanForm({ ...planForm, price_yearly: e.target.value })}
                      placeholder="19990"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-slate-300 font-semibold">Entitlements List (One Feature Per Line)</span>
                  <textarea
                    value={planForm.features_text}
                    onChange={(e) => setPlanForm({ ...planForm, features_text: e.target.value })}
                    placeholder="QR Ordering System&#10;Unlimited Menu Items&#10;Real-Time KDS Matrix&#10;Inventory & GST Invoice Module"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none min-h-[100px]"
                  />
                </label>

                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.is_popular}
                      onChange={(e) => setPlanForm({ ...planForm, is_popular: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950"
                    />
                    <span className="text-slate-200">Set as MOST POPULAR Tier</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.is_active}
                      onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950"
                    />
                    <span className="text-slate-200">Active Tier Status</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create SaaS Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Edit Plan Modal */}
      <AnimatePresence>
        {editingPlan && (
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
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="size-5 text-indigo-400" />
                  Edit Plan Settings: {editingPlan.name}
                </h3>
                <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={(e) => void handleUpdatePlan(e)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Plan Name *</span>
                    <input
                      type="text"
                      required
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Slug Tag</span>
                    <input
                      type="text"
                      value={planForm.slug}
                      onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Price Monthly (INR ₹)</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={planForm.price_monthly}
                      onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Price Yearly (INR ₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={planForm.price_yearly}
                      onChange={(e) => setPlanForm({ ...planForm, price_yearly: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-slate-300 font-semibold">Entitlements List (One Feature Per Line)</span>
                  <textarea
                    value={planForm.features_text}
                    onChange={(e) => setPlanForm({ ...planForm, features_text: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-indigo-500 focus:outline-none min-h-[100px]"
                  />
                </label>

                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.is_popular}
                      onChange={(e) => setPlanForm({ ...planForm, is_popular: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950"
                    />
                    <span className="text-slate-200">Set as MOST POPULAR Tier</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.is_active}
                      onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950"
                    />
                    <span className="text-slate-200">Active Tier Status</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Plan Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
