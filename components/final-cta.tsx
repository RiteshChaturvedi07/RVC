'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function FinalCTA() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <motion.div
          animate={{
            boxShadow: [
              '0 0 40px rgba(67, 56, 202, 0.3)',
              '0 0 80px rgba(67, 56, 202, 0.5)',
              '0 0 40px rgba(67, 56, 202, 0.3)',
            ],
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-500/20 to-amber-500/20 dark:from-indigo-600/20 dark:to-amber-600/20 rounded-full blur-3xl"
        />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <h2 className="text-4xl sm:text-6xl font-bold mb-6">
            <span className="text-slate-900 dark:text-white">Ready to go</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-amber-500 dark:from-indigo-400 dark:to-amber-400 bg-clip-text text-transparent">
              digital?
            </span>
          </h2>

          <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join hundreds of businesses transforming their operations with RVC. Start for free today.
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05 }}
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold text-lg shadow-2xl hover:shadow-2xl hover:shadow-indigo-500/50 transition-all group"
            >
              Get Started Now
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-slate-500 dark:text-slate-400 mt-6"
          >
            No credit card required. Live demo available.
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
