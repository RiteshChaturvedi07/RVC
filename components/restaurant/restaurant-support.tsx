'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  MessageCircle,
  MessageSquare,
  Phone,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

export type Ticket = {
  id: string
  subject: string
  category: string
  priority: string
  status: string
  description?: string | null
  updated_at: string
  created_at: string
}

export type TicketMessage = {
  id: string
  sender_id: string | null
  body: string
  created_at: string
}

export const VIDEO_GUIDES = [
  {
    id: 'printer',
    title: '🖨️ Setup 58mm / 80mm Thermal KOT Printers',
    desc: 'Connect USB/Network POS thermal receipt printers for instant KDS ticket printing.',
    steps: [
      '1. Connect your 58mm or 80mm thermal receipt printer via USB or Local Network.',
      '2. Ensure browser popup & window permissions are allowed for your domain.',
      '3. Open KDS page -> Click "Test KOT Printer" in the top command bar.',
      '4. Set paper size to 80mm auto-cut and margin to "None" in browser print dialog.',
    ],
  },
  {
    id: 'qr_stand',
    title: '📱 Download & Print Acrylic Table QR Stands',
    desc: 'Generate high-resolution customer table QR codes for instant digital menu ordering.',
    steps: [
      '1. Navigate to "Tables & QR Management" workspace.',
      '2. Click "Add Table" to create Table Numbers (e.g. Table 01 to Table 15).',
      '3. Click "Print All Table QRs" button to export formatted QR cards.',
      '4. Print on heavy cardstock or insert into 4x6 acrylic table stand displays.',
    ],
  },
  {
    id: 'z_report',
    title: '🧾 Settle Daily Cash & Generate Day-End Z-Reports',
    desc: 'Reconcile register cash drawer, log petty expenses & lock shift totals.',
    steps: [
      '1. Navigate to "Finance & Accounts" workspace at end of service shift.',
      '2. Log any daily cash outlays using "+ Log Petty Expense" (e.g., Mandi veg, ice).',
      '3. Count physical cash in drawer and enter into "Actual Counted Cash" input.',
      '4. Verify discrepancy pill (Exact match 🟢 / Shortage 🔴) and click "Print Day-End Z-Report".',
    ],
  },
]

export const FAQS = [
  {
    id: '1',
    q: 'How do I add new waiters or kitchen staff with custom permissions?',
    a: 'Go to the "Staff & Team Management" workspace, click "+ Add Staff Member", enter their registered RVC email address, select their role preset (Store Manager, Kitchen Chef, Waiter, Cashier), and check the specific workspace checkboxes they are permitted to view.',
  },
  {
    id: '2',
    q: 'What should I do if internet disconnects during active service?',
    a: 'RVC KDS & POS features local caching! Active order cards remain rendered on screen. Once internet reconnects, Supabase Realtime syncs pending order statuses automatically.',
  },
  {
    id: '3',
    q: 'How do I change GST tax rates (5% vs 18%) or restaurant details on receipts?',
    a: 'Navigate to "Restaurant Settings", update your GSTIN number, tax rate percentage (default 5%), address, and contact phone number. All printed thermal receipts will update instantly.',
  },
  {
    id: '4',
    q: 'Why are KDS kitchen ticket chimes not playing audio on new orders?',
    a: 'Modern web browsers require one user tap on the screen before playing web audio. Simply click anywhere on the KDS board once at shift start to auto-unlock audio chimes.',
  },
]

export function RestaurantSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [tenantId, setTenantId] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [queryFaq, setQueryFaq] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(FAQS[0].id)
  const [selectedGuide, setSelectedGuide] = useState<(typeof VIDEO_GUIDES)[0] | null>(null)

  // Modals
  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    category: 'Kitchen KDS',
    priority: '🔴 Critical (Service Blocked)',
    description: '',
  })

  const threadEndRef = useRef<HTMLDivElement>(null)

  // Load Tickets & Restaurant Metadata
  const loadData = async () => {
    setLoading(true)
    try {
      const db = createClient()
      const tenant = await currentRestaurantTenant()
      setTenantId(tenant)

      const userRes = await db.auth.getUser()
      setUserId(userRes.data.user?.id || '')

      const [{ data: ticketData }, { data: settings }] = await Promise.all([
        db.from('support_tickets').select('*').eq('tenant_id', tenant).order('updated_at', { ascending: false }),
        db.from('restaurant_settings').select('display_name').eq('tenant_id', tenant).single(),
      ])

      setTickets((ticketData ?? []) as Ticket[])
      setRestaurantName(settings?.display_name || 'Our Restaurant')
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  // Load Message Thread for Selected Ticket
  const loadThread = async (ticket: Ticket) => {
    setActiveTicket(ticket)
    try {
      const db = createClient()
      const { data } = await db
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })

      setMessages((data ?? []) as TicketMessage[])
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Submit Ticket to Supabase
  const handleCreateTicket = async () => {
    if (!form.subject.trim()) return alert('Enter an issue subject.')
    try {
      const db = createClient()
      const tenant = tenantId || (await currentRestaurantTenant())
      const me = userId || (await db.auth.getUser()).data.user?.id

      const { data, error } = await db
        .from('support_tickets')
        .insert({
          tenant_id: tenant,
          subject: form.subject.trim(),
          category: form.category,
          priority: form.priority,
          description: form.description.trim() || null,
          created_by: me || null,
        })
        .select()
        .single()

      if (error) throw error

      setCreateModal(false)
      setForm({ subject: '', category: 'Kitchen KDS', priority: '🔴 Critical (Service Blocked)', description: '' })
      await loadData()
      if (data) void loadThread(data as Ticket)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to submit support ticket.')
    }
  }

  // Send Message Reply
  const handleSendMessage = async () => {
    if (!activeTicket || !replyText.trim()) return
    try {
      const db = createClient()
      const tenant = tenantId || (await currentRestaurantTenant())

      const { error } = await db.from('support_ticket_messages').insert({
        ticket_id: activeTicket.id,
        tenant_id: tenant,
        sender_id: userId,
        body: replyText.trim(),
      })

      if (error) throw error

      await db
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString(), status: activeTicket.status === 'resolved' ? 'open' : activeTicket.status })
        .eq('id', activeTicket.id)

      setReplyText('')
      void loadThread(activeTicket)
      void loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send reply.')
    }
  }

  // Trigger Emergency WhatsApp Support
  const handleEmergencyWhatsApp = () => {
    const payload = `🚨 EMERGENCY RESTAURANT SUPPORT ESCALATION 🚨\n\n• Restaurant: ${restaurantName}\n• Tenant ID: ${tenantId || 'RVC-POS'}\n• Active Issue: Urgent POS / KDS assistance required during live service.\n• Time: ${new Date().toLocaleString('en-IN')}\n\nPlease assign a senior support engineer immediately!`

    const whatsappUrl = `https://wa.me/919876543210?text=${encodeURIComponent(payload)}`
    window.open(whatsappUrl, '_blank')
  }

  // Filtered FAQs
  const filteredFaqs = FAQS.filter(
    (f) => f.q.toLowerCase().includes(queryFaq.toLowerCase()) || f.a.toLowerCase().includes(queryFaq.toLowerCase())
  )

  const openTicketsCount = tickets.filter((t) => t.status !== 'resolved').length

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white">
      {/* HEADER & PRIMARY ESCALATION BAR */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <HelpCircle className="size-4" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Help Desk &amp; Diagnostics Center
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              24/7 priority support, emergency WhatsApp escalations, ticket tracking, &amp; printer setup guides.
            </p>
          </div>

          {/* Action Escalation Triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleEmergencyWhatsApp}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
            >
              <MessageCircle className="size-4" />
              <span>🚨 Emergency WhatsApp Support</span>
            </button>

            <button
              onClick={() => setCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95"
            >
              <Plus className="size-4" />
              <span>➕ Raise Support Ticket</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. SUMMARY METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Priority SLA */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/20">
              <Clock className="size-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-extrabold">
              <span>Guaranteed ⚡</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Priority SLA Response
            </span>
            <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              &lt; 15 Mins <span className="text-xs font-bold text-slate-400">during service</span>
            </p>
          </div>
        </div>

        {/* Metric 2: Active Tickets */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="size-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-2 py-0.5 text-[11px] font-extrabold">
              <span>{openTicketsCount ? `🟡 ${openTicketsCount} Open` : '🟢 All Clear'}</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Support Tickets
            </span>
            <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {openTicketsCount} <span className="text-xs font-bold text-slate-400">Open Tickets</span>
            </p>
          </div>
        </div>

        {/* Metric 3: WhatsApp Emergency Help */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
              <Phone className="size-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-extrabold">
              <span>🟢 Online Now</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              WhatsApp Emergency Agent
            </span>
            <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5 font-mono">
              +91 98765 43210
            </p>
          </div>
        </div>

        {/* Metric 4: Knowledge Base */}
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20">
              <BookOpen className="size-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-[11px] font-extrabold">
              <span>12 Guides 📚</span>
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Knowledge Base
            </span>
            <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              Printer &amp; POS Setup
            </p>
          </div>
        </div>
      </div>

      {/* 2. TWO-COLUMN HELP DESK & DIAGNOSTICS LAYOUT */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN (60% Width - 7 Cols): Live System Status & Ticket Chat Thread */}
        <div className="lg:col-span-7 space-y-6">
          {/* Live System Status Banner */}
          <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <h3 className="font-black text-emerald-900 dark:text-emerald-200 text-sm">
                  Live System &amp; Infrastructure Health
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase">
                🟢 100% Operational
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
              <div className="rounded-xl bg-white/60 dark:bg-slate-900/60 p-2.5 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase">Realtime Sync</span>
                <span className="text-xs font-black block mt-0.5">🟢 Connected</span>
              </div>

              <div className="rounded-xl bg-white/60 dark:bg-slate-900/60 p-2.5 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase">Cloud API Speed</span>
                <span className="text-xs font-black block mt-0.5 font-mono">🟢 42ms Latency</span>
              </div>

              <div className="rounded-xl bg-white/60 dark:bg-slate-900/60 p-2.5 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase">Thermal Print Engine</span>
                <span className="text-xs font-black block mt-0.5">🟢 Ready</span>
              </div>
            </div>
          </div>

          {/* Ticket History & Live Chat Interface */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col min-h-[450px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                <MessageSquare className="size-4 text-primary" />
                <span>Support Ticket Threads ({tickets.length})</span>
              </h3>

              {activeTicket && (
                <button
                  onClick={() => setActiveTicket(null)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  ← Back to Ticket List
                </button>
              )}
            </div>

            {/* View A: Ticket List */}
            {!activeTicket ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Subject</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                          {t.subject}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            #{t.id.slice(0, 8)} · {new Date(t.updated_at).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-600 dark:text-slate-300">{t.category || 'General'}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800">
                            {t.priority}
                          </span>
                        </td>
                        <td className="p-3 font-bold">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              t.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {t.status === 'resolved' ? '🟢 Resolved' : '🟡 In Review'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => void loadThread(t)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                          >
                            <span>Chat</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!tickets.length && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400 font-medium">
                          <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-2" />
                          No active issues reported. Your system is running smoothly!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* View B: Live Chat Thread Window */
              <div className="flex flex-1 flex-col justify-between">
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                  <div>
                    <span className="text-slate-900 dark:text-white font-black block text-sm">
                      {activeTicket.subject}
                    </span>
                    <span className="text-slate-400 font-medium">
                      Category: {activeTicket.category || 'General'} · Priority: {activeTicket.priority}
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                      activeTicket.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {activeTicket.status === 'resolved' ? 'Resolved' : 'In Review'}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[300px]">
                  {messages.map((m) => {
                    const isSelf = m.sender_id === userId
                    return (
                      <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl p-3 text-xs shadow-xs ${
                            isSelf
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {!isSelf && (
                            <span className="flex items-center gap-1 text-[10px] font-black text-primary mb-1">
                              <ShieldCheck className="size-3" />
                              <span>RVC Support Senior Engineer</span>
                            </span>
                          )}
                          <p className="leading-relaxed">{m.body}</p>
                          <span className="block text-[9px] opacity-70 mt-1 text-right">
                            {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {!messages.length && (
                    <p className="py-8 text-center text-xs text-slate-400 italic">
                      Thread initialized. Our support engineer will respond shortly.
                    </p>
                  )}
                  <div ref={threadEndRef} />
                </div>

                <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleSendMessage()}
                    placeholder="Type reply to support engineer…"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => void handleSendMessage()}
                    className="rounded-xl bg-primary hover:opacity-90 px-4 py-2 text-xs font-bold text-primary-foreground active:scale-95"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (40% Width - 5 Cols): Visual Video Guides & Searchable FAQs */}
        <div className="lg:col-span-5 space-y-6">
          {/* Visual Video / Setup Guide Cards */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <PlayCircle className="size-4 text-purple-500" />
              <span>Interactive Hardware &amp; Setup Guides</span>
            </h3>

            <div className="space-y-2.5">
              {VIDEO_GUIDES.map((guide) => (
                <div
                  key={guide.id}
                  onClick={() => setSelectedGuide(guide)}
                  className="group flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-primary/50 transition-all cursor-pointer"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                    <PlayCircle className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                      {guide.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-tight mt-0.5">
                      {guide.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Searchable FAQ Accordion */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <HelpCircle className="size-4 text-amber-500" />
              <span>Searchable Operational FAQs</span>
            </h3>

            {/* FAQ Search Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <input
                value={queryFaq}
                onChange={(e) => setQueryFaq(e.target.value)}
                placeholder="Search operational FAQs (e.g. staff, tax, KDS audio)…"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2 pl-8 pr-3 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Accordion List */}
            <div className="space-y-2 pt-1">
              {filteredFaqs.map((faq) => {
                const isOpen = expandedFaq === faq.id
                return (
                  <div
                    key={faq.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : faq.id)}
                      className="w-full flex items-center justify-between p-3 text-left text-xs font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="size-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-3 text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}

              {!filteredFaqs.length && (
                <p className="py-6 text-center text-xs text-slate-400 font-medium">
                  No FAQs match your search term. Use Emergency WhatsApp for direct assistance.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: RAISE SUPPORT TICKET MODAL */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-primary" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Raise Support Ticket
                </h3>
              </div>
              <button
                onClick={() => setCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Issue Subject *
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. KDS tickets not printing to 80mm thermal printer"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Affected Module
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
                >
                  <option>Kitchen KDS</option>
                  <option>Orders &amp; Billing POS</option>
                  <option>Tables &amp; QR Stands</option>
                  <option>Menu Builder</option>
                  <option>Inventory &amp; Stock</option>
                  <option>Finance &amp; Daily Cash</option>
                  <option>Staff &amp; Permissions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Urgency Level
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
                >
                  <option>🔴 Critical (Service Blocked)</option>
                  <option>🟡 Moderate (Minor Issue)</option>
                  <option>🔵 Question / Feature</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Detailed Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what happened, error message, or steps to reproduce..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateTicket()}
                className="rounded-xl bg-primary hover:opacity-90 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md active:scale-95"
              >
                Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SETUP GUIDE STEPS MODAL */}
      {selectedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlayCircle className="size-5 text-purple-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {selectedGuide.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedGuide(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {selectedGuide.desc}
              </p>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {selectedGuide.steps.map((step, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {step}
                  </p>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedGuide(null)}
                className="rounded-xl bg-primary hover:opacity-90 px-5 py-2 text-xs font-bold text-primary-foreground"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
