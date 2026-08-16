export type CouponDefinition = {
  code: string
  discount_type: 'percentage' | 'flat' | 'fixed'
  discount_value: number
  min_order_amount?: number
  max_discount_amount?: number | null
  is_active?: boolean
}

export type CouponValidationResult = {
  valid: boolean
  discount: number
  message: string
}

export function calculateCouponDiscount(
  subtotal: number,
  coupon: CouponDefinition
): CouponValidationResult {
  if (coupon.is_active === false) {
    return { valid: false, discount: 0, message: 'Coupon is inactive' }
  }

  const minAmount = coupon.min_order_amount ?? 0
  if (subtotal < minAmount) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order amount of ₹${minAmount} required`
    }
  }

  let discount = 0
  if (coupon.discount_type === 'percentage') {
    discount = (subtotal * coupon.discount_value) / 100
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, coupon.max_discount_amount)
    }
  } else {
    // flat or fixed
    discount = coupon.discount_value
  }

  // Ensure discount does not exceed subtotal
  discount = Math.min(subtotal, Math.max(0, discount))

  return {
    valid: true,
    discount,
    message: 'Coupon applied successfully'
  }
}
