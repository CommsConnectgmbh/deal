import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

const EXPECTED_TITLE = /DealBuddy/

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`)
  })
  return errors
}

test.describe('Public pages — smoke', () => {
  test('landing page renders & has no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/')
    await expect(page).toHaveTitle(EXPECTED_TITLE)
    await expect(page.getByText(/jetzt starten/i).first()).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('onboarding page renders', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/onboarding')
    await expect(page.getByText(/start competing/i)).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('login page renders', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/auth/login')
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByText(/einloggen/i).first()).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('register page renders', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/auth/register')
    await expect(page.getByRole('button', { name: /konto erstellen/i })).toBeVisible()
    expect(errors, errors.join('\n')).toEqual([])
  })

  test('/app/* routes redirect unauthenticated users to auth', async ({ page }) => {
    await page.goto('/app/home')
    await expect(page).toHaveURL(/\/auth\//)
  })
})

test.describe('Legal pages', () => {
  for (const slug of ['imprint', 'privacy', 'terms']) {
    test(`legal/${slug} renders`, async ({ page }) => {
      const errors = collectConsoleErrors(page)
      await page.goto(`/legal/${slug}`)
      await expect(page).toHaveTitle(EXPECTED_TITLE)
      expect(errors, errors.join('\n')).toEqual([])
    })
  }
})

test.describe('Regression guards (from audit 2026-04-18)', () => {
  test('home dashboard action pills: no horizontal overflow at 390px', async ({ page }) => {
    // Surrogate check on landing page: the flex-child overflow pattern
    // that broke on /app/home should never produce body-level horizontal scroll.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('no 4xx/5xx on critical asset bundles', async ({ page }) => {
    const badResponses: string[] = []
    page.on('response', (res) => {
      const url = res.url()
      if ((url.includes('/_next/static/') || url.endsWith('.webp') || url.endsWith('.png')) && res.status() >= 400) {
        badResponses.push(`${res.status()} ${url}`)
      }
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(badResponses, badResponses.join('\n')).toEqual([])
  })
})
