'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export function FinalCTA() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50/50 dark:bg-[#070b14] border-t border-slate-200/80 dark:border-slate-800/80">
      {/* Soft Ambient Radial Glow Backdrop */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-gradient-to-br from-indigo-600/15 to-violet-600/15 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="rounded-3xl border border-indigo-500/20 dark:border-indigo-500/30 bg-white/80 dark:bg-[#0b1324]/80 backdrop-blur-xl p-8 sm:p-14 shadow-2xl shadow-indigo-950/10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Onboarding</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.15]">
            Ready to go{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              digital?
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join hundreds of businesses transforming their operations with RVC. Start for free today.
          </p>

          <motion.div
            whileHover={shouldReduceMotion ? {} : { scale: 1.025 }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
            className="inline-block"
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-10 py-4 sm:py-5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-extrabold text-base sm:text-lg shadow-xl shadow-indigo-600/25 hover:shadow-2xl hover:shadow-indigo-600/40 transition-all duration-300 group"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>
          </motion.div>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-6 font-medium">
            No credit card required. Live demo available.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

