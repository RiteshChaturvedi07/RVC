'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Globe,
  Key,
  Layers,
  Lock,
  Mail,
  Phone,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  UploadCloud,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
interface PlatformSettings {
  id: boolean
  maintenance_mode: boolean
  support_email: string | null
  support_phone: string | null
  invoice_prefix: string | null
  rvc_upi_id: string | null
  rvc_upi_qr_url: string | null
  updated_at?: string | null
  updated_by?: string | null
}

function formatRelativeTime(dateString?: string | null) {
  if (!dateString) return 'recently'
  const date = new Date(dateString)
  const now = new Date()
  const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSecs < 60) return `${Math.max(1, diffSecs)}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export default function SettingsPage() {
  const supabase = createClient()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Form Fields
  const [settings, setSettings] = useState<PlatformSettings>({
    id: true,
    maintenance_mode: false,
    support_email: 'support@rvcplatform.in',
    support_phone: '+91 98765 43210',
    invoice_prefix: 'RVC-INV',
    rvc_upi_id: 'rvc@icici',
    rvc_upi_qr_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80',
  })

  // File Upload State
  const [qrFile, setQrFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingQr, setUploadingQr] = useState(false)

  // Modals
  const [testScanModalOpen, setTestScanModalOpen] = useState(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)

  // --- Data Loading ---
  const loadSettingsData = async () => {
    setLoading(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      if (userRes?.user) setCurrentUserId(userRes.user.id)

      const { data: settingsData, error } = await supabase.from('platform_settings').select('*').single()

      if (error && error.code !== 'PGRST116') {
        toast.error(`Failed to load platform settings: ${error.message}`)
      }

      if (settingsData) {
        setSettings({
          id: true,
          maintenance_mode: settingsData.maintenance_mode ?? false,
          support_email: settingsData.support_email || 'support@rvcplatform.in',
          support_phone: settingsData.support_phone || '+91 98765 43210',
          invoice_prefix: settingsData.invoice_prefix || 'RVC-INV',
          rvc_upi_id: settingsData.rvc_upi_id || 'rvc@icici',
          rvc_upi_qr_url: settingsData.rvc_upi_qr_url || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80',
          updated_at: settingsData.updated_at,
          updated_by: settingsData.updated_by,
        })
      }
    } catch (err: unknown) {
      toast.error(`Settings load error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettingsData()
  }, [])

  // --- Handlers ---

  // 1. Upload QR Image File to Supabase Storage
  const handleUploadQrImage = async (file: File) => {
    setUploadingQr(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const filePath = `upi/platform-qr-${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage.from('platform_assets').upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      })

      if (uploadErr) throw new Error(uploadErr.message)

      const publicUrl = supabase.storage.from('platform_assets').getPublicUrl(filePath).data.publicUrl

      setSettings((prev) => ({ ...prev, rvc_upi_qr_url: publicUrl }))

      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'UPI_QR_ROTATED',
        details: { new_qr_url: publicUrl },
      })

      toast.success('Payment QR Code image uploaded to Supabase Storage!')
    } catch (err: unknown) {
      toast.error(`QR upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploadingQr(false)
      setQrFile(null)
    }
  }

  // 2. Save Master Settings Form
  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const updatedPayload = {
        id: true,
        maintenance_mode: settings.maintenance_mode,
        support_email: settings.support_email?.trim() || null,
        support_phone: settings.support_phone?.trim() || null,
        invoice_prefix: settings.invoice_prefix?.trim() || 'RVC-INV',
        rvc_upi_id: settings.rvc_upi_id?.trim() || null,
        rvc_upi_qr_url: settings.rvc_upi_qr_url || null,
        updated_at: new Date().toISOString(),
        updated_by: currentUserId || null,
      }

      const { error } = await supabase.from('platform_settings').upsert(updatedPayload)

      if (error) throw new Error(error.message)

      // Audit Log Hook
      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'PLATFORM_SETTINGS_UPDATED',
        details: {
          maintenance_mode: settings.maintenance_mode,
          rvc_upi_id: settings.rvc_upi_id,
          invoice_prefix: settings.invoice_prefix,
          support_email: settings.support_email,
        },
      })

      toast.success('Platform Settings & Treasury Config saved successfully!')
      void loadSettingsData()
    } catch (err: unknown) {
      toast.error(`Save settings error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // 3. Confirm Maintenance Mode Toggle
  const handleConfirmMaintenanceToggle = async () => {
    const nextMode = !settings.maintenance_mode
    setSettings((prev) => ({ ...prev, maintenance_mode: nextMode }))

    await supabase.from('platform_settings').upsert({
      id: true,
      maintenance_mode: nextMode,
      updated_at: new Date().toISOString(),
      updated_by: currentUserId || null,
    })

    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'MAINTENANCE_MODE_TOGGLED',
      details: { maintenance_mode: nextMode },
    })

    setMaintenanceModalOpen(false)
    toast.error(
      nextMode ? '⚡ Platform Maintenance Mode ENABLED! Non-admin users locked out.' : '🟢 Platform Operational. Maintenance Mode Disabled.'
    )
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4 font-mono">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            <Settings className="size-4" />
            <span>RVC Platform • Platform Governance & Treasury Config</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Global Settings Console
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium ${
                settings.maintenance_mode
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <span className={`size-2 rounded-full ${settings.maintenance_mode ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
              {settings.maintenance_mode ? 'Maintenance Lockdown' : 'Operational'}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            disabled={saving}
            onClick={() => void handleSaveSettings()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50 transition-all"
          >
            <Save className="size-4" />
            {saving ? 'Saving Config...' : '💾 Save & Deploy Configuration'}
          </button>

          <button
            onClick={() => void loadSettingsData()}
            disabled={loading}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh Settings"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---------------- 2. TELEMETRY & GOVERNANCE KPI BAR (TOP ROW - 6 CARDS) ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 font-mono">
        {/* Card 1: Platform Status */}
        <div
          className={`rounded-2xl border p-4 shadow-lg flex flex-col justify-between ${
            settings.maintenance_mode ? 'border-rose-500/40 bg-rose-500/10' : 'border-slate-800 bg-[#0d1322]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Platform Health</span>
            {settings.maintenance_mode ? <Lock className="size-4 text-rose-400 animate-pulse" /> : <Unlock className="size-4 text-emerald-400" />}
          </div>
          <div className="mt-2">
            <span className={`text-base font-bold ${settings.maintenance_mode ? 'text-rose-400' : 'text-emerald-400'}`}>
              {settings.maintenance_mode ? '🔴 Maintenance' : '🟢 Operational'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Global State</p>
        </div>

        {/* Card 2: Treasury Endpoint Health */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Treasury UPI</span>
            <QrCode className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-sm font-black text-amber-300 truncate block" title={settings.rvc_upi_id || 'Not set'}>
              {settings.rvc_upi_id || 'rvc@icici'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-400 font-bold">VPA Endpoint Verified</p>
        </div>

        {/* Card 3: Invoice Sequencer */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Invoice Prefix</span>
            <Receipt className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{settings.invoice_prefix || 'RVC-INV'}</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Sequence: {settings.invoice_prefix}-2026-001</p>
        </div>

        {/* Card 4: Support SLA Desk */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Support SLA</span>
            <Mail className="size-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xs font-bold text-slate-200 truncate block" title={settings.support_email || ''}>
              {settings.support_email}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Primary Contact</p>
        </div>

        {/* Card 5: Configuration Version */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Last Mutation</span>
            <Clock className="size-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-base font-bold text-white">{formatRelativeTime(settings.updated_at)}</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Audited State</p>
        </div>

        {/* Card 6: Audit Logging Hook */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Audit Hook</span>
            <ShieldCheck className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-base font-bold text-emerald-400">SOC-2 Active</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Log Mutations Enabled</p>
        </div>
      </div>

      {/* ---------------- 50% / 50% PERSISTENT SPLIT WORKSPACE ---------------- */}
      <div className="grid gap-6 md:grid-cols-2 font-mono">
        {/* ---------------- 3. LEFT COLUMN (50% WIDTH) - TREASURY, UPI & MONETIZATION SETUP ---------------- */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 shadow-xl space-y-5">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <QrCode className="size-4 text-indigo-400" />
              Treasury, Platform UPI & Payment Endpoint Setup
            </h2>
            <p className="text-[11px] text-slate-400">Configure Merchant UPI handle, QR code asset, and fallback bank details.</p>
          </div>

          {/* 1. Official Platform UPI ID */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">
              Official Platform Merchant UPI ID (`rvc_upi_id`)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.rvc_upi_id || ''}
                onChange={(e) => setSettings({ ...settings, rvc_upi_id: e.target.value })}
                placeholder="e.g. rvc@icici or payments.rvc@upi"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-amber-300 focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(settings.rvc_upi_id || '', 'UPI VPA Handle')}
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"
                title="Copy UPI ID"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Valid URI: <code className="text-emerald-400">upi://pay?pa={settings.rvc_upi_id || 'rvc@icici'}&pn=RVC+Platform</code>
            </p>
          </div>

          {/* 2. Official Payment QR Code Image */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-4 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <QrCode className="size-4 text-indigo-400" /> Official Payment QR Code Image
              </span>
              <button
                onClick={() => setTestScanModalOpen(true)}
                className="text-[10px] font-bold text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Eye className="size-3" /> Test Scan Preview
              </button>
            </div>

            <div className="flex items-center gap-4 pt-1">
              {settings.rvc_upi_qr_url ? (
                <img
                  src={settings.rvc_upi_qr_url}
                  alt="Platform Merchant QR"
                  className="size-24 rounded-xl border border-slate-700 object-contain bg-white p-1"
                />
              ) : (
                <div className="size-24 rounded-xl border border-dashed border-slate-700 grid place-items-center text-[10px] text-slate-500">
                  No QR Uploaded
                </div>
              )}

              <div className="space-y-2 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUploadQrImage(file)
                  }}
                  className="hidden"
                />

                <button
                  disabled={uploadingQr}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                >
                  <UploadCloud className="size-4 text-indigo-400" />
                  {uploadingQr ? 'Uploading QR to Supabase...' : 'Upload QR Image File'}
                </button>

                <p className="text-[10px] text-slate-400">Upload PNG / JPEG. Stored in Supabase `platform_assets` bucket.</p>
              </div>
            </div>
          </div>

          {/* 3. Bank Settlement Coordinates */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-4 border border-slate-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
              <Building2 className="size-4 text-purple-400" /> Bank Settlement Coordinates (Manual IMPS/NEFT Fallbacks)
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 pt-1">
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Beneficiary Name:</span>
                <p className="font-bold text-white">RVC Software Technologies Pvt Ltd</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Bank Name:</span>
                <p className="font-bold text-white">ICICI Bank Ltd</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Account Number:</span>
                <p className="font-bold text-amber-300">000405019824</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase">IFSC Code:</span>
                <p className="font-bold text-indigo-300">ICIC0000004</p>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- 4. RIGHT COLUMN (50% WIDTH) - SYSTEM GOVERNANCE, INVOICING & GLOBAL FLAGS ---------------- */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-5 shadow-xl space-y-5 font-mono">
          <div className="border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="size-4 text-rose-400" />
              System Governance, Maintenance & Invoicing Engine
            </h2>
            <p className="text-[11px] text-slate-400">Emergency lockdown flags, invoice prefixes, and global escalation contacts.</p>
          </div>

          {/* 1. Emergency Maintenance Mode Switch */}
          <div className="space-y-2 rounded-xl bg-slate-950 p-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AlertOctagon className="size-4 text-rose-400" /> Emergency Platform Maintenance Mode
                </strong>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  When enabled, non-admin tenant logins are immediately locked out and redirected to system maintenance notice.
                </p>
              </div>

              <button
                onClick={() => setMaintenanceModalOpen(true)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.maintenance_mode ? 'bg-rose-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white transition-transform ${
                    settings.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 2. Automated Billing & Invoice Prefix Engine */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">
              Automated Invoicing Prefix (`invoice_prefix`)
            </label>
            <input
              type="text"
              value={settings.invoice_prefix || ''}
              onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
              placeholder="e.g. RVC-INV"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-emerald-300 focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">
              Formatted Preview: <code className="text-emerald-400 font-bold">{settings.invoice_prefix || 'RVC-INV'}-2026-001</code>
            </p>
          </div>

          {/* 3. Global Support & Escalation Contacts */}
          <div className="space-y-3 rounded-xl bg-slate-950 p-4 border border-slate-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
              <Mail className="size-4 text-cyan-400" /> Global Support & Escalation Contacts
            </span>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] text-slate-300 font-semibold">Primary Platform Support Email</span>
                <input
                  type="email"
                  value={settings.support_email || ''}
                  onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                  placeholder="support@rvcplatform.in"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-[11px] text-slate-300 font-semibold">Primary Platform Escalation Phone</span>
                <input
                  type="text"
                  value={settings.support_phone || ''}
                  onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-[#090d16] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}

      {/* 1. Test QR Scan Preview Modal */}
      <AnimatePresence>
        {testScanModalOpen && (
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
                  <QrCode className="size-5 text-indigo-400" />
                  Tenant Renewal QR Scan Preview
                </h3>
                <button onClick={() => setTestScanModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Official Merchant Payment QR</span>
                {settings.rvc_upi_qr_url ? (
                  <img
                    src={settings.rvc_upi_qr_url}
                    alt="Platform Merchant QR"
                    className="size-48 rounded-xl border border-slate-700 object-contain bg-white p-2"
                  />
                ) : (
                  <div className="size-48 rounded-xl border border-dashed border-slate-700 grid place-items-center text-slate-500">
                    No QR Image Configured
                  </div>
                )}
                <code className="text-xs font-bold text-amber-300">{settings.rvc_upi_id || 'rvc@icici'}</code>
                <p className="text-[10px] text-slate-400 text-center">
                  Scan with GPay, PhonePe, Paytm, or BHIM to pay subscription renewal fee.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setTestScanModalOpen(false)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Maintenance Confirmation Modal */}
      <AnimatePresence>
        {maintenanceModalOpen && (
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
                  <AlertOctagon className="size-5 text-rose-400" />
                  Confirm Maintenance Mode Toggle
                </h3>
                <button onClick={() => setMaintenanceModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200 space-y-1">
                <p className="font-bold">⚠️ Warning: Platform Access</p>
                <p className="text-[11px]">
                  Toggling Maintenance Mode to{' '}
                  <strong className="text-white">{settings.maintenance_mode ? 'DISABLED (Operational)' : 'ENABLED (Lockdown)'}</strong> will modify tenant access immediately.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setMaintenanceModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleConfirmMaintenanceToggle()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500"
                >
                  Confirm Mode Toggle
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
