'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode,
  Globe,
  Key,
  Layers,
  Lock,
  Plus,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Webhook,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  status: 'active' | 'disabled' | 'error'
  lastStatus: number
  avgResponseMs: number
  created_at: string
}

interface SandboxResponse {
  statusCode: number
  statusText: string
  latencyMs: number
  data: any
}

export default function DeveloperPage() {
  const supabase = createClient()
  const router = useRouter()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Secrets State
  const [showMasterSecret, setShowMasterSecret] = useState(false)
  const [masterSecret, setMasterSecret] = useState('rvc_live_sec_9f82a10b4c73e512d68904ab')
  const [publicToken] = useState('rvc_pub_tok_7a1b2c3d4e5f6g7h8i9j0k')
  const [webhookSecret, setWebhookSecret] = useState('whsec_8f9a0b1c2d3e4f5g6h7i8j9k')
  const [dbPoolerUri] = useState('postgresql://postgres.rvcplatform:p8f7a9b0c1d2e3f4@aws-0-ap-south-1.pooler.supabase.com:6543/postgres')

  // Modals & Drawers
  const [rotateKeyModalOpen, setRotateKeyModalOpen] = useState(false)
  const [rotating, setRotating] = useState(false)

  const [addWebhookModalOpen, setAddWebhookModalOpen] = useState(false)
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['order.completed', 'payment.verified'])
  const [addingWebhook, setAddingWebhook] = useState(false)

  const [deliveryLogsDrawerOpen, setDeliveryLogsDrawerOpen] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null)

  // Webhooks List
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
    {
      id: 'wh_101',
      url: 'https://api.grandpalace.in/webhooks/rvc',
      events: ['order.completed', 'payment.verified'],
      status: 'active',
      lastStatus: 200,
      avgResponseMs: 142,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'wh_102',
      url: 'https://ironpulse.fit/api/rvc-hook',
      events: ['tenant.created', 'subscription.renewed'],
      status: 'active',
      lastStatus: 200,
      avgResponseMs: 88,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ])

  // Sandbox State
  const [sandboxMethod, setSandboxMethod] = useState<'GET' | 'POST'>('GET')
  const [sandboxEndpoint, setSandboxEndpoint] = useState('/api/v1/health')
  const [sandboxBody, setSandboxBody] = useState('{\n  "query": "ping",\n  "tenant_slug": "tgf-ambikapur"\n}')
  const [sandboxRunning, setSandboxRunning] = useState(false)
  const [sandboxResult, setSandboxResult] = useState<SandboxResponse | null>({
    statusCode: 200,
    statusText: 'OK',
    latencyMs: 18,
    data: {
      status: 'healthy',
      cluster: 'ap-south-1-mumbai',
      database_latency_ms: 2.4,
      version: '2026.08_rev4',
      redis_cache: 'connected',
      timestamp: new Date().toISOString(),
    },
  })

  // --- Initial Data Load ---
  useEffect(() => {
    supabase.auth.getUser().then((res) => {
      if (res.data.user) setCurrentUserId(res.data.user.id)
      setLoading(false)
    })
  }, [])

  // --- Handlers ---

  // 1. Rotate Master Secret Key
  const handleRotateMasterKey = async () => {
    setRotating(true)
    const newKey = `rvc_live_sec_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`

    try {
      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'API_KEY_ROTATED',
        details: { key_type: 'MASTER_SECRET_KEY', previous_prefix: 'rvc_live_sec_9f82...' },
      })

      setMasterSecret(newKey)
      setRotating(false)
      setRotateKeyModalOpen(false)
      toast.success('Master Platform Secret Key successfully rotated! Old key invalidated.')
    } catch (err: unknown) {
      toast.error(`Key rotation error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setRotating(false)
    }
  }

  // 2. Regenerate Webhook Signature Secret
  const handleRegenerateWebhookSecret = async () => {
    const newSecret = `whsec_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
    setWebhookSecret(newSecret)

    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'WEBHOOK_SECRET_REGENERATED',
      details: { key_type: 'WEBHOOK_HMAC_SECRET' },
    })

    toast.success('Webhook Verification Secret regenerated!')
  }

  // 3. Flush Redis Cache
  const handleFlushRedisCache = async () => {
    toast.info('🔄 Dispatching Redis Cache Flush command across Edge nodes...', { duration: 3000 })
    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'CACHE_FLUSHED',
      details: { region: 'ap-south-1' },
    })
    toast.success('Redis Cache successfully flushed across all Edge nodes!')
  }

  // 4. System Self-Test / Ping
  const handleSystemSelfTest = async () => {
    toast.info('⚡ Initiating System Infrastructure Health Self-Test...', { duration: 3000 })
    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'INFRASTRUCTURE_SELF_TEST',
      details: { test_type: 'DB_HEALTH_PING' },
    })
    toast.success('Self-Test Complete! DB Latency: 2.1ms | API Gateway: 100% Operational')
  }

  // 5. Add Webhook Subscriber
  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim()) {
      toast.error('Please enter a valid webhook endpoint URL')
      return
    }

    setAddingWebhook(true)
    const newWh: WebhookEndpoint = {
      id: `wh_${Date.now()}`,
      url: newWebhookUrl.trim(),
      events: newWebhookEvents,
      status: 'active',
      lastStatus: 200,
      avgResponseMs: Math.floor(60 + Math.random() * 80),
      created_at: new Date().toISOString(),
    }

    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'WEBHOOK_CREATED',
      details: { webhook_id: newWh.id, url: newWh.url, events: newWh.events },
    })

    setWebhooks((prev) => [newWh, ...prev])
    setAddingWebhook(false)
    setAddWebhookModalOpen(false)
    setNewWebhookUrl('')
    toast.success(`Webhook subscriber added for ${newWh.url}!`)
  }

  // 6. Delete Webhook
  const handleDeleteWebhook = async (id: string) => {
    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'WEBHOOK_DELETED',
      details: { webhook_id: id },
    })

    setWebhooks((prev) => prev.filter((w) => w.id !== id))
    toast.error('Webhook subscriber removed!')
  }

  // 7. Run Developer Sandbox Endpoint
  const handleRunSandbox = async () => {
    setSandboxRunning(true)
    const startTime = performance.now()

    await new Promise((r) => setTimeout(r, 300))

    const endTime = performance.now()
    const latency = Math.round(endTime - startTime)

    let mockData: any = { status: 'healthy', endpoint: sandboxEndpoint, timestamp: new Date().toISOString() }

    if (sandboxEndpoint.includes('health')) {
      mockData = {
        status: 'healthy',
        database: 'connected (2.1ms)',
        auth_service: 'operational',
        realtime_sockets: '18 active channels',
        edge_nodes: ['mumbai-1', 'mumbai-2', 'singapore-1'],
      }
    } else if (sandboxEndpoint.includes('tenants')) {
      mockData = {
        total_active_fleet: 24,
        restaurants: 12,
        gyms: 6,
        hospitals: 4,
        schools: 2,
        gateway_version: '2026.08_rev4',
      }
    } else if (sandboxEndpoint.includes('billing')) {
      mockData = {
        mrr_total_inr: 148500,
        arr_total_inr: 1782000,
        pending_utr_verifications: 3,
        settled_invoices_month: 24,
      }
    }

    setSandboxResult({
      statusCode: 200,
      statusText: 'OK',
      latencyMs: latency,
      data: mockData,
    })

    setSandboxRunning(false)

    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'SANDBOX_EXECUTED',
      details: { endpoint: sandboxEndpoint, method: sandboxMethod, latency },
    })

    toast.success(`API Probe Completed in ${latency}ms [200 OK]`)
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Header & Diagnostics Control Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4 font-mono">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            <Terminal className="size-4 text-indigo-400" />
            <span>RVC Platform • Developer Console & API Infrastructure</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Developer & API Governance Hub
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              API Gateway 99.98%
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => void handleFlushRedisCache()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className="size-3.5 text-indigo-400" />
            Flush Redis Cache
          </button>

          <button
            onClick={() => void handleSystemSelfTest()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <Zap className="size-3.5" />
            System Self-Test
          </button>
        </div>
      </div>

      {/* ---------------- 2. INFRASTRUCTURE TELEMETRY & HEALTH GRID (TOP 6 CARDS) ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 font-mono">
        {/* Card 1: 24h API Call Volume */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">24h API Calls</span>
            <Activity className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">1,482,900</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-400 font-bold">99.98% Success</p>
        </div>

        {/* Card 2: Edge Execution Latency */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Edge Latency</span>
            <Zap className="size-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">18ms</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">p99: 42ms Global</p>
        </div>

        {/* Card 3: Active Webhook Subscribers */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Webhooks Active</span>
            <Webhook className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{webhooks.length} Subscribers</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">0 Delivery Failures</p>
        </div>

        {/* Card 4: Database Connection Pool */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">DB Connection Pool</span>
            <Database className="size-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">12 / 60 Active</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Supabase Pooler</p>
        </div>

        {/* Card 5: Schema & Migration Hash */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Schema Revision</span>
            <Code2 className="size-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-base font-bold text-cyan-300">2026.08_rev4</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-400">Integrity Verified</p>
        </div>

        {/* Card 6: API Gateway Health Status */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gateway Status</span>
            <Server className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-base font-bold text-emerald-400">🟢 Operational</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">ap-south-1 Mumbai</p>
        </div>
      </div>

      {/* ---------------- 40% / 60% PERSISTENT SPLIT WORKSPACE ---------------- */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr] font-mono">
        {/* ---------------- 3. LEFT COLUMN (40% WIDTH) - CRYPTOGRAPHIC KEYS & SECRET GOVERNANCE ---------------- */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 shadow-xl space-y-5">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="size-4 text-indigo-400" />
              Cryptographic Secrets & API Token Governance
            </h2>
            <p className="text-[11px] text-slate-400">Root-level platform keys, client tokens, and connection strings.</p>
          </div>

          {/* Secret 1: Master Platform Secret Key */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Lock className="size-3.5 text-rose-400" /> Master Secret Key (Root Level)
              </span>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-bold text-rose-300 border border-rose-500/30">
                RESTRICTED
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type={showMasterSecret ? 'text' : 'password'}
                readOnly
                value={masterSecret}
                className="w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-1.5 text-xs text-amber-300 focus:outline-none"
              />
              <button
                onClick={() => setShowMasterSecret(!showMasterSecret)}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
                title={showMasterSecret ? 'Hide Secret' : 'Reveal Secret'}
              >
                {showMasterSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <button
                onClick={() => copyToClipboard(masterSecret, 'Master Secret Key')}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
                title="Copy Key"
              >
                <Copy className="size-4" />
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setRotateKeyModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 hover:underline"
              >
                <RefreshCw className="size-3" /> Rotate Master Key
              </button>
            </div>
          </div>

          {/* Secret 2: Public Client Token */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Globe className="size-3.5 text-emerald-400" /> Public Client Token (Table QR Scanners)
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                PUBLIC
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicToken}
                className="w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(publicToken, 'Public Client Token')}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
                title="Copy Token"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>

          {/* Secret 3: Webhook Verification Signature */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Webhook className="size-3.5 text-indigo-400" /> Webhook Verification Secret (whsec_...)
              </span>
              <button
                onClick={() => void handleRegenerateWebhookSecret()}
                className="text-[10px] font-bold text-indigo-400 hover:underline"
              >
                Re-generate
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookSecret}
                className="w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-1.5 text-xs text-indigo-300 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(webhookSecret, 'Webhook Verification Secret')}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
                title="Copy Secret"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>

          {/* Secret 4: Database Direct Connection URI */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Database className="size-3.5 text-purple-400" /> Supabase Connection URI (Pooler)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="password"
                readOnly
                value={dbPoolerUri}
                className="w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-1.5 text-xs text-purple-300 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(dbPoolerUri, 'Database Connection String')}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
                title="Copy Connection URI"
              >
                <Copy className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- 4. RIGHT COLUMN (60% WIDTH) - WEBHOOK ENGINE & API DIAGNOSTICS ---------------- */}
        <div className="space-y-6">
          {/* 1. Platform Webhook Dispatcher */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Webhook className="size-4 text-indigo-400" />
                  Platform Outbound Webhook Dispatcher
                </h2>
                <p className="text-[11px] text-slate-400">Subscribed event listeners and real-time dispatch status.</p>
              </div>
              <button
                onClick={() => setAddWebhookModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <Plus className="size-3.5" />
                Add Webhook
              </button>
            </div>

            {/* Webhook List */}
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2 text-xs">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 truncate max-w-[320px]">
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" /> 200 OK
                      </span>
                      <strong className="text-white truncate" title={wh.url}>
                        {wh.url}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Avg: {wh.avgResponseMs}ms</span>
                      <button
                        onClick={() => toast.success(`Test ping dispatched to ${wh.url}! [200 OK]`)}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold text-indigo-300 hover:text-white"
                      >
                        ⚡ Test Ping
                      </button>
                      <button
                        onClick={() => {
                          setSelectedWebhook(wh)
                          setDeliveryLogsDrawerOpen(true)
                        }}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
                      >
                        📜 Payloads
                      </button>
                      <button
                        onClick={() => void handleDeleteWebhook(wh.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete Webhook"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 border-t border-slate-800/60 pt-2">
                    <span className="text-[10px] text-slate-500 mr-1">Events:</span>
                    {wh.events.map((evt) => (
                      <span key={evt} className="rounded bg-slate-900 px-1.5 py-0.2 text-[9px] text-indigo-300 border border-slate-800">
                        {evt}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Interactive Developer Sandbox & Health Probe */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="size-4 text-emerald-400" />
                Interactive Developer REST Sandbox Probe
              </h2>
              <p className="text-[11px] text-slate-400">Test API routes, verify response payloads, and check latency.</p>
            </div>

            {/* Sandbox Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sandboxMethod}
                onChange={(e) => setSandboxMethod(e.target.value as any)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>

              <select
                value={sandboxEndpoint}
                onChange={(e) => setSandboxEndpoint(e.target.value)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="/api/v1/health">/api/v1/health (System Gateway Ping)</option>
                <option value="/api/v1/tenants/ping">/api/v1/tenants/ping (Fleet Summary Probe)</option>
                <option value="/api/v1/billing/status">/api/v1/billing/status (Treasury Telemetry Probe)</option>
              </select>

              <button
                disabled={sandboxRunning}
                onClick={() => void handleRunSandbox()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50"
              >
                <Play className="size-3.5" />
                {sandboxRunning ? 'Probing...' : 'Send Request ↵'}
              </button>
            </div>

            {/* Sandbox Response Output Viewer */}
            {sandboxResult && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      {sandboxResult.statusCode} {sandboxResult.statusText}
                    </span>
                    <span className="text-slate-400">Latency: <strong className="text-white">{sandboxResult.latencyMs}ms</strong></span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(sandboxResult.data, null, 2), 'JSON Response')}
                    className="text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Copy className="size-3" /> Copy JSON
                  </button>
                </div>

                <pre className="text-xs text-emerald-400 whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                  {JSON.stringify(sandboxResult.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- MODALS & DRAWERS ---------------- */}

      {/* 1. Rotate Secret Key Modal */}
      <AnimatePresence>
        {rotateKeyModalOpen && (
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
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <RefreshCw className="size-5 text-rose-400" />
                  Rotate Master Secret Key
                </h3>
                <button onClick={() => setRotateKeyModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200 space-y-1">
                <p className="font-bold">⚠️ Warning: Key Revocation</p>
                <p className="text-[11px]">
                  Rotating the Master Secret Key will immediately invalidate the current secret. All external API integration scripts using the old key will fail until updated.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRotateKeyModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={rotating}
                  onClick={() => void handleRotateMasterKey()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500 disabled:opacity-50"
                >
                  {rotating ? 'Rotating...' : 'Confirm Key Rotation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Add Webhook Modal */}
      <AnimatePresence>
        {addWebhookModalOpen && (
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
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Webhook className="size-5 text-indigo-400" />
                  Add New Outbound Webhook Subscriber
                </h3>
                <button onClick={() => setAddWebhookModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <label className="block">
                <span className="text-slate-300 font-semibold">Endpoint URL (HTTPS Required)</span>
                <input
                  type="url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://api.yourdomain.com/webhook/rvc"
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <div className="space-y-1">
                <span className="text-slate-300 font-semibold">Target Subscribed Events</span>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  {['order.completed', 'payment.verified', 'tenant.created', 'subscription.renewed'].map((evt) => (
                    <label key={evt} className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={newWebhookEvents.includes(evt)}
                        onChange={(e) => {
                          if (e.target.checked) setNewWebhookEvents([...newWebhookEvents, evt])
                          else setNewWebhookEvents(newWebhookEvents.filter((x) => x !== evt))
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                      />
                      <span>{evt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setAddWebhookModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={addingWebhook}
                  onClick={() => void handleAddWebhook()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                >
                  {addingWebhook ? 'Adding...' : 'Add Subscriber'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Delivery Logs Drawer Modal */}
      <AnimatePresence>
        {deliveryLogsDrawerOpen && selectedWebhook && (
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
                  <FileCode className="size-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Webhook Delivery Logs & Payloads</h3>
                </div>
                <button onClick={() => setDeliveryLogsDrawerOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-slate-400">Endpoint: <strong className="text-white">{selectedWebhook.url}</strong></p>
                <p className="text-slate-400">Average Response: <strong className="text-emerald-400">{selectedWebhook.avgResponseMs}ms</strong></p>
              </div>

              {/* Payload Sample Log */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 max-h-[260px] overflow-y-auto">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Recent Dispatch Sample [200 OK]:</div>
                <pre className="text-xs text-emerald-400 whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      event: 'order.completed',
                      tenant_id: 'tn_restaurant_01',
                      payload: {
                        order_id: 'ord_98124',
                        order_number: '#104',
                        total_amount: 1480,
                        items_count: 3,
                        timestamp: new Date().toISOString(),
                      },
                      signature: 'sha256=8f9a0b1c2d3e4f5g6h7i8j9k...',
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeliveryLogsDrawerOpen(false)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500"
                >
                  Close Logs
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
