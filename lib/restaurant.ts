import { createClient } from '@/lib/supabase/client'

export async function currentRestaurantTenant() {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Please sign in again.')
  const { data: profile, error } = await supabase.from('profiles').select('tenant_id, role').eq('id', userData.user.id).single()
  if (error || !profile?.tenant_id || !['tenant_owner', 'staff'].includes(profile.role)) throw new Error('Restaurant access is required.')
  return profile.tenant_id as string
}
