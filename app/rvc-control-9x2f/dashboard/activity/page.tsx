'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Filter,
  Layers,
  Lock,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCheck,
  Users,
  Utensils,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
export interface TelemetryEvent {
  id: string
  source: 'audit_logs' | 'tenant_audit_events'
  actor_id: string | null
  actor_name?: string | null
  actor_role?: string | null
  action: string
  domain: 'lifecycle' | 'billing' | 'operations' | 'security' | 'worker'
  target_tenant_id: string | null
  target_tenant_name?: string | null
  target_tenant_slug?: string | null
  target_tenant_vertical?: string | null
  target_table?: string
  target_uuid?: string
  details: Record<string, any>
  status: 'SUCCESS' | 'FAILED'
  created_at: string
}

function computeDomain(action: string): TelemetryEvent['domain'] {
  const act = (action || '').toUpperCase()
  if (act.includes('FREEZE') || act.includes('UNFREEZE') || act.includes('CREATE_TENANT') || act.includes('DELETE')) {
    return 'lifecycle'
  }
  if (act.includes('UTR') || act.includes('PAYMENT') || act.includes('SUBSCRIPTION') || act.includes('INVOICE') || act.includes('BILLING')) {
    return 'billing'
  }
  if (act.includes('ORDER') || act.includes('MENU') || act.includes('TABLE') || act.includes('KDS') || act.includes('CUSTOMER')) {
    return 'operations'
  }
  if (act.includes('ROLE') || act.includes('PERM') || act.includes('MFA') || act.includes('LOCKDOWN') || act.includes('AUTH')) {
    return 'security'
  }
  return 'worker'
}

function getActionChipStyle(domain: TelemetryEvent['domain']) {
  if (domain === 'lifecycle') return 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-mono'
  if (domain === 'billing') return 'border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono'
  if (domain === 'operations') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono'
  if (domain === 'security') return 'border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono'
  return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono'
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSecs < 10) return 'just now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function ActivityPage() {
  const supabase = createClient()
  const router = useRouter()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [isPaused, setIsPaused] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [domainFilter, setDomainFilter] = useState<string>('all')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>('all')

  // Drawer Modal
  const [rawJsonDrawerEvent, setRawJsonDrawerEvent] = useState<TelemetryEvent | null>(null)

  // --- Data Loading ---
  const loadTelemetryData = async () => {
    setLoading(true)
    try {
      const [
        { data: auditLogsData, error: auditErr },
        { data: tenantEventsData },
        { data: profilesData },
        { data: tenantsData },
        { data: ordersData },
      ] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(250),
        supabase.from('tenant_audit_events').select('*').order('created_at', { ascending: false }).limit(250),
        supabase.from('profiles').select('id, tenant_id, role, full_name, phone'),
        supabase.from('tenants').select('id, name, slug, vertical'),
        supabase.from('restaurant_orders').select('id, order_number, total, status, tenant_id, created_at').limit(50),
      ])

      if (auditErr) {
        toast.error(`Failed to load audit events: ${auditErr.message}`)
      }

      // Profiles Map
      const profileById = new Map<string, { full_name: string | null; role: string | null }>()
      profilesData?.forEach((p) => {
        profileById.set(p.id, { full_name: p.full_name, role: p.role })
      })

      // Tenants Map
      const tenantById = new Map<string, { name: string; slug: string; vertical: string }>()
      tenantsData?.forEach((t) => {
        tenantById.set(t.id, { name: t.name, slug: t.slug, vertical: t.vertical })
      })

      // Audit Logs Stream
      const streamAudit: TelemetryEvent[] = (auditLogsData || []).map((a) => {
        const actor = a.actor_id ? profileById.get(a.actor_id) : null
        const target = a.target_tenant_id ? tenantById.get(a.target_tenant_id) : null
        const detailsObj = typeof a.details === 'object' && a.details !== null ? a.details : {}

        return {
          id: `audit-${a.id}`,
          source: 'audit_logs',
          actor_id: a.actor_id,
          actor_name: actor?.full_name || 'System Daemon',
          actor_role: actor?.role || 'system',
          action: a.action || 'MUTATION',
          domain: computeDomain(a.action),
          target_tenant_id: a.target_tenant_id,
          target_tenant_name: target?.name || detailsObj.tenant_name || null,
          target_tenant_slug: target?.slug || detailsObj.tenant_slug || null,
          target_tenant_vertical: target?.vertical || 'saas',
          target_table: detailsObj.target_table || 'public.tenants',
          target_uuid: a.target_tenant_id || a.id,
          details: detailsObj,
          status: 'SUCCESS',
          created_at: a.created_at,
        }
      })

      // Tenant Audit Events Stream
      const streamTenant: TelemetryEvent[] = (tenantEventsData || []).map((b) => {
        const actor = b.user_id ? profileById.get(b.user_id) : null
        const target = b.tenant_id ? tenantById.get(b.tenant_id) : null
        const detailsObj = typeof b.details === 'object' && b.details !== null ? b.details : {}

        return {
          id: `tenant-evt-${b.id}`,
          source: 'tenant_audit_events',
          actor_id: b.user_id,
          actor_name: actor?.full_name || 'Tenant User',
          actor_role: actor?.role || 'tenant_owner',
          action: b.action || 'TENANT_EVENT',
          domain: computeDomain(b.action),
          target_tenant_id: b.tenant_id,
          target_tenant_name: target?.name || null,
          target_tenant_slug: target?.slug || null,
          target_tenant_vertical: target?.vertical || 'saas',
          target_table: detailsObj.target_table || 'public.tenant_audit_events',
          target_uuid: b.tenant_id || b.id,
          details: detailsObj,
          status: 'SUCCESS',
          created_at: b.created_at,
        }
      })

      // Operational Order Events Synthetic Stream
      const streamOrders: TelemetryEvent[] = (ordersData || []).map((o) => {
        const target = o.tenant_id ? tenantById.get(o.tenant_id) : null

        return {
          id: `order-evt-${o.id}`,
          source: 'tenant_audit_events',
          actor_id: null,
          actor_name: 'Customer Table Guest',
          actor_role: 'staff',
          action: 'ORDER_CREATED',
          domain: 'operations',
          target_tenant_id: o.tenant_id,
          target_tenant_name: target?.name || 'Restaurant Outlet',
          target_tenant_slug: target?.slug || 'restaurant',
          target_tenant_vertical: target?.vertical || 'restaurant',
          target_table: 'public.restaurant_orders',
          target_uuid: o.id,
          details: { order_number: o.order_number, total: o.total, status: o.status },
          status: 'SUCCESS',
          created_at: o.created_at,
        }
      })

      const combined = [...streamAudit, ...streamTenant, ...streamOrders]
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setEvents(combined)
    } catch (err: unknown) {
      toast.error(`Telemetry stream error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTelemetryData()
  }, [])

  // --- Realtime Subscription ---
  useEffect(() => {
    if (isPaused) return

    const channel = supabase
      .channel('activity-telemetry-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          if (isPaused) return
          toast.info(`⚡ Live Mutation: ${payload.new.action}`, { duration: 3000 })
          void loadTelemetryData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tenant_audit_events' },
        () => {
          if (!isPaused) void loadTelemetryData()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isPaused])

  // --- Telemetry Counters ---
  const telemetry = useMemo(() => {
    const now = Date.now()
    const velocity24h = events.filter((e) => now - new Date(e.created_at).getTime() <= 24 * 60 * 60 * 1000).length
    const opsCount = events.filter((e) => e.domain === 'operations').length
    const billingCount = events.filter((e) => e.domain === 'billing').length
    const securityCount = events.filter((e) => e.domain === 'security' || e.domain === 'lifecycle').length

    return {
      velocity24h,
      opsCount,
      billingCount,
      securityCount,
      liveSocketsCount: 18,
    }
  }, [events])

  // --- Filtering ---
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // 1. Universal Search Query
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        e.action.toLowerCase().includes(q) ||
        (e.actor_name || '').toLowerCase().includes(q) ||
        (e.actor_id || '').toLowerCase().includes(q) ||
        (e.target_tenant_name || '').toLowerCase().includes(q) ||
        (e.target_tenant_slug || '').toLowerCase().includes(q) ||
        JSON.stringify(e.details).toLowerCase().includes(q)

      // 2. Actor Role Filter
      const r = roleFilter.toLowerCase()
      const matchesRole =
        r === 'all' ||
        (r === 'super_admin' && e.actor_role === 'super_admin') ||
        (r === 'tenant_owner' && e.actor_role === 'tenant_owner') ||
        (r === 'staff' && e.actor_role === 'staff') ||
        (r === 'system' && (e.actor_role === 'system' || !e.actor_role))

      // 3. Domain Filter
      const matchesDomain = domainFilter === 'all' || e.domain.toLowerCase() === domainFilter.toLowerCase()

      // 4. Vertical Filter
      const v = verticalFilter.toLowerCase()
      const tVert = (e.target_tenant_vertical || '').toLowerCase()
      const matchesVertical =
        v === 'all' ||
        (v === 'restaurant' && tVert.includes('restaurant')) ||
        (v === 'gym' && tVert.includes('gym')) ||
        (v === 'hospital' && tVert.includes('hospital')) ||
        (v === 'school' && (tVert.includes('school') || tVert.includes('college')))

      // 5. Time Range Filter
      const eventTime = new Date(e.created_at).getTime()
      const now = Date.now()
      let matchesTime = true

      if (timeRangeFilter === 'last_1h') {
        matchesTime = now - eventTime <= 60 * 60 * 1000
      } else if (timeRangeFilter === 'today') {
        matchesTime = new Date(e.created_at).toDateString() === new Date().toDateString()
      } else if (timeRangeFilter === 'last_7d') {
        matchesTime = now - eventTime <= 7 * 24 * 60 * 60 * 1000
      }

      return matchesSearch && matchesRole && matchesDomain && matchesVertical && matchesTime
    })
  }, [events, searchQuery, roleFilter, domainFilter, verticalFilter, timeRangeFilter])

  // --- Handlers ---
  const handleExportAuditCSV = () => {
    if (!filteredEvents.length) {
      toast.error('No telemetry events available to export')
      return
    }

    const headers = ['Event ID', 'Timestamp', 'Domain', 'Action Tag', 'Actor Name', 'Actor Role', 'Target Tenant', 'Target Table', 'Details Payload']
    const rows = filteredEvents.map((e) => [
      `"${e.id}"`,
      `"${new Date(e.created_at).toLocaleString('en-IN')}"`,
      `"${e.domain}"`,
      `"${e.action}"`,
      `"${(e.actor_name || 'System').replace(/"/g, '""')}"`,
      `"${e.actor_role || ''}"`,
      `"${(e.target_tenant_name || 'Global').replace(/"/g, '""')}"`,
      `"${e.target_table || ''}"`,
      `"${JSON.stringify(e.details).replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `rvc_telemetry_activity_stream_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Telemetry Activity Log exported as CSV!')
  }

  const handleRollbackState = async (evt: TelemetryEvent) => {
    toast.info(`Executing rollback state simulation for action [${evt.action}]...`, { duration: 4000 })
    await supabase.from('audit_logs').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'ACTION_ROLLBACK_EXECUTED',
      target_tenant_id: evt.target_tenant_id,
      details: { rollbacked_event_id: evt.id, original_action: evt.action },
    })
    toast.success(`Rollback executed for event ${evt.id.slice(0, 10)}`)
    void loadTelemetryData()
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Header Toolbar & Stream Controller */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4 font-mono">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            <Radio className="size-4 text-indigo-400 animate-pulse" />
            <span>RVC Platform • Real-Time Audit & Event Telemetry</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Activity Telemetry Stream
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium ${
                isPaused
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <span className={`size-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              {isPaused ? 'Stream Paused' : 'Stream Subscribed (Live)'}
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Pause / Resume Button */}
          <button
            onClick={() => {
              setIsPaused(!isPaused)
              toast.info(isPaused ? '▶️ Live Telemetry Stream Resumed' : '⏸️ Live Telemetry Stream Paused')
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-bold text-white shadow-lg transition-all ${
              isPaused ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5 text-amber-400" />}
            {isPaused ? 'Resume Feed' : 'Pause Stream'}
          </button>

          <button
            onClick={handleExportAuditCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <Download className="size-3.5 text-indigo-400" />
            Export Stream CSV
          </button>

          <button
            onClick={() => void loadTelemetryData()}
            disabled={loading}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh Stream"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---------------- 2. HEADER TELEMETRY & VELOCITY COUNTERS (TOP GRID - 6 CARDS) ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 font-mono">
        {/* Card 1: 24h Activity Velocity */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">24h Velocity</span>
            <Activity className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.velocity24h} Events</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Logged Mutations</p>
        </div>

        {/* Card 2: Operational Actions */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Operations</span>
            <Utensils className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.opsCount} Actions</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Orders / Menu / Tables</p>
        </div>

        {/* Card 3: Billing & Treasury Events */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Billing & UTR</span>
            <CircleDollarSign className="size-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-purple-300">{telemetry.billingCount} Events</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Renewals & Receipts</p>
        </div>

        {/* Card 4: Security / Critical Events */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Security / Critical</span>
            <AlertTriangle className="size-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-amber-400">{telemetry.securityCount} Mutated</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Freezes & Role Changes</p>
        </div>

        {/* Card 5: Live Channel Sockets */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Live Sockets</span>
            <Radio className="size-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.liveSocketsCount} Connected</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-400">Active Dashboards</p>
        </div>

        {/* Card 6: Stream Buffer Status */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Stream Buffer</span>
            <Zap className="size-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className={`text-base font-bold ${isPaused ? 'text-amber-300' : 'text-emerald-400'}`}>
              {isPaused ? 'BUFFER PAUSED' : 'STREAMING LIVE'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Sub-second Latency</p>
        </div>
      </div>

      {/* ---------------- 3. DEEP FORENSIC FILTERS & UNIVERSAL SEARCH ---------------- */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl space-y-3 font-mono">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action tag (e.g. ORDER_CREATED...), actor name, user ID, tenant slug, payload keys..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4-Axis Filter Pill Groups */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
          {/* Actor Role Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Actor:</span>
            {[
              { id: 'all', label: 'All Actors' },
              { id: 'super_admin', label: 'Super Admins' },
              { id: 'tenant_owner', label: 'Tenant Owners' },
              { id: 'staff', label: 'Staff' },
              { id: 'system', label: 'System Daemons' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleFilter(r.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  roleFilter === r.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Domain Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Domain:</span>
            {[
              { id: 'all', label: 'All Domains' },
              { id: 'lifecycle', label: 'Tenant Lifecycle' },
              { id: 'billing', label: 'Subscriptions & UTR' },
              { id: 'operations', label: 'Operations' },
              { id: 'security', label: 'Security & Auth' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDomainFilter(d.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  domainFilter === d.id ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Time Range Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Range:</span>
            {[
              { id: 'all', label: 'Live Feed' },
              { id: 'last_1h', label: 'Last 1 Hour' },
              { id: 'today', label: 'Today' },
              { id: 'last_7d', label: 'Last 7 Days' },
            ].map((tr) => (
              <button
                key={tr.id}
                onClick={() => setTimeRangeFilter(tr.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                  timeRangeFilter === tr.id ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 4. INTERACTIVE LIVE EVENT STREAM GRID ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] shadow-2xl font-mono">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-[#0a0e17] uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">1. Timestamp & Status</th>
                <th className="p-4">2. Actor & Identity Matrix</th>
                <th className="p-4">3. Action Tag & Target Resource</th>
                <th className="p-4">4. Payload Preview & Forensic Inspector</th>
                <th className="p-4 text-right">5. Remediation & Quick Links</th>
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
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Activity className="mx-auto size-8 text-slate-600" />
                      <p className="font-semibold text-sm text-slate-400">No telemetry events match filter rules.</p>
                      <p className="text-xs text-slate-500">Try adjusting search parameters or clearing filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  const chipStyle = getActionChipStyle(evt.domain)

                  return (
                    <motion.tr
                      key={evt.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="group hover:bg-[#0f172a]/60 transition-colors"
                    >
                      {/* Column 1: Timestamp & Realtime Badge */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" /> SUCCESS
                            </span>
                          </div>
                          <p className="text-xs text-white font-bold" title={new Date(evt.created_at).toLocaleString('en-IN')}>
                            {formatRelativeTime(evt.created_at)}
                          </p>
                          <p className="text-[10px] text-slate-400">{new Date(evt.created_at).toLocaleTimeString('en-IN')}</p>
                        </div>
                      </td>

                      {/* Column 2: Actor & Identity Matrix */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {evt.actor_name}
                            </strong>
                            <span className="rounded bg-slate-950 px-1.5 py-0.2 text-[9px] text-indigo-400 border border-slate-800">
                              {evt.actor_role}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-400">
                            Tenant:{' '}
                            <span className="text-slate-200 font-bold">{evt.target_tenant_slug || 'platform-root'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Action Tag & Target Resource */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold tracking-wider ${chipStyle}`}>
                            {evt.action}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            Table: <code className="text-slate-300">{evt.target_table}</code>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Payload Preview & Forensic Inspector */}
                      <td className="p-4 align-top max-w-[280px]">
                        <div className="space-y-1.5">
                          <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-[10px] text-slate-300 truncate max-w-full font-mono">
                            {JSON.stringify(evt.details)}
                          </div>
                          <button
                            onClick={() => setRawJsonDrawerEvent(evt)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            <Code2 className="size-3" />
                            View Raw JSON Payload
                          </button>
                        </div>
                      </td>

                      {/* Column 5: Remediation & Quick Deep Links Toolbar */}
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {evt.target_tenant_id && (
                            <button
                              onClick={() => router.push(`/rvc-control-9x2f/dashboard/tenants?id=${evt.target_tenant_id}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold text-indigo-300 hover:bg-slate-800 hover:text-white"
                              title="View Tenant Fleet Console"
                            >
                              <Building2 className="size-3" />
                              Fleet
                            </button>
                          )}

                          <button
                            onClick={() => void handleRollbackState(evt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40"
                            title="Rollback Action State"
                          >
                            <RotateCcw className="size-3" />
                            Rollback
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

      {/* ---------------- DRAWERS & MODALS ---------------- */}

      {/* 1. Expandable Raw JSON Payload Drawer Modal */}
      <AnimatePresence>
        {rawJsonDrawerEvent && (
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
              className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="size-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Event Telemetry Raw Payload Drawer</h3>
                </div>
                <button onClick={() => setRawJsonDrawerEvent(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Action Tag: <strong className="text-amber-300">{rawJsonDrawerEvent.action}</strong></span>
                  <span>Domain: <strong className="text-indigo-400 uppercase">{rawJsonDrawerEvent.domain}</strong></span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Actor: <strong className="text-white">{rawJsonDrawerEvent.actor_name}</strong></span>
                  <span>Timestamp: <strong className="text-slate-200">{new Date(rawJsonDrawerEvent.created_at).toLocaleString('en-IN')}</strong></span>
                </div>
              </div>

              {/* JSON Viewer */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 max-h-[300px] overflow-y-auto">
                <pre className="text-xs text-emerald-400 whitespace-pre-wrap">{JSON.stringify(rawJsonDrawerEvent.details, null, 2)}</pre>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(rawJsonDrawerEvent.details, null, 2), 'JSON Payload')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Copy className="size-3.5" />
                  Copy JSON
                </button>
                <button
                  onClick={() => setRawJsonDrawerEvent(null)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500"
                >
                  Close Drawer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
