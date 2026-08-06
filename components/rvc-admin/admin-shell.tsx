'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
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

  useEffect(() => {
    const saved = window.localStorage.getItem('rvc-admin-theme')
    const isDark = saved ? saved === 'dark' : true
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

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

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-20 items-center justify-between border-b border-border px-5">
          <button type="button" onClick={() => navigate('/rvc-control-9x2f/dashboard')} className="flex min-w-0 items-center gap-3 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><LockKeyhole className="size-5" /></span>
            {!collapsed && <span className="min-w-0"><span className="block truncate text-sm font-bold tracking-tight">RVC CONTROL</span><span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Headquarters</span></span>}
          </button>
          <button type="button" aria-label="Close navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setMobileOpen(false)}><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.label} className="mb-7">
              {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{section.label}</p>}
              <nav className="space-y-1" aria-label={section.label}>
                {section.items.map((item) => {
                  const active = pathname === item.href
                  const Icon = item.icon
                  return (
                    <button key={item.href} type="button" onClick={() => navigate(item.href)} title={collapsed ? item.label : undefined} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                      <Icon className="size-[18px] shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && active && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3">
          <button type="button" onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">AK</span>
            {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">Arjun Kapoor</p><p className="truncate text-xs text-muted-foreground">Super Admin</p></div>}
          </div>
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="flex h-20 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" aria-label="Open navigation" className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
            <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-xl p-2.5 text-muted-foreground hover:bg-muted lg:inline-flex" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</button>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{pageTitle}</p><p className="hidden text-xs text-muted-foreground sm:block">RVC platform operations workspace</p></div>
            <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Search className="size-5" /></button>
            <button type="button" aria-label="Notifications" onClick={() => setNotificationsOpen((value) => !value)} className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="size-5" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" /></button>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-muted"><span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">AK</span><ChevronDown className="hidden size-4 text-muted-foreground sm:block" /></button>
              <AnimatePresence>{profileOpen && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 w-48 rounded-2xl border border-border bg-card p-2 shadow-2xl"><p className="px-3 py-2 text-xs text-muted-foreground">Signed in as</p><p className="px-3 pb-2 text-sm font-semibold">Arjun Kapoor</p><button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => navigate('/rvc-control-9x2f/dashboard/settings')}>Account settings</button><button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => router.push('/rvc-control-9x2f')}>Sign out</button></motion.div>}</AnimatePresence>
            </div>
          </div>
          <AnimatePresence>{notificationsOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-t border-border px-6 py-4"><div className="mx-auto flex max-w-7xl items-center gap-3 text-sm"><span className="size-2 rounded-full bg-emerald-500" /><span className="font-medium">All systems operational.</span><span className="text-muted-foreground">3 new tenant events require review.</span></div></motion.div>}</AnimatePresence>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <AnimatePresence>{searchOpen && <motion.div className="fixed inset-0 z-[60] bg-slate-950/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSearchOpen(false)}><motion.div className="mx-auto mt-[12vh] max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-border px-5 py-4"><Search className="size-5 text-muted-foreground" /><input autoFocus placeholder="Search tenants, invoices, users..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><kbd className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground">ESC</kbd></div><div className="p-3"><p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick navigation</p>{sections.flatMap((section) => section.items).slice(0, 5).map((item) => <button type="button" key={item.href} onClick={() => navigate(item.href)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-muted"><item.icon className="size-4 text-primary" />{item.label}<ChevronRight className="ml-auto size-4 text-muted-foreground" /></button>)}</div></motion.div></motion.div>}</AnimatePresence>
    </div>
  )
}
