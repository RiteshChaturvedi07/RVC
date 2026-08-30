'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2,
  ShieldCheck,
  Zap,
  Users,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Award,
  Globe2,
  CheckCircle2,
  UtensilsCrossed,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export default function AboutPage() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialDark = savedTheme ? savedTheme === 'dark' : prefersDark
    setIsDark(initialDark)
    document.documentElement.classList.toggle('dark', initialDark)
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    localStorage.setItem('theme', nextDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', nextDark)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header isDark={isDark} onThemeToggle={toggleTheme} />

      <main className="relative overflow-hidden pt-12 pb-24">
        {/* Background Glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-emerald-500/15 rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          
          {/* HERO SECTION */}
          <section className="text-center max-w-4xl mx-auto space-y-6 pt-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Our Mission & Story</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.12] text-slate-900 dark:text-white"
            >
              Digitizing Bharat’s Local Businesses, <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 dark:from-indigo-400 dark:via-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
                One City at a Time.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl mx-auto font-normal"
            >
              RVC was born out of a simple observation: small and medium businesses in Tier-2 and Tier-3 cities were getting left behind by complex, high-commission software aggregators. We built an all-in-one operating platform engineered for local ground realities.
            </motion.p>
          </section>

          {/* STATS BAND */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-8 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#0d1322]/80 backdrop-blur-xl shadow-xl text-center"
          >
            <div className="p-4">
              <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-1 font-mono">
                500+
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Businesses Digitized</div>
              <div className="text-xs text-slate-500 mt-1">Across 24 Tier-2/3 Hubs</div>
            </div>

            <div className="p-4 border-y sm:border-y-0 sm:border-x border-slate-200 dark:border-slate-800">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-1 font-mono">
                50K+
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Daily Customer Orders</div>
              <div className="text-xs text-slate-500 mt-1">Processed with Zero Lag</div>
            </div>

            <div className="p-4">
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-600 dark:text-amber-400 mb-1 font-mono">
                99.9%
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Uptime SLA Guarantee</div>
              <div className="text-xs text-slate-500 mt-1">Cloud Resilient Core</div>
            </div>
          </motion.section>

          {/* CORE PILLARS BENTO GRID */}
          <section className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Our 3 Core Product Pillars</h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm mt-2">Built differently from legacy software to protect merchant margins and maximize speed.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Pillar 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-lg hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit mb-6">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                    0% Aggregator Commission
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    We believe business owners should keep 100% of their hard-earned sales. RVC charges zero commission on direct table orders and takeaway bills.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Direct Customer Payouts
                </div>
              </motion.div>

              {/* Pillar 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
                className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 w-fit mb-6">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                    Sub-Second Experience
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    Customers scan a QR code and order in under 3 seconds without downloading any heavy app. Kitchen KDS displays sync instantly with zero latency.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Zero App Installation
                </div>
              </motion.div>

              {/* Pillar 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                viewport={{ once: true }}
                className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 w-fit mb-6">
                    <Globe2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                    Hyper-Local Focus
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    Designed for regional teams with multi-lingual staff interfaces, instant UPI QR settlements, and 3-minute zero-hardware setup.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Multi-Lingual & Direct UPI
                </div>
              </motion.div>

            </div>
          </section>

          {/* CALL TO ACTION STRIP */}
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-8 sm:p-12 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-8"
          >
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Ready to digitize your restaurant?</h3>
              <p className="text-indigo-100 text-sm max-w-xl">Join 500+ businesses running on RVC Restaurant OS with 0% commissions.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                href="/register"
                className="px-6 py-3.5 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-slate-100 transition-colors text-center shadow-lg"
              >
                Launch Free Trial 🚀
              </Link>
              <Link
                href="/order/demo-restaurant/A-01"
                className="px-6 py-3.5 rounded-xl border border-indigo-400/50 bg-indigo-800/40 text-white font-semibold text-sm hover:bg-indigo-800/60 transition-colors text-center"
              >
                Test Live QR Demo
              </Link>
            </div>
          </motion.section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
