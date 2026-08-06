import { AdminShell } from '@/components/rvc-admin/admin-shell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
