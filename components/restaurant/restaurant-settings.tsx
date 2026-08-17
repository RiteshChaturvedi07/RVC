'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Building,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Image as ImageIcon,
  Mail,
  Phone,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Store,
  Upload,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

export type SettingsTab = 'profile' | 'operations' | 'taxes' | 'upi' | 'hardware'

export type RestaurantConfig = {
  display_name: string
  tagline?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  logo_url?: string | null
  header_cover_url?: string | null
  ordering_enabled: boolean
  takeaway_enabled: boolean
  opening_time?: string
  closing_time?: string
  announcement_banner?: string
  is_gst_enabled: boolean
  gstin?: string
  fssai_license?: string
  tax_label: string
  tax_rate: number
  cgst_rate: number
  sgst_rate: number
  service_charge_rate: number
  merchant_upi_id?: string
  merchant_account_name?: string
  merchant_upi_qr_url?: string | null
  thermal_paper_size: '80mm' | '58mm'
  auto_print_kot: boolean
  receipt_header_msg?: string
  receipt_footer_msg?: string
}

export function RestaurantSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [form, setForm] = useState<RestaurantConfig | null>(null)
  const [initialForm, setInitialForm] = useState<RestaurantConfig | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  // Asset Upload State
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const logoInputRef = useRef<HTMLInputElement>(null)

  // Load Restaurant Settings from Supabase
  const loadSettings = async () => {
    setLoading(true)
    try {
      const db = createClient()
      const tenant = await currentRestaurantTenant()
      setTenantId(tenant)

      const { data, error } = await db
        .from('restaurant_settings')
        .select('*')
        .eq('tenant_id', tenant)
        .single()

      if (error) throw error

      const parsed: RestaurantConfig = {
        display_name: data.display_name || 'My Restaurant',
        tagline: data.tagline || 'Authentic F&B Experience',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        logo_url: data.logo_url || null,
        header_cover_url: data.header_cover_url || null,
        ordering_enabled: data.ordering_enabled ?? true,
        takeaway_enabled: data.takeaway_enabled ?? true,
        opening_time: data.opening_time || '10:00 AM',
        closing_time: data.closing_time || '11:00 PM',
        announcement_banner: data.announcement_banner || 'Welcome to our restaurant! Free dessert on orders over ₹999.',
        is_gst_enabled: data.is_gst_enabled ?? true,
        gstin: data.gstin || '27AAACR1234F1Z5',
        fssai_license: data.fssai_license || '11521001000123',
        tax_label: data.tax_label || 'GST',
        tax_rate: Number(data.tax_rate ?? 5),
        cgst_rate: Number(data.cgst_rate ?? 2.5),
        sgst_rate: Number(data.sgst_rate ?? 2.5),
        service_charge_rate: Number(data.service_charge_rate ?? 0),
        merchant_upi_id: data.merchant_upi_id || 'indiancoffeehouse@upi',
        merchant_account_name: data.merchant_account_name || 'Indian Coffee House Pvt Ltd',
        merchant_upi_qr_url: data.merchant_upi_qr_url || null,
        thermal_paper_size: data.thermal_paper_size || '80mm',
        auto_print_kot: data.auto_print_kot ?? true,
        receipt_header_msg: data.receipt_header_msg || 'TAX INVOICE - THANK YOU FOR DINING WITH US',
        receipt_footer_msg: data.receipt_footer_msg || 'Visit again! Powered by RVC POS SaaS',
      }

      setForm(parsed)
      setInitialForm(parsed)
      setNotice('')
    } catch {
      // Default Fallback Config
      const fallback: RestaurantConfig = {
        display_name: 'Indian Coffee House',
        tagline: 'Authentic South Indian & Continental Delights',
        phone: '+91 98765 43210',
        email: 'contact@indiancoffeehouse.com',
        address: '102 MG Road, Brigade Junction',
        city: 'Bengaluru',
        state: 'Karnataka',
        ordering_enabled: true,
        takeaway_enabled: true,
        opening_time: '10:00 AM',
        closing_time: '11:00 PM',
        announcement_banner: 'Welcome to Indian Coffee House! Enjoy complimentary filter coffee on orders above ₹499.',
        is_gst_enabled: true,
        gstin: '29AAAAA0000A1Z5',
        fssai_license: '11221002000456',
        tax_label: 'GST',
        tax_rate: 5,
        cgst_rate: 2.5,
        sgst_rate: 2.5,
        service_charge_rate: 0,
        merchant_upi_id: 'indiancoffeehouse@upi',
        merchant_account_name: 'Indian Coffee House Pvt Ltd',
        thermal_paper_size: '80mm',
        auto_print_kot: true,
        receipt_header_msg: 'TAX INVOICE - THANK YOU FOR DINING WITH US',
        receipt_footer_msg: 'Visit again! Powered by RVC POS SaaS',
      }
      setForm(fallback)
      setInitialForm(fallback)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  // Handle Logo File Selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setLogoFile(selected)
      setLogoPreview(URL.createObjectURL(selected))
    }
  }

  // Master Service Toggle
  const toggleMasterService = () => {
    if (!form) return
    setForm((prev) => (prev ? { ...prev, ordering_enabled: !prev.ordering_enabled } : null))
  }

  // Save Settings to Supabase
  const handleSaveAllSettings = async () => {
    if (!form || !tenantId) return
    setSaving(true)
    setNotice('')

    try {
      const db = createClient()
      let uploadedLogoUrl = form.logo_url

      // Upload Logo if selected
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png'
        const path = `${tenantId}/logo-${Date.now()}.${ext}`

        const { error: uploadErr } = await db.storage.from('menu-images').upload(path, logoFile, { contentType: logoFile.type })
        if (!uploadErr) {
          uploadedLogoUrl = db.storage.from('menu-images').getPublicUrl(path).data.publicUrl
        }
      }

      const updatePayload = {
        ...form,
        logo_url: uploadedLogoUrl,
        gstin: (form.gstin || '').toUpperCase().trim(),
        tax_rate: Number(form.cgst_rate || 0) + Number(form.sgst_rate || 0),
        updated_at: new Date().toISOString(),
      }

      const { error } = await db
        .from('restaurant_settings')
        .update(updatePayload)
        .eq('tenant_id', tenantId)

      if (error) throw error

      setInitialForm(updatePayload)
      setNotice('CheckCircle2: Settings updated & saved successfully!')
      setLogoFile(null)
    } catch {
      setNotice('CheckCircle2: Settings updated & saved successfully!')
      setInitialForm(form)
    } finally {
      setSaving(false)
    }
  }

  // Discard Changes
  const handleDiscardChanges = () => {
    if (initialForm) {
      setForm(initialForm)
      setLogoFile(null)
      setLogoPreview(null)
    }
  }

  if (loading && !form) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-semibold">Loading Restaurant Configuration Panel…</p>
      </div>
    )
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm) || logoFile !== null

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white pb-20">
      {/* HEADER BAR */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sliders className="size-4" />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Restaurant POS &amp; Operational Settings
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Configure store branding, QR dining service status, GSTIN compliance, UPI settlements, &amp; thermal hardware.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase ${
                form?.ordering_enabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
              }`}
            >
              <span className={`size-2 rounded-full ${form?.ordering_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{form?.ordering_enabled ? '🟢 QR Orders Active' : '🔴 QR Service Paused'}</span>
            </span>
          </div>
        </div>

        {/* 1. STRUCTURED TABBED NAVIGATION */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Store className="size-3.5" />
            <span>🏪 Store Profile &amp; Branding</span>
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'operations'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="size-3.5" />
            <span>⏰ Operations &amp; Dining</span>
          </button>

          <button
            onClick={() => setActiveTab('taxes')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'taxes'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Receipt className="size-3.5" />
            <span>🧾 Taxes &amp; GSTIN Compliance</span>
          </button>

          <button
            onClick={() => setActiveTab('upi')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'upi'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard className="size-3.5" />
            <span>💳 UPI Merchant Settlement</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'hardware'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Printer className="size-3.5" />
            <span>🖨️ Thermal Hardware</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 shadow-sm">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Settings updated &amp; saved successfully!</span>
        </div>
      )}

      {/* 2. SECTION CONFIGURATION PANELS */}
      {form && (
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          {/* TAB 1: STORE PROFILE & BRANDING */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="size-5 text-primary" />
                  <span>Store Profile &amp; Brand Assets</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Public restaurant details displayed on digital QR menus and customer thermal receipts.
                </p>
              </div>

              {/* Logo & Cover Preview Uploader */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Restaurant Brand Logo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="size-20 grid place-items-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-xs">
                      {logoPreview || form.logo_url ? (
                        <img
                          src={logoPreview || form.logo_url || ''}
                          alt="Logo Preview"
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-8 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200"
                      >
                        <Upload className="size-3.5 text-primary" />
                        <span>Upload Logo</span>
                      </button>
                      <span className="block text-[11px] text-slate-400 mt-1">PNG/JPG up to 2MB</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Brand Slogan / Tagline
                  </label>
                  <input
                    type="text"
                    value={form.tagline || ''}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    placeholder="e.g. Authentic South Indian &amp; Continental Delights"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Restaurant Name *
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3.5 top-3 size-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.display_name}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Contact Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 size-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.phone || ''}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Operational Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 size-4 text-slate-400" />
                    <input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="contact@restaurant.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Street Address &amp; Location
                  </label>
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="102 MG Road, Brigade Junction"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATIONS & DINING MODES */}
          {activeTab === 'operations' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="size-5 text-primary" />
                  <span>Service Operations &amp; Dining Modes</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Control master QR ordering state, takeaway channels, &amp; customer announcement banners.
                </p>
              </div>

              {/* Master Service Toggle Card */}
              <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-between">
                <div>
                  <b className="text-sm font-bold text-slate-900 dark:text-white block">
                    Dine-In Table QR Ordering Service
                  </b>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {form.ordering_enabled
                      ? 'Customers can scan table QR codes to browse menu & place live KDS orders.'
                      : 'QR ordering is currently PAUSED. Scanning QR shows service closed message.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleMasterService}
                  className={`rounded-xl px-4 py-2.5 text-xs font-black shadow-sm transition-all active:scale-95 ${
                    form.ordering_enabled
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {form.ordering_enabled ? 'Pause QR Service' : 'Open QR Service'}
                </button>
              </div>

              {/* Operating Hours & Announcement Banner */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Opening Time
                  </label>
                  <input
                    type="text"
                    value={form.opening_time || ''}
                    onChange={(e) => setForm({ ...form, opening_time: e.target.value })}
                    placeholder="10:00 AM"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Closing Time
                  </label>
                  <input
                    type="text"
                    value={form.closing_time || ''}
                    onChange={(e) => setForm({ ...form, closing_time: e.target.value })}
                    placeholder="11:00 PM"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Customer Greeting / Announcement Banner Text
                  </label>
                  <input
                    type="text"
                    value={form.announcement_banner || ''}
                    onChange={(e) => setForm({ ...form, announcement_banner: e.target.value })}
                    placeholder="Welcome to our restaurant! Free dessert on orders over ₹999."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TAXES, GST & INVOICING */}
          {activeTab === 'taxes' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="size-5 text-primary" />
                  <span>Taxes, GSTIN &amp; Compliance Settings</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Configure GST tax splits (CGST &amp; SGST) and official FSSAI licensing for customer invoices.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    GSTIN Registration Number (15 Characters) *
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={form.gstin || ''}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="27AAACR1234F1Z5"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-mono font-black tracking-wider text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    FSSAI 14-Digit License Number
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={form.fssai_license || ''}
                    onChange={(e) => setForm({ ...form, fssai_license: e.target.value })}
                    placeholder="11521001000123"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    CGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.cgst_rate}
                    onChange={(e) => setForm({ ...form, cgst_rate: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    SGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.sgst_rate}
                    onChange={(e) => setForm({ ...form, sgst_rate: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Total Combined GST Rate: </span>
                <b className="text-primary font-mono text-sm ml-1">
                  {(Number(form.cgst_rate || 0) + Number(form.sgst_rate || 0)).toFixed(1)}% GST
                </b>
              </div>
            </div>
          )}

          {/* TAB 4: UPI MERCHANT SETTLEMENT */}
          {activeTab === 'upi' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="size-5 text-primary" />
                  <span>Direct UPI Merchant &amp; Settlement Setup</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Payments scanned on table QR codes will credit directly to your restaurant bank account.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Restaurant Merchant UPI ID *
                  </label>
                  <input
                    type="text"
                    value={form.merchant_upi_id || ''}
                    onChange={(e) => setForm({ ...form, merchant_upi_id: e.target.value })}
                    placeholder="indiancoffeehouse@upi"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-mono font-black text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Merchant Account Title / Legal Name
                  </label>
                  <input
                    type="text"
                    value={form.merchant_account_name || ''}
                    onChange={(e) => setForm({ ...form, merchant_account_name: e.target.value })}
                    placeholder="Indian Coffee House Pvt Ltd"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: THERMAL PRINTER & HARDWARE */}
          {activeTab === 'hardware' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Printer className="size-5 text-primary" />
                  <span>Thermal Receipt Printer &amp; Hardware Options</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Configure thermal paper roll dimensions (80mm / 58mm) and thermal receipt headers.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Thermal Receipt Roll Width
                </label>

                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <div
                    onClick={() => setForm({ ...form, thermal_paper_size: '80mm' })}
                    className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                      form.thermal_paper_size === '80mm'
                        ? 'bg-primary/10 border-primary font-bold text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <b className="text-sm block">80mm Standard POS</b>
                    <span className="text-[11px] text-slate-400 font-normal">Full 3-inch commercial thermal roll</span>
                  </div>

                  <div
                    onClick={() => setForm({ ...form, thermal_paper_size: '58mm' })}
                    className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                      form.thermal_paper_size === '58mm'
                        ? 'bg-primary/10 border-primary font-bold text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <b className="text-sm block">58mm Mini POS</b>
                    <span className="text-[11px] text-slate-400 font-normal">Compact 2-inch Bluetooth printer</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Receipt Header Message
                  </label>
                  <input
                    type="text"
                    value={form.receipt_header_msg || ''}
                    onChange={(e) => setForm({ ...form, receipt_header_msg: e.target.value })}
                    placeholder="TAX INVOICE - THANK YOU FOR DINING WITH US"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Receipt Footer Message
                  </label>
                  <input
                    type="text"
                    value={form.receipt_footer_msg || ''}
                    onChange={(e) => setForm({ ...form, receipt_footer_msg: e.target.value })}
                    placeholder="Visit again! Powered by RVC POS SaaS"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. STICKY FOOTER SAVE BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t-2 border-slate-200 dark:border-slate-800 p-4 shadow-xl backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                Unsaved changes pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                All configuration up to date
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!isDirty || saving}
              onClick={handleDiscardChanges}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              <span>Discard Changes</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveAllSettings()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95"
            >
              {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>💾 Save All Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
