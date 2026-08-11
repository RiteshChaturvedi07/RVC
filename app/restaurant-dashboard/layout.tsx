import { RestaurantShell } from '@/components/restaurant/restaurant-shell'
import { RestaurantSubscriptionGuard } from '@/components/restaurant/subscription-guard'
import { StaffPermissionGuard } from '@/components/restaurant/staff-permission-guard'

export default function RestaurantDashboardLayout({ children }: { children: React.ReactNode }) {
  return <RestaurantShell><RestaurantSubscriptionGuard><StaffPermissionGuard>{children}</StaffPermissionGuard></RestaurantSubscriptionGuard></RestaurantShell>
}
