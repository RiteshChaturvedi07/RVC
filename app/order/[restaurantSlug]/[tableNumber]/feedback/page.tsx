'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Heart,
  MessageSquare,
  Send,
  Sparkles,
  Star,
  ThumbsUp,
  Utensils,
  X,
} from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const positiveTags = ['Fast Service', 'Delicious Food', 'Great Presentation', 'Clean Table']
const criticalTags = ['Slow Kitchen', 'Cold Food', 'Missing Item']

const ratingLabels: Record<number, { text: string; emoji: string; color: string }> = {
  1: { text: 'Needs Improvement', emoji: '😞', color: 'text-red-500' },
  2: { text: 'Below Average', emoji: '😕', color: 'text-orange-500' },
  3: { text: 'Good', emoji: '🙂', color: 'text-amber-500' },
  4: { text: 'Very Good', emoji: '😊', color: 'text-emerald-500' },
  5: { text: 'Outstanding!', emoji: '🤩', color: 'text-amber-400' },
}

export default function RestaurantFeedbackPage() {
  const params = useParams<{ restaurantSlug: string; tableNumber: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const db = useMemo(() => createClient(), [])

  const orderId = searchParams.get('orderId')
  const { restaurantSlug, tableNumber } = params

  const [restaurantName, setRestaurantName] = useState('Restaurant')
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Load Restaurant Metadata
  useEffect(() => {
    if (!restaurantSlug || !tableNumber) return
    const loadInfo = async () => {
      try {
        const res = await fetch(`/api/public-menu/${restaurantSlug}/${tableNumber}`)
        const payload = await res.json()
        if (payload?.restaurant?.name) {
          setRestaurantName(payload.restaurant.name)
        }
      } catch {
        // Fallback
      }
    }
    void loadInfo()
  }, [restaurantSlug, tableNumber])

  // Toggle Quick Tag Chip
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return
    setSubmitting(true)
    setErrorMessage('')

    try {
      const { error: rpcErr } = await db.rpc('submit_restaurant_order_feedback', {
        p_order_id: orderId || null,
        p_rating: rating,
        p_tags: selectedTags,
        p_comments: comments || null,
      })

      if (rpcErr) {
        // Fallback direct insert if RPC fails
        const { data: tenantData } = await db.from('tenants').select('id').eq('slug', restaurantSlug).single()
        if (tenantData?.id) {
          await db.from('restaurant_order_feedback').insert({
            tenant_id: tenantData.id,
            order_id: orderId || null,
            table_number: tableNumber,
            rating,
            tags: selectedTags,
            comments: comments || null,
          })
        }
      }

      setSubmitted(true)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Unable to submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  // Active Star Label
  const activeRatingObj = ratingLabels[hoverRating || rating] || ratingLabels[5]

  return (
    <main className="mx-auto min-h-screen max-w-md bg-amber-50/60 pb-16 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 relative">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-white/90 p-4 backdrop-blur-md dark:bg-slate-900/90 text-center shadow-2xs">
        <h1 className="text-lg font-black tracking-tight flex items-center justify-center gap-1.5">
          {restaurantName}
          <Sparkles className="size-4 text-amber-500" />
        </h1>
        <p className="text-xs font-semibold text-muted-foreground mt-0.5">
          Dining Feedback · <span className="font-extrabold text-foreground">Table {tableNumber}</span>
        </p>
      </header>

      {/* THANK YOU SUBMITTED CARD */}
      {submitted ? (
        <section className="mx-4 mt-8 rounded-3xl border border-emerald-500/30 bg-card p-8 shadow-2xl text-center dark:bg-slate-900 space-y-5 animate-in zoom-in duration-300">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40">
            <CheckCircle2 className="size-12 animate-bounce" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Thank You! 🎉</h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Your feedback has been shared with the restaurant manager. We appreciate your review!
            </p>
          </div>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1.5">
            <Heart className="size-4 text-amber-500 fill-amber-500" />
            Have a wonderful rest of your day!
          </div>

          <button
            onClick={() => router.push(`/order/${restaurantSlug}/${tableNumber}`)}
            className="w-full rounded-2xl bg-primary py-3.5 text-xs font-extrabold text-primary-foreground shadow-lg hover:opacity-90 transition-all"
          >
            Return to Menu
          </button>
        </section>
      ) : (
        /* INTERACTIVE FEEDBACK FORM */
        <form onSubmit={handleSubmitFeedback} className="px-4 mt-6 space-y-5">
          {/* RATING CARD */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm text-center dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-extrabold text-foreground">How was your experience today?</h2>

            {/* STAR RATING PICKER */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= (hoverRating || rating)
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`size-9 transition-colors ${
                        isFilled
                          ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                          : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                )
              })}
            </div>

            {/* DYNAMIC RATING EMOJI & LABEL */}
            <div className="rounded-2xl bg-muted/40 p-2.5 text-center">
              <span className="text-lg mr-1.5">{activeRatingObj.emoji}</span>
              <span className={`text-xs font-extrabold ${activeRatingObj.color}`}>{activeRatingObj.text}</span>
            </div>
          </div>

          {/* QUICK TAG CHIPS CARD */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ThumbsUp className="size-3.5 text-primary" /> What went well or needs attention?
            </h3>

            {/* POSITIVE TAGS */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Highlights</p>
              <div className="flex flex-wrap gap-2">
                {positiveTags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all border ${
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs scale-105'
                          : 'bg-background border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '} {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* CRITICAL TAGS */}
            <div className="space-y-1.5 pt-2">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Areas for Improvement</p>
              <div className="flex flex-wrap gap-2">
                {criticalTags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all border ${
                        selected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs scale-105'
                          : 'bg-background border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '} {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* COMMENTS TEXTAREA CARD */}
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:bg-slate-900 space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-primary" /> Manager Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Tell us what you loved or how we can make your next visit even better…"
              className="w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:border-primary font-medium"
            />
          </div>

          {errorMessage && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
              {errorMessage}
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-primary py-3.5 font-extrabold text-primary-foreground shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="size-4" />
            <span>{submitting ? 'Submitting Review…' : 'Submit Review'}</span>
          </button>
        </form>
      )}
    </main>
  )
}
