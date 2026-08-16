export type TenantStatus = 'active' | 'trial' | 'suspended' | 'expired'

export type TenantRecord = {
  id: string
  name?: string
  status: TenantStatus | string
  subscription_end_date?: string | null
}

export type TenantGuardResult = {
  allowed: boolean
  reason?: string
}

export function verifyTenantStatus(
  tenant: TenantRecord,
  currentDate: Date = new Date()
): TenantGuardResult {
  if (tenant.status === 'suspended') {
    return {
      allowed: false,
      reason: 'Tenant account is suspended'
    }
  }

  if (tenant.status === 'expired') {
    return {
      allowed: false,
      reason: 'Tenant subscription has expired'
    }
  }

  if (tenant.subscription_end_date) {
    const endDate = new Date(tenant.subscription_end_date)
    if (endDate < currentDate) {
      return {
        allowed: false,
        reason: 'Tenant subscription end date has passed'
      }
    }
  }

  if (tenant.status === 'active' || tenant.status === 'trial') {
    return {
      allowed: true
    }
  }

  return {
    allowed: false,
    reason: `Unknown tenant status: ${tenant.status}`
  }
}
