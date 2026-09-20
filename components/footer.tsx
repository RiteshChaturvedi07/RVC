'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Zap, Globe, Mail, MessageSquare, ShieldCheck } from 'lucide-react'

const footerSections = [
  {
    title: 'Products & Live OS',
    links: [
      { label: 'Restaurant OS (Live 🟢)', href: '/order/demo-restaurant/A-01' },
      { label: 'Gym OS (Early Access ⚡)', href: '/#solutions' },
      { label: 'School & College ERP', href: '/#solutions' },
      { label: 'Hospital HIS', href: '/#solutions' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog & Playbooks', href: '/blog' },
      { label: 'Careers (We’re Hiring)', href: '/careers' },
      { label: 'Contact & Support', href: '/contact' },
    ],
  },
  {
    title: 'Legal & Security',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Cookie Policy', href: '#' },
      { label: 'Security & RLS SLA', href: '#' },
    ],
  },
]

const socialLinks = [
  { icon: Globe, href: 'https://rvc.app', label: 'Website' },
  { icon: Zap, href: '/register', label: 'Launch' },
  { icon: MessageSquare, href: '/contact', label: 'Contact' },
  { icon: Mail, href: 'mailto:support@rvc.in', label: 'Email' },
]

export function Footer() {
  return (
    <footer className="bg-[#060911] text-slate-300 relative overflow-hidden border-t border-slate-800/80">
      {/* Decorative Glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-900/15 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 relative z-10">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 pb-12 border-b border-slate-800">
          
          {/* Brand Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform bg-slate-900 border border-slate-700/50">
                <img src="/rvc-logo.png" alt="RVC Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="font-extrabold text-xl text-white">RVC</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold block -mt-1">
                  Multi-Vertical OS
                </span>
              </div>
            </Link>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Digitizing businesses across Tier-2 and Tier-3 cities with zero aggregator commissions and sub-second QR dining workflows.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Tier-2/3 Tested & Resilient
            </div>
          </motion.div>

          {/* Nav Sections */}
          {footerSections.map((section, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: (idx + 1) * 0.1 }}
              viewport={{ once: true }}
            >
              <h4 className="font-bold text-white text-sm mb-4 uppercase tracking-wider text-indigo-400">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <Link
                      href={link.href}
                      className="text-slate-400 hover:text-indigo-400 transition-colors text-xs sm:text-sm font-medium"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-slate-400 text-xs text-center sm:text-left"
          >
            © 2026 RVC SaaS Platform. All rights reserved. One Platform. Every Business. Digitized.
          </motion.p>

          {/* Social Links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            viewport={{ once: true }}
            className="flex items-center gap-3"
          >
            {socialLinks.map((social, idx) => {
              const Icon = social.icon
              return (
                <Link
                  key={idx}
                  href={social.href}
                  aria-label={social.label}
                  className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-indigo-600 text-slate-400 hover:text-white flex items-center justify-center transition-all hover:scale-110 border border-slate-700/60"
                >
                  <Icon className="w-4 h-4" />
                </Link>
              )
            })}
          </motion.div>
        </div>
      </div>
    </footer>
  )
}
