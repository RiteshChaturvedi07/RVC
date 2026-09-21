'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Table as TableIcon,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

type ReviewItem = {
  id: string
  order_id?: string | null
  order_number?: number | null
  table_number: string
  guest_name?: string | null
  guest_phone?: string | null
  rating: number
  tags: string[]
  comments?: string | null
  created_at: string
}

type SummaryData = {
  avg_rating: number
  total_reviews: number
  five_star_count: number
  four_star_count: number
  three_star_count: number
  two_star_count: number
  one_star_count: number
  reviews: ReviewItem[]
}

const ratingBadge: Record<number, { text: string; bg: string; textCol: string }> = {
  5: { text: '5.0 Outstanding', bg: 'bg-emerald-500/10 border-emerald-500/30', textCol: 'text-emerald-600 dark:text-emerald-400' },
  4: { text: '4.0 Very Good', bg: 'bg-emerald-500/10 border-emerald-500/20', textCol: 'text-emerald-700 dark:text-emerald-400' },
  3: { text: '3.0 Good', bg: 'bg-amber-500/10 border-amber-500/30', textCol: 'text-amber-600 dark:text-amber-400' },
  2: { text: '2.0 Below Avg', bg: 'bg-orange-500/10 border-orange-500/30', textCol: 'text-orange-600 dark:text-orange-400' },
  1: { text: '1.0 Critical', bg: 'bg-red-500/10 border-red-500/30', textCol: 'text-red-600 dark:text-red-400' },
}

export function RestaurantReviews() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRating, setFilterRating] = useState<'all' | '5' | '4' | '3' | 'critical'>('all')

  const load = async () => {
    setLoading(true)
    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()

      const { data: rpcData, error: rpcErr } = await db.rpc('get_restaurant_feedback_summary', {
        p_tenant_id: tenantId,
      })

      if (rpcErr || !rpcData) {
        // Fallback fetch if RPC signature is compiling
        const { data: rawReviews } = await db
          .from('restaurant_order_feedback')
          .select('*, restaurant_orders(order_number, customer_name, customer_phone)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        const list = (rawReviews || []).map((r: any) => ({
          id: r.id,
          order_id: r.order_id,
          order_number: r.restaurant_orders?.order_number,
          table_number: r.table_number || 'QR',
          guest_name: r.restaurant_orders?.customer_name,
          guest_phone: r.restaurant_orders?.customer_phone,
          rating: r.rating,
          tags: r.tags || [],
          comments: r.comments,
          created_at: r.created_at,
        }))

        const total = list.length
        const sumRating = list.reduce((sum: number, r: ReviewItem) => sum + r.rating, 0)
        const avg = total > 0 ? Math.round((sumRating / total) * 10) / 10 : 5.0

        setData({
          avg_rating: avg,
          total_reviews: total,
          five_star_count: list.filter((r: ReviewItem) => r.rating === 5).length,
          four_star_count: list.filter((r: ReviewItem) => r.rating === 4).length,
          three_star_count: list.filter((r: ReviewItem) => r.rating === 3).length,
          two_star_count: list.filter((r: ReviewItem) => r.rating === 2).length,
          one_star_count: list.filter((r: ReviewItem) => r.rating === 1).length,
          reviews: list,
        })
      } else {
        setData(rpcData as SummaryData)
      }
    } catch {
      // Empty fallback
      setData({
        avg_rating: 5.0,
        total_reviews: 0,
        five_star_count: 0,
        four_star_count: 0,
        three_star_count: 0,
        two_star_count: 0,
        one_star_count: 0,
        reviews: [],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Filtered reviews list
  const filteredReviews = useMemo(() => {
    if (!data?.reviews) return []
    return data.reviews.filter((r) => {
      const matchRating =
        filterRating === 'all' ||
        (filterRating === '5' && r.rating === 5) ||
        (filterRating === '4' && r.rating === 4) ||
        (filterRating === '3' && r.rating === 3) ||
        (filterRating === 'critical' && r.rating <= 2)

      const q = search.toLowerCase().trim()
      const matchQuery =
        !q ||
        (r.table_number || '').toLowerCase().includes(q) ||
        (r.guest_name || '').toLowerCase().includes(q) ||
        (r.comments || '').toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(q))

      return matchRating && matchQuery
    })
  }, [data, filterRating, search])

  const positivePercent = useMemo(() => {
    if (!data || data.total_reviews === 0) return 100
    const pos = data.five_star_count + data.four_star_count
    return Math.round((pos / data.total_reviews) * 100)
  }, [data])

  const criticalCount = useMemo(() => {
    if (!data) return 0
    return data.two_star_count + data.one_star_count
  }, [data])

  return (
    <div className="space-y-6">
      {/* HEADER BAND */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Guest Reviews & Feedback Portal
            <Sparkles className="size-6 text-amber-500" />
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor real-time guest ratings, post-meal survey tags, and manager comments.
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold shadow-2xs hover:bg-secondary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* KPI METRICS HEADER */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* AVERAGE STAR RATING */}
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="size-5 fill-amber-400" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Average Rating</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{data?.avg_rating.toFixed(1) || '5.0'}</span>
            <div className="flex items-center text-amber-400">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`size-3.5 ${
                    s <= Math.round(data?.avg_rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </article>

        {/* TOTAL REVIEWS */}
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Total Reviews</span>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-foreground">{data?.total_reviews || 0}</span>
            <span className="ml-2 text-xs font-bold text-muted-foreground">Guest submissions</span>
          </div>
        </article>

        {/* POSITIVE SATISFACTION % */}
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <ThumbsUp className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Satisfaction Rate</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{positivePercent}%</span>
            <span className="text-xs font-bold text-muted-foreground">4★ & 5★ reviews</span>
          </div>
        </article>

        {/* CRITICAL ALERTS */}
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Critical Feedback</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-red-600 dark:text-red-400">{criticalCount}</span>
            <span className="text-xs font-bold text-muted-foreground">Requires attention</span>
          </div>
        </article>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-4 shadow-2xs dark:bg-slate-900">
        {/* RATING FILTER BUTTONS */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none text-xs font-bold">
          <button
            onClick={() => setFilterRating('all')}
            className={`rounded-xl px-3.5 py-2 transition-all ${
              filterRating === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-800 shadow-2xs'
                : 'border border-border bg-background text-muted-foreground hover:bg-secondary'
            }`}
          >
            All Reviews
          </button>
          <button
            onClick={() => setFilterRating('5')}
            className={`rounded-xl px-3.5 py-2 transition-all ${
              filterRating === '5'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'border border-border bg-background text-muted-foreground hover:bg-secondary'
            }`}
          >
            5★ Outstanding ({data?.five_star_count || 0})
          </button>
          <button
            onClick={() => setFilterRating('4')}
            className={`rounded-xl px-3.5 py-2 transition-all ${
              filterRating === '4'
                ? 'bg-emerald-500 text-white shadow-2xs'
                : 'border border-border bg-background text-muted-foreground hover:bg-secondary'
            }`}
          >
            4★ Very Good ({data?.four_star_count || 0})
          </button>
          <button
            onClick={() => setFilterRating('3')}
            className={`rounded-xl px-3.5 py-2 transition-all ${
              filterRating === '3'
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'border border-border bg-background text-muted-foreground hover:bg-secondary'
            }`}
          >
            3★ Good ({data?.three_star_count || 0})
          </button>
          <button
            onClick={() => setFilterRating('critical')}
            className={`rounded-xl px-3.5 py-2 transition-all ${
              filterRating === 'critical'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'border border-border bg-background text-muted-foreground hover:bg-secondary'
            }`}
          >
            Critical 1-2★ ({criticalCount})
          </button>
        </div>

        {/* SEARCH INPUT */}
        <label className="relative min-w-56">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search table, tags, comments..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
          />
        </label>
      </div>

      {/* FEED REVIEWS LIST */}
      <section className="space-y-4">
        {filteredReviews.length > 0 ? (
          filteredReviews.map((review) => {
            const badge = ratingBadge[review.rating] || ratingBadge[5]
            return (
              <article
                key={review.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-2xs dark:bg-slate-900 transition-all hover:shadow-md space-y-3"
              >
                {/* TOP BAR: RATING + TABLE BADGE + DATE */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-xl border px-3 py-1 text-xs font-black ${badge.bg} ${badge.textCol}`}>
                      {badge.text}
                    </span>
                    <span className="rounded-xl border border-border bg-muted/30 px-2.5 py-1 text-xs font-extrabold text-foreground flex items-center gap-1">
                      <TableIcon className="size-3 text-primary" />
                      Table {review.table_number}
                    </span>
                    {review.order_number && (
                      <span className="rounded-xl bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                        Order #{review.order_number}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold text-muted-foreground">
                    {new Date(review.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                {/* GUEST INFO */}
                {(review.guest_name || review.guest_phone) && (
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <User className="size-3.5 text-muted-foreground" />
                    <span>{review.guest_name || 'Guest'}</span>
                    {review.guest_phone && <span className="text-muted-foreground">({review.guest_phone})</span>}
                  </div>
                )}

                {/* SELECTED TAGS */}
                {review.tags && review.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {review.tags.map((tag, idx) => {
                      const isCritical = ['Slow Kitchen', 'Cold Food', 'Missing Item'].includes(tag)
                      return (
                        <span
                          key={idx}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold border ${
                            isCritical
                              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isCritical ? '⚠️ ' : '✓ '} {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* COMMENTS NOTE */}
                {review.comments && (
                  <div className="rounded-2xl border border-border/80 bg-muted/40 p-3 text-xs font-medium text-foreground italic leading-relaxed">
                    "{review.comments}"
                  </div>
                )}
              </article>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-12 text-center dark:bg-slate-900 space-y-3">
            <MessageSquare className="size-12 text-muted-foreground" />
            <h3 className="text-lg font-bold text-foreground">No reviews match your filter</h3>
            <p className="text-xs text-muted-foreground">
              Guest reviews submitted after bill settlement will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
