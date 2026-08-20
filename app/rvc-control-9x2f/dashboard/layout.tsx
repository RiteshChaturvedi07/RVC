import { AdminShell } from '@/components/rvc-admin/admin-shell'
import { Toaster } from 'sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      {children}
      <Toaster theme="dark" position="top-right" richColors />
    </AdminShell>
  )
}

