'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Settings, Zap } from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Sign up & choose your business type',
    description: 'Tell us what business you run and we&apos;ll tailor the platform for you',
    icon: CheckCircle2,
    color: 'from-blue-500 to-blue-600',
  },
  {
    number: 2,
    title: 'We set up your dashboard',
    description: 'Our team configures everything with pre-built templates and integrations',
    icon: Settings,
    color: 'from-purple-500 to-purple-600',
  },
  {
    number: 3,
    title: 'Go live in days, not months',
    description: 'Start managing your business immediately with full support',
    icon: Zap,
    color: 'from-amber-500 to-amber-600',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-100 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
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
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Simple. Fast. Effective. Get your business digitized in three easy steps.
          </p>
        </motion.div>

        {/* Steps Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Animated Connector Line (Desktop Only) */}
          <motion.svg
            className="hidden md:block absolute top-24 left-0 right-0 w-full h-1 pointer-events-none"
            viewBox="0 0 1000 2"
            preserveAspectRatio="none"
          >
            <motion.line
              x1="0"
              y1="1"
              x2="1000"
              y2="1"
              stroke="url(#gradient)"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              viewport={{ once: true }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(79, 70, 229)" />
                <stop offset="50%" stopColor="rgb(245, 158, 11)" />
                <stop offset="100%" stopColor="rgb(79, 70, 229)" />
              </linearGradient>
            </defs>
          </motion.svg>

          {/* Steps */}
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true, margin: '-100px' }}
                className="relative"
              >
                <div className="text-center">
                  {/* Icon Circle */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="relative mb-8 flex justify-center"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-amber-600/20 dark:from-indigo-400/20 dark:to-amber-400/20 rounded-full blur-lg" />
                    <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                  </motion.div>

                  {/* Step Number */}
                  <div className="inline-block mb-4 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold">
                    Step {step.number}
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
