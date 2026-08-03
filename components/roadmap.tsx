'use client'

import { motion } from 'framer-motion'

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
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-100 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="text-slate-900 dark:text-white">What&apos;s</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-amber-500 dark:from-indigo-400 dark:to-amber-400 bg-clip-text text-transparent">
              Coming Next
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            We&apos;re constantly expanding. Here&apos;s what we&apos;re building for you next.
          </p>
        </motion.div>

        {/* Horizontal Scroll Cards */}
        <div className="overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex gap-6 min-w-min px-4">
            {roadmapItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className="flex-shrink-0 w-64 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:border-indigo-500 dark:hover:border-indigo-400 transition-all relative group"
              >
                {/* Pulsing Badge */}
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
                  Soon
                </div>

                <div className="text-6xl mb-4">{item.emoji}</div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {item.name}
                </h3>

                <p className="text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>

                {/* Hover Gradient Border */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-amber-500 opacity-0 group-hover:opacity-10 blur" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ x: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center mt-8 text-slate-600 dark:text-slate-400 text-sm md:hidden flex items-center justify-center gap-2"
        >
          <span>Swipe to explore</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.div>
      </div>
    </section>
  )
}
