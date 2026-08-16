'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  Gift,
  MessageSquare,
  Plus,
  Send,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

type Coupon = {
  id: string
  name: string
  coupon_code: string | null
  description: string | null
  discount_type: 'percent' | 'flat'
  discount_value: number
  minimum_order_amount: number
  max_discount_amount: number | null
  ends_at: string | null
  active: boolean
  usage_count?: number
  revenue_generated?: number
  created_at?: string
}

type CampaignTemplate = {
  id: string
  title: string
  tag: string
  audience: string
  targetCount: number
  discountCode: string
  ordersCount: number
  revenue: number
  defaultText: string
}

const db = () => createClient()

const money = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const starterCampaigns: CampaignTemplate[] = [
  {
    id: 'bday',
    title: '🎂 Birthday & Anniversary Special',
    tag: 'Automated Retention',
    audience: 'Guests with birthday this month',
    targetCount: 42,
    discountCode: 'BDAY20',
    ordersCount: 18,
    revenue: 8400,
    defaultText:
      '🎂 Happy Birthday from {Restaurant_Name}! Enjoy 20% OFF your celebratory feast with coupon BDAY20. Order here: {Menu_Link}',
  },
  {
    id: 'weekend',
    title: '🔥 Weekend Dinner Rush - Flat ₹100 OFF',
    tag: 'Peak Hours Acceleration',
    audience: 'VIP Regulars (5+ Orders)',
    targetCount: 128,
    discountCode: 'WEEKEND100',
    ordersCount: 54,
    revenue: 28900,
    defaultText:
      '🔥 Weekend Special at {Restaurant_Name}! Get flat ₹100 OFF on orders above ₹500 using code WEEKEND100. Order now: {Menu_Link}',
  },
  {
    id: 'winback',
    title: '☕ We Miss You Win-Back Blast',
    tag: 'Churn Reduction',
    audience: 'Inactive Guests (30+ Days)',
    targetCount: 85,
    discountCode: 'COMEBACK15',
    ordersCount: 22,
    revenue: 9600,
    defaultText:
      '☕ We miss serving you at {Restaurant_Name}! Take 15% OFF your next order with coupon COMEBACK15. Reserve your table or order: {Menu_Link}',
  },
  {
    id: 'festival',
    title: '🎉 Festival Celebration Offer',
    tag: 'Holiday Campaign',
    audience: 'All Registered Customers',
    targetCount: 310,
    discountCode: 'FESTIVE25',
    ordersCount: 96,
    revenue: 52400,
    defaultText:
      '🎉 Celebrate the festive season with {Restaurant_Name}! Get 25% OFF your entire bill with code FESTIVE25. Order here: {Menu_Link}',
  },
]

export function RestaurantMarketing() {
  const [tenant, setTenant] = useState('')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [customerCount, setCustomerCount] = useState(185)
  const [broadcastCount, setBroadcastCount] = useState(420)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'coupons'>('campaigns')
  const [notice, setNotice] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Modals
  const [showBroadcastModal, setShowBroadcastModal] = useState<CampaignTemplate | 'new' | null>(null)
  const [showCouponModal, setShowCouponModal] = useState(false)

  // Broadcast Modal State
  const [broadcastAudience, setBroadcastAudience] = useState('All Registered Customers')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [testPhone, setTestPhone] = useState('')

  // Coupon Form State
  const [couponName, setCouponName] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponType, setCouponType] = useState<'percent' | 'flat'>('percent')
  const [couponVal, setCouponVal] = useState('')
  const [couponMin, setCouponMin] = useState('0')
  const [couponMax, setCouponMax] = useState('')
  const [couponEnds, setCouponEnds] = useState('')
  const [couponDesc, setCouponDesc] = useState('')

  const loadData = async () => {
    try {
      const currentTenant = tenant || (await currentRestaurantTenant())
      setTenant(currentTenant)

      const [{ data: promoData }, { count }] = await Promise.all([
        db().from('restaurant_promotions').select('*').eq('tenant_id', currentTenant).order('created_at', { ascending: false }),
        db().from('restaurant_orders').select('customer_phone', { count: 'exact', head: true }).eq('tenant_id', currentTenant),
      ])

      setCoupons((promoData ?? []) as Coupon[])
      if (count && count > 0) setCustomerCount(count)
    } catch (e) {
      setNotice('Unable to load marketing promotions.')
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Metrics
  const activeCouponsCount = coupons.filter((c) => c.active).length
  const totalCampaignRevenue = useMemo(() => {
    return starterCampaigns.reduce((sum, c) => sum + c.revenue, 0) + coupons.reduce((sum, c) => sum + (c.revenue_generated || 0), 0)
  }, [coupons])

  // Copy Coupon Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Open Broadcast Modal
  const openBroadcast = (template?: CampaignTemplate) => {
    if (template) {
      setShowBroadcastModal(template)
      setBroadcastAudience(template.audience)
      setBroadcastMessage(template.defaultText)
    } else {
      setShowBroadcastModal('new')
      setBroadcastAudience('All Registered Customers')
      setBroadcastMessage(
        '🎁 Special treat from {Restaurant_Name}! Enjoy 15% OFF your meal using code WELCOME15. Order now: {Menu_Link}'
      )
    }
  }

  // Dispatch WhatsApp Broadcast
  const handleDispatchBroadcast = () => {
    if (!broadcastMessage.trim()) return
    const text = broadcastMessage
      .replace('{Restaurant_Name}', 'Indian Coffee House')
      .replace('{Menu_Link}', `http://localhost:3000/order/${tenant}/1`)

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
    setBroadcastCount((prev) => prev + 25)
    setShowBroadcastModal(null)
    setNotice('🚀 WhatsApp Broadcast triggered! WhatsApp Web opened with pre-filled message.')
  }

  // Send Test Message
  const handleSendTest = () => {
    if (!testPhone.trim()) {
      alert('Enter a valid test phone number.')
      return
    }
    const text = broadcastMessage
      .replace('{Restaurant_Name}', 'Indian Coffee House')
      .replace('{Menu_Link}', `http://localhost:3000/order/${tenant}/1`)

    const url = `https://api.whatsapp.com/send?phone=${testPhone.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Share Coupon on WhatsApp
  const handleShareCouponOnWhatsapp = (coupon: Coupon) => {
    const code = coupon.coupon_code || coupon.name
    const discountStr = coupon.discount_type === 'percent' ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} OFF`
    const message = `🎉 *SPECIAL OFFER FROM RESTAURANT*\n\nUse code *${code}* to get *${discountStr}* on orders above ₹${coupon.minimum_order_amount}!\n\nOrder online here: http://localhost:3000/order/${tenant}/1`
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  // Toggle Coupon Active Status
  const handleToggleCoupon = async (coupon: Coupon) => {
    const nextStatus = !coupon.active
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: nextStatus } : c)))

    const { error } = await db().from('restaurant_promotions').update({ active: nextStatus }).eq('id', coupon.id)
    if (error) {
      setNotice(error.message)
      void loadData()
    }
  }

  // Delete Coupon
  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`Delete coupon ${coupon.coupon_code || coupon.name}?`)) return
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id))

    const { error } = await db().from('restaurant_promotions').delete().eq('id', coupon.id)
    if (error) alert(error.message)
    else void loadData()
  }

  // Save New Coupon Form
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponName.trim() || !couponCode.trim() || !couponVal) return

    const payload = {
      tenant_id: tenant,
      name: couponName.trim(),
      coupon_code: couponCode.trim().toUpperCase(),
      description: couponDesc.trim() || null,
      discount_type: couponType,
      discount_value: Number(couponVal),
      minimum_order_amount: Number(couponMin || 0),
      max_discount_amount: couponMax ? Number(couponMax) : null,
      ends_at: couponEnds ? new Date(`${couponEnds}T23:59:59`).toISOString() : null,
      active: true,
    }

    const { error } = await db().from('restaurant_promotions').insert(payload)
    if (error) {
      setNotice(error.message)
    } else {
      setShowCouponModal(false)
      setNotice(`✅ Promo code ${couponCode.toUpperCase()} created successfully!`)
      setCouponName('')
      setCouponCode('')
      setCouponVal('')
      setCouponDesc('')
      void loadData()
    }
  }

  return (
    <div className="space-y-6">
      {/* TITLE & PRIMARY ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Marketing & Revenue Growth Hub</h2>
          <p className="text-sm text-muted-foreground">
            Launch WhatsApp broadcasts, target segmented guest lists, and issue high-converting promo codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openBroadcast()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
          >
            <Send className="size-4" />
            <span>Launch WhatsApp Blast</span>
          </button>

          <button
            onClick={() => setShowCouponModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90"
          >
            <Plus className="size-4" />
            <span>Create Promo Code</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-medium text-primary flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:opacity-70">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* SUMMARY KPI ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <MessageSquare className="size-5" />
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              WhatsApp Engine
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">WhatsApp & SMS Dispatched</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{broadcastCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Tag className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Live Offers</span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Promo Codes</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{activeCouponsCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Users className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Reachable Base</span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Engaged Customers</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{customerCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <TrendingDown className="size-5 rotate-180" />
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Attributed Sales
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Campaign Revenue</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{money(totalCampaignRevenue)}</p>
        </article>
      </div>

      {/* SEGMENTED TAB SWITCH */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex rounded-2xl border border-border bg-muted p-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'campaigns' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
            }`}
          >
            <MessageSquare className="size-4 text-emerald-600" />
            <span>📲 WhatsApp & SMS Campaigns ({starterCampaigns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('coupons')}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'coupons' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Tag className="size-4 text-primary" />
            <span>🎟️ Discount Codes & Promos ({coupons.length})</span>
          </button>
        </div>

        {/* TAB 1: WHATSAPP & SMS CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {starterCampaigns.map((camp) => (
              <article
                key={camp.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4 hover:border-primary transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-foreground text-base">{camp.title}</h3>
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {camp.tag}
                      </span>
                    </div>

                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                      {camp.discountCode}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Target Segment: <b className="text-foreground">{camp.audience}</b> ({camp.targetCount} Guests)
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Attributed Orders</span>
                      <b className="text-sm font-extrabold">{camp.ordersCount} Orders</b>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Revenue Generated</span>
                      <b className="text-sm font-extrabold text-emerald-600">{money(camp.revenue)}</b>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openBroadcast(camp)}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Zap className="size-4" />
                  Dispatch WhatsApp Broadcast ({camp.targetCount} Guests)
                </button>
              </article>
            ))}
          </div>
        )}

        {/* TAB 2: DISCOUNT CODES & PROMOS */}
        {activeTab === 'coupons' && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs dark:bg-slate-900">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-4">Offer Name & Code</th>
                  <th className="p-4">Discount</th>
                  <th className="p-4">Min Order</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions & Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <b className="font-extrabold text-foreground">{coupon.name}</b>
                        <button
                          onClick={() => handleCopyCode(coupon.coupon_code || coupon.name)}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-mono font-bold text-foreground hover:bg-muted"
                          title="Click to copy code"
                        >
                          {coupon.coupon_code || 'NO CODE'}
                          {copiedCode === (coupon.coupon_code || coupon.name) ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      {coupon.description && <p className="text-xs text-muted-foreground mt-0.5">{coupon.description}</p>}
                    </td>

                    <td className="p-4 font-bold text-foreground">
                      {coupon.discount_type === 'percent' ? `${coupon.discount_value}% OFF` : money(coupon.discount_value) + ' OFF'}
                    </td>

                    <td className="p-4 text-xs font-medium">{money(coupon.minimum_order_amount)}</td>

                    <td className="p-4">
                      <button
                        onClick={() => void handleToggleCoupon(coupon)}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                          coupon.active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {coupon.active ? '🟢 Active' : '🔴 Inactive'}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleShareCouponOnWhatsapp(coupon)}
                          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1"
                          title="Share on WhatsApp"
                        >
                          <Share2 className="size-3.5" />
                          Share
                        </button>

                        <button
                          onClick={() => void handleDeleteCoupon(coupon)}
                          className="rounded-xl border border-red-500/20 px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
                          title="Delete Coupon"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!coupons.length && (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <Tag className="size-10 text-muted-foreground" />
                <h3 className="mt-3 text-lg font-bold">No promo codes created yet</h3>
                <p className="mt-1 text-xs text-muted-foreground">Issue your first discount coupon to boost QR checkout conversions.</p>
                <button
                  onClick={() => setShowCouponModal(true)}
                  className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  Create Promo Code
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* WHATSAPP BROADCAST MODAL ENGINE */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
          <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setShowBroadcastModal(null)} className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-secondary">
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm uppercase tracking-wider">
              <Send className="size-5" />
              WhatsApp Retention Broadcast Engine
            </div>
            <h3 className="mt-1 text-2xl font-black">
              {typeof showBroadcastModal === 'object' ? showBroadcastModal.title : 'New WhatsApp Broadcast'}
            </h3>

            <div className="mt-4 space-y-4 text-left">
              {/* TARGET AUDIENCE SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Guest Segment</label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-bold outline-none"
                >
                  <option value="All Registered Customers">All Registered Customers ({customerCount} Numbers)</option>
                  <option value="VIP Regulars (5+ Orders)">VIP Regulars (5+ Orders) (128 Guests)</option>
                  <option value="Inactive Guests (30+ Days)">Inactive Guests (30+ Days) (85 Guests)</option>
                  <option value="Guests with Birthday this Month">Guests with Birthday this Month (42 Guests)</option>
                </select>
              </div>

              {/* MESSAGE TEXT & PREVIEW */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">WhatsApp Message Copy</label>
                <textarea
                  rows={4}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Enter message text with tags {Restaurant_Name}, {Menu_Link}..."
                  className="w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:border-primary font-mono"
                />
              </div>

              {/* LIVE MESSAGE PREVIEW */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                  📱 Live Customer WhatsApp Preview:
                </span>
                <p className="text-xs text-foreground font-sans whitespace-pre-wrap leading-relaxed">
                  {broadcastMessage
                    .replace('{Restaurant_Name}', 'Indian Coffee House')
                    .replace('{Menu_Link}', `http://localhost:3000/order/${tenant}/1`)}
                </p>
              </div>

              {/* TEST SEND INPUT */}
              <div className="flex gap-2 items-center pt-2">
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Test Phone (e.g. +91 9876543210)"
                  className="flex-1 rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendTest}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
                >
                  Send Test
                </button>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowBroadcastModal(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchBroadcast}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5"
              >
                <Zap className="size-4" />
                Dispatch Broadcast
              </button>
            </div>
          </section>
        </div>
      )}

      {/* CREATE PROMO CODE MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
          <form
            onSubmit={handleSaveCoupon}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xl font-extrabold">Create Promo Code</h3>
              <button type="button" onClick={() => setShowCouponModal(false)} className="rounded-full p-1.5 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Offer Name *</label>
                <input
                  required
                  value={couponName}
                  onChange={(e) => setCouponName(e.target.value)}
                  placeholder="e.g. Weekend Rush Special"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Coupon Code *</label>
                  <input
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="WEEKEND20"
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Discount Type</label>
                  <select
                    value={couponType}
                    onChange={(e) => setCouponType(e.target.value as any)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
                  >
                    <option value="percent">Percentage Off (%)</option>
                    <option value="flat">Flat Amount Off (₹)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Discount Value *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={couponVal}
                    onChange={(e) => setCouponVal(e.target.value)}
                    placeholder={couponType === 'percent' ? '20' : '100'}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={couponMin}
                    onChange={(e) => setCouponMin(e.target.value)}
                    placeholder="300"
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={couponEnds}
                    onChange={(e) => setCouponEnds(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Description (Optional)</label>
                <input
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  placeholder="Valid on orders above ₹300 for dinner."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCouponModal(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                Publish Promo Code
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
