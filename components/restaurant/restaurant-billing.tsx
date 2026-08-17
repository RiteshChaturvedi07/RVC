'use client'

import { useEffect, useState } from 'react'
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
  price_monthly: number
  price_yearly: number
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
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const DEFAULT_PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter / Trial',
    price_monthly: 0,
    price_yearly: 0,
    features: [
      'Up to 5 Restaurant Tables',
      'Basic Digital QR Menu',
      'Live Order Queue',
      'Email Support',
    ],
    is_popular: false,
  },
  {
    id: 'growth',
    name: 'Growth POS (Recommended)',
    price_monthly: 799,
    price_yearly: 8990,
    features: [
      'Unlimited QR Code Tables',
      '100/100 Commercial KDS Board',
      'WhatsApp Marketing Campaigns',
      'Daily Cash & GST Reconciliation',
      'Kitchen Stock & Inventory Management',
      'Staff Email-Based RBAC Permissions',
      '24/7 Emergency Support SLA',
    ],
    is_popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pro Multi-Outlet',
    price_monthly: 1499,
    price_yearly: 14990,
    features: [
      'Multi-Branch Outlet Dashboard',
      'Custom Domain & White-Label Branding',
      'Advanced Executive BI Reports',
      'Dedicated Account Manager',
      'Priority Thermal Printer Setup',
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
        <td>${req.billing_cycle === 'yearly' ? 'Annual Subscription (365 Days)' : 'Monthly Subscription (30 Days)'}</td>
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
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [utrInput, setUtrInput] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

      if (plansRes.data && plansRes.data.length > 0) {
        setPlans((plansRes.data ?? []) as Plan[])
      }

      setRequests((reqsRes.data ?? []) as PaymentRequest[])
      setPaymentSettings(paymentRes.data)
    } catch {
      // Fallback state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBillingData()
  }, [])

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
      : chosenPlan.price_yearly
    : 0

  // Submit UTR Payment Request
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

      const { error } = await db.from('subscription_payment_requests').insert({
        tenant_id: tenantId,
        plan_id: chosenPlan.id,
        amount: selectedAmount,
        billing_cycle: cycle,
        utr_reference: utrInput.trim(),
        status: 'pending',
      })

      if (error) throw error

      setChosenPlan(null)
      setUtrInput('')
      setNotice('✅ Payment submitted for verification! Your subscription will update upon admin review.')
      await loadBillingData()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to submit payment request.')
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
            Manage your SaaS plan, renew via Instant UPI QR, &amp; download tax invoice receipts.
          </p>
        </div>

        <button
          onClick={() => {
            const growth = plans.find((p) => p.is_popular) || plans[0]
            setChosenPlan(growth)
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95 shrink-0"
        >
          <Zap className="size-4" />
          <span>⚡ Upgrade / Renew Plan</span>
        </button>
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <span>Available Subscription Tiers</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Choose the ideal tier for your restaurant. Upgrade or renew anytime via Instant UPI.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === tenant?.plan_id || (plan.is_popular && !tenant?.plan_id)
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
                    🔥 Recommended
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 dark:text-white">
                        {money(plan.price_monthly)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">/ month</span>
                    </div>
                    {plan.price_yearly > 0 && (
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        Or {money(plan.price_yearly)} / year (Save 20%)
                      </p>
                    )}
                  </div>

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
                      setCycle('monthly')
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
          <table className="w-full min-w-[750px] text-left text-xs">
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
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                    #{r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {r.saas_plans?.name || 'Growth POS Plan'}
                    <span className="block text-[10px] text-slate-400 font-normal uppercase">
                      {r.billing_cycle || 'monthly'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{r.utr_reference}</td>
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

      {/* 3. INSTANT UPI PAYMENT & UTR SUBMISSION MODAL */}
      {chosenPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {chosenPlan.name} Subscription
                </h3>
              </div>
              <button
                onClick={() => setChosenPlan(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Cycle Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setCycle('monthly')}
                className={`py-2 rounded-lg transition-all ${
                  cycle === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Monthly ({money(chosenPlan.price_monthly)})
              </button>
              <button
                type="button"
                onClick={() => setCycle('yearly')}
                className={`py-2 rounded-lg transition-all ${
                  cycle === 'yearly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Yearly ({money(chosenPlan.price_yearly)}) 🌟
              </button>
            </div>

            <div className="text-center rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Amount Due</span>
              <b className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
                {money(selectedAmount)}
              </b>
            </div>

            {/* UPI QR Container */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              {paymentSettings?.rvc_upi_qr_url ? (
                <img
                  src={paymentSettings.rvc_upi_qr_url}
                  alt="RVC Platform Official UPI QR"
                  className="mx-auto size-44 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-1"
                />
              ) : (
                <div className="mx-auto size-40 grid place-items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                  <QrCode className="size-28 text-slate-700 dark:text-slate-300" />
                </div>
              )}

              {/* Copyable UPI ID Pill */}
              <div
                onClick={handleCopyUpi}
                className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:border-primary transition-colors shadow-xs"
              >
                <span>UPI: {paymentSettings?.rvc_upi_id || 'rvcpay@okaxis'}</span>
                {copiedUpi ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5 text-slate-400" />
                )}
              </div>
            </div>

            {/* UTR Input Form */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                12-Digit UTR / Transaction Reference Number *
              </label>
              <input
                type="text"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                placeholder="e.g. 423910582910"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-sm font-mono font-black text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Submit & Contact Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmitPayment()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 px-4 py-3 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95"
              >
                {isSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                <span>Submit UTR for Verification</span>
              </button>

              <a
                href={`https://wa.me/919876543210?text=${encodeURIComponent(
                  `Hello Billing Support! I have completed payment of ${money(selectedAmount)} for ${chosenPlan.name}. UTR: ${utrInput || 'Pending'}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
              >
                <MessageCircle className="size-4 text-emerald-600" />
                <span>💬 Contact Billing Support on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
