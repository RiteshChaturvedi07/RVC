'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Settings, Zap, ArrowUpRight } from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Sign up & choose your business type',
    description: "Tell us what business you run and we'll tailor the platform for you",
    icon: CheckCircle2,
    color: 'from-blue-500 to-indigo-600',
    accentBorder: 'hover:border-blue-500/50',
    shadow: 'hover:shadow-blue-500/10',
  },
  {
    number: 2,
    title: 'We set up your dashboard',
    description: 'Our team configures everything with pre-built templates and integrations',
    icon: Settings,
    color: 'from-purple-500 to-violet-600',
    accentBorder: 'hover:border-purple-500/50',
    shadow: 'hover:shadow-purple-500/10',
  },
  {
    number: 3,
    title: 'Go live in days, not months',
    description: 'Start managing your business immediately with full support',
    icon: Zap,
    color: 'from-amber-500 to-orange-600',
    accentBorder: 'hover:border-amber-500/50',
    shadow: 'hover:shadow-amber-500/10',
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="how-it-works" className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-white dark:bg-[#070b14]">
      {/* Background Soft Glow & Grid */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[130px]" />
        <div 
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Asymmetric 2-Column Split Layout (Rhythm Variation) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Heading & Sticky Lead Content (5 Cols) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="lg:col-span-5 text-left"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
              <span>Onboarding Pipeline</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.15]">
              How It Works
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
              Simple. Fast. Effective. Get your business digitized in three easy steps with zero technical friction.
            </p>

            <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Guaranteed Speed</span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Our dedicated Tier-2/3 onboarding team assists with initial data upload, staff training, and printed QR stands.
              </p>
            </div>
          </motion.div>

          {/* Right Column: Timeline Step Cards (7 Cols) */}
          <div className="lg:col-span-7 space-y-6 relative">
            {/* Connecting Vertical Line (Desktop) */}
            <div className="hidden sm:block absolute top-8 bottom-8 left-9 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-amber-500 opacity-20 pointer-events-none" />

            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.number}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true, margin: '-50px' }}
                  whileHover={shouldReduceMotion ? {} : { y: -4 }}
                  className={`group relative rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white/90 dark:bg-[#0b1324]/90 p-6 sm:p-7 shadow-md shadow-slate-950/5 hover:shadow-xl ${step.shadow} ${step.accentBorder} transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-6`}
                >
                  {/* Step Icon Badge */}
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-300`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-black flex items-center justify-center shadow-xs">
                      {step.number}
                    </span>
                  </div>

                  {/* Step Description */}
                  <div className="flex-1">
                    <div className="inline-block mb-1 text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Step {step.number}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">
                      {step.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>

        </div>
      </div>
    </section>
  )
}

