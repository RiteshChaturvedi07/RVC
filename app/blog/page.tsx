'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Sparkles,
  Clock,
  ArrowRight,
  TrendingUp,
  Utensils,
  CheckCircle2,
  Mail,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

interface Article {
  id: string
  title: string
  category: 'Restaurant Tech' | 'Profit Playbooks' | 'Product Updates'
  excerpt: string
  readTime: string
  date: string
  author: string
  featured?: boolean
  imageGradient: string
}

const articles: Article[] = [
  {
    id: 'slash-wait-times',
    title: 'How Tier-2 Cafes Are Slashing Table Wait Times by 40% Using Direct QR Ordering',
    category: 'Restaurant Tech',
    excerpt:
      'Discover how smart QR menus connected directly to kitchen displays eliminate manual captain order-taking and boost table turnover during rush hours.',
    readTime: '5 min read',
    date: 'Aug 20, 2026',
    author: 'RVC Research Team',
    featured: true,
    imageGradient: 'from-indigo-600 via-purple-600 to-emerald-600',
  },
  {
    id: 'aggregator-math',
    title: 'Saying Goodbye to Aggregator Commissions: The Math Behind Direct Dine-in Billing',
    category: 'Profit Playbooks',
    excerpt:
      'Paying 18-25% commissions eats your margin. We break down the real numbers of switching to direct UPI dine-in payments.',
    readTime: '6 min read',
    date: 'Aug 18, 2026',
    author: 'Financial Ops Hub',
    imageGradient: 'from-emerald-500 to-teal-700',
  },
  {
    id: 'kds-vs-paper-kot',
    title: 'Kitchen Display Systems (KDS) vs Paper KOTs: Which Saves More Money?',
    category: 'Restaurant Tech',
    excerpt:
      'Paper receipts get lost or spilled on. Learn how real-time digital kitchen displays prevent missing items and speed up food prep.',
    readTime: '4 min read',
    date: 'Aug 14, 2026',
    author: 'Chef Operational Insights',
    imageGradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'whatsapp-tactics',
    title: 'Top 5 WhatsApp Marketing Automation Tactics for Weekend Rush',
    category: 'Profit Playbooks',
    excerpt:
      'Turn one-time diners into loyal repeat customers using automated WhatsApp feedback requests and weekend discount coupons.',
    readTime: '7 min read',
    date: 'Aug 10, 2026',
    author: 'Growth & CRM Team',
    imageGradient: 'from-blue-500 to-indigo-700',
  },
]

export default function BlogPage() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All Insights')
  const [newsletterEmail, setNewsletterEmail] = useState('')
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

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      toast.success('🎉 You have subscribed to RVC Insights! Check your inbox for weekly playbooks.')
      setNewsletterEmail('')
    }, 500)
  }

  const filteredArticles = articles.filter(
    (art) => selectedCategory === 'All Insights' || art.category === selectedCategory
  )

  const featuredArticle = articles.find((a) => a.featured) || articles[0]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header isDark={isDark} onThemeToggle={toggleTheme} />

      <main className="relative overflow-hidden pt-12 pb-24">
        {/* Background Glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          {/* HEADER & CATEGORY FILTER */}
          <div className="text-center max-w-3xl mx-auto space-y-6 pt-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>RVC Knowledge & Playbooks</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Insights & Playbooks for <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 dark:from-indigo-400 dark:via-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
                High-Growth Local Businesses
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Expert guides on restaurant POS efficiency, zero-commission dining math, and customer retention.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              {['All Insights', 'Restaurant Tech', 'Profit Playbooks', 'Product Updates'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* FEATURED ARTICLE (Full-Width Glassmorphism Card) */}
          {selectedCategory === 'All Insights' && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1322] shadow-2xl p-6 sm:p-10"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Featured 🌟
                    </span>
                    <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                      {featuredArticle.category}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {featuredArticle.readTime}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    {featuredArticle.title}
                  </h2>

                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    {featuredArticle.excerpt}
                  </p>

                  <div className="pt-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">By {featuredArticle.author} • {featuredArticle.date}</span>
                    <button
                      onClick={() => toast.info(`Opening article: ${featuredArticle.title}`)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-colors"
                    >
                      Read Full Article <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className={`w-full h-64 rounded-2xl bg-gradient-to-br ${featuredArticle.imageGradient} flex items-center justify-center p-6 shadow-inner`}>
                    <div className="text-center text-white space-y-2">
                      <Utensils className="w-12 h-12 mx-auto animate-bounce" />
                      <div className="font-extrabold text-lg">Restaurant Ops Playbook</div>
                      <div className="text-xs opacity-80">RVC Knowledge Base</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* ARTICLE GRID */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredArticles.map((art) => (
              <motion.article
                key={art.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-6 shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className={`w-full h-40 rounded-2xl bg-gradient-to-br ${art.imageGradient} mb-5 flex items-center justify-center`}>
                    <BookOpen className="w-10 h-10 text-white/90" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{art.category}</span>
                    <span>{art.readTime}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                    {art.title}
                  </h3>

                  <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed mb-4">
                    {art.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>{art.date}</span>
                  <button
                    onClick={() => toast.info(`Reading: ${art.title}`)}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    Read Guide →
                  </button>
                </div>
              </motion.article>
            ))}
          </section>

          {/* NEWSLETTER SUBSCRIPTION CARD */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-8 sm:p-12 text-center max-w-4xl mx-auto shadow-xl">
            <div className="max-w-xl mx-auto space-y-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 w-fit mx-auto">
                <Mail className="w-6 h-6" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Get Weekly Restaurant Growth Playbooks
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Join 2,500+ restaurant owners and SMB founders getting operational strategies delivered every Tuesday.
              </p>

              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 pt-2">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your business email address..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Subscribing...' : 'Subscribe Free 🚀'}
                </button>
              </form>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  )
}
