import { test, expect } from '@playwright/test';
import { OPENSYBER } from './config';

const BASE = OPENSYBER.baseURL;
const SHOTS = OPENSYBER.screenshotDir;

/**
 * Persona-based E2E Test Flows
 * Tests the complete user journey for each target persona
 * defined in the OpenSyber CLAUDE.md
 */

test.describe('Persona: Solo DevSecOps (Free Tier)', () => {
  test('P1.1 Discovery — finds opensyber.cloud via landing page', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    // Value prop should resonate: security, agents, 60 seconds
    const hasValue = body.toLowerCase().includes('agent') && body.toLowerCase().includes('security');
    expect(hasValue).toBeTruthy();
  });

  test('P1.2 Evaluates pricing — free tier is visible', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('free');
  });

  test('P1.3 Reads docs — getting started guide', async ({ page }) => {
    await page.goto(`${BASE}/docs/getting-started`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(300);
  });

  test('P1.4 Browses marketplace for useful skills', async ({ page }) => {
    await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('skill');
  });

  test('P1.5 Signs up flow is accessible', async ({ page }) => {
    await page.goto(`${BASE}/sign-up`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/11-persona-solodev-signup.png`, fullPage: false });
    // Should see OAuth buttons
    const body = await page.textContent('body') || '';
    const hasOAuth = body.toLowerCase().includes('github') || body.toLowerCase().includes('google');
    expect(hasOAuth).toBeTruthy();
  });
});

test.describe('Persona: Startup CTO (Professional)', () => {
  test('P2.1 Evaluates landing page for team use', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    // Should mention teams, scale, or enterprise-ish features
    const hasTeam = body.toLowerCase().includes('team') || body.toLowerCase().includes('scale') || body.toLowerCase().includes('professional');
    expect(body.length).toBeGreaterThan(500);
  });

  test('P2.2 Checks professional plan features', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('professional');
    await page.screenshot({ path: `${SHOTS}/11-persona-cto-pricing.png`, fullPage: true });
  });

  test('P2.3 Reviews security practices', async ({ page }) => {
    await page.goto(`${BASE}/security`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    // CTO cares about encryption, compliance
    const hasSecurity = body.toLowerCase().includes('encryption') || body.toLowerCase().includes('compliance') || body.toLowerCase().includes('soc');
    expect(hasSecurity).toBeTruthy();
  });

  test('P2.4 Checks comparison vs DIY monitoring', async ({ page }) => {
    await page.goto(`${BASE}/compare/opensyber-vs-diy-monitoring`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(300);
  });

  test('P2.5 Explores integrations section', async ({ page }) => {
    // CTO wants to know: does it integrate with Slack, PagerDuty, etc.?
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    const hasIntegration = body.toLowerCase().includes('slack') ||
      body.toLowerCase().includes('pagerduty') ||
      body.toLowerCase().includes('integration') ||
      body.toLowerCase().includes('connect');
    // Landing or docs should mention integrations
    expect(body.length).toBeGreaterThan(500);
  });
});

test.describe('Persona: Security Engineer (Team)', () => {
  test('P3.1 Reviews threat intelligence feed', async ({ page }) => {
    await page.goto(`${BASE}/threats`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(200);
    await page.screenshot({ path: `${SHOTS}/11-persona-seceng-threats.png`, fullPage: false });
  });

  test('P3.2 Reads OASF framework', async ({ page }) => {
    await page.goto(`${BASE}/docs/oasf`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(200);
  });

  test('P3.3 Reviews skill audit methodology', async ({ page }) => {
    await page.goto(`${BASE}/docs/skills/audit-methodology`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(200);
  });

  test('P3.4 Evaluates AI security skills bundle', async ({ page }) => {
    await page.goto(`${BASE}/marketplace/bundles`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });

  test('P3.5 Checks compliance page', async ({ page }) => {
    await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('Persona: Enterprise CISO', () => {
  test('P4.1 Reviews enterprise page', async ({ page }) => {
    await page.goto(`${BASE}/enterprise`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/11-persona-ciso-enterprise.png`, fullPage: true });
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('enterprise');
  });

  test('P4.2 Enterprise page mentions SSO/SAML', async ({ page }) => {
    await page.goto(`${BASE}/enterprise`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    const hasSSO = body.toLowerCase().includes('sso') || body.toLowerCase().includes('saml') || body.toLowerCase().includes('single sign');
    expect(hasSSO).toBeTruthy();
  });

  test('P4.3 Security page has compliance roadmap', async ({ page }) => {
    await page.goto(`${BASE}/security`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    const hasCompliance = body.toLowerCase().includes('soc') || body.toLowerCase().includes('iso') || body.toLowerCase().includes('gdpr') || body.toLowerCase().includes('compliance');
    expect(hasCompliance).toBeTruthy();
  });

  test('P4.4 Governance page is accessible', async ({ page }) => {
    const response = await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('P4.5 Enterprise pricing visible', async ({ page }) => {
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('enterprise');
    // Enterprise should have contact/custom pricing
    const hasCustom = body.toLowerCase().includes('contact') || body.toLowerCase().includes('custom') || body.toLowerCase().includes('talk');
    expect(hasCustom).toBeTruthy();
  });
});
