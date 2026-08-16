import { test, expect } from '@playwright/test'

test.describe('Public QR Ordering Flow', () => {
  test('guest opens menu, adds items to cart, applies coupon, inputs phone number, and submits order', async ({ page }) => {
    // Intercept all API and RPC network calls for deterministic test execution
    await page.route('**/*', async (route) => {
      const url = route.request().url()

      if (url.includes('/api/public-menu')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            restaurant: {
              name: 'Indian Coffee House',
              tax_rate: 5,
              merchant_upi_id: 'ich@upi',
              merchant_upi_qr_url: null,
            },
            table: {
              number: 'A-01',
              token: 'mock-table-token-123',
            },
            items: [
              {
                id: 'item-1',
                name: 'Cold Coffee',
                price: 150,
                description: 'Chilled brewed coffee with vanilla ice cream',
                category: 'Beverages',
                is_vegetarian: true,
              },
              {
                id: 'item-2',
                name: 'Masala Dosa',
                price: 120,
                description: 'Crispy rice crepe with spiced potato filling',
                category: 'South Indian',
                is_vegetarian: true,
              },
            ],
          }),
        })
      }

      if (url.includes('public_restaurant_table_session_orders')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'order-101',
              order_number: 101,
              status: 'pending',
              payment_status: 'unpaid',
              total: 255.5,
              items: [
                { name: 'Cold Coffee', quantity: 1 },
                { name: 'Masala Dosa', quantity: 1 },
              ],
            },
          ]),
        })
      }

      if (url.includes('public_validate_restaurant_coupon')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            discount: 30,
            message: 'Coupon WELCOME10 applied',
          }),
        })
      }

      if (url.includes('create_public_restaurant_order')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'order-101',
            order_number: 101,
            status: 'pending',
          }),
        })
      }

      return route.continue()
    })

    // Step 1: Open public QR ordering page
    await page.goto('/order/indian-coffee-house/A-01')

    // Verify restaurant header and table number render once menu loads
    await expect(page.getByText('Indian Coffee House')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Table A-01')).toBeVisible()

    // Step 2: Add dish items to cart
    const coldCoffeeCard = page.locator('article').filter({ hasText: 'Cold Coffee' })
    await expect(coldCoffeeCard).toBeVisible()
    await coldCoffeeCard.getByRole('button', { name: 'ADD +' }).click()

    const dosaCard = page.locator('article').filter({ hasText: 'Masala Dosa' })
    await expect(dosaCard).toBeVisible()
    await dosaCard.getByRole('button', { name: 'ADD +' }).click()

    // Step 3: Open checkout modal
    const checkoutBarButton = page.locator('button').filter({ hasText: /items? ·/i })
    await expect(checkoutBarButton).toBeVisible()
    await checkoutBarButton.click()

    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()

    // Step 4: Apply test coupon
    const couponInput = page.getByPlaceholder('WELCOME10')
    await couponInput.fill('WELCOME10')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('Coupon WELCOME10 applied')).toBeVisible()

    // Step 5: Input guest phone number & name
    const nameInput = page.getByPlaceholder('Your name (optional)')
    await nameInput.fill('Rahul Sharma')

    const phoneInput = page.getByPlaceholder('Phone number')
    await phoneInput.fill('9876543210')

    // Step 6: Submit order
    const placeOrderButton = page.locator('button').filter({ hasText: /Place order/i })
    await expect(placeOrderButton).toBeVisible()
    await placeOrderButton.click()

    // Step 7: Verify order creation and live status tracking / session history modal rendering
    await expect(page.getByText(/Session bill & history/i)).toBeVisible()
    await expect(page.getByText(/Order #101/i)).toBeVisible()
  })
})
