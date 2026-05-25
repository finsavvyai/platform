import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

// Key pages to screenshot
const pages = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
]

test.describe('Visual Regression', () => {
  for (const page of pages) {
    test(`${page.name} page matches snapshot`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`)
      await p.waitForLoadState('networkidle')
      await expect(p).toHaveScreenshot(`${page.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      })
    })
  }

  // Mobile viewport tests
  test('landing page mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${BASE_URL}/`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('landing-mobile.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    })
  })
})
