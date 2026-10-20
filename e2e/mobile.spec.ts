import { expect, test } from '@playwright/test'

test('keeps the primary journeys visible at a mobile viewport', async ({ page }, testInfo) => {
  await page.route('**/api/meta', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Character Forge',
        ruleset: '2024',
        rulesVersion: 'SRD-5.2.1',
        status: 'ready',
      }),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Forge a legend/i })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await testInfo.attach('home-mobile', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
})
