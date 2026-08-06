'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type TenantInfo = {
  name: string
  vertical: string
  status: string
  subscription_plan: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('')
  const [tenant, setTenant] = useState<TenantInfo | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, tenant_id')
        .eq('id', userData.user.id)
        .single()

      if (!profile) {
        router.push('/login')
        return
      }

      setFullName(profile.full_name ?? '')
      setRole(profile.role)

      if (profile.tenant_id) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('name, vertical, status, subscription_plan')
          .eq('id', profile.tenant_id)
          .single()

        setTenant(tenantData)
      }

      setLoading(false)
    }

    loadDashboard()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            RVC
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">RVC Dashboard</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Welcome{fullName ? `, ${fullName}` : ''}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Role: <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
          </p>

          {tenant ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg">
                  <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">{tenant.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{tenant.vertical}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Status</p>
                  <p className="font-medium text-slate-900 dark:text-white capitalize">{tenant.status}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Plan</p>
                  <p className="font-medium text-slate-900 dark:text-white capitalize">{tenant.subscription_plan}</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-6">
                This is a placeholder dashboard. Vertical-specific modules (e.g. restaurant menu, school attendance) will be added here next.
              </p>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No business linked to this account yet.</p>
          )}
        </motion.div>
      </main>
    </div>
  )
}
