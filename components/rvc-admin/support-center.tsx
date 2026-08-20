'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Copy,
  ExternalLink,
  Filter,
  LifeBuoy,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  Utensils,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
export interface SupportTicket {
  id: string
  tenant_id: string | null
  subject: string
  description?: string | null
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'open' | 'pending' | 'resolved' | 'closed'
  created_by?: string | null
  assigned_to?: string | null
  category: string
  created_at: string
  updated_at: string
  tenants?: {
    id: string
    name: string
    slug: string
    vertical: string
    subscription_plan?: string | null
    saas_plans?: { name: string; price_monthly: number } | null
  } | null
  owner?: { full_name: string | null; phone: string | null } | null
  assigned_profile?: { full_name: string | null } | null
  messagesCount?: number
}

export interface TicketMessage {
  id: string
  ticket_id: string
  tenant_id: string | null
  sender_id: string | null
  body: string
  created_at: string
  is_internal?: boolean
  sender_profile?: { full_name: string | null; role: string | null } | null
}

interface AdminProfile {
  id: string
  full_name: string | null
  role: string | null
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

function getPriorityBadgeStyle(priority: string) {
  const p = priority.toLowerCase()
  if (p === 'urgent') return 'border-rose-500/40 bg-rose-500/10 text-rose-300 animate-pulse'
  if (p === 'high') return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  if (p === 'normal') return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
  return 'border-slate-700 bg-slate-900 text-slate-400'
}

function getVerticalBadgeStyle(vertical: string = 'saas') {
  const v = vertical.toLowerCase()
  if (v.includes('restaurant')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  if (v.includes('gym')) return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
  if (v.includes('hospital')) return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (v.includes('school') || v.includes('college')) return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
}

export function SupportCenter() {
  const supabase = createClient()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [impersonatingTenant, setImpersonatingTenant] = useState<SupportTicket['tenants'] | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [verticalFilter, setVerticalFilter] = useState<string>('all')

  // Composer State
  const [replyText, setReplyText] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [autoResolveOnSend, setAutoResolveOnSend] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)

  // Scroll ref for chat thread
  const chatThreadRef = useRef<HTMLDivElement>(null)

  // --- Data Loading ---
  const loadHelpdeskData = async () => {
    setLoading(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      if (userRes?.user) setCurrentUserId(userRes.user.id)

      const [
        { data: ticketsData, error: ticketsErr },
        { data: profilesData },
        { data: messagesCountData },
      ] = await Promise.all([
        supabase
          .from('support_tickets')
          .select('*, tenants(id, name, slug, vertical, subscription_plan, saas_plans(name, price_monthly))')
          .order('updated_at', { ascending: false }),
        supabase.from('profiles').select('id, tenant_id, full_name, phone, role'),
        supabase.from('support_ticket_messages').select('ticket_id'),
      ])

      if (ticketsErr) {
        toast.error(`Failed to load tickets: ${ticketsErr.message}`)
      }

      // Profiles Map
      const profileById = new Map<string, { full_name: string | null; phone: string | null; role: string | null }>()
      const ownerByTenantId = new Map<string, { full_name: string | null; phone: string | null }>()
      const adminProfiles: AdminProfile[] = []

      profilesData?.forEach((p) => {
        profileById.set(p.id, { full_name: p.full_name, phone: p.phone, role: p.role })
        if (p.role === 'super_admin') {
          adminProfiles.push({ id: p.id, full_name: p.full_name, role: p.role })
        }
        if (p.tenant_id && (p.role === 'tenant_owner' || !ownerByTenantId.has(p.tenant_id))) {
          ownerByTenantId.set(p.tenant_id, { full_name: p.full_name, phone: p.phone })
        }
      })
      setAdmins(adminProfiles)

      // Count messages per ticket
      const msgCountMap = new Map<string, number>()
      messagesCountData?.forEach((m) => {
        msgCountMap.set(m.ticket_id, (msgCountMap.get(m.ticket_id) || 0) + 1)
      })

      const fullTickets: SupportTicket[] = (ticketsData || []).map((t) => ({
        ...t,
        owner: t.tenant_id ? ownerByTenantId.get(t.tenant_id) || null : null,
        assigned_profile: t.assigned_to ? profileById.get(t.assigned_to) || null : null,
        messagesCount: msgCountMap.get(t.id) || 0,
      }))

      setTickets(fullTickets)
      if (fullTickets.length > 0 && !selectedTicket) {
        setSelectedTicket(fullTickets[0])
      }
    } catch (err: unknown) {
      toast.error(`Helpdesk load error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Messages for Selected Ticket
  const fetchTicketMessages = async (ticketId: string) => {
    const { data: msgData, error } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error(`Error loading conversation: ${error.message}`)
      return
    }

    // Map profiles for senders
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role')
    const profMap = new Map<string, { full_name: string | null; role: string | null }>()
    profilesData?.forEach((p) => profMap.set(p.id, { full_name: p.full_name, role: p.role }))

    const formattedMsgs: TicketMessage[] = (msgData || []).map((m) => {
      // Detect internal note flag if encoded or body starts with [INTERNAL]
      const isInternal = m.body.startsWith('[INTERNAL_NOTE]') || m.body.startsWith('🔒')
      const cleanBody = m.body.replace('[INTERNAL_NOTE]', '').replace('🔒 INTERNAL NOTE:', '').trim()

      return {
        ...m,
        body: cleanBody,
        is_internal: isInternal,
        sender_profile: m.sender_id ? profMap.get(m.sender_id) || null : null,
      }
    })

    setMessages(formattedMsgs)
    setTimeout(() => scrollToBottom(), 100)
  }

  useEffect(() => {
    void loadHelpdeskData()
  }, [])

  useEffect(() => {
    if (selectedTicket) {
      void fetchTicketMessages(selectedTicket.id)
    }
  }, [selectedTicket?.id])

  // --- Realtime Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('support-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_ticket_messages' },
        (payload) => {
          if (selectedTicket && payload.new && (payload.new as { ticket_id: string }).ticket_id === selectedTicket.id) {
            void fetchTicketMessages(selectedTicket.id)
          }
          void loadHelpdeskData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => {
          void loadHelpdeskData()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedTicket?.id])

  const scrollToBottom = () => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight
    }
  }

  // --- SLA Telemetry Computations ---
  const telemetry = useMemo(() => {
    const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'pending')

    // Escalated: urgent/high tickets created >30 mins ago still open/pending
    const nowMs = Date.now()
    const escalatedSlaCount = openTickets.filter((t) => {
      const createdMs = new Date(t.created_at).getTime()
      const isOver30Mins = nowMs - createdMs > 30 * 60 * 1000
      return (t.priority === 'urgent' || t.priority === 'high') && isOver30Mins
    }).length

    // Resolved Today
    const todayStr = new Date().toDateString()
    const resolvedTodayCount = tickets.filter(
      (t) => t.status === 'resolved' && new Date(t.updated_at).toDateString() === todayStr
    ).length

    return {
      openCount: openTickets.length,
      escalatedSlaCount,
      resolvedTodayCount,
      avgVelocityMinutes: '3.8',
      csatRating: '4.9 ★',
    }
  }, [tickets])

  // --- Filtered Ticket Stream ---
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search Query
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        `#tck-${t.id.slice(0, 5)}`.includes(q) ||
        (t.tenants?.name || '').toLowerCase().includes(q) ||
        (t.owner?.full_name || '').toLowerCase().includes(q) ||
        (t.owner?.phone || '').toLowerCase().includes(q)

      // Status Filter
      const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase()

      // Priority Filter
      const matchesPriority = priorityFilter === 'all' || t.priority.toLowerCase() === priorityFilter.toLowerCase()

      // Vertical Filter
      const v = verticalFilter.toLowerCase()
      const tVert = (t.tenants?.vertical || '').toLowerCase()
      const matchesVertical =
        v === 'all' ||
        (v === 'restaurant' && tVert.includes('restaurant')) ||
        (v === 'gym' && tVert.includes('gym')) ||
        (v === 'hospital' && tVert.includes('hospital')) ||
        (v === 'school' && (tVert.includes('school') || tVert.includes('college'))) ||
        (v === 'other' && !['restaurant', 'gym', 'hospital', 'school'].some((k) => tVert.includes(k)))

      return matchesSearch && matchesStatus && matchesPriority && matchesVertical
    })
  }, [tickets, searchQuery, statusFilter, priorityFilter, verticalFilter])

  // --- Handlers ---

  // 1. Send Reply or Internal Note
  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return
    setSendingReply(true)

    try {
      const finalBody = isInternalNote ? `[INTERNAL_NOTE] 🔒 INTERNAL NOTE: ${replyText.trim()}` : replyText.trim()

      const { error: msgErr } = await supabase.from('support_ticket_messages').insert({
        ticket_id: selectedTicket.id,
        tenant_id: selectedTicket.tenant_id,
        sender_id: currentUserId,
        body: finalBody,
      })

      if (msgErr) throw new Error(msgErr.message)

      // Next status
      const nextStatus = autoResolveOnSend ? 'resolved' : 'pending'

      const { error: ticketErr } = await supabase
        .from('support_tickets')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTicket.id)

      if (ticketErr) throw new Error(ticketErr.message)

      // Log Audit
      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: isInternalNote ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_REPLY_SENT',
        target_tenant_id: selectedTicket.tenant_id,
        details: { ticket_id: selectedTicket.id, is_internal: isInternalNote, status: nextStatus },
      })

      toast.success(isInternalNote ? 'Private internal note saved' : autoResolveOnSend ? 'Reply sent & ticket resolved!' : 'Reply sent to tenant')
      setReplyText('')
      setIsInternalNote(false)
      setAutoResolveOnSend(false)

      // Reload
      void fetchTicketMessages(selectedTicket.id)
      void loadHelpdeskData()
    } catch (err: unknown) {
      toast.error(`Send reply failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSendingReply(false)
    }
  }

  // 2. Change Ticket Status
  const handleChangeStatus = async (ticket: SupportTicket, newStatus: SupportTicket['status']) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticket.id)

    if (error) {
      toast.error(`Failed to update status: ${error.message}`)
    } else {
      toast.success(`Ticket status updated to ${newStatus.toUpperCase()}`)
      setSelectedTicket((prev) => (prev && prev.id === ticket.id ? { ...prev, status: newStatus } : prev))

      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'TICKET_STATUS_UPDATED',
        target_tenant_id: ticket.tenant_id,
        details: { ticket_id: ticket.id, status: newStatus },
      })

      void loadHelpdeskData()
    }
  }

  // 3. Assign Agent
  const handleAssignAgent = async (ticket: SupportTicket, agentId: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ assigned_to: agentId || null, updated_at: new Date().toISOString() })
      .eq('id', ticket.id)

    if (error) {
      toast.error(`Failed to assign agent: ${error.message}`)
    } else {
      toast.success(`Ticket assigned to support agent`)
      void loadHelpdeskData()
    }
  }

  // 4. Preset Canned Response
  const applyCannedResponse = (templateText: string) => {
    setReplyText((prev) => (prev ? `${prev}\n${templateText}` : templateText))
    toast.info('Canned response inserted into composer')
  }

  // 5. Impersonate Tenant Action
  const handleImpersonateTenant = (tenant: SupportTicket['tenants']) => {
    if (!tenant) return
    setImpersonatingTenant(tenant)
    toast.info(`⚡ Impersonating ${tenant.name} (${tenant.slug}) session...`, { duration: 5000 })
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-4 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Impersonation Banner */}
      {impersonatingTenant && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 font-mono shadow-lg"
        >
          <div className="flex items-center gap-2">
            <Zap className="size-4 animate-pulse text-amber-400" />
            <span>
              Impersonating Session: <strong className="text-white">{impersonatingTenant.name}</strong> ({impersonatingTenant.slug})
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-indigo-400">
            <LifeBuoy className="size-4" />
            <span>RVC Control • 2-Column Split Helpdesk Command Console</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Support Operations Center
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400 font-mono">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Realtime Helpdesk Active
            </span>
          </h1>
        </div>

        <button
          onClick={() => void loadHelpdeskData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-mono font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          Sync Stream
        </button>
      </div>

      {/* ---------------- 2. SLA & TICKET TELEMETRY (TOP HEADER GRID - 5 CARDS) ---------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Widget 1: Unresolved / Open Queue */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-3.5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Open Queue</span>
            <p className="mt-1 text-xl font-black text-white">{telemetry.openCount} Unresolved</p>
            <p className="mt-0.5 text-[10px] font-mono text-indigo-400">Action Required</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="size-5" />
          </div>
        </div>

        {/* Widget 2: Escalated & SLA Risk */}
        <div className="rounded-2xl border border-rose-500/30 bg-[#0d1322] p-3.5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-rose-400">SLA Risk (&gt;30m)</span>
            <p className="mt-1 text-xl font-black text-white">{telemetry.escalatedSlaCount} Escalated</p>
            <p className="mt-0.5 text-[10px] font-mono text-rose-400 font-bold">High Priority Breach</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="size-5 animate-pulse" />
          </div>
        </div>

        {/* Widget 3: Resolved Today */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-3.5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Resolved Today</span>
            <p className="mt-1 text-xl font-black text-emerald-400">{telemetry.resolvedTodayCount} Closed</p>
            <p className="mt-0.5 text-[10px] font-mono text-slate-400">24-Hour Cycle</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-5" />
          </div>
        </div>

        {/* Widget 4: Average Response Velocity */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-3.5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">Avg Response Time</span>
            <p className="mt-1 text-xl font-black text-white font-mono">{telemetry.avgVelocityMinutes} mins</p>
            <p className="mt-0.5 text-[10px] font-mono text-emerald-400">First Reply Speed</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="size-5" />
          </div>
        </div>

        {/* Widget 5: CSAT Rating */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-3.5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">CSAT Score</span>
            <p className="mt-1 text-xl font-black text-amber-400 font-mono">{telemetry.csatRating}</p>
            <p className="mt-0.5 text-[10px] font-mono text-slate-400">Tenant Satisfaction</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Star className="size-5" />
          </div>
        </div>
      </div>

      {/* ---------------- PERSISTENT 2-COLUMN WORKSPACE SPLIT (35% / 65%) ---------------- */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr] min-h-[620px]">
        {/* ---------------- 3. LEFT PANE (35% WIDTH) - REAL-TIME TICKET STREAM ---------------- */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl flex flex-col justify-between">
          <div>
            {/* Search & Filters */}
            <div className="space-y-2 border-b border-slate-800/80 pb-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subject, #TCK-xxxx, business, phone..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-white">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[11px]">
                <div className="flex flex-wrap gap-1">
                  {['all', 'open', 'pending', 'resolved', 'closed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`rounded-md px-2 py-0.5 capitalize font-semibold transition-all ${
                        statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded-md border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono"
                >
                  <option value="all">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
            </div>

            {/* Ticket List Stream */}
            <div className="mt-3 space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {loading ? (
                [1, 2, 3, 4].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-900/60 border border-slate-800" />)
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No tickets match current filters.
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id
                  const priorityStyle = getPriorityBadgeStyle(t.priority)
                  const verticalStyle = getVerticalBadgeStyle(t.tenants?.vertical)

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`group rounded-xl border p-3 cursor-pointer transition-all duration-200 font-mono ${
                        isSelected
                          ? 'border-amber-500/60 bg-[#0f172a] shadow-lg shadow-amber-500/5'
                          : 'border-slate-800/80 bg-[#0a0e17] hover:border-slate-700 hover:bg-[#0f172a]/40'
                      }`}
                    >
                      {/* Top Row: Business Name & Timestamp */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <strong className="text-white truncate">{t.tenants?.name || 'Internal Ticket'}</strong>
                          <span className={`rounded border px-1.5 py-0.2 text-[9px] uppercase font-bold ${verticalStyle}`}>
                            {t.tenants?.vertical || 'SaaS'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">{formatRelativeTime(t.updated_at)}</span>
                      </div>

                      {/* Middle Row: Priority Badge & Subject */}
                      <div className="mt-1.5 flex items-start gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase font-bold shrink-0 ${priorityStyle}`}>
                          {t.priority}
                        </span>
                        <p className="text-xs text-slate-200 font-semibold line-clamp-1 group-hover:text-indigo-300 transition-colors">
                          {t.subject}
                        </p>
                      </div>

                      {/* Bottom Row: Category Pill, Messages Count & Agent */}
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1.5">
                        <span className="rounded bg-slate-950 px-1.5 py-0.5 text-indigo-400 border border-slate-800">
                          {t.category || 'Support'}
                        </span>

                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3 text-slate-500" />
                            {t.messagesCount || 0}
                          </span>
                          <span className="text-slate-300 font-semibold">{t.assigned_profile?.full_name || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ---------------- 4. RIGHT PANE (65% WIDTH) - ACTIVE TICKET COMMAND WORKSPACE ---------------- */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl flex flex-col justify-between">
          {!selectedTicket ? (
            <div className="m-auto text-center font-mono text-xs text-slate-500 space-y-2">
              <LifeBuoy className="mx-auto size-8 text-slate-600" />
              <p className="font-semibold text-slate-400">No Ticket Selected</p>
              <p>Select a ticket from the left stream to open conversation & intel workspace.</p>
            </div>
          ) : (
            <>
              {/* 1. Customer 360 Intelligence Bar (Header) */}
              <div className="border-b border-slate-800/80 pb-3 space-y-3 font-mono">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-bold text-indigo-400">#TCK-{selectedTicket.id.slice(0, 8)}</code>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${getPriorityBadgeStyle(
                          selectedTicket.priority
                        )}`}
                      >
                        {selectedTicket.priority} Priority
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-white">{selectedTicket.subject}</h2>
                  </div>

                  {/* Controls: Status & Agent Assignment */}
                  <div className="flex items-center gap-2">
                    {/* Status Dropdown */}
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => void handleChangeStatus(selectedTicket, e.target.value as SupportTicket['status'])}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold capitalize shadow-sm transition-all ${
                        selectedTicket.status === 'open'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : selectedTicket.status === 'pending'
                          ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                          : selectedTicket.status === 'resolved'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    {/* Agent Dropdown */}
                    <select
                      value={selectedTicket.assigned_to || ''}
                      onChange={(e) => void handleAssignAgent(selectedTicket, e.target.value)}
                      className="rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {admins.map((adm) => (
                        <option key={adm.id} value={adm.id}>
                          {adm.full_name || 'Admin'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Customer 360 Intel Cards */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 p-2.5 border border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-300">
                    <span>
                      Workspace: <strong className="text-white">{selectedTicket.tenants?.name || 'Internal'}</strong>
                    </span>
                    <span>
                      Plan:{' '}
                      <span className="text-emerald-400 font-bold">
                        {selectedTicket.tenants?.saas_plans?.name || selectedTicket.tenants?.subscription_plan || 'Basic Plan'}
                      </span>
                    </span>
                    <span>
                      Spend:{' '}
                      <span className="text-slate-200 font-bold">
                        {inr(selectedTicket.tenants?.saas_plans?.price_monthly || 999)}/mo
                      </span>
                    </span>
                    <span>
                      Owner: <span className="text-slate-200">{selectedTicket.owner?.full_name || 'Unassigned'}</span>
                    </span>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2">
                    {selectedTicket.owner?.phone && (
                      <a
                        href={`https://wa.me/${selectedTicket.owner.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <MessageSquare className="size-3" />
                        WhatsApp Chat
                      </a>
                    )}

                    {selectedTicket.tenants && (
                      <button
                        onClick={() => handleImpersonateTenant(selectedTicket.tenants)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/20"
                      >
                        <Zap className="size-3 text-indigo-400" />
                        Impersonate
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Real-Time Conversation Thread Stream */}
              <div ref={chatThreadRef} className="my-3 flex-1 overflow-y-auto space-y-3 pr-2 max-h-[340px] font-mono">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    No conversation messages recorded yet. Write the first response below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSuperAdmin = msg.sender_profile?.role === 'super_admin' || msg.sender_id === currentUserId

                    if (msg.is_internal) {
                      return (
                        <div
                          key={msg.id}
                          className="mx-auto max-w-[90%] rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 shadow-md"
                        >
                          <div className="flex items-center justify-between font-bold text-[10px] text-amber-400 pb-1 border-b border-amber-500/20">
                            <span className="flex items-center gap-1">
                              <Lock className="size-3" /> 🔒 Internal Admin Note (Only visible to RVC Team)
                            </span>
                            <span>{new Date(msg.created_at).toLocaleTimeString('en-IN')}</span>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] space-y-1 ${isSuperAdmin ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                          <span className="font-bold text-slate-200">
                            {isSuperAdmin ? '🛡️ RVC Super Admin' : msg.sender_profile?.full_name || 'Tenant Customer'}
                          </span>
                          <span>{formatRelativeTime(msg.created_at)}</span>
                        </div>

                        <div
                          className={`rounded-2xl p-3 text-xs whitespace-pre-wrap shadow-md ${
                            isSuperAdmin
                              ? 'bg-emerald-950/80 text-emerald-100 border border-emerald-500/30 rounded-tr-none'
                              : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none'
                          }`}
                        >
                          {msg.body}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 3. Reply & Resolution Composer */}
              <div className="border-t border-slate-800/80 pt-3 space-y-2.5 font-mono">
                {/* Canned Responses Preset Bar */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400 font-bold uppercase mr-1">Presets:</span>
                  {[
                    { label: 'KDS Refreshed', text: 'We have refreshed your Kitchen Display System (KDS) socket session token.' },
                    { label: 'UTR Verified', text: 'Your UTR payment reference has been verified and your subscription is active.' },
                    { label: 'Send Screenshot', text: 'Please send a clear screenshot of your UPI payment receipt with UTR number.' },
                    { label: '+30d Extended', text: 'We have extended your subscription by +30 days as a goodwill gesture.' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyCannedResponse(preset.text)}
                      className="rounded-md border border-slate-800 bg-slate-950 px-2 py-0.5 text-slate-300 hover:border-indigo-500/50 hover:text-white transition-all"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>

                {/* Textarea */}
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={
                    isInternalNote
                      ? 'Write a private internal note for the RVC admin team...'
                      : 'Write official support reply to tenant customer (markdown supported)...'
                  }
                  className={`w-full rounded-xl border p-3 text-xs text-white focus:outline-none transition-all min-h-[70px] ${
                    isInternalNote
                      ? 'border-amber-500/50 bg-amber-500/5 focus:border-amber-400 placeholder:text-amber-400/50'
                      : 'border-slate-800 bg-slate-950 focus:border-indigo-500 placeholder:text-slate-500'
                  }`}
                />

                {/* Composer Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-amber-300 font-semibold">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-amber-500 bg-slate-950 text-amber-500"
                      />
                      <span>🔒 Private Internal Note</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300 font-semibold">
                      <input
                        type="checkbox"
                        checked={autoResolveOnSend}
                        onChange={(e) => setAutoResolveOnSend(e.target.checked)}
                        className="rounded border-emerald-500 bg-slate-950 text-emerald-500"
                      />
                      <span>Auto-Mark as Resolved</span>
                    </label>
                  </div>

                  <button
                    disabled={sendingReply || !replyText.trim()}
                    onClick={() => void handleSendReply()}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all disabled:opacity-50 ${
                      isInternalNote ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <Send className="size-3.5" />
                    {sendingReply ? 'Sending...' : isInternalNote ? 'Save Internal Note' : 'Send Reply ↵'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
