'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  QrCode,
  UtensilsCrossed,
  Dumbbell,
  GraduationCap,
  CheckCircle2,
  Clock,
  ChefHat,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export function Hero() {
  const [activeTab, setActiveTab] = useState<'restaurant' | 'gym' | 'school'>('restaurant')
  const [orderStateIndex, setOrderStateIndex] = useState(0)
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistVertical, setWaitlistVertical] = useState('Gym OS')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { scrollY } = useScroll()
  const shouldReduceMotion = useReducedMotion()
  const rawMockupY = useTransform(scrollY, [0, 600], [0, -28])
  const mockupY = shouldReduceMotion ? 0 : rawMockupY

  // Order progression state machine simulation
  const orderStatuses = [
    { title: 'Received', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', icon: Clock, desc: 'Table A-01 • 2 items' },
    { title: 'Preparing', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', icon: ChefHat, desc: 'Kitchen KDS Display' },
    { title: 'Ready to Serve', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, desc: 'Notified Captain' },
  ]

  useEffect(() => {
    if (activeTab !== 'restaurant') return
    const timer = setInterval(() => {
      setOrderStateIndex((prev) => (prev + 1) % orderStatuses.length)
    }, 3200)
    return () => clearInterval(timer)
  }, [activeTab, orderStatuses.length])

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail.trim()) {
      toast.error('Please enter a valid email or phone number')
      return
    }
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      toast.success(`🎉 You're on the early access waitlist for ${waitlistVertical}! We'll notify you first.`)
      setWaitlistModalOpen(false)
      setWaitlistEmail('')
    }, 600)
  }

  const openWaitlist = (vertical: string) => {
    setWaitlistVertical(vertical)
    setWaitlistModalOpen(true)
  }

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20 pb-16 lg:pt-24 lg:pb-24">
      {/* Dynamic Background Glow & Grid pattern */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-emerald-500/20 rounded-full blur-3xl opacity-60 animate-pulse" />
        <div className="absolute -top-10 -left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-1/3 -right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-6 text-left"
          >
            {/* Live Operational Status Pill */}
            <motion.div
              initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wide mb-6 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Restaurant OS v2.4 Live in Tier-2/3 Cities</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">0% Commission</span>
            </motion.div>

            {/* Headline - Restrained treatment: solid foreground + single brand indigo gradient on "Digitized." */}
            <motion.h1
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] mb-6 text-slate-900 dark:text-white"
            >
              One Platform. Every Business.{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 dark:from-indigo-400 dark:via-violet-400 dark:to-violet-300 bg-clip-text text-transparent">
                Digitized.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-xl leading-relaxed font-normal"
            >
              Powering modern dining with our smart Restaurant OS. High-speed QR ordering, live Kitchen KDS, and zero commission. Built for high velocity across Tier-2 & Tier-3 hubs.
            </motion.p>

            {/* Interactive Primary & Secondary CTAs */}
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
            >
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
              >
                <Zap className="w-4 h-4 mr-2 text-amber-300 fill-amber-300" />
                🚀 Launch Restaurant Free Trial
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/order/demo-restaurant/A-01"
                className="inline-flex items-center justify-center px-6 py-3.5 border-2 border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-900 dark:text-slate-100 rounded-xl font-semibold text-sm sm:text-base backdrop-blur-md transition-all duration-200 hover:border-indigo-500/50 hover:scale-[1.02] shadow-sm"
              >
                <Smartphone className="w-4 h-4 mr-2 text-indigo-500" />
                📱 Test Live QR Demo
              </Link>
            </motion.div>

            {/* Trust highlights */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Instant Setup in 3 Mins</span>
              </div>
              <div className="flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-500" />
                <span>Zero Hardware Mandate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Direct UPI Settlements</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Hero Graphic - Parallax Floating Glassmorphism Mockup with Vertical Tabs & Ambient Glow */}
          <motion.div
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ y: mockupY }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-6 relative"
          >
            {/* Soft Ambient Accent Glow behind Mockup */}
            <div className="absolute -inset-3 bg-gradient-to-r from-indigo-600/20 via-purple-600/15 to-indigo-500/20 rounded-3xl blur-3xl opacity-70 -z-10 pointer-events-none" />

            {/* Vertical Selector Tabs Header */}
            <div className="flex items-center justify-start sm:justify-center gap-1.5 mb-4 p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-300/60 dark:border-slate-800 backdrop-blur-md overflow-x-auto">
              <button
                onClick={() => setActiveTab('restaurant')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'restaurant'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                Restaurant OS
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                  Live 🟢
                </span>
              </button>

              <button
                onClick={() => setActiveTab('gym')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'gym'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Dumbbell className="w-4 h-4" />
                Gym OS
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                  Soon ⚡
                </span>
              </button>

              <button
                onClick={() => setActiveTab('school')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'school'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                School ERP
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/30">
                  Soon 🚀
                </span>
              </button>
            </div>

            {/* Glassmorphism Mockup Card */}
            <div className="relative rounded-3xl border border-slate-300/70 dark:border-slate-800 bg-white/80 dark:bg-[#0d1322]/90 backdrop-blur-xl shadow-2xl p-5 sm:p-6 overflow-hidden min-h-[420px] flex flex-col justify-between">
              
              {/* Top Bar inside Mockup */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {activeTab === 'restaurant' ? 'rvc-pos://live-session/table-A01' : `${activeTab}-preview.rvc.app`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                    {activeTab === 'restaurant' ? 'LIVE POS CONNECTED' : 'BETA SPEC'}
                  </span>
                </div>
              </div>

              {/* Dynamic Content based on selected Tab */}
              <AnimatePresence mode="wait">
                {activeTab === 'restaurant' && (
                  <motion.div
                    key="restaurant-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="py-4 space-y-4"
                  >
                    {/* Tablet KDS + Smartphone Ordering Mockup Split */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      
                      {/* Left: Tablet KDS Mockup (7 cols) */}
                      <div className="sm:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-4 shadow-inner">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Kitchen Display (KDS)</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-500 font-semibold animate-pulse">Sync Active</span>
                        </div>

                        {/* Interactive Order Progression Card */}
                        <div className="rounded-xl border border-indigo-500/30 bg-white dark:bg-slate-800/80 p-3 shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">Order #RVC-8842</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${orderStatuses[orderStateIndex].color}`}>
                              {orderStatuses[orderStateIndex].desc}
                            </span>
                          </div>

                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            1x Paneer Butter Masala • 2x Butter Naan
                          </div>

                          {/* Animated Stepper */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-bold">
                            {orderStatuses.map((st, i) => (
                              <div
                                key={st.title}
                                className={`flex items-center gap-1 transition-all ${
                                  i === orderStateIndex
                                    ? 'text-indigo-600 dark:text-indigo-400 scale-105'
                                    : i < orderStateIndex
                                    ? 'text-emerald-500'
                                    : 'text-slate-400 dark:text-slate-600'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {st.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Smartphone QR Mockup (5 cols) */}
                      <div className="sm:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white p-4 shadow-lg relative overflow-hidden flex flex-col justify-between">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px]">
                          <span className="font-mono text-emerald-400">Table A-01</span>
                          <QrCode className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        
                        <div className="my-3 text-center space-y-1">
                          <div className="inline-flex p-2 rounded-xl bg-white text-slate-900">
                            <QrCode className="w-8 h-8 text-indigo-600" />
                          </div>
                          <p className="text-[11px] font-bold text-slate-200">Scan & Pay via UPI</p>
                          <p className="text-[9px] text-slate-400">Zero App Download Required</p>
                        </div>

                        <Link
                          href="/order/demo-restaurant/A-01"
                          className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold text-center transition-colors"
                        >
                          Try Customer View →
                        </Link>
                      </div>
                    </div>

                    {/* Feature badges row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[11px] font-semibold">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        ⚡ 3-Sec Ordering
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        💰 Direct UPI Pay
                      </div>
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        📊 Live Revenue Analytics
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'gym' && (
                  <motion.div
                    key="gym-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="py-6 space-y-4"
                  >
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Dumbbell className="w-5 h-5 text-amber-500" />
                        <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">Gym OS • Early Access Preview</h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Automated member renewals, WhatsApp fee alerts, biometric entry sync, and trainer slot management for fitness centers.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <span className="block font-bold text-slate-800 dark:text-slate-200">WhatsApp Reminders</span>
                        <span className="text-[10px] text-slate-500">Auto-send renewal links</span>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <span className="block font-bold text-slate-800 dark:text-slate-200">Biometric Sync</span>
                        <span className="text-[10px] text-slate-500">Attendance tracking</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openWaitlist('Gym & Fitness OS')}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs shadow-md hover:scale-[1.01] transition-transform"
                    >
                      ⚡ Join Gym OS Early Access Waitlist
                    </button>
                  </motion.div>
                )}

                {activeTab === 'school' && (
                  <motion.div
                    key="school-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="py-6 space-y-4"
                  >
                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <GraduationCap className="w-5 h-5 text-indigo-500" />
                        <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">School & College ERP • Coming Soon</h4>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Comprehensive institute management: online fee collections, SMS/WhatsApp report cards, bus GPS tracking, and staff payroll.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <span className="block font-bold text-slate-800 dark:text-slate-200">Fee Gateway</span>
                        <span className="text-[10px] text-slate-500">Zero-reconciliation fees</span>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                        <span className="block font-bold text-slate-800 dark:text-slate-200">Parent Portal</span>
                        <span className="text-[10px] text-slate-500">Live attendance updates</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openWaitlist('School & College ERP')}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md hover:scale-[1.01] transition-transform"
                    >
                      🚀 Request Demo & Notify Me
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Footer inside Glass Card */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  RVC Engine Tier-2/3 Tested
                </span>
                <span className="font-mono text-indigo-500 font-semibold">99.99% Uptime</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Early Access Waitlist Modal */}
      <AnimatePresence>
        {waitlistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
            >
              <button
                onClick={() => setWaitlistModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Join Early Access: {waitlistVertical}
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                Be among the first businesses in your city to launch with RVC {waitlistVertical}. Early beta members receive 3 months free upon launch.
              </p>

              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="name@business.com or +91 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? 'Joining...' : '⚡ Submit & Lock Priority Access'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
