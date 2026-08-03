'use client'

import { motion } from 'framer-motion'
import { Shield, MessageCircle, Lock, Users } from 'lucide-react'

const trustPoints = [
  {
    icon: Users,
    title: 'Built for Tier-2 & Tier-3 Cities',
    description: 'Designed specifically for businesses that don&apos;t have massive IT teams',
  },
  {
    icon: Lock,
    title: 'Bank-Grade Security & Data Isolation',
    description: 'Enterprise-level security with per-business data isolation and compliance',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp-First Communication',
    description: 'Reach customers where they are with integrated WhatsApp messaging',
  },
  {
    icon: Shield,
    title: 'Live Support, Not Just Software',
    description: 'Real people helping you succeed, not just automated systems',
  },
]

export function TrustBand() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-900 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Why RVC?
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            We&apos;re not just another software platform. We&apos;re built differently for your business.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {trustPoints.map((point, index) => {
            const Icon = point.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true, margin: '-100px' }}
                className="text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="inline-block mb-6"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
                    <Icon className="w-8 h-8 text-slate-900" />
                  </div>
                </motion.div>

                <h3 className="text-lg font-bold text-white mb-3">
                  {point.title}
                </h3>
                <p className="text-slate-300">
                  {point.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
