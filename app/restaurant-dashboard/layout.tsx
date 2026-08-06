import { RestaurantShell } from '@/components/restaurant/restaurant-shell'

export default function RestaurantDashboardLayout({ children }: { children: React.ReactNode }) {
  return <RestaurantShell>{children}</RestaurantShell>
}
