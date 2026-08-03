'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'

interface HeaderProps {
  isDark: boolean
  onThemeToggle: () => void
}

export function Header({ isDark, onThemeToggle }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    setIsOpen(false)
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? isDark
            ? 'bg-slate-900/80 backdrop-blur border-b border-slate-700'
            : 'bg-white/80 backdrop-blur border-b border-slate-200'
          : isDark
            ? 'bg-slate-900/50'
            : 'bg-white/50'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">R</span>
          </div>
          <span className="font-bold text-lg hidden sm:inline bg-gradient-to-r from-indigo-600 to-indigo-700 bg-clip-text text-transparent">
            RVC
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <button
            onClick={() => scrollToSection('solutions')}
            className="text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Solutions
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Pricing
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            About
          </button>
        </div>

        {/* Right Side - Theme Toggle & CTA */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onThemeToggle}
            className="p-2 rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-600" />
            )}
          </button>

          <Link
            href="/register"
            className="hidden sm:inline-block px-6 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-indigo-500/50 transition-all hover:scale-105"
          >
            Get Started
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`md:hidden border-t ${
            isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="px-4 py-4 space-y-3">
            <button
              onClick={() => scrollToSection('solutions')}
              className="block w-full text-left px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Solutions
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="block w-full text-left px-4 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              About
            </button>
            <Link
              href="/register"
              className="block w-full text-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              Get Started
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
