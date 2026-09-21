'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Shield, MessageCircle, Lock, Users, Sparkles } from 'lucide-react'

const trustPoints = [
  {
    icon: Users,
    title: 'Built for Tier-2 & Tier-3 Cities',
    description: "Designed specifically for businesses that don't have massive IT teams",
    glowColor: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10',
    iconBg: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: Lock,
    title: 'Bank-Grade Security & Data Isolation',
    description: 'Enterprise-level security with per-business data isolation and compliance',
    glowColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
    iconBg: 'from-emerald-500 to-teal-600',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp-First Communication',
    description: 'Reach customers where they are with integrated WhatsApp messaging',
    glowColor: 'hover:border-green-500/50 hover:shadow-green-500/10',
    iconBg: 'from-green-500 to-emerald-600',
  },
  {
    icon: Shield,
    title: 'Live Support, Not Just Software',
    description: 'Real people helping you succeed, not just automated systems',
    glowColor: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
    iconBg: 'from-amber-500 to-orange-600',
  },
]

export function TrustBand() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-[#070c18] relative overflow-hidden text-white border-y border-slate-800">
      {/* Soft Background Gradient Mesh & Faint SVG Dot Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[140px]" />
        
        {/* Subtle Geometric Dot Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.8) 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Asymmetric 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Heading & Summary Callout (5 Cols) */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="lg:col-span-5 text-left"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Core Operational Pillars</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-[1.15]">
              Why RVC?
            </h2>

            <p className="text-lg text-slate-300 leading-relaxed mb-8">
              We&apos;re not just another software platform. We&apos;re built differently for your business — with deep localization, zero complexity, and real human support.
            </p>

            <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/30 backdrop-blur-md">
              <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                99.9% Operational Reliability
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-tenant cloud architecture running on Indian edge nodes for sub-100ms response times.
              </p>
            </div>
          </motion.div>

          {/* Right Column: 2x2 Grid of Trust Cards (7 Cols) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {trustPoints.map((point, index) => {
              const Icon = point.icon
              return (
                <motion.div
                  key={index}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  viewport={{ once: true }}
                  whileHover={shouldReduceMotion ? {} : { y: -5 }}
                  className={`group rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-lg shadow-black/20 ${point.glowColor} transition-all duration-300 flex flex-col justify-between`}
                >
                  <div>
                    <div className="mb-5 inline-block">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${point.iconBg} flex items-center justify-center text-white shadow-md shadow-indigo-950/40 group-hover:scale-105 transition-transform duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                      {point.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {point.description}
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

