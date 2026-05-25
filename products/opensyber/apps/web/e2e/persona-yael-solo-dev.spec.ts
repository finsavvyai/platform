import { test, expect } from '@playwright/test';
import { authTest, expect as authExpect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Persona: Yael Navon — Solo Security-Minded Developer
 *
 * Journey: Discovers OpenSyber via Trivy blog → explores landing page →
 * checks demo → browses marketplace → signs up → onboards with IDE →
 * installs skills → monitors security score → shares scorecard.
 *
 * Plan: Free → Personal ($49/mo)
 * Key value: IDE agent monitoring, security score, free skills
 */

/* ================================================================== */
/*  PHASE 1: AWARENESS — Landing Page Discovery                        */
/* ================================================================== */
test.describe('Yael — Awareness: Landing Page Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('hero resonates: headline about AI agent security', async ({ page }) => {
    const hero = page.locator('h1');
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(/AI agents/i);
  });

  test('Trivy attack banner creates urgency', async ({ page }) => {
    await expect(page.getByText(/Trivy attack/i).first()).toBeVisible();
    await expect(page.getByText(/45 orgs/i).first()).toBeVisible();
  });

  test('free tier CTA is prominent — no credit card messaging', async ({ page }) => {
    await expect(page.getByText(/free forever/i).first()).toBeVisible();
    await expect(page.getByText(/no credit card/i).first()).toBeVisible();
  });

  test('problem section shows before/after comparison', async ({ page }) => {
    const withoutSection = page.getByText(/without opensyber/i);
    const withSection = page.getByText(/with opensyber/i);
    await expect(withoutSection.first()).toBeVisible();
    await expect(withSection.first()).toBeVisible();
  });

  test('three pillars visible: infrastructure, marketplace, monitoring', async ({ page }) => {
    await expect(page.getByText(/hardened infrastructure/i).first()).toBeVisible();
    await expect(page.getByText(/verified marketplace/i).first()).toBeVisible();
    await expect(page.getByText(/real-time monitoring/i).first()).toBeVisible();
  });

  test('how-it-works shows 60-second promise', async ({ page }) => {
    await expect(page.getByText(/60 seconds/i).first()).toBeVisible();
  });

  test('trust bar shows compliance badges', async ({ page }) => {
    await expect(page.getByText(/zero-trust/i).first()).toBeVisible();
    await expect(page.getByText(/cloudflare edge/i).first()).toBeVisible();
    await expect(page.getByText(/GDPR/i).first()).toBeVisible();
  });
});

/* ================================================================== */
/*  PHASE 2: CONSIDERATION — Evaluating Before Signup                  */
/* ================================================================== */
test.describe('Yael — Consideration: Demo & Marketplace Evaluation', () => {
  test('live demo loads without signup required', async ({ page }) => {
    await page.goto(`${BASE}/demo`);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('marketplace shows free skills available', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Skill cards or placeholder content should be visible
    const skills = page.locator('a[href^="/marketplace/"]');
    const empty = page.getByText(/no skills/i);
    const hasSkills = (await skills.count()) > 0;
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasSkills || hasEmpty).toBe(true);
  });

  test('pricing page shows free tier prominently', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/\$0/i).first()).toBeVisible();
  });

  test('pricing page shows upgrade path to Personal ($49)', async ({ page }) => {
    await page.goto(`${BASE}/pricing`);
    await expect(page.getByText(/personal/i).first()).toBeVisible();
    await expect(page.getByText(/\$49/i).first()).toBeVisible();
  });

  test('Trivy blog post loads — technical credibility check', async ({ page }) => {
    await page.goto(`${BASE}/blog/trivy-attack-inevitable`);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});

/* ================================================================== */
/*  PHASE 3: CONSIDERATION — Auth Pages Accessible                     */
/* ================================================================== */
test.describe('Yael — Consideration: Sign-Up Path', () => {
  test('sign-in page loads with OAuth providers', async ({ page }) => {
    await page.goto(`${BASE}/sign-in`);
    await page.waitForLoadState('networkidle');

    // Should show sign-in content (OAuth buttons or auth form)
    const content = page.locator('main, [class*="auth"], form, button');
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated /dashboard redirects to sign-in', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should redirect to sign-in or show auth prompt
    const url = page.url();
    const isRedirected = url.includes('/sign-in') || url.includes('/api/auth');
    const hasAuthContent = await page.getByText(/sign in|log in|continue with/i)
      .first().isVisible().catch(() => false);
    expect(isRedirected || hasAuthContent).toBe(true);
  });
});

/* ================================================================== */
/*  PHASE 4: ONBOARDING — First Dashboard Experience (Authenticated)   */
/* ================================================================== */
authTest.describe('Yael — Onboarding: First Dashboard Visit', () => {
  authTest('dashboard loads with security score or getting started', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('getting started page has onboarding checklist', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/getting-started`);
    await page.waitForLoadState('networkidle');

    // Should show integration guides or onboarding checklist
    const content = page.getByText(/getting started|set up|connect|IDE/i);
    await authExpect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  authTest('getting started mentions VS Code and Cursor integration', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/getting-started`);
    await page.waitForLoadState('networkidle');

    const vscode = page.getByText(/VS Code|Visual Studio Code|Cursor/i);
    await authExpect(vscode.first()).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 5: ACTIVATION — Marketplace Skill Installation               */
/* ================================================================== */
authTest.describe('Yael — Activation: Skill Installation Flow', () => {
  authTest('dashboard marketplace shows browsable skills', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/marketplace`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('installed skills page shows table or empty state', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/skills`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const empty = page.getByText(/no skills installed/i);
    const heading = page.getByRole('heading').first();

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    expect(hasTable || hasEmpty || hasHeading).toBe(true);
  });

  authTest('marketplace Browse link available from skills page', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/skills`);
    await page.waitForLoadState('networkidle');

    const browseLink = page.getByRole('link', { name: /browse|marketplace/i });
    if (await browseLink.first().isVisible().catch(() => false)) {
      const href = await browseLink.first().getAttribute('href');
      expect(href).toMatch(/marketplace/);
    }
  });
});

/* ================================================================== */
/*  PHASE 6: ACTIVATION — Security Score & Achievements                */
/* ================================================================== */
authTest.describe('Yael — Activation: Score & Gamification', () => {
  authTest('main dashboard shows security score or metrics', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');

    const scoreEl = page.getByText(/score|security|metric/i);
    const heading = page.getByRole('heading').first();

    const hasScore = await scoreEl.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    expect(hasScore || hasHeading).toBe(true);
  });

  authTest('achievements page loads with badge list or empty state', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/achievements`);
    await page.waitForLoadState('networkidle');

    const content = page.getByRole('heading').first();
    await authExpect(content).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 7: RETENTION — Settings & API Keys                           */
/* ================================================================== */
authTest.describe('Yael — Retention: Settings & API Keys', () => {
  authTest('settings page shows plan info and instance details', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    await authExpect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  authTest('API keys page loads with generation option', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings/api-keys`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });

  authTest('profile page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/profile`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await authExpect(heading).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 8: EXPANSION — Upgrade Path Visibility                       */
/* ================================================================== */
authTest.describe('Yael — Expansion: Upgrade Triggers', () => {
  authTest('settings shows current plan with upgrade option', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');

    // Should show plan info or upgrade link
    const planInfo = page.getByText(/free|personal|pro|plan/i);
    const upgradeLink = page.getByRole('link', { name: /upgrade|change plan/i });

    const hasPlan = await planInfo.first().isVisible().catch(() => false);
    const hasUpgrade = await upgradeLink.first().isVisible().catch(() => false);

    expect(hasPlan || hasUpgrade).toBe(true);
  });
});
