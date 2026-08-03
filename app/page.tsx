'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { SolutionsGrid } from '@/components/solutions-grid'
import { HowItWorks } from '@/components/how-it-works'
import { TrustBand } from '@/components/trust-band'
import { Roadmap } from '@/components/roadmap'
import { StatsBand } from '@/components/stats-band'
import { FinalCTA } from '@/components/final-cta'
import { Footer } from '@/components/footer'

export default function Home() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const savedTheme = localStorage.getItem('theme')
    
    if (savedTheme) {
      setIsDark(savedTheme === 'dark')
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    } else {
      setIsDark(prefersDark)
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', newIsDark)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      <Header isDark={isDark} onThemeToggle={toggleTheme} />
      <Hero />
      <SolutionsGrid />
      <HowItWorks />
      <TrustBand />
      <Roadmap />
      <StatsBand />
      <FinalCTA />
      <Footer />
    </div>
  )
}
