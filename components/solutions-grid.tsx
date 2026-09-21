'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  UtensilsCrossed,
  Dumbbell,
  GraduationCap,
  Stethoscope,
  Building2,
  Sparkles,
  ArrowRight,
  QrCode,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export function SolutionsGrid() {
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [activeVerticalTitle, setActiveVerticalTitle] = useState('')
  const [waitlistInput, setWaitlistInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  const openWaitlist = (vertical: string) => {
    setActiveVerticalTitle(vertical)
    setWaitlistModalOpen(true)
  }

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistInput.trim()) {
      toast.error('Please enter a valid email or phone number')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      toast.success(`🎉 You're registered for ${activeVerticalTitle} early access! We will invite you first.`)
      setWaitlistModalOpen(false)
      setWaitlistInput('')
    }, 600)
  }

  return (
    <section id="solutions" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50/60 dark:bg-[#080d1a] border-y border-slate-200/80 dark:border-slate-800/80">
      {/* Background Gradient Mesh & Grid */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[120px]" />
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Asymmetric Left-Aligned Section Header (Rhythm Variation) */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-6 pb-8 border-b border-slate-200/60 dark:border-slate-800/60">
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vertical OS Architecture</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Tailored Industry Solutions for{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
                Tier-2 & Tier-3 Cities
              </span>
            </h2>
          </motion.div>

          <motion.p
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-md leading-relaxed"
          >
            One powerful core engine adapted into specialized operating software for restaurants, gyms, institutes, clinics, and businesses.
          </motion.p>
        </div>

        {/* Bento Grid Layout (Featured 60% Width + Standard Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Featured Bento Card (60% Width / Col-span-2) - Restaurant POS & Digital OS (LIVE NOW 🟢) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            whileHover={shouldReduceMotion ? {} : { y: -5 }}
            className="lg:col-span-2 group relative overflow-hidden rounded-3xl border border-emerald-500/30 dark:border-emerald-500/30 bg-gradient-to-br from-white via-emerald-50/30 to-indigo-50/20 dark:from-[#0b1324] dark:via-[#0c182b] dark:to-[#0f172a] p-8 shadow-lg shadow-emerald-950/5 hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/60 transition-all duration-300 flex flex-col justify-between"
          >
            {/* Soft Ambient Inner Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform duration-300">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">Production Ready</span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                      Restaurant POS & Digital OS
                    </h3>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE NOW 🟢
                </span>
              </div>

              {/* Badges Grid */}
              <div className="flex flex-wrap gap-2 mb-6">
                {['0% Commission', 'Zero App Download', 'Live KDS Sync', 'Smart Inventory & Billing'].map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    {badge}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                Complete dine-in and takeaway automation: High-speed QR table ordering, kitchen display system (KDS), direct customer UPI payouts, and real-time inventory tracking.
              </p>

              {/* Mini Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-xs group-hover:border-indigo-500/30 transition-colors">
                  <QrCode className="w-5 h-5 text-indigo-500 mb-1.5" />
                  <div className="font-bold text-xs text-slate-900 dark:text-white">QR Table Ordering</div>
                  <div className="text-[11px] text-slate-500">Scan, order & pay instantly</div>
                </div>
                <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-xs group-hover:border-emerald-500/30 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 mb-1.5" />
                  <div className="font-bold text-xs text-slate-900 dark:text-white">Direct Settlement</div>
                  <div className="text-[11px] text-slate-500">Instant UPI into your bank</div>
                </div>
                <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-xs group-hover:border-amber-500/30 transition-colors">
                  <Sparkles className="w-5 h-5 text-amber-500 mb-1.5" />
                  <div className="font-bold text-xs text-slate-900 dark:text-white">Kitchen Display</div>
                  <div className="text-[11px] text-slate-500">Zero order slip errors</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all group/btn"
                >
                  Launch Restaurant OS Free Trial
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/order/demo-restaurant/A-01"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Test Live QR Customer Demo →
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Card 2: Gym & Fitness OS (Early Access ⚡) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            whileHover={shouldReduceMotion ? {} : { y: -5 }}
            className="group rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-[#0b1324] p-6 shadow-md shadow-slate-950/5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
                  Early Access ⚡
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Gym & Fitness OS
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                Membership management, WhatsApp automated fee renewal alerts, biometric entry logs, and personal trainer booking.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  WhatsApp expiry payment links
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Biometric & RFID access integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Diet plan & workout cards
                </li>
              </ul>
            </div>

            <button
              onClick={() => openWaitlist('Gym & Fitness OS')}
              className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs transition-colors"
            >
              [ Join Beta Waitlist ]
            </button>
          </motion.div>

          {/* Card 3: School & College ERP (Coming Soon 🚀) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            whileHover={shouldReduceMotion ? {} : { y: -5 }}
            className="group rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-[#0b1324] p-6 shadow-md shadow-slate-950/5 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  Coming Soon 🚀
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                School & College ERP
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                Attendance tracking, online fee collection with auto receipts, digital report cards, and parent notification portals.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Instant parent SMS & WhatsApp alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Automated term fee schedules
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Exam marksheet generator
                </li>
              </ul>
            </div>

            <button
              onClick={() => openWaitlist('School & College ERP')}
              className="w-full py-2.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition-colors"
            >
              [ Notify Me ]
            </button>
          </motion.div>

          {/* Card 4: Hospital & Clinic HIS (Coming Soon 🚀) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            whileHover={shouldReduceMotion ? {} : { y: -5 }}
            className="group rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-[#0b1324] p-6 shadow-md shadow-slate-950/5 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold">
                  Coming Soon 🚀
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Hospital & Clinic HIS
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                OPD token queue management, electronic health records (EHR), digital prescriptions, and pharmacy billing.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Live OPD queue screen displays
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  WhatsApp digital rx delivery
                </li>
              </ul>
            </div>

            <button
              onClick={() => openWaitlist('Hospital & Clinic HIS')}
              className="w-full py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold text-xs transition-colors"
            >
              [ Join Waitlist ]
            </button>
          </motion.div>

          {/* Card 5: Real Estate & Service CRM (Coming Soon 🚀) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            whileHover={shouldReduceMotion ? {} : { y: -5 }}
            className="group rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-[#0b1324] p-6 shadow-md shadow-slate-950/5 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                  Coming Soon 🚀
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Real Estate & Service CRM
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                Lead capture pipelines, automated lead follow-up reminders, agent commission tracking, and deal analytics.
              </p>

              <ul className="space-y-2 mb-6 text-xs text-slate-700 dark:text-slate-300 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Meta & Justdial lead integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Automated site visit scheduling
                </li>
              </ul>
            </div>

            <button
              onClick={() => openWaitlist('Real Estate & Service CRM')}
              className="w-full py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors"
            >
              [ Join Waitlist ]
            </button>
          </motion.div>

        </div>
      </div>

      {/* Interactive Waitlist Modal */}
      <AnimatePresence>
        {waitlistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
            >
              <button
                onClick={() => setWaitlistModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Waitlist: {activeVerticalTitle}
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                Register your business for priority onboarding and discounted lifetime pricing when {activeVerticalTitle} launches in your city.
              </p>

              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address or Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    value={waitlistInput}
                    onChange={(e) => setWaitlistInput(e.target.value)}
                    placeholder="you@business.com or +91 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : '🚀 Lock Early Access Priority'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}

