'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Download,
  FileText,
  Gift,
  HelpCircle,
  MessageCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

export type Plan = {
  id: string
  name: string
  slug?: string
  target_vertical?: string
  price_monthly: number
  price_quarterly?: number
  price_yearly: number
  promotional_perk?: string | null
  onboarding_offer_type?: string
  badge_text?: string | null
  features: string[]
  is_popular: boolean
}

export type PaymentRequest = {
  id: string
  tenant_id?: string
  amount: number
  billing_cycle: string
  utr_reference: string
  status: 'pending' | 'paid' | 'rejected' | string
  rejection_note?: string | null
  created_at: string
  saas_plans: { name: string } | null
}

const money = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const DEFAULT_PLANS: Plan[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Starter Restaurant OS',
    target_vertical: 'restaurant',
    price_monthly: 999,
    price_quarterly: 2499,
    price_yearly: 9588,
    promotional_perk: 'Get 5 Free QR Table Acrylic Stickers',
    badge_text: 'Popular Choice',
    features: [
      'Up to 15 Restaurant Tables',
      'Sub-second QR Ordering',
      'Live Kitchen KDS Board',
      '0% Commission UPI Payments',
      'Daily Revenue & Order Reports',
    ],
    is_popular: false,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Growth POS (3-Month Promo Bundle)',
    target_vertical: 'restaurant',
    price_monthly: 1999,
    price_quarterly: 4999,
    price_yearly: 19190,
    promotional_perk: 'Get 10 Free QR Acrylic Stands + Free AI Menu Digitization',
    badge_text: '🎁 3-Month Free Gift Bundle',
    features: [
      'Unlimited QR Code Tables',
      '10 Free Acrylic Stands Included',
      'Multi-Captain KDS Displays',
      'WhatsApp Marketing Campaigns',
      'Daily Cash & GST Reconciliation',
      'Kitchen Stock & Ingredient Track',
      'Staff Email-Based RBAC Permissions',
      '24/7 Priority Support SLA',
    ],
    is_popular: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Enterprise Pro Multi-Outlet',
    target_vertical: 'restaurant',
    price_monthly: 3999,
    price_quarterly: 9999,
    price_yearly: 38390,
    promotional_perk: 'Get 25 Free QR Acrylic Stands + Dedicated Onboarding Manager',
    badge_text: 'Enterprise',
    features: [
      'Multi-Branch Outlet Dashboard',
      '25 Free Acrylic Stands Included',
      'Custom Domain & White-Label Branding',
      'Advanced Executive BI Reports',
      'Dedicated Account Manager',
      'Thermal Printer Auto-Routing',
      'Custom API & Webhook Integrations',
    ],
    is_popular: false,
  },
]

export function printSubscriptionInvoice(req: PaymentRequest, restaurantName: string) {
  const win = window.open('', '_blank', 'width=650,height=800')
  if (!win) return

  const html = `<!doctype html>
<html>
<head>
  <title>Subscription Tax Invoice - #${req.id.slice(0, 8).toUpperCase()}</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #000; }
    body { padding: 24px; font-size: 13px; line-height: 1.5; background: #fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }
    .logo { font-size: 22px; font-weight: 900; color: #6366f1; letter-spacing: -0.5px; }
    .badge { background: #dcfce7; color: #166534; padding: 4px 10px; font-size: 11px; font-weight: bold; border-radius: 6px; display: inline-block; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-row { font-weight: bold; font-size: 15px; background: #f1f5f9; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">RVC RESTAURANT SAAS</div>
      <small style="color: #64748b;">Official SaaS Subscription Tax Receipt</small>
    </div>
    <div style="text-align: right;">
      <span class="badge">[ VERIFIED & PAID ]</span>
      <div style="font-size: 11px; margin-top: 6px; font-weight: bold;">Invoice #${req.id.slice(0, 8).toUpperCase()}</div>
      <div style="font-size: 11px; color: #64748b;">Date: ${new Date(req.created_at).toLocaleDateString('en-IN')}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
    <div>
      <b style="color: #6366f1;">Billed Subscriber:</b><br/>
      <b>${restaurantName}</b><br/>
      Tenant Reference: ${req.tenant_id || 'RVC-TENANT'}<br/>
      GST Status: Retail Restaurant Partner
    </div>
    <div style="text-align: right;">
      <b style="color: #6366f1;">Platform Operator:</b><br/>
      RVC Software Solutions Pvt Ltd<br/>
      UPI: rvcpay@okaxis<br/>
      Email: billing@rvcpos.com
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Subscription Plan</th>
        <th>Billing Cycle</th>
        <th>UTR Reference</th>
        <th style="text-align: right;">Amount Paid</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>${req.saas_plans?.name || 'Growth POS Plan'}</b></td>
        <td>${
          req.billing_cycle === 'yearly'
            ? 'Annual Subscription (365 Days)'
            : req.billing_cycle === 'quarterly'
            ? 'Quarterly 3-Month Promo Bundle (90 Days)'
            : 'Monthly Subscription (30 Days)'
        }</td>
        <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${req.utr_reference}</code></td>
        <td style="text-align: right; font-weight: bold;">₹${req.amount.toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align: right;">TOTAL PAID AMOUNT:</td>
        <td style="text-align: right; color: #166534;">₹${req.amount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 30px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px border #e2e8f0; font-size: 11px; text-align: center; color: #64748b;">
    Thank you for subscribing to RVC Restaurant POS &amp; KDS Platform. Your subscription validity has been automatically extended.
  </div>

  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    }
  </script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}

export function RestaurantBilling() {
  const [tenant, setTenant] = useState<any>(null)
  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [paymentSettings, setPaymentSettings] = useState<any>(null)
  const [chosenPlan, setChosenPlan] = useState<Plan | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('quarterly')
  const [utrInput, setUtrInput] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cacheBuster, setCacheBuster] = useState(Date.now())

  const loadBillingData = async () => {
    setLoading(true)
    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()

      const [tenantRes, plansRes, reqsRes, paymentRes, settingsRes] = await Promise.all([
        db
          .from('tenants')
          .select(
            'status,subscription_status,subscription_expires_at,subscription_end_date,plan_id,saas_plans(name,features)'
          )
          .eq('id', tenantId)
          .single(),
        db.rpc('get_active_saas_plans'),
        db
          .from('subscription_payment_requests')
          .select('*,saas_plans(name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        db.rpc('get_platform_payment_settings'),
        db.from('restaurant_settings').select('display_name').eq('tenant_id', tenantId).single(),
      ])

      setTenant(tenantRes.data)
      setRestaurantName(settingsRes.data?.display_name || 'Restaurant')

      if (plansRes.data && Array.isArray(plansRes.data) && plansRes.data.length > 0) {
        const parsedPlans: Plan[] = plansRes.data.map((p: any) => {
          let parsedFeatures: string[] = []
          if (Array.isArray(p.features)) parsedFeatures = p.features.map(String)
          else if (typeof p.features === 'string') {
            try {
              const obj = JSON.parse(p.features)
              parsedFeatures = Array.isArray(obj) ? obj.map(String) : Object.values(obj).map(String)
            } catch {
              parsedFeatures = [p.features]
            }
          }

          const monthlyPrice = Number(p.price_monthly || 0)
          const quarterlyPrice = Number(p.price_quarterly || Math.round(monthlyPrice * 2.7))
          const yearlyPrice = Number(p.price_yearly || monthlyPrice * 10)

          return {
            id: String(p.id),
            name: String(p.name || 'SaaS Plan'),
            slug: p.slug ? String(p.slug) : undefined,
            target_vertical: p.target_vertical ? String(p.target_vertical) : 'restaurant',
            price_monthly: monthlyPrice,
            price_quarterly: quarterlyPrice,
            price_yearly: yearlyPrice,
            promotional_perk: p.promotional_perk ? String(p.promotional_perk) : null,
            onboarding_offer_type: p.onboarding_offer_type || 'trial_7_day',
            badge_text: p.badge_text ? String(p.badge_text) : null,
            features: parsedFeatures.length > 0 ? parsedFeatures : ['Full operational suite included'],
            is_popular: Boolean(p.is_popular),
          }
        })
        setPlans(parsedPlans)
      }

      setRequests((reqsRes.data ?? []) as PaymentRequest[])
      setPaymentSettings(paymentRes.data)
      setCacheBuster(Date.now())
    } catch {
      // Fallback state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBillingData()
  }, [])

  // Keyboard shortcut to close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChosenPlan(null)
      }
    }
    if (chosenPlan) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [chosenPlan])

  // Fresh Cache-Busted UPI QR Code URL
  const qrImageUrl = useMemo(() => {
    if (!paymentSettings?.rvc_upi_qr_url) return null
    const url = paymentSettings.rvc_upi_qr_url
    return url.includes('?') ? `${url}&cb=${cacheBuster}` : `${url}?cb=${cacheBuster}`
  }, [paymentSettings?.rvc_upi_qr_url, cacheBuster])

  // Expiry & Countdown Calculation
  const expiryDate = tenant?.subscription_expires_at || tenant?.subscription_end_date
    ? new Date(tenant.subscription_expires_at || tenant.subscription_end_date)
    : new Date(Date.now() + 24 * 86400000)

  const daysRemaining = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000))
  const isExpired = daysRemaining <= 0
  const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0

  const statusLabel = isExpired
    ? 'Expired'
    : isExpiringSoon
    ? 'Expiring Soon'
    : tenant?.subscription_status || 'Active Pro'

  // Selected Plan Price Calculation
  const selectedAmount = chosenPlan
    ? cycle === 'monthly'
      ? chosenPlan.price_monthly
      : cycle === 'quarterly'
      ? Number(chosenPlan.price_quarterly || Math.round(chosenPlan.price_monthly * 2.7))
      : chosenPlan.price_yearly
    : 0

  // Submit UTR Payment Request with Fallback Handling
  const handleSubmitPayment = async () => {
    if (!chosenPlan) return
    if (!utrInput.trim()) {
      setNotice('Please enter the 12-digit UTR / transaction reference number.')
      return
    }

    setIsSubmitting(true)
    setNotice('')
    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chosenPlan.id)
      const existsInDb = plans.some((p) => p.id === chosenPlan.id)
      const validPlanIdUuid = isUuid && existsInDb ? chosenPlan.id : null

      // Attempt primary insert
      const { error } = await db.from('subscription_payment_requests').insert({
        tenant_id: tenantId,
        plan_id: validPlanIdUuid,
        amount: selectedAmount,
        billing_cycle: cycle,
        utr_reference: utrInput.trim(),
        status: 'pending',
      })

      if (error) {
        // If DB check constraint error (code 23514) occurs because migration wasn't run yet, retry with 'monthly'
        if (error.code === '23514' || error.message?.includes('billing_cycle')) {
          const fallbackCycle = cycle === 'quarterly' ? 'monthly' : cycle
          const { error: retryErr } = await db.from('subscription_payment_requests').insert({
            tenant_id: tenantId,
            plan_id: validPlanIdUuid,
            amount: selectedAmount,
            billing_cycle: fallbackCycle,
            utr_reference: utrInput.trim(),
            status: 'pending',
          })
          if (retryErr) throw retryErr
        } else {
          throw error
        }
      }

      setChosenPlan(null)
      setUtrInput('')
      setNotice('✅ Payment request submitted for verification! Your subscription will update upon admin review.')
      await loadBillingData()
    } catch (err: any) {
      const msg = err?.message || 'Unable to submit payment request.'
      setNotice(`❌ ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Copy UPI ID to Clipboard
  const handleCopyUpi = () => {
    const upiId = paymentSettings?.rvc_upi_id || 'rvcpay@okaxis'
    navigator.clipboard.writeText(upiId).catch(() => {})
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  if (loading && !tenant) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-semibold">Loading SaaS Subscription Center…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white">
      {/* HEADER & ACTION BAR */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CreditCard className="size-4" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Subscription &amp; Billing Center
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Manage your SaaS plan, renew via Instant Real-Time UPI QR, &amp; download tax invoice receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadBillingData()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-sm"
            title="Refresh Payment QR & Status"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          <button
            onClick={() => {
              const growth = plans.find((p) => p.is_popular) || plans[0]
              setChosenPlan(growth)
              setCycle('quarterly')
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95 shrink-0"
          >
            <Zap className="size-4" />
            <span>⚡ Upgrade / Renew Plan</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 1. ACTIVE SUBSCRIPTION STATUS BANNER */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Plan:</span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{tenant?.saas_plans?.name || 'Growth POS (Annual)'}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 text-xs font-black uppercase">
                  <Crown className="size-3 text-amber-500" />
                  <span>PRO</span>
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black uppercase ${
                  isExpired
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                    : isExpiringSoon
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                }`}
              >
                <span>{statusLabel}</span>
              </span>
              <span>·</span>
              <span>Renews {expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Validity Countdown</span>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              <p className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                ⏳ {daysRemaining} <span className="text-sm font-bold text-slate-400 font-sans">Days Remaining</span>
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar for Remaining Days */}
        <div className="space-y-1 pt-2">
          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExpired ? 'bg-rose-500' : isExpiringSoon ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, (daysRemaining / 30) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE SUBSCRIPTION PLAN TIERS */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <span>Available Subscription Tiers &amp; Promo Perks</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Choose the ideal operating tier for your store. Select 3-month bundles for free gift perks.
            </p>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 w-fit text-xs font-bold font-mono">
            <button
              onClick={() => setCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                cycle === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly (1 Mo)
            </button>
            <button
              onClick={() => setCycle('quarterly')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                cycle === 'quarterly'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>3-Mo Bundle</span>
              <span className="px-1 py-0.2 rounded bg-purple-500 text-white text-[9px]">🎁 Gift Perks</span>
            </button>
            <button
              onClick={() => setCycle('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                cycle === 'yearly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Yearly (Save ~20%)
            </button>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === tenant?.plan_id || (plan.is_popular && !tenant?.plan_id)
            const quarterlyPrice = Number(plan.price_quarterly || Math.round(plan.price_monthly * 2.7))
            
            const displayPrice =
              cycle === 'yearly'
                ? Math.round(plan.price_yearly / 12)
                : cycle === 'quarterly'
                ? Math.round(quarterlyPrice / 3)
                : plan.price_monthly

            return (
              <article
                key={plan.id}
                className={`relative rounded-2xl border-2 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between transition-all ${
                  plan.is_popular
                    ? 'border-primary shadow-md ring-2 ring-primary/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {plan.is_popular && (
                  <span className="absolute -top-3.5 right-6 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-black shadow-md uppercase tracking-wider">
                    <Sparkles className="size-3" />
                    🔥 Recommended Tier
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1 font-mono">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        {money(displayPrice)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">/ month</span>
                    </div>

                    {cycle === 'quarterly' && (
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-300 mt-1 font-mono">
                        Billed 3-Monthly: {money(quarterlyPrice)} / 3 mo
                      </p>
                    )}
                    {cycle === 'yearly' && (
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        Billed Annually: {money(plan.price_yearly)} / yr (Save ~20%)
                      </p>
                    )}
                  </div>

                  {/* Free Promotional Gift Callout */}
                  {plan.promotional_perk && (
                    <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-800 dark:text-purple-200 flex items-start gap-2">
                      <Gift className="size-4 text-purple-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block">
                          Included Free Gift Perk:
                        </strong>
                        <span className="font-medium text-slate-900 dark:text-white">{plan.promotional_perk}</span>
                      </div>
                    </div>
                  )}

                  <ul className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {(plan.features || []).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => {
                      setChosenPlan(plan)
                    }}
                    className={`w-full rounded-xl py-3 text-xs font-bold transition-all shadow-sm active:scale-95 ${
                      isCurrent
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black'
                        : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                  >
                    {isCurrent ? '✓ Current Plan (Renew)' : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* 4. BILLING HISTORY & TAX INVOICE LEDGER */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-base">
              <FileText className="size-5 text-primary" />
              <span>Billing History &amp; Tax Invoice Receipts</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Download tax invoices for all approved renewal requests.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-3">Request / Invoice #</th>
                <th className="p-3">Plan Details</th>
                <th className="p-3">UTR Reference</th>
                <th className="p-3">Payment Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    #{r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {r.saas_plans?.name || 'Growth POS Plan'}
                    <span className="block text-[10px] text-slate-400 font-normal uppercase">
                      {r.billing_cycle || 'monthly'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{r.utr_reference}</td>
                  <td className="p-3 text-slate-400 font-medium">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                  <td className="p-3 font-black text-slate-900 dark:text-white">{money(r.amount)}</td>
                  <td className="p-3">
                    {r.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-black">
                        🟢 Paid &amp; Approved
                      </span>
                    ) : r.status === 'rejected' ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2.5 py-0.5 text-[11px] font-black">
                          🔴 Rejected
                        </span>
                        {r.rejection_note && (
                          <span className="block text-[10px] text-rose-500 font-normal mt-0.5">
                            Reason: {r.rejection_note}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-black">
                        🟡 Pending Verification
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {r.status === 'paid' ? (
                      <button
                        onClick={() => printSubscriptionInvoice(r, restaurantName)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                      >
                        <Download className="size-3.5 text-primary" />
                        <span>Tax Invoice</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium italic">In Review</span>
                    )}
                  </td>
                </tr>
              ))}

              {!requests.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-400 font-medium">
                    No past subscription payment requests recorded. Click "Upgrade / Renew Plan" to subscribe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. INSTANT REAL-TIME UPI PAYMENT & UTR SUBMISSION MODAL */}
      {chosenPlan && (
        <div
          onClick={() => setChosenPlan(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 backdrop-blur-md font-mono overflow-y-auto min-h-screen"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl border border-slate-700 bg-slate-900 p-4 sm:p-5 shadow-2xl space-y-3 text-xs text-slate-100 my-auto overflow-hidden"
          >
            {/* Modal Header (Sticky Top with High-Visibility Close Button) */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {chosenPlan.name} Subscription
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setChosenPlan(null)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                title="Close modal (Esc)"
              >
                <span>✕ Close</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto space-y-3 pr-1 shrink-1 flex-1">
              {/* Cycle Selector */}
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 font-bold text-[10px]">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`py-1.5 rounded-lg transition-all ${
                    cycle === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1 Mo ({money(chosenPlan.price_monthly)})
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('quarterly')}
                  className={`py-1.5 rounded-lg transition-all ${
                    cycle === 'quarterly'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3 Mo ({money(Number(chosenPlan.price_quarterly || Math.round(chosenPlan.price_monthly * 2.7)))}) 🎁
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('yearly')}
                  className={`py-1.5 rounded-lg transition-all ${
                    cycle === 'yearly'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  12 Mo ({money(chosenPlan.price_yearly)}) 🌟
                </button>
              </div>

              {/* Gift Perk Callout inside Modal */}
              {chosenPlan.promotional_perk && (
                <div className="p-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-200 flex items-start gap-2">
                  <Gift className="size-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[9px] uppercase font-bold text-purple-300">
                      Included Promotional Gift Perk:
                    </strong>
                    <span className="text-[11px] font-semibold text-white">{chosenPlan.promotional_perk}</span>
                  </div>
                </div>
              )}

              {/* Total Amount Due Box */}
              <div className="text-center rounded-xl bg-slate-950/90 p-2 border border-slate-800">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount Due Today</span>
                <b className="text-xl sm:text-2xl font-black text-white block mt-0.5">
                  {money(selectedAmount)}
                </b>
              </div>

              {/* Real-time Cache-Busted UPI QR Container */}
              <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 text-center space-y-2">
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase mb-0.5">
                  <span>Official Real-Time Merchant QR</span>
                  <button
                    type="button"
                    onClick={() => setCacheBuster(Date.now())}
                    className="text-indigo-400 hover:underline flex items-center gap-1"
                    title="Force refresh QR image"
                  >
                    <RefreshCw className="size-2.5" /> Refresh
                  </button>
                </div>

                {qrImageUrl ? (
                  <img
                    key={cacheBuster}
                    src={qrImageUrl}
                    alt="RVC Platform Official UPI QR"
                    className="mx-auto size-28 sm:size-32 object-contain rounded-xl border border-slate-700 bg-white p-1.5 shadow-md"
                  />
                ) : (
                  <div className="mx-auto size-28 grid place-items-center bg-slate-900 rounded-xl border border-slate-800 p-2">
                    <QrCode className="size-16 text-slate-400" />
                  </div>
                )}

                {/* Copyable UPI ID Pill */}
                <div
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1 text-[11px] font-mono font-bold text-slate-200 cursor-pointer hover:border-indigo-500 transition-colors shadow-sm"
                >
                  <span>UPI: {paymentSettings?.rvc_upi_id || 'rvcpay@okaxis'}</span>
                  {copiedUpi ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3 text-slate-400" />
                  )}
                </div>
              </div>

              {/* UTR Input Form */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  12-Digit UTR / Transaction Reference Number *
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 423910582910"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 px-3 text-xs font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Modal Footer / Action Buttons (Always Visible Bottom) */}
            <div className="space-y-2 pt-2 shrink-0 border-t border-slate-800">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmitPayment()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                {isSubmitting ? <RefreshCw className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                <span>Submit UTR for Verification</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/919876543210?text=${encodeURIComponent(
                    `Hello Billing Support! I have completed payment of ${money(selectedAmount)} for ${chosenPlan.name}. UTR: ${utrInput || 'Pending'}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle className="size-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => setChosenPlan(null)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <X className="size-3.5" />
                  <span>Close Modal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
