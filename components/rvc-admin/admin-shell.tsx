'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react'

const sections = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', href: '/rvc-control-9x2f/dashboard', icon: LayoutDashboard },
      { label: 'Tenants', href: '/rvc-control-9x2f/dashboard/tenants', icon: Building2 },
      { label: 'SaaS Plans', href: '/rvc-control-9x2f/dashboard/plans', icon: CreditCard },
      { label: 'Billing & Plans', href: '/rvc-control-9x2f/dashboard/billing', icon: CreditCard },
      { label: 'Support', href: '/rvc-control-9x2f/dashboard/support', icon: CircleHelp },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/rvc-control-9x2f/dashboard/analytics', icon: BarChart3 },
      { label: 'Security', href: '/rvc-control-9x2f/dashboard/security', icon: ShieldCheck },
      { label: 'Activity', href: '/rvc-control-9x2f/dashboard/activity', icon: Activity },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Team', href: '/rvc-control-9x2f/dashboard/team', icon: Users },
      { label: 'Developer', href: '/rvc-control-9x2f/dashboard/developer', icon: Code2 },
      { label: 'Settings', href: '/rvc-control-9x2f/dashboard/settings', icon: Settings },
    ],
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [adminName, setAdminName] = useState('Administrator')
  const [checkingAccess, setCheckingAccess] = useState(true)

  useEffect(() => {
    const saved = window.localStorage.getItem('rvc-admin-theme')
    const isDark = saved ? saved === 'dark' : true
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  useEffect(() => {
    const verifyAdmin = async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { router.replace('/rvc-control-9x2f'); return }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', userData.user.id).single()
      if (profile?.role !== 'super_admin') { await supabase.auth.signOut(); router.replace('/rvc-control-9x2f'); return }
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assuranceError || (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) { router.replace('/enroll-mfa'); return }
      setAdminName(profile.full_name || 'Administrator')
      setCheckingAccess(false)
    }
    verifyAdmin()
  }, [router])

  const signOut = async () => {
    await createClient().auth.signOut()
    router.replace('/rvc-control-9x2f')
  }

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    window.localStorage.setItem('rvc-admin-theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  const pageTitle = useMemo(() => {
    const item = sections.flatMap((section) => section.items).find((entry) => entry.href === pathname)
    return item?.label ?? 'Overview'
  }, [pathname])

  const navigate = (href: string) => {
    router.push(href)
    setMobileOpen(false)
    setSearchOpen(false)
  }

  if (checkingAccess) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400 font-mono">Verifying secure access…</div>

  const initials = adminName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans">
      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-[#0d1322] transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-20 items-center justify-between border-b border-slate-800/80 px-5">
          <button type="button" onClick={() => navigate('/rvc-control-9x2f/dashboard')} className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl overflow-hidden bg-slate-900 shadow-lg border border-slate-700/50"><img src="/rvc-logo.png" alt="RVC Logo" className="w-full h-full object-cover" /></span>
            {!collapsed && <span className="min-w-0"><span className="block truncate text-sm font-bold tracking-tight text-white">RVC CONTROL</span><span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Headquarters</span></span>}
          </button>
          <button type="button" aria-label="Close navigation" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)}><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.label} className="mb-7">
              {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{section.label}</p>}
              <nav className="space-y-1" aria-label={section.label}>
                {section.items.map((item) => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  return (
                    <button key={item.href} type="button" onClick={() => navigate(item.href)} title={collapsed ? item.label : undefined} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'}`}>
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && active && <span className="ml-auto size-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800/80 p-3">
          <button type="button" onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-900/80 border border-slate-800/80 px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400 border border-indigo-500/30">{initials}</span>
            {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{adminName}</p><p className="truncate text-xs text-slate-400 font-mono">Super Admin</p></div>}
          </div>
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
          <div className="flex h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" aria-label="Open navigation" className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
            <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-xl p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:inline-flex" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</button>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{pageTitle}</p><p className="hidden text-xs text-slate-400 sm:block font-mono">RVC platform operations workspace</p></div>
            <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white"><Search className="size-5" /></button>
            <button type="button" aria-label="Notifications" onClick={() => setNotificationsOpen((value) => !value)} className="relative rounded-xl p-2.5 text-slate-400 hover:bg-slate-800 hover:text-white"><Bell className="size-5" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-emerald-400" /></button>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-800"><span className="grid size-9 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-md">{initials}</span><ChevronDown className="hidden size-4 text-slate-400 sm:block" /></button>
              <AnimatePresence>{profileOpen && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 w-52 rounded-2xl border border-slate-800 bg-[#0d1322] p-2 shadow-2xl z-50"><p className="px-3 py-2 text-xs text-slate-400 font-mono">Signed in as</p><p className="truncate px-3 pb-2 text-sm font-semibold text-white">{adminName}</p><button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => navigate('/rvc-control-9x2f/dashboard/settings')}>Account settings</button><button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10" onClick={signOut}>Sign out</button></motion.div>}</AnimatePresence>
            </div>
          </div>
          <AnimatePresence>{notificationsOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-slate-800/80 px-6 py-4 bg-[#0d1322]"><div className="mx-auto flex max-w-7xl items-center gap-3 text-sm"><span className="size-2 rounded-full bg-emerald-400 animate-pulse" /><span className="font-medium text-white">All systems operational.</span><span className="text-slate-400 font-mono">Live telemetry stream active.</span></div></motion.div>}</AnimatePresence>
        </header>

        <main className="w-full p-4 sm:p-6 lg:p-8 space-y-6">{children}</main>
      </div>

      <AnimatePresence>{searchOpen && <motion.div className="fixed inset-0 z-[60] bg-slate-950/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSearchOpen(false)}><motion.div className="mx-auto mt-[12vh] max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] shadow-2xl" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4"><Search className="size-5 text-slate-400" /><input autoFocus placeholder="Search tenants, invoices, users..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 font-mono" /><kbd className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-400 font-mono">ESC</kbd></div><div className="p-3"><p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">Quick navigation</p>{sections.flatMap((section) => section.items).slice(0, 5).map((item) => <button type="button" key={item.href} onClick={() => navigate(item.href)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-slate-800/80"><item.icon className="size-4 text-indigo-400" />{item.label}<ChevronRight className="ml-auto size-4 text-slate-500" /></button>)}</div></motion.div></motion.div>}</AnimatePresence>
    </div>
  )
}
