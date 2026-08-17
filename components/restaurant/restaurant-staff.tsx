'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle2,
  ChefHat,
  Crown,
  Edit3,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

export type StaffAssignment = {
  role_label: string
  permissions: string[]
  is_active: boolean
}

export type StaffMember = {
  id: string
  full_name: string | null
  phone: string | null
  email?: string | null
  role: string
  created_at?: string
  restaurant_staff_assignments: StaffAssignment | null
}

export const WORKSPACES = [
  { id: 'Overview', label: 'Overview & Live Dashboard', desc: 'Main command center & metrics' },
  { id: 'Kitchen', label: 'Kitchen Display System (KDS)', desc: 'Live ticket queue & cook checklist' },
  { id: 'Orders', label: 'Orders & Bill Settlements', desc: 'Active orders & checkout POS' },
  { id: 'Tables & QR', label: 'Tables & QR Management', desc: 'Floor plan & QR code generator' },
  { id: 'Menu Builder', label: 'Menu Builder & Pricing', desc: 'Items, categories & pricing' },
  { id: 'Inventory', label: 'Kitchen Inventory & Stock', desc: 'Ingredients & stock levels' },
  { id: 'Analytics', label: 'Analytics & Revenue', desc: 'BI reports & sales CSV exports' },
  { id: 'Marketing', label: 'Marketing & WhatsApp Campaigns', desc: 'Promos & customer outreach' },
  { id: 'Finance', label: 'Finance & Daily Settlements', desc: 'Expenses & daily cash register' },
  { id: 'Staff', label: 'Staff & Team Management', desc: 'User roles & RBAC access control' },
]

export const ROLE_PRESETS: Record<string, string[]> = {
  'Store Manager': WORKSPACES.map((w) => w.id),
  'Kitchen Chef': ['Kitchen', 'Inventory'],
  'Floor Waiter': ['Overview', 'Orders', 'Tables & QR'],
  Cashier: ['Overview', 'Orders', 'Finance', 'Billing'],
  Custom: ['Orders'],
}

export function RestaurantStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Modal Form State
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    roleLabel: 'Floor Waiter',
    permissions: ROLE_PRESETS['Floor Waiter'],
  })

  // Load Staff Members & Assignments from Supabase
  const loadStaff = async () => {
    setLoading(true)
    try {
      const db = createClient()
      const tenantId = await currentRestaurantTenant()

      const { data, error: dbError } = await db
        .from('profiles')
        .select(
          'id,full_name,phone,email,role,created_at,restaurant_staff_assignments(role_label,permissions,is_active)'
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (dbError) throw dbError
      setStaff((data ?? []) as unknown as StaffMember[])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load restaurant team')
    } fontally: {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaff()
  }, [])

  // Open Modal for Add or Edit
  const openModal = (member?: StaffMember) => {
    setEditingStaff(member || null)
    if (member) {
      const currentRole = member.restaurant_staff_assignments?.role_label || 'Floor Waiter'
      const currentPerms = member.restaurant_staff_assignments?.permissions || ROLE_PRESETS[currentRole] || ['Orders']
      setForm({
        email: member.email || '',
        fullName: member.full_name || '',
        roleLabel: currentRole,
        permissions: currentPerms,
      })
    } else {
      setForm({
        email: '',
        fullName: '',
        roleLabel: 'Floor Waiter',
        permissions: ROLE_PRESETS['Floor Waiter'],
      })
    }
    setModalOpen(true)
  }

  // Handle Role Selection Preset
  const handleRolePresetChange = (presetName: string) => {
    const defaultPerms = ROLE_PRESETS[presetName] || ['Orders']
    setForm((prev) => ({
      ...prev,
      roleLabel: presetName,
      permissions: presetName === 'Custom' ? prev.permissions : defaultPerms,
    }))
  }

  // Handle Checkbox Permission Toggle
  const togglePermission = (workspaceId: string) => {
    setForm((prev) => {
      const exists = prev.permissions.includes(workspaceId)
      const nextPerms = exists
        ? prev.permissions.filter((p) => p !== workspaceId)
        : [...prev.permissions, workspaceId]

      return {
        ...prev,
        roleLabel: 'Custom',
        permissions: nextPerms,
      }
    })
  }

  // Save Staff Assignment
  const handleSaveStaff = async () => {
    setIsSaving(true)
    setNotice('')
    try {
      const db = createClient()
      let profileId = editingStaff?.id

      if (!profileId) {
        if (!form.email.trim()) {
          setNotice('Please enter a registered RVC email address.')
          setIsSaving(false)
          return
        }

        // RPC call to add staff member by email
        const { data: addResult, error: addError } = await db.rpc('restaurant_add_staff', {
          p_email: form.email.trim(),
        })

        if (addError) {
          throw new Error(addError.message || 'Staff email not found in RVC user directory.')
        }

        profileId = addResult?.id
      }

      if (!profileId) {
        throw new Error('Staff account ID could not be identified.')
      }

      // Save assignment permissions
      const { error: assignError } = await db.rpc('restaurant_save_staff_assignment', {
        p_profile_id: profileId,
        p_role_label: form.roleLabel,
        p_permissions: form.permissions,
      })

      if (assignError) {
        // Fallback direct table upsert if RPC unavailable
        const tenantId = await currentRestaurantTenant()
        await db.from('restaurant_staff_assignments').upsert({
          profile_id: profileId,
          tenant_id: tenantId,
          role_label: form.roleLabel,
          permissions: form.permissions,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
      }

      setModalOpen(false)
      setNotice(`✅ Access rights saved for ${form.fullName || form.email || 'staff member'}.`)
      await loadStaff()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save staff access permissions.')
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle Active/Suspended Status
  const handleToggleStatus = async (member: StaffMember) => {
    try {
      const db = createClient()
      const currentActive = member.restaurant_staff_assignments?.is_active ?? true
      const nextActive = !currentActive

      const { error } = await db
        .from('restaurant_staff_assignments')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('profile_id', member.id)

      if (error) throw error
      await loadStaff()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update status')
    }
  }

  // Revoke Staff Access
  const handleRevokeStaff = async (member: StaffMember) => {
    if (!confirm(`Revoke access for ${member.full_name || member.email || 'this staff member'}?`)) return
    try {
      const db = createClient()
      const { error: rpcError } = await db.rpc('restaurant_remove_staff', {
        p_profile_id: member.id,
      })

      if (rpcError) {
        // Direct delete fallback
        await db.from('restaurant_staff_assignments').delete().eq('profile_id', member.id)
      }

      setNotice(`Staff access revoked for ${member.full_name || 'user'}.`)
      await loadStaff()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke access')
    }
  }

  // Role Badge Helper
  const renderRoleBadge = (member: StaffMember) => {
    const isOwner = member.role === 'tenant_owner'
    const roleLabel = isOwner
      ? 'Owner'
      : member.restaurant_staff_assignments?.role_label || 'Unassigned'

    if (isOwner || roleLabel.toLowerCase().includes('manager')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 px-2.5 py-1 text-xs font-black uppercase tracking-wider">
          <Crown className="size-3.5 text-amber-500" />
          <span>👑 {roleLabel}</span>
        </span>
      )
    }

    if (roleLabel.toLowerCase().includes('kitchen') || roleLabel.toLowerCase().includes('chef')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-800 dark:text-sky-300 px-2.5 py-1 text-xs font-black uppercase tracking-wider">
          <ChefHat className="size-3.5 text-sky-500" />
          <span>👨‍🍳 {roleLabel}</span>
        </span>
      )
    }

    if (roleLabel.toLowerCase().includes('waiter') || roleLabel.toLowerCase().includes('service') || roleLabel.toLowerCase().includes('floor')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 text-xs font-black uppercase tracking-wider">
          <Utensils className="size-3.5 text-emerald-500" />
          <span>🍽️ {roleLabel}</span>
        </span>
      )
    }

    if (roleLabel.toLowerCase().includes('cashier') || roleLabel.toLowerCase().includes('billing')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-800 dark:text-purple-300 px-2.5 py-1 text-xs font-black uppercase tracking-wider">
          <Briefcase className="size-3.5 text-purple-500" />
          <span>💼 {roleLabel}</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 text-xs font-bold">
        <span>⚙️ {roleLabel}</span>
      </span>
    )
  }

  // Filter staff members by Search & Role Pill
  const filteredStaff = staff.filter((s) => {
    const searchText = `${s.full_name || ''} ${s.email || ''} ${s.phone || ''} ${
      s.restaurant_staff_assignments?.role_label || ''
    }`.toLowerCase()
    const matchesQuery = searchText.includes(query.toLowerCase())

    if (!matchesQuery) return false

    const roleStr = (s.restaurant_staff_assignments?.role_label || s.role).toLowerCase()
    if (roleFilter === 'manager') return roleStr.includes('manager') || s.role === 'tenant_owner'
    if (roleFilter === 'kitchen') return roleStr.includes('kitchen') || roleStr.includes('chef')
    if (roleFilter === 'service') return roleStr.includes('waiter') || roleStr.includes('service') || roleStr.includes('floor')
    if (roleFilter === 'cashier') return roleStr.includes('cashier') || roleStr.includes('billing')

    return true
  })

  // KPI Metrics
  const countTotal = staff.length
  const countManagers = staff.filter(
    (s) => s.role === 'tenant_owner' || s.restaurant_staff_assignments?.role_label?.toLowerCase().includes('manager')
  ).length
  const countKitchen = staff.filter((s) =>
    s.restaurant_staff_assignments?.role_label?.toLowerCase().includes('kitchen')
  ).length
  const countService = staff.filter((s) =>
    ['waiter', 'service', 'floor', 'cashier'].some((r) =>
      s.restaurant_staff_assignments?.role_label?.toLowerCase().includes(r)
    )
  ).length

  if (loading && !staff.length) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-slate-500 dark:text-slate-400">
        <RefreshCw className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-base font-semibold">Loading Authorized Staff RBAC Directory…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 selection:bg-primary selection:text-white">
      {/* HEADER & ACTION BAR */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="size-4" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Staff RBAC &amp; Access Control
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Email-based Role-Based Access Control. Assign workspace permissions per team member.
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95 shrink-0"
        >
          <UserPlus className="size-4" />
          <span>➕ Add Staff Member</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 1. SUMMARY KPI ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary border border-primary/20">
              <Users className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Team
              </span>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {countTotal} <span className="text-xs font-bold text-slate-400">Members</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Crown className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Store Managers
              </span>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {countManagers} <span className="text-xs font-bold text-slate-400 font-normal">Full Access</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <ChefHat className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kitchen Staff
              </span>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {countKitchen} <span className="text-xs font-bold text-slate-400 font-normal">KDS Team</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Utensils className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Service &amp; Floor
              </span>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {countService} <span className="text-xs font-bold text-slate-400 font-normal">Floor Staff</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH & ROLE FILTER BAR */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter staff by email, name, or role…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Role Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setRoleFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              roleFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Roles
          </button>
          <button
            onClick={() => setRoleFilter('manager')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              roleFilter === 'manager'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            👑 Managers
          </button>
          <button
            onClick={() => setRoleFilter('kitchen')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              roleFilter === 'kitchen'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-sky-700 dark:text-sky-400 hover:bg-sky-500/10'
            }`}
          >
            👨‍🍳 Kitchen
          </button>
          <button
            onClick={() => setRoleFilter('service')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              roleFilter === 'service'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            🍽️ Service
          </button>
          <button
            onClick={() => setRoleFilter('cashier')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              roleFilter === 'cashier'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-700 dark:text-purple-400 hover:bg-purple-500/10'
            }`}
          >
            💼 Cashiers
          </button>
        </div>
      </div>

      {/* 2. HIGH-DENSITY TEAM DATA TABLE */}
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Staff Member</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Allowed Workspaces</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredStaff.map((member) => {
                const isOwner = member.role === 'tenant_owner'
                const isActive = member.restaurant_staff_assignments?.is_active ?? true
                const permissionsList = isOwner
                  ? WORKSPACES.map((w) => w.id)
                  : member.restaurant_staff_assignments?.permissions || []

                const initials = (member.full_name || member.email || 'Staff')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Staff Member Avatar & Subtitle */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-black text-xs shadow-sm">
                          {initials}
                        </span>
                        <div>
                          <b className="text-sm font-bold text-slate-900 dark:text-white block">
                            {member.full_name || 'Unnamed Staff Member'}
                          </b>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                            {member.email || member.phone || 'No contact email'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="p-4">{renderRoleBadge(member)}</td>

                    {/* Allowed Workspaces Tags */}
                    <td className="p-4">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          ⭐ All Workspaces Unlocked
                        </span>
                      ) : permissionsList.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {permissionsList.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-rose-500 font-semibold italic">No workspaces permitted</span>
                      )}
                    </td>

                    {/* Status Toggle */}
                    <td className="p-4">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" /> 🟢 Active Owner
                        </span>
                      ) : (
                        <button
                          onClick={() => void handleToggleStatus(member)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold transition-all ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`size-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{isActive ? 'Active' : 'Suspended'}</span>
                        </button>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(member)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs"
                          title="Edit Staff Access Rights"
                        >
                          <Edit3 className="size-3.5 text-primary" />
                          <span>Edit</span>
                        </button>

                        {!isOwner && (
                          <button
                            onClick={() => void handleRevokeStaff(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all shadow-xs"
                            title="Revoke Access Rights"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="hidden sm:inline">Revoke</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!filteredStaff.length && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No matching staff members found. Click "Add Staff Member" above to authorize team members by email.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. ADD / EDIT STAFF MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {editingStaff ? 'Edit Staff Permissions' : 'Authorize Staff Member'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Email Input */}
            {!editingStaff ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Registered RVC Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 size-4 text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="staff.name@example.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400 font-medium">
                  When this user logs into their RVC account, they will automatically gain access to checked workspaces below.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800">
                <b className="text-sm font-bold text-slate-900 dark:text-white block">
                  {editingStaff.full_name || 'Staff Member'}
                </b>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
                  {editingStaff.email || editingStaff.phone || 'Account ID: ' + editingStaff.id}
                </span>
              </div>
            )}

            {/* Role Preset Dropdown */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Assigned Role Preset
              </label>
              <select
                value={form.roleLabel}
                onChange={(e) => handleRolePresetChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
              >
                <option value="Store Manager">👑 Store Manager (Full Access)</option>
                <option value="Kitchen Chef">👨‍🍳 Kitchen Chef (KDS &amp; Inventory)</option>
                <option value="Floor Waiter">🍽️ Floor Waiter (Overview, Orders, Tables)</option>
                <option value="Cashier">💼 Cashier (Overview, Orders, Finance, Billing)</option>
                <option value="Custom">⚙️ Custom Workspace Selection</option>
              </select>
            </div>

            {/* Workspace Permission Checkbox Grid (10 Workspaces) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Permitted Workspaces ({form.permissions.length} selected)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                {WORKSPACES.map((ws) => {
                  const checked = form.permissions.includes(ws.id)
                  return (
                    <div
                      key={ws.id}
                      onClick={() => togglePermission(ws.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border select-none cursor-pointer transition-all ${
                        checked
                          ? 'bg-primary/10 border-primary/40 text-slate-900 dark:text-slate-100 font-bold'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}} // Handled by div click
                        className="mt-0.5 size-4 rounded text-primary focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold block">{ws.label}</span>
                        <span className="text-[10px] text-slate-400 block leading-tight font-normal">
                          {ws.desc}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveStaff()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary hover:opacity-90 px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                <span>Save Staff Rights</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
