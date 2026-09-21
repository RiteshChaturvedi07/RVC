'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const roadmapItems = [
  {
    name: 'Salons',
    emoji: '💇',
    description: 'Beauty & wellness management',
  },
  {
    name: 'Real Estate CRM',
    emoji: '🏢',
    description: 'Property management system',
  },
  {
    name: 'Coaching Institutes',
    emoji: '📖',
    description: 'Education & course management',
  },
  {
    name: 'Medical Stores',
    emoji: '💊',
    description: 'Pharmacy management system',
  },
  {
    name: 'Travel Agencies',
    emoji: '✈️',
    description: 'Booking & itinerary management',
  },
  {
    name: 'Retail Shops',
    emoji: '🛍️',
    description: 'Inventory & sales tracking',
  },
]

export function Roadmap() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-white dark:bg-[#070b14]">
      {/* Background Soft Mesh Glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Product Expansion</span>
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
            What&apos;s{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              Coming Next
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            We&apos;re constantly expanding. Here&apos;s what we&apos;re building for you next.
          </p>
        </motion.div>

        {/* Horizontal Scroll Cards */}
        <div className="overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-5 min-w-min py-2">
            {roadmapItems.map((item, index) => (
              <motion.div
                key={index}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                viewport={{ once: true }}
                whileHover={shouldReduceMotion ? {} : { y: -6 }}
                className="flex-shrink-0 w-64 p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white/90 dark:bg-[#0b1324]/90 backdrop-blur-md shadow-md shadow-slate-950/5 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 relative group"
              >
                {/* Pulsing Badge */}
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Soon
                </div>

                <div className="text-5xl mb-5 group-hover:scale-110 transition-transform duration-300">{item.emoji}</div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">
                  {item.name}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={shouldReduceMotion ? {} : { x: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center mt-6 text-slate-500 dark:text-slate-400 text-xs font-semibold md:hidden flex items-center justify-center gap-2"
        >
          <span>Swipe to explore roadmap</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.div>
      </div>
    </section>
  )
}

