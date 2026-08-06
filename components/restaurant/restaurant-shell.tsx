'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3, Bell, Boxes, ChefHat, ChevronDown, CircleHelp, CreditCard,
  DollarSign, FileText, Grid2X2, LayoutDashboard, Menu, Moon, PanelLeft,
  Search, Settings, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Users, X,
} from 'lucide-react'

const nav = [
  { label: 'Overview', href: '/restaurant-dashboard', icon: LayoutDashboard },
  { label: 'Orders', href: '/restaurant-dashboard/orders', icon: ShoppingBag },
  { label: 'Tables & QR', href: '/restaurant-dashboard/tables', icon: Grid2X2 },
  { label: 'Kitchen', href: '/restaurant-dashboard/kitchen', icon: ChefHat },
  { label: 'Menu Builder', href: '/restaurant-dashboard/menu', icon: FileText },
  { label: 'Inventory', href: '/restaurant-dashboard/inventory', icon: Boxes },
  { label: 'Customers', href: '/restaurant-dashboard/customers', icon: Users },
  { label: 'Marketing', href: '/restaurant-dashboard/marketing', icon: Sparkles },
  { label: 'Analytics', href: '/restaurant-dashboard/analytics', icon: BarChart3 },
  { label: 'Finance', href: '/restaurant-dashboard/finance', icon: DollarSign },
  { label: 'Staff', href: '/restaurant-dashboard/staff', icon: Users },
  { label: 'Billing', href: '/restaurant-dashboard/billing', icon: CreditCard },
  { label: 'Support', href: '/restaurant-dashboard/support', icon: CircleHelp },
  { label: 'Settings', href: '/restaurant-dashboard/settings', icon: Settings },
]

export function RestaurantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('rvc-restaurant-theme')
    const isDark = stored ? stored === 'dark' : document.documentElement.classList.contains('dark')
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const activeLabel = useMemo(() => nav.find((item) => item.href === pathname)?.label ?? 'Overview', [pathname])
  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('rvc-restaurant-theme', next ? 'dark' : 'light')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-card transition-all lg:block ${collapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-border px-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><ChefHat size={20} /></div>
            {!collapsed && <div className="min-w-0"><p className="truncate font-semibold">Spice Kitchen</p><p className="text-xs text-muted-foreground">Restaurant workspace</p></div>}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {nav.map((item) => {
              const Icon = item.icon
              const active = item.href === '/restaurant-dashboard' ? pathname === item.href : pathname.startsWith(item.href)
              return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Icon size={18} /><span className={collapsed ? 'sr-only' : ''}>{item.label}</span></Link>
            })}
          </nav>
          <div className="border-t border-border p-3">
            <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-secondary"><div className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground font-semibold">RK</div>{!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Rajesh Kumar</p><p className="truncate text-xs text-muted-foreground">Owner</p></div>} {!collapsed && <ChevronDown size={15} />}</button>
          </div>
        </div>
      </aside>

      <AnimatePresence>{mobileOpen && <><motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} /><motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card lg:hidden"><div className="flex h-full flex-col"><div className="flex h-20 items-center justify-between border-b border-border px-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><ChefHat size={20} /></div><div><p className="font-semibold">Spice Kitchen</p><p className="text-xs text-muted-foreground">Restaurant workspace</p></div></div><button aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button></div><nav className="flex-1 space-y-1 overflow-y-auto p-3">{nav.map((item) => { const Icon = item.icon; const active = item.href === '/restaurant-dashboard' ? pathname === item.href : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Icon size={18} />{item.label}</Link> })}</nav></div></motion.aside></>}</AnimatePresence>

      <div className={`min-h-screen transition-[padding] ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 hover:bg-secondary lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <button className="hidden rounded-lg p-2 hover:bg-secondary lg:block" aria-label="Collapse sidebar" onClick={() => setCollapsed((value) => !value)}><PanelLeft size={19} /></button>
          <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Restaurant workspace</p><h1 className="truncate text-lg font-semibold">{activeLabel}</h1></div>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground md:flex"><Search size={16} /><span>Search anything</span><kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">⌘ K</kbd></div>
          <button className="relative rounded-lg p-2 hover:bg-secondary" aria-label="Notifications"><Bell size={19} /><span className="absolute right-1 top-1 size-2 rounded-full bg-accent" /></button>
          <button className="rounded-lg p-2 hover:bg-secondary" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
          <button className="hidden rounded-xl border border-border bg-card px-3 py-2 text-sm md:flex md:items-center md:gap-2"><SlidersHorizontal size={15} /> Today <ChevronDown size={15} /></button>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
