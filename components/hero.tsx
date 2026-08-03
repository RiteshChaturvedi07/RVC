'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const mockupItems = [
  { label: 'School Dashboard', icon: '📚', color: 'from-blue-500 to-blue-600' },
  { label: 'Hospital System', icon: '🏥', color: 'from-red-500 to-red-600' },
  { label: 'Restaurant POS', icon: '🍽️', color: 'from-orange-500 to-orange-600' },
  { label: 'Gym Management', icon: '💪', color: 'from-green-500 to-green-600' },
]

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-200 dark:bg-indigo-900/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-amber-200 dark:bg-amber-900/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-200 dark:bg-purple-900/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-4000" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-balance leading-tight mb-6"
            >
              <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
                One Platform.
              </span>
              <br />
              <span className="text-slate-900 dark:text-white">
                Every Business.
              </span>
              <br />
              <span className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-400 dark:to-amber-500 bg-clip-text text-transparent">
                Digitized.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 leading-relaxed"
            >
              RVC gives Tier-2 and Tier-3 city businesses instant access to professional software—school ERP, hospital systems, gym management, restaurant POS, and more. No coding, no big IT budget needed.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold hover:shadow-xl hover:shadow-indigo-500/50 transition-all hover:scale-105 group"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => {
                  const element = document.getElementById('solutions')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                Explore Solutions
              </button>
            </motion.div>
          </motion.div>

          {/* Right - Animated Carousel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative h-96 sm:h-[500px]"
          >
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
              {mockupItems.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: activeIndex === index ? 1 : 0,
                  }}
                  transition={{ duration: 0.8 }}
                  className={`absolute inset-0 bg-gradient-to-br ${item.color} flex items-center justify-center`}
                >
                  <div className="text-center">
                    <div className="text-8xl mb-4 animate-bounce">{item.icon}</div>
                    <h3 className="text-white text-2xl font-bold">{item.label}</h3>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Carousel Controls */}
            <div className="flex justify-center gap-2 mt-8">
              {mockupItems.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeIndex === index
                      ? 'bg-indigo-600 dark:bg-indigo-400 w-8'
                      : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
