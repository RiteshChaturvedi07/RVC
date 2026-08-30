'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Building2,
  Send,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: 'How long does onboarding take for my restaurant?',
    answer: 'Onboarding takes under 3 minutes! Simply register your account, upload or create your menu, download your printed table QR codes, and you are live.',
  },
  {
    question: 'Do I need expensive hardware or POS machines?',
    answer: 'Zero special hardware required! You can run RVC Restaurant OS on any existing Android tablet, smartphone, laptop, or desktop browser.',
  },
  {
    question: 'How does the 0% commission model work?',
    answer: 'We charge zero commission on direct table dining and customer UPI orders. You only pay a transparent fixed subscription fee for the software platform.',
  },
]

export default function ContactPage() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  // Contact Form States
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('Restaurant')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !phoneNumber.trim()) {
      toast.error('Please enter your name and phone number')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      toast.success('🎉 Message sent! Our onboarding team will contact you within 2 hours.')
      setFullName('')
      setBusinessName('')
      setPhoneNumber('')
      setMessage('')
    }, 600)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header isDark={isDark} onThemeToggle={toggleTheme} />

      <main className="relative overflow-hidden pt-12 pb-24">
        {/* Background Glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          {/* HEADER */}
          <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Contact & Support Hub</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              We’re Here to Help Your Business <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-300 bg-clip-text text-transparent">
                Scale & Succeed.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Have questions about setting up your restaurant OS or requesting early access for multi-verticals? Talk with our product team directly.
            </p>
          </div>

          {/* DUAL COLUMN LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* LEFT COLUMN: Direct Support Channels & FAQ Accordion */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Direct Communication Channels */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1322] p-6 sm:p-8 shadow-lg space-y-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Direct Communication Channels</h2>

                <div className="space-y-4 text-xs sm:text-sm">
                  {/* WhatsApp Support Link */}
                  <a
                    href="https://wa.me/919876543210?text=Hi%20RVC%20Team%2C%20I%20want%20to%20know%20more%20about%20Restaurant%20OS"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all font-semibold"
                  >
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Instant WhatsApp Chat</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Response within 5 mins</div>
                    </div>
                  </a>

                  {/* Email Support */}
                  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <Mail className="w-5 h-5 text-indigo-500" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Email Us</div>
                      <div className="text-xs text-slate-500">support@rvc.in • sales@rvc.in</div>
                    </div>
                  </div>

                  {/* Live Hours */}
                  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Support Operating Hours</div>
                      <div className="text-xs text-slate-500">Mon – Sat: 9:00 AM – 9:00 PM IST</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick FAQ Accordion */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 sm:p-8 shadow-lg space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
                </div>

                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden"
                    >
                      <button
                        onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                        className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform ${
                            openFaqIndex === index ? 'rotate-180 text-indigo-500' : ''
                          }`}
                        />
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pb-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3"
                          >
                            {faq.answer}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Interactive Contact Form */}
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 sm:p-10 shadow-xl space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    Send Us a Direct Message
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fill in your details below and our team will get in touch with you shortly.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phone / WhatsApp Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Royal Cafe & Restaurant"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Business Vertical
                      </label>
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Restaurant">Restaurant / Cafe / Cloud Kitchen</option>
                        <option value="Gym">Gym & Fitness Center</option>
                        <option value="School">School / Institute / College</option>
                        <option value="Clinic">Hospital / Clinic</option>
                        <option value="CRM">Real Estate / Service Business</option>
                        <option value="Other">Other Business</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      How can we help you?
                    </label>
                    <textarea
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your restaurant setup or queries..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? 'Sending Message...' : '🚀 Submit Message'}
                  </button>
                </form>
              </motion.div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
