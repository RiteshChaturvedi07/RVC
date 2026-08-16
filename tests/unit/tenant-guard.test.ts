import { describe, expect, it } from 'vitest'
import { verifyTenantStatus, TenantRecord } from '../../lib/tenant-guard'

describe('Tenant Guard Status Verification', () => {
  const now = new Date('2026-08-16T12:00:00Z')

  it('should allow active tenant with future subscription end date', () => {
    const tenant: TenantRecord = {
      id: 'tenant-1',
      status: 'active',
      subscription_end_date: '2026-12-31T23:59:59Z',
    }

    const result = verifyTenantStatus(tenant, now)
    expect(result.allowed).toBe(true)
  })

  it('should allow active trial tenant', () => {
    const tenant: TenantRecord = {
      id: 'tenant-2',
      status: 'trial',
      subscription_end_date: '2026-08-30T00:00:00Z',
    }

    const result = verifyTenantStatus(tenant, now)
    expect(result.allowed).toBe(true)
  })

  it('should reject suspended tenant', () => {
    const tenant: TenantRecord = {
      id: 'tenant-3',
      status: 'suspended',
    }

    const result = verifyTenantStatus(tenant, now)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Tenant account is suspended')
  })

  it('should reject expired tenant', () => {
    const tenant: TenantRecord = {
      id: 'tenant-4',
      status: 'expired',
    }

    const result = verifyTenantStatus(tenant, now)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Tenant subscription has expired')
  })

  it('should reject tenant if subscription end date is in the past', () => {
    const tenant: TenantRecord = {
      id: 'tenant-5',
      status: 'active',
      subscription_end_date: '2026-08-01T00:00:00Z',
    }

    const result = verifyTenantStatus(tenant, now)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Tenant subscription end date has passed')
  })
})
