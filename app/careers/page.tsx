'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Zap,
  Code2,
  Users,
  Building2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

interface JobRole {
  id: string
  title: string
  department: 'Engineering' | 'Product' | 'Sales' | 'Support'
  type: string
  location: string
  description: string
}

const roles: JobRole[] = [
  {
    id: 'fullstack-engineer',
    title: 'Senior Full-Stack Engineer (Next.js / TypeScript)',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote / Hybrid (Bengaluru)',
    description:
      'Own end-to-end features across Next.js 16 App Router, Supabase real-time sync, and Upstash Redis rate-limiting architecture.',
  },
  {
    id: 'frontend-uiux',
    title: 'Frontend UI/UX Specialist (Tailwind CSS / Motion)',
    department: 'Engineering',
    type: 'Full-Time',
    location: 'Remote',
    description:
      'Design and craft sub-second responsive web apps, glassmorphism dashboards, and micro-animated POS interfaces.',
  },
  {
    id: 'growth-ops',
    title: 'Growth & Restaurant Operations Associate',
    department: 'Sales',
    type: 'Full-Time',
    location: 'Tier-2 Hub (On-Ground Focus)',
    description:
      'Lead merchant acquisition, demonstrate live QR ordering to cafe owners, and onboard restaurants onto RVC OS.',
  },
  {
    id: 'customer-success',
    title: 'Customer Success & Onboarding Lead',
    department: 'Support',
    type: 'Full-Time',
    location: 'Remote / Hybrid',
    description:
      'Ensure 99.9% merchant satisfaction, guide table QR setup, and train restaurant staff on Kitchen Display (KDS) workflows.',
  },
]

export default function CareersPage() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [selectedDept, setSelectedDept] = useState<string>('All Departments')
  const [applyModalRole, setApplyModalRole] = useState<JobRole | null>(null)

  // Form states
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [applicantLink, setApplicantLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialDark = savedTheme ? savedTheme === 'dark' : prefersDark
    setIsDark(initialDark)
    document.documentElement.classList.toggle('dark', initialDark)
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    localStorage.setItem('theme', nextDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', nextDark)
  }

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!applicantName.trim() || !applicantEmail.trim()) {
      toast.error('Please fill in your name and email address')
      return
    }
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      toast.success(`🎉 Application submitted for ${applyModalRole?.title}! Our hiring team will review and reply within 48 hours.`)
      setApplyModalRole(null)
      setApplicantName('')
      setApplicantEmail('')
      setApplicantLink('')
    }, 600)
  }

  const filteredRoles = roles.filter(
    (r) => selectedDept === 'All Departments' || r.department === selectedDept
  )

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header isDark={isDark} onThemeToggle={toggleTheme} />

      <main className="relative overflow-hidden pt-12 pb-24">
        {/* Background Glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-purple-600/15 via-indigo-600/15 to-emerald-500/15 rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          
          {/* HERO BANNER */}
          <section className="text-center max-w-4xl mx-auto space-y-6 pt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" />
              <span>We Are Hiring</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.12] text-slate-900 dark:text-white">
              Build the Operating System for the <br />
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500 dark:from-purple-400 dark:via-indigo-300 dark:to-emerald-300 bg-clip-text text-transparent">
                Next 100 Million Users.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              We are a high-velocity team building software that transforms local commerce. Join us to engineer software used daily by thousands of merchants.
            </p>
          </section>

          {/* CULTURE & BENEFITS GRID */}
          <section className="space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Why Join RVC?</h2>
              <p className="text-slate-600 dark:text-slate-300 text-xs mt-1">High ownership, zero bureaucracy, and high leverage work.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-md space-y-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 w-fit">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">High Autonomy</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Own your domain. You define the solution, write clean code, and ship directly to production.
                </p>
              </div>

              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-md space-y-3">
                <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 w-fit">
                  <Code2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Modern Tech Stack</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Next.js 16, React 19, Supabase, Tailwind CSS 4, Vitest, and Playwright automated testing.
                </p>
              </div>

              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-md space-y-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Competitive Equity</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Top-of-market salary packages with meaningful equity ownership in RVC’s multi-vertical platform.
                </p>
              </div>

              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-md space-y-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 w-fit">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Fast-Track Growth</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Grow rapidly alongside an expanding multi-tenant SaaS operating across 5 vertical markets.
                </p>
              </div>
            </div>
          </section>

          {/* OPEN POSITIONS BOARD */}
          <section className="space-y-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Open Roles</h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">Find your fit and apply directly online.</p>
              </div>

              {/* Department Filter */}
              <div className="flex flex-wrap gap-1.5">
                {['All Departments', 'Engineering', 'Product', 'Sales', 'Support'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedDept === dept
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* Roles List */}
            <div className="space-y-4">
              {filteredRoles.map((role) => (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  viewport={{ once: true }}
                  className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] shadow-sm hover:border-purple-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
                        {role.department}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <MapPin className="w-3.5 h-3.5" /> {role.location}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5" /> {role.type}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{role.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{role.description}</p>
                  </div>

                  <button
                    onClick={() => setApplyModalRole(role)}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all self-start md:self-center whitespace-nowrap"
                  >
                    Apply Now →
                  </button>
                </motion.div>
              ))}
            </div>
          </section>

        </div>
      </main>

      {/* APPLY NOW MODAL / DRAWER */}
      <AnimatePresence>
        {applyModalRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <button
                onClick={() => setApplyModalRole(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-1">
                  Job Application
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{applyModalRole.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{applyModalRole.location} • {applyModalRole.type}</p>
              </div>

              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Ritesh Chaturvedi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="ritesh@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GitHub / Portfolio / LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={applicantLink}
                    onChange={(e) => setApplicantLink(e.target.value)}
                    placeholder="https://github.com/yourhandle"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors shadow-lg shadow-purple-600/30 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting Application...' : '🚀 Submit Application'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  )
}
