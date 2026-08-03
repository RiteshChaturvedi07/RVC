'use client'

import { motion } from 'framer-motion'
import { BookOpen, Stethoscope, Users, Utensils, TrendingUp, Sparkles } from 'lucide-react'

const solutions = [
  {
    id: 1,
    name: 'School ERP',
    description: 'Attendance, fees, exams, parent-teacher communication',
    icon: BookOpen,
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 2,
    name: 'College / Institute ERP',
    description: 'Admissions, courses, faculty, student records',
    icon: Users,
    color: 'from-purple-400 to-purple-600',
  },
  {
    id: 3,
    name: 'Hospital HIS',
    description: 'Patient records, appointments, billing, staff management',
    icon: Stethoscope,
    color: 'from-red-400 to-red-600',
  },
  {
    id: 4,
    name: 'Gym Management',
    description: 'Memberships, attendance, fee reminders, diet/workout tracking',
    icon: TrendingUp,
    color: 'from-green-400 to-green-600',
  },
  {
    id: 5,
    name: 'Restaurant POS',
    description: 'QR ordering, table management, billing, WhatsApp alerts',
    icon: Utensils,
    color: 'from-orange-400 to-orange-600',
  },
  {
    id: 6,
    name: 'More Coming Soon',
    description: 'Check back for exciting new verticals and features',
    icon: Sparkles,
    color: 'from-indigo-400 to-indigo-600',
    comingSoon: true,
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

export function SolutionsGrid() {
  return (
    <section id="solutions" className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-indigo-100 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-100 dark:bg-amber-900/10 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            <span className="text-slate-900 dark:text-white">What We</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
              Provide
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Professional software solutions tailored for every type of business in Tier-2 and Tier-3 cities
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {solutions.map((solution) => {
            const Icon = solution.icon
            return (
              <motion.div
                key={solution.id}
                variants={itemVariants}
                whileHover={{ y: -10, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                className={`relative p-8 rounded-2xl backdrop-blur-sm border transition-all cursor-pointer group ${
                  solution.comingSoon
                    ? 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400'
                }`}
              >
                {/* Gradient Border Animation */}
                {!solution.comingSoon && (
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${solution.color} opacity-0 group-hover:opacity-10 blur`} />
                  </div>
                )}

                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${solution.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {solution.name}
                </h3>

                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  {solution.description}
                </p>

                {solution.comingSoon && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
                    Coming Soon
                  </div>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
