'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const stats = [
  { label: 'Businesses Digitized', value: 500, suffix: '+' },
  { label: 'Industries Served', value: 6, suffix: '' },
  { label: 'Uptime Guarantee', value: 99.9, suffix: '%' },
  { label: 'Daily Active Users', value: 50, suffix: 'K+' },
]

interface AnimatedCounterProps {
  value: number
  suffix?: string
  decimals?: number
}

function AnimatedCounter({ value, suffix = '', decimals = 0 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let animationId: NodeJS.Timeout
    let current = 0
    const increment = value / 50

    const animate = () => {
      current += increment
      if (current < value) {
        setDisplayValue(Math.floor(current * Math.pow(10, decimals)) / Math.pow(10, decimals))
        animationId = setTimeout(animate, 30)
      } else {
        setDisplayValue(value)
      }
    }

    animate()
    return () => clearTimeout(animationId)
  }, [value, decimals])

  return (
    <>
      {displayValue.toFixed(decimals).replace(/\.0+$/, '')}
      {suffix}
    </>
  )
}

export function StatsBand() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 dark:from-slate-800 to-slate-100 dark:to-slate-900 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-100 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-100 dark:bg-amber-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 15,
                  delay: index * 0.15 + 0.3,
                }}
                viewport={{ once: true }}
                className="mb-4"
              >
                <div className="text-6xl sm:text-7xl font-bold bg-gradient-to-r from-indigo-600 to-amber-500 dark:from-indigo-400 dark:to-amber-400 bg-clip-text text-transparent">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    decimals={stat.label.includes('Uptime') ? 1 : 0}
                  />
                </div>
              </motion.div>
              <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
