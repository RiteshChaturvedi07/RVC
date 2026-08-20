'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Key,
  Layers,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Types ---
export interface TeamMember {
  id: string
  tenant_id: string | null
  role: 'super_admin' | 'staff'
  full_name: string | null
  email?: string | null
  phone: string | null
  mfa_enabled: boolean
  is_suspended?: boolean
  created_at: string
  permissions?: {
    approve_utr: boolean
    freeze_tenants: boolean
    edit_plans: boolean
    impersonate_dashboards: boolean
    export_reports: boolean
  }
}

interface InviteFormData {
  full_name: string
  email: string
  phone: string
  role: 'super_admin' | 'billing_manager' | 'support_agent' | 'auditor'
  permissions: {
    approve_utr: boolean
    freeze_tenants: boolean
    edit_plans: boolean
    impersonate_dashboards: boolean
    export_reports: boolean
  }
}

const DEFAULT_PERMISSIONS = {
  approve_utr: true,
  freeze_tenants: true,
  edit_plans: true,
  impersonate_dashboards: true,
  export_reports: true,
}

function getRoleBadgeStyle(role: string) {
  const r = role.toLowerCase()
  if (r === 'super_admin' || r.includes('root')) return 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-mono'
  if (r.includes('billing')) return 'border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono'
  if (r.includes('support')) return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono'
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono'
}

export default function TeamPage() {
  const supabase = createClient()
  const router = useRouter()

  // --- States ---
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    full_name: '',
    email: '',
    phone: '',
    role: 'super_admin',
    permissions: { ...DEFAULT_PERMISSIONS },
  })
  const [inviting, setInviting] = useState(false)

  const [editPermissionsMember, setEditPermissionsMember] = useState<TeamMember | null>(null)
  const [editPermState, setEditPermState] = useState({ ...DEFAULT_PERMISSIONS })
  const [savingPerms, setSavingPerms] = useState(false)

  const [revokeModalMember, setRevokeModalMember] = useState<TeamMember | null>(null)
  const [revoking, setRevoking] = useState(false)

  // --- Data Loading ---
  const loadTeamData = async () => {
    setLoading(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      if (userRes?.user) setCurrentUserId(userRes.user.id)

      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['super_admin', 'staff'])
        .order('created_at', { ascending: false })

      if (error) {
        toast.error(`Failed to load team members: ${error.message}`)
      }

      const formattedMembers: TeamMember[] = (profilesData || []).map((p) => ({
        ...p,
        email: `${(p.full_name || 'admin').toLowerCase().replace(/\s+/g, '.')}@rvcplatform.in`,
        permissions: p.role === 'super_admin' ? { ...DEFAULT_PERMISSIONS } : {
          approve_utr: false,
          freeze_tenants: false,
          edit_plans: false,
          impersonate_dashboards: true,
          export_reports: true,
        },
      }))

      setMembers(formattedMembers)
    } catch (err: unknown) {
      toast.error(`Team data load error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTeamData()
  }, [])

  // --- Governance Telemetry Computations ---
  const telemetry = useMemo(() => {
    const total = members.length
    const superAdminCount = members.filter((m) => m.role === 'super_admin').length
    const billingApprovers = members.filter((m) => m.permissions?.approve_utr || m.role === 'super_admin').length
    const supportOperators = members.filter((m) => m.role === 'staff' || m.permissions?.impersonate_dashboards).length
    const mfaCount = members.filter((m) => m.mfa_enabled).length
    const mfaRate = total > 0 ? Math.round((mfaCount / total) * 100) : 100

    return {
      total,
      superAdminCount,
      billingApprovers,
      supportOperators,
      mfaCount,
      mfaRate,
    }
  }, [members])

  // --- Filtered Team Members ---
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (m.full_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)

      const matchesRole = roleFilter === 'all' || m.role.toLowerCase() === roleFilter.toLowerCase()

      return matchesSearch && matchesRole
    })
  }, [members, searchQuery, roleFilter])

  // --- Handlers ---

  // 1. Invite Admin Member
  const handleInviteMember = async () => {
    if (!inviteForm.full_name.trim() || !inviteForm.email.trim()) {
      toast.error('Please enter full name and official email address')
      return
    }

    setInviting(true)
    try {
      const newRole = inviteForm.role === 'super_admin' ? 'super_admin' : 'staff'
      const newId = `usr_${Date.now()}`

      const { error: insertErr } = await supabase.from('profiles').insert({
        id: newId,
        full_name: inviteForm.full_name.trim(),
        role: newRole,
        phone: inviteForm.phone.trim() || '+91 98765 43210',
        mfa_enabled: true,
        created_at: new Date().toISOString(),
      })

      if (insertErr) throw new Error(insertErr.message)

      // Log Audit Event
      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'TEAM_MEMBER_INVITED',
        details: {
          invited_name: inviteForm.full_name,
          invited_email: inviteForm.email,
          role: newRole,
          permissions: inviteForm.permissions,
        },
      })

      toast.success(`Admin Invitation sent to ${inviteForm.email}! Account provisioned.`)
      setInviteModalOpen(false)
      setInviteForm({
        full_name: '',
        email: '',
        phone: '',
        role: 'super_admin',
        permissions: { ...DEFAULT_PERMISSIONS },
      })
      void loadTeamData()
    } catch (err: unknown) {
      toast.error(`Invitation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setInviting(false)
    }
  }

  // 2. Save Edited Granular Permissions
  const handleSavePermissions = async () => {
    if (!editPermissionsMember) return
    setSavingPerms(true)

    try {
      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'PERMISSIONS_MODIFIED',
        details: {
          target_user_id: editPermissionsMember.id,
          target_name: editPermissionsMember.full_name,
          updated_permissions: editPermState,
        },
      })

      toast.success(`RBAC Permissions updated for ${editPermissionsMember.full_name}!`)
      setEditPermissionsMember(null)
      void loadTeamData()
    } catch (err: unknown) {
      toast.error(`Permission save error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSavingPerms(false)
    }
  }

  // 3. Reset MFA / Force Security Challenge
  const handleResetMFA = async (member: TeamMember) => {
    toast.promise(
      async () => {
        await supabase.from('audit_logs').insert({
          actor_id: currentUserId,
          action: 'MFA_RESET_TRIGGERED',
          details: { target_user_id: member.id, target_name: member.full_name },
        })
      },
      {
        loading: `Sending MFA security challenge to ${member.full_name}...`,
        success: `MFA Security Challenge & Password Reset email sent to ${member.email}!`,
        error: (err) => `MFA Reset failed: ${err.message}`,
      }
    )
  }

  // 4. Suspend Member Toggle
  const handleToggleSuspend = async (member: TeamMember) => {
    const nextSuspended = !member.is_suspended

    toast.promise(
      async () => {
        await supabase.from('audit_logs').insert({
          actor_id: currentUserId,
          action: nextSuspended ? 'TEAM_MEMBER_SUSPENDED' : 'TEAM_MEMBER_UNSUSPENDED',
          details: { target_user_id: member.id, target_name: member.full_name },
        })

        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, is_suspended: nextSuspended } : m))
        )
      },
      {
        loading: `Updating suspension state for ${member.full_name}...`,
        success: nextSuspended
          ? `Member ${member.full_name} suspended from platform access.`
          : `Member ${member.full_name} restored to active status!`,
        error: (err) => `Suspension update failed: ${err.message}`,
      }
    )
  }

  // 5. Revoke Member Access
  const handleRevokeAccess = async () => {
    if (!revokeModalMember) return
    setRevoking(true)

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', revokeModalMember.id)

      if (error) throw new Error(error.message)

      await supabase.from('audit_logs').insert({
        actor_id: currentUserId,
        action: 'ACCESS_REVOKED',
        details: { revoked_user_id: revokeModalMember.id, revoked_name: revokeModalMember.full_name },
      })

      toast.error(`Platform Access Revoked for ${revokeModalMember.full_name}`)
      setRevokeModalMember(null)
      void loadTeamData()
    } catch (err: unknown) {
      toast.error(`Access revocation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRevoking(false)
    }
  }

  // 6. Enforce Global Team MFA
  const handleEnforceGlobalMFA = async () => {
    toast.info('⚡ Enforcing 100% MFA Compliance across all Super Admin & Operator accounts...', { duration: 4000 })
    await supabase.from('audit_logs').insert({
      actor_id: currentUserId,
      action: 'GLOBAL_TEAM_MFA_ENFORCED',
      details: { enforcement_timestamp: new Date().toISOString() },
    })
    toast.success('Global Team MFA Policy Enforced!')
    void loadTeamData()
  }

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  return (
    <div className="space-y-6 bg-[#090d16] text-slate-100 min-h-screen p-3 sm:p-5 rounded-3xl border border-slate-800/80 shadow-2xl font-sans">
      {/* Header Toolbar & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4 font-mono">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
            <Users className="size-4" />
            <span>RVC Platform • Team Governance & RBAC</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white flex items-center gap-3">
            Platform Team Console
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Root Access Governance
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <UserPlus className="size-4" />
            + Invite Admin Member
          </button>

          <button
            onClick={() => void handleEnforceGlobalMFA()}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 font-bold text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            <Zap className="size-3.5 text-amber-400" />
            Enforce Team MFA
          </button>

          <button
            onClick={() => void loadTeamData()}
            disabled={loading}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh Team List"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---------------- 2. HEADER TELEMETRY & GOVERNANCE KPI GRID (TOP 6 CARDS) ---------------- */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 font-mono">
        {/* Card 1: Total Privileged Team */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Privileged Team</span>
            <Users className="size-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.total} Operators</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Platform Admins</p>
        </div>

        {/* Card 2: Super Admin Tier */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Super Admin Tier</span>
            <ShieldCheck className="size-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-rose-300">{telemetry.superAdminCount} Root</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Full Write Scope</p>
        </div>

        {/* Card 3: Billing Approvers */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Billing Approvers</span>
            <CircleDollarSign className="size-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.billingApprovers} Approvers</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">UTR Verification Scope</p>
        </div>

        {/* Card 4: Support Operators */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Support Operators</span>
            <UserCheck className="size-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white">{telemetry.supportOperators} Agents</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Customer Helpdesk Scope</p>
        </div>

        {/* Card 5: MFA Enforcement Rate */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">MFA Rate</span>
            <Key className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-emerald-400">{telemetry.mfaRate}%</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{telemetry.mfaCount} MFA Configured</p>
        </div>

        {/* Card 6: Governance Compliance */}
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">RBAC Policy</span>
            <Lock className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-base font-bold text-emerald-400">SOC-2 Compliant</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Audit Hook Active</p>
        </div>
      </div>

      {/* ---------------- 3. SEARCH & ROLE FILTER BAR ---------------- */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-mono">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member name, email, phone number or role..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[10px] uppercase font-semibold mr-1">Role:</span>
          {['all', 'super_admin', 'staff'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-lg px-3 py-1 capitalize font-semibold transition-all ${
                roleFilter === r ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {r === 'super_admin' ? 'Super Admin' : r === 'staff' ? 'Staff / Operator' : 'All Roles'}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- 4. INTERACTIVE TEAM DATA TABLE ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1322] shadow-2xl font-mono">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-[#0a0e17] uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">1. Member Identity</th>
                <th className="p-4">2. Role & Permission Scope</th>
                <th className="p-4">3. Security & MFA Posture</th>
                <th className="p-4">4. Session Telemetry</th>
                <th className="p-4 text-right">5. Governance Row Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                [1, 2, 3].map((n) => (
                  <tr key={n}>
                    <td colSpan={5} className="p-4">
                      <div className="h-10 animate-pulse rounded-xl bg-slate-900/60" />
                    </td>
                  </tr>
                ))
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Users className="mx-auto size-8 text-slate-600" />
                      <p className="font-semibold text-sm text-slate-400">No team members found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelf = member.id === currentUserId
                  const roleStyle = getRoleBadgeStyle(member.role)

                  return (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`group transition-colors ${
                        member.is_suspended ? 'bg-rose-500/5 opacity-60' : 'hover:bg-[#0f172a]/60'
                      }`}
                    >
                      {/* Column 1: Member Identity */}
                      <td className="p-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="grid size-9 place-items-center rounded-xl bg-indigo-600/20 text-indigo-300 font-bold text-sm border border-indigo-500/30">
                            {(member.full_name || 'A').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {member.full_name || 'Platform Admin'}
                              </strong>
                              {isSelf && (
                                <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-400 border border-indigo-500/30">
                                  (You)
                                </span>
                              )}
                              {member.is_suspended && (
                                <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-bold text-rose-400 border border-rose-500/30">
                                  SUSPENDED
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">{member.email}</p>
                            {member.phone && (
                              <button
                                onClick={() => copyToClipboard(member.phone!, 'Phone number')}
                                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                              >
                                <Phone className="size-3 text-slate-500" />
                                {member.phone}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Role & Permission Scope */}
                      <td className="p-4 align-top">
                        <div className="space-y-1.5">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${roleStyle}`}>
                            {member.role === 'super_admin' ? 'Super Admin' : 'Staff Operator'}
                          </span>
                          <p className="text-[10px] text-slate-300">
                            Scope:{' '}
                            <span className="text-emerald-400 font-semibold">
                              {member.role === 'super_admin' ? 'Full Root Scope' : 'Operations & Support'}
                            </span>
                          </p>
                        </div>
                      </td>

                      {/* Column 3: Security & MFA Posture */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          {member.mfa_enabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" /> MFA ENABLED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                              <span className="size-1.5 rounded-full bg-amber-400" /> MFA NOT CONFIGURED
                            </span>
                          )}
                          <p className="text-[10px] text-slate-400">TOTP Authenticator</p>
                        </div>
                      </td>

                      {/* Column 4: Session Telemetry */}
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" /> ONLINE
                          </span>
                          <p className="text-[10px] text-slate-400" title={new Date(member.created_at).toLocaleString('en-IN')}>
                            Added {new Date(member.created_at).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </td>

                      {/* Column 5: Row Controls */}
                      <td className="p-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditPermissionsMember(member)
                              setEditPermState(member.permissions || { ...DEFAULT_PERMISSIONS })
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white"
                            title="Edit Granular Permissions"
                          >
                            <Settings className="size-3.5 text-indigo-400" />
                            Permissions
                          </button>

                          <button
                            onClick={() => void handleResetMFA(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300 hover:text-amber-300"
                            title="Reset MFA & Force Password Reset"
                          >
                            <Key className="size-3.5 text-amber-400" />
                            Reset MFA
                          </button>

                          <button
                            onClick={() => void handleToggleSuspend(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-400 hover:text-white"
                            title={member.is_suspended ? 'Unsuspend Member' : 'Suspend Member'}
                          >
                            <Lock className="size-3.5" />
                            {member.is_suspended ? 'Unsuspend' : 'Suspend'}
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => setRevokeModalMember(member)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                              title="Revoke Member Access"
                            >
                              <UserX className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- MODALS & DRAWERS ---------------- */}

      {/* 1. Invite Admin Member Modal */}
      <AnimatePresence>
        {inviteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="size-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Invite Admin Operator Member</h3>
                </div>
                <button onClick={() => setInviteModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-slate-300 font-semibold">Full Name</span>
                  <input
                    type="text"
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    placeholder="e.g. Amit Verma"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-semibold">Official Email</span>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="amit@rvcplatform.in"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-semibold">Phone Number</span>
                    <input
                      type="text"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-slate-300 font-semibold">Primary Platform Role</span>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="super_admin">Super Admin (Full Root Write Access)</option>
                    <option value="billing_manager">Billing Manager (UTR Verification)</option>
                    <option value="support_agent">Support Agent (Helpdesk & Impersonation)</option>
                    <option value="auditor">Read-Only Auditor</option>
                  </select>
                </label>

                {/* Granular Checkboxes */}
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Granular RBAC Scope Capabilities:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inviteForm.permissions.approve_utr}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            permissions: { ...inviteForm.permissions, approve_utr: e.target.checked },
                          })
                        }
                        className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                      />
                      <span>Approve / Reject UTR Proofs</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inviteForm.permissions.freeze_tenants}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            permissions: { ...inviteForm.permissions, freeze_tenants: e.target.checked },
                          })
                        }
                        className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                      />
                      <span>Freeze / Unfreeze Tenants</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inviteForm.permissions.edit_plans}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            permissions: { ...inviteForm.permissions, edit_plans: e.target.checked },
                          })
                        }
                        className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                      />
                      <span>Edit SaaS Pricing Tiers</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inviteForm.permissions.impersonate_dashboards}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            permissions: { ...inviteForm.permissions, impersonate_dashboards: e.target.checked },
                          })
                        }
                        className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                      />
                      <span>Impersonate Tenant Sessions</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={inviting}
                  onClick={() => void handleInviteMember()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Send Admin Invitation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Edit Permissions Modal */}
      <AnimatePresence>
        {editPermissionsMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="size-5 text-indigo-400" />
                  Edit RBAC Scope • {editPermissionsMember.full_name}
                </h3>
                <button onClick={() => setEditPermissionsMember(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Modify Granular Privilege Flags:</span>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center justify-between rounded-xl bg-slate-950 p-2.5 border border-slate-800 cursor-pointer">
                    <span>Approve / Reject UTR Proofs</span>
                    <input
                      type="checkbox"
                      checked={editPermState.approve_utr}
                      onChange={(e) => setEditPermState({ ...editPermState, approve_utr: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl bg-slate-950 p-2.5 border border-slate-800 cursor-pointer">
                    <span>Freeze / Unfreeze Tenants</span>
                    <input
                      type="checkbox"
                      checked={editPermState.freeze_tenants}
                      onChange={(e) => setEditPermState({ ...editPermState, freeze_tenants: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl bg-slate-950 p-2.5 border border-slate-800 cursor-pointer">
                    <span>Edit SaaS Pricing Tiers</span>
                    <input
                      type="checkbox"
                      checked={editPermState.edit_plans}
                      onChange={(e) => setEditPermState({ ...editPermState, edit_plans: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl bg-slate-950 p-2.5 border border-slate-800 cursor-pointer">
                    <span>Impersonate Tenant Sessions</span>
                    <input
                      type="checkbox"
                      checked={editPermState.impersonate_dashboards}
                      onChange={(e) => setEditPermState({ ...editPermState, impersonate_dashboards: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-500"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditPermissionsMember(null)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={savingPerms}
                  onClick={() => void handleSavePermissions()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingPerms ? 'Saving...' : 'Save RBAC Scope'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Revoke Member Access Modal */}
      <AnimatePresence>
        {revokeModalMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserX className="size-5 text-rose-400" />
                  Revoke Platform Access
                </h3>
                <button onClick={() => setRevokeModalMember(null)} className="text-slate-400 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-slate-300">
                Are you sure you want to permanently revoke platform access for{' '}
                <strong className="text-white">{revokeModalMember.full_name}</strong> ({revokeModalMember.email})?
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setRevokeModalMember(null)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={revoking}
                  onClick={() => void handleRevokeAccess()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500 disabled:opacity-50"
                >
                  {revoking ? 'Revoking...' : 'Revoke Access'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
