import { RestaurantShell } from '@/components/restaurant/restaurant-shell'
import { RestaurantSubscriptionGuard } from '@/components/restaurant/subscription-guard'

export default function RestaurantDashboardLayout({ children }: { children: React.ReactNode }) {
  return <RestaurantShell><RestaurantSubscriptionGuard>{children}</RestaurantSubscriptionGuard></RestaurantShell>
}
