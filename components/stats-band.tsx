'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

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
  trigger: boolean
}

function AnimatedCounter({ value, suffix = '', decimals = 0, trigger }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (!trigger) return

    let animationId: NodeJS.Timeout
    let current = 0
    const stepsCount = 40
    const increment = value / stepsCount

    const animate = () => {
      current += increment
      if (current < value) {
        setDisplayValue(Math.floor(current * Math.pow(10, decimals)) / Math.pow(10, decimals))
        animationId = setTimeout(animate, 25)
      } else {
        setDisplayValue(value)
      }
    }

    animate()
    return () => clearTimeout(animationId)
  }, [value, decimals, trigger])

  return (
    <>
      {displayValue.toFixed(decimals).replace(/\.0+$/, '')}
      {suffix}
    </>
  )
}

export function StatsBand() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: '-50px' })
  const shouldReduceMotion = useReducedMotion()

  return (
    <section ref={containerRef} className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-slate-100/80 dark:bg-[#060913] relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80">
      {/* Background Soft Mesh Glow & Grid */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-[450px] h-[450px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[120px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 dark:bg-emerald-600/15 rounded-full blur-[120px] -translate-y-1/2" />
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              viewport={{ once: true }}
              whileHover={shouldReduceMotion ? {} : { y: -4 }}
              className="p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/90 bg-white/80 dark:bg-[#0b1222]/80 backdrop-blur-md shadow-md shadow-slate-950/5 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 text-center flex flex-col justify-center"
            >
              <div className="mb-2">
                <span className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    decimals={stat.label.includes('Uptime') ? 1 : 0}
                    trigger={isInView || !!shouldReduceMotion}
                  />
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

