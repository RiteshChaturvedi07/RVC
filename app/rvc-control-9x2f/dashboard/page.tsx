'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Building2, CircleDollarSign, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Snapshot = { tenants_total: number; active_tenants: number; trial_tenants: number; suspended_tenants: number; platform_users: number; mrr: number | string; verticals: { name: string; value: number }[]; activity: { id: string; action: string; details: Record<string, unknown> | null; created_at: string }[] }
const inr = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const colors = ['#6366f1', '#14b8a6', '#f59e0b', '#a855f7', '#ef4444', '#64748b']

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [name, setName] = useState('Administrator')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true); setError('')
    const { data: user } = await supabase.auth.getUser()
    if (user.user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.user.id).single()
      if (profile?.full_name) setName(profile.full_name)
    }
    const { data, error: rpcError } = await supabase.rpc('admin_dashboard_snapshot', { p_days: 30 })
    if (rpcError) setError(rpcError.message)
    else setSnapshot(data as Snapshot)
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  const health = snapshot ? [{ name: 'Active', value: snapshot.active_tenants, color: '#22c55e' }, { name: 'Trial', value: snapshot.trial_tenants, color: '#f59e0b' }, { name: 'Suspended', value: snapshot.suspended_tenants, color: '#ef4444' }] : []

  return <div className="space-y-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary">Platform command center</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {name.split(' ')[0]}.</h1><p className="mt-2 text-sm text-muted-foreground">Live view of RVC tenants, subscriptions, and platform operations.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}. Confirm migration <code>202608060002_admin_operations.sql</code> has been run and your profile role is <code>super_admin</code>.</div>}{loading && !snapshot ? <Loading /> : snapshot && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Monthly recurring revenue" value={inr(snapshot.mrr)} icon={CircleDollarSign} accent="bg-primary/15 text-primary" /><Metric label="Active businesses" value={snapshot.active_tenants.toLocaleString('en-IN')} icon={Building2} accent="bg-emerald-500/15 text-emerald-500" /><Metric label="Platform users" value={snapshot.platform_users.toLocaleString('en-IN')} icon={Users} accent="bg-violet-500/15 text-violet-500" /><Metric label="Security posture" value="Protected" icon={ShieldCheck} accent="bg-amber-500/15 text-amber-500" /></div><div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="text-sm font-semibold">Business adoption by vertical</h2><p className="mt-1 text-xs text-muted-foreground">Every registered business on the RVC platform.</p><ChartEmpty ready={snapshot.verticals.length > 0}><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={snapshot.verticals} layout="vertical" margin={{ left: 12, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }} /><Bar dataKey="value" fill="#6366f1" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer></div></ChartEmpty></section><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 className="text-sm font-semibold">Tenant health</h2><p className="mt-1 text-xs text-muted-foreground">Current account distribution.</p><ChartEmpty ready={snapshot.tenants_total > 0}><div className="mt-2 h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={health} dataKey="value" innerRadius={52} outerRadius={76} paddingAngle={4}>{health.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-2">{health.map((item) => <div key={item.name} className="flex justify-between text-sm"><span className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: item.color }} />{item.name}</span><b>{item.value}</b></div>)}</div></ChartEmpty></section></div><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Auditable activity</h2><p className="mt-1 text-xs text-muted-foreground">The latest actions recorded across RVC.</p></div><Activity className="size-5 text-primary" /></div>{snapshot.activity.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{snapshot.activity.map((event) => <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={event.id} className="rounded-xl bg-muted/45 p-4"><p className="font-mono text-xs font-semibold text-primary">{event.action}</p><p className="mt-2 text-sm text-muted-foreground">{event.details?.status ? `Status changed to ${String(event.details.status)}` : 'Platform action recorded'}</p><time className="mt-3 block text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString('en-IN')}</time></motion.article>)}</div> : <Empty text="No audit events yet. Tenant status changes and future admin actions will appear here." />}</section></>}</div>
}
function Metric({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Building2; accent: string }) { return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><span className={`grid size-10 place-items-center rounded-xl ${accent}`}><Icon className="size-5" /></span><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p></div> }
function ChartEmpty({ ready, children }: { ready: boolean; children: React.ReactNode }) { return ready ? children : <Empty text="Data will appear as businesses join your platform." /> }
function Empty({ text }: { text: string }) { return <div className="mt-5 grid min-h-40 place-items-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</div> }
function Loading() { return <div className="grid min-h-96 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><RefreshCw className="mb-3 size-5 animate-spin" />Loading platform data…</div> }
