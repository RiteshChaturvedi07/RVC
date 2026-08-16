import { describe, expect, it } from 'vitest'
import { calculateCouponDiscount, CouponDefinition } from '../../lib/coupon'

describe('Coupon Calculation Logic', () => {
  it('should apply percentage discount correctly', () => {
    const coupon: CouponDefinition = {
      code: 'WELCOME10',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_amount: 100,
    }

    const result = calculateCouponDiscount(500, coupon)
    expect(result.valid).toBe(true)
    expect(result.discount).toBe(50)
  })

  it('should apply flat discount correctly', () => {
    const coupon: CouponDefinition = {
      code: 'FLAT50',
      discount_type: 'flat',
      discount_value: 50,
      min_order_amount: 200,
    }

    const result = calculateCouponDiscount(300, coupon)
    expect(result.valid).toBe(true)
    expect(result.discount).toBe(50)
  })

  it('should reject coupon if subtotal is below minimum order amount', () => {
    const coupon: CouponDefinition = {
      code: 'MIN500',
      discount_type: 'flat',
      discount_value: 100,
      min_order_amount: 500,
    }

    const result = calculateCouponDiscount(300, coupon)
    expect(result.valid).toBe(false)
    expect(result.discount).toBe(0)
    expect(result.message).toContain('Minimum order amount of ₹500 required')
  })

  it('should respect maximum discount cap for percentage coupons', () => {
    const coupon: CouponDefinition = {
      code: 'BIG20',
      discount_type: 'percentage',
      discount_value: 20,
      max_discount_amount: 100,
    }

    const result = calculateCouponDiscount(1000, coupon)
    expect(result.valid).toBe(true)
    expect(result.discount).toBe(100)
  })

  it('should cap discount to subtotal if flat discount exceeds subtotal', () => {
    const coupon: CouponDefinition = {
      code: 'SUPER500',
      discount_type: 'flat',
      discount_value: 500,
    }

    const result = calculateCouponDiscount(200, coupon)
    expect(result.valid).toBe(true)
    expect(result.discount).toBe(200)
  })

  it('should reject inactive coupons', () => {
    const coupon: CouponDefinition = {
      code: 'EXPIRED',
      discount_type: 'flat',
      discount_value: 50,
      is_active: false,
    }

    const result = calculateCouponDiscount(500, coupon)
    expect(result.valid).toBe(false)
    expect(result.discount).toBe(0)
    expect(result.message).toBe('Coupon is inactive')
  })
})
