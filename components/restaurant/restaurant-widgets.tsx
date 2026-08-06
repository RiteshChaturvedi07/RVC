'use client'

import { motion } from 'framer-motion'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Clock3, IndianRupee, PackageCheck, Users } from 'lucide-react'

export const revenueData = [
  { day: 'Mon', revenue: 18400 }, { day: 'Tue', revenue: 22100 }, { day: 'Wed', revenue: 19800 }, { day: 'Thu', revenue: 26700 }, { day: 'Fri', revenue: 31100 }, { day: 'Sat', revenue: 38200 }, { day: 'Sun', revenue: 29400 },
]

export const orders = [
  { id: '#1048', table: 'T-06', items: 'Paneer Tikka, 2 Naan', total: 680, status: 'New', time: 'Just now', fresh: true },
  { id: '#1047', table: 'T-02', items: 'Butter Chicken, Rice', total: 920, status: 'Preparing', time: '6 min', fresh: false },
  { id: '#1046', table: 'T-11', items: 'Veg Thali x2', total: 740, status: 'Ready', time: '11 min', fresh: false },
  { id: '#1045', table: 'Takeaway', items: 'Masala Dosa, Chai', total: 320, status: 'Served', time: '18 min', fresh: false },
]

export const statusClasses: Record<string, string> = { New: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300', Preparing: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', Ready: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', Served: 'bg-slate-500/15 text-slate-600 dark:text-slate-300', Paid: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', Cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300' }

export function RestaurantStatCard({ title, value, change, icon: Icon, trend = 'up' }: { title: string; value: string; change: string; icon: React.ElementType; trend?: 'up' | 'down' }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={19} /></div></div><div className="mt-4 flex items-center gap-1 text-xs"><span className={trend === 'up' ? 'text-emerald-600' : 'text-red-600'}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}</span><span className="text-muted-foreground">vs yesterday</span></div></motion.div>
}

export function RevenueChart({ compact = false }: { compact?: boolean }) {
  return <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={revenueData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}><defs><linearGradient id="restaurantRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4338CA" stopOpacity={0.32} /><stop offset="100%" stopColor="#4338CA" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><YAxis hide={compact} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `INR ${value / 1000}k`} /><Tooltip formatter={(value) => [`INR ${Number(value).toLocaleString('en-IN')}`, 'Revenue']} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Area type="monotone" dataKey="revenue" stroke="#4338CA" strokeWidth={3} fill="url(#restaurantRevenue)" animationDuration={900} /></AreaChart></ResponsiveContainer></div>
}

export function TopItemsChart() {
  const data = [{ name: 'Butter Chicken', orders: 128 }, { name: 'Paneer Tikka', orders: 102 }, { name: 'Garlic Naan', orders: 96 }, { name: 'Veg Thali', orders: 84 }, { name: 'Masala Chai', orders: 72 }]
  return <div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={105} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /><Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} /><Bar dataKey="orders" fill="#F59E0B" radius={[0, 6, 6, 0]} animationDuration={900} /></BarChart></ResponsiveContainer></div>
}

export const statIcons = { revenue: IndianRupee, orders: PackageCheck, tables: Users, average: Clock3 }
