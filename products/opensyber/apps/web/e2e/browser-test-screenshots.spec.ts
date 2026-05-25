import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Each test captures 4 viewports with page compilation — needs generous timeout
test.setTimeout(120_000);

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../.luna/opensyber/browser-test/screenshots');

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

/** Public pages — no auth needed */
const PUBLIC_PAGES = [
  { route: '/', folder: 'landing', label: 'Landing' },
  { route: '/pricing', folder: 'pricing', label: 'Pricing' },
  { route: '/enterprise', folder: 'enterprise', label: 'Enterprise' },
  { route: '/demo', folder: 'demo', label: 'Demo' },
  { route: '/security', folder: 'security', label: 'Security' },
  { route: '/compliance', folder: 'compliance', label: 'Compliance' },
  { route: '/threats', folder: 'threats', label: 'Threats' },
  { route: '/openagent', folder: 'openagent', label: 'OpenAgent' },
  { route: '/marketplace', folder: 'marketplace', label: 'Marketplace' },
  { route: '/skills', folder: 'skills', label: 'Skills' },
  { route: '/marketplace/bundles', folder: 'marketplace', label: 'Marketplace Bundles' },
  { route: '/docs', folder: 'docs', label: 'Docs' },
  { route: '/docs/getting-started', folder: 'docs', label: 'Docs Getting Started' },
  { route: '/docs/api', folder: 'docs', label: 'Docs API' },
  { route: '/docs/security', folder: 'docs', label: 'Docs Security' },
  { route: '/docs/skills', folder: 'docs', label: 'Docs Skills' },
  { route: '/docs/skills/audit-methodology', folder: 'docs', label: 'Docs Skill Audit' },
  { route: '/blog', folder: 'blog', label: 'Blog' },
  { route: '/tokenforge', folder: 'tokenforge', label: 'TokenForge' },
  { route: '/privacy', folder: 'privacy', label: 'Privacy' },
  { route: '/terms', folder: 'terms', label: 'Terms' },
  { route: '/sign-in', folder: 'auth', label: 'Sign In' },
  { route: '/sign-up', folder: 'auth', label: 'Sign Up' },
];

/** Dashboard pages — need auth state */
const DASHBOARD_PAGES = [
  { route: '/dashboard', folder: 'dashboard', label: 'Dashboard' },
  { route: '/dashboard/getting-started', folder: 'dashboard', label: 'Getting Started' },
  { route: '/dashboard/profile', folder: 'dashboard', label: 'Profile' },
  { route: '/dashboard/agents', folder: 'dashboard-agents', label: 'Agents' },
  { route: '/dashboard/agents/team', folder: 'dashboard-team', label: 'Team' },
  { route: '/dashboard/agents/policies', folder: 'dashboard-agents', label: 'Policies' },
  { route: '/dashboard/security', folder: 'dashboard-security', label: 'Security Overview' },
  { route: '/dashboard/security/alerts', folder: 'dashboard-security', label: 'Alerts' },
  { route: '/dashboard/security/vulnerabilities', folder: 'dashboard-security', label: 'Vulnerabilities' },
  { route: '/dashboard/security/compliance', folder: 'dashboard-security', label: 'Compliance' },
  { route: '/dashboard/security/incidents', folder: 'dashboard-security', label: 'Incidents' },
  { route: '/dashboard/security/network', folder: 'dashboard-security', label: 'Network' },
  { route: '/dashboard/security/supply-chain', folder: 'dashboard-security', label: 'Supply Chain' },
  { route: '/dashboard/security/threats', folder: 'dashboard-security', label: 'Threats' },
  { route: '/dashboard/security/uptime', folder: 'dashboard-security', label: 'Uptime' },
  { route: '/dashboard/attack-paths', folder: 'dashboard', label: 'Attack Paths' },
  { route: '/dashboard/kill-chain', folder: 'dashboard', label: 'Kill Chain' },
  { route: '/dashboard/logs', folder: 'dashboard', label: 'Logs' },
  { route: '/dashboard/marketplace', folder: 'dashboard', label: 'Marketplace' },
  { route: '/dashboard/skills', folder: 'dashboard', label: 'Skills' },
  { route: '/dashboard/skills/submit', folder: 'dashboard', label: 'Skill Submit' },
  { route: '/dashboard/integrations', folder: 'dashboard', label: 'Integrations' },
  { route: '/dashboard/cloud', folder: 'dashboard', label: 'Cloud' },
  { route: '/dashboard/assets', folder: 'dashboard', label: 'Assets' },
  { route: '/dashboard/achievements', folder: 'dashboard', label: 'Achievements' },
  { route: '/dashboard/mcp-monitoring', folder: 'dashboard', label: 'MCP Monitoring' },
  { route: '/dashboard/oasf', folder: 'dashboard', label: 'OASF' },
  { route: '/dashboard/threat-feed', folder: 'dashboard', label: 'Threat Feed' },
  { route: '/dashboard/rule-engine', folder: 'dashboard', label: 'Rule Engine' },
  { route: '/dashboard/bundles', folder: 'dashboard', label: 'Bundles' },
  { route: '/dashboard/settings', folder: 'dashboard-settings', label: 'Settings' },
  { route: '/dashboard/settings/api-keys', folder: 'dashboard-settings', label: 'API Keys' },
  { route: '/dashboard/settings/notifications', folder: 'dashboard-settings', label: 'Notifications' },
  { route: '/dashboard/settings/roles', folder: 'dashboard-settings', label: 'Roles' },
  { route: '/dashboard/team', folder: 'dashboard-team', label: 'Team Management' },
  { route: '/dashboard/team/settings', folder: 'dashboard-team', label: 'Team Settings' },
  { route: '/dashboard/team/sso', folder: 'dashboard-team', label: 'SSO' },
  { route: '/dashboard/sla', folder: 'dashboard', label: 'SLA' },
  { route: '/dashboard/slo-dashboard', folder: 'dashboard', label: 'SLO Dashboard' },
];

const ADMIN_PAGES = [
  { route: '/admin', folder: 'admin', label: 'Admin' },
  { route: '/admin/audit', folder: 'admin', label: 'Audit' },
  { route: '/admin/billing', folder: 'admin', label: 'Billing' },
  { route: '/admin/instances', folder: 'admin', label: 'Instances' },
  { route: '/admin/metrics', folder: 'admin', label: 'Metrics' },
  { route: '/admin/organizations', folder: 'admin', label: 'Organizations' },
  { route: '/admin/skills', folder: 'admin', label: 'Admin Skills' },
  { route: '/admin/users', folder: 'admin', label: 'Users' },
];

function slugify(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function captureAtViewports(
  page: Page,
  route: string,
  folder: string,
  label: string,
  results: { page: string; viewport: string; status: string; error?: string }[]
) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const slug = slugify(label);
    const filePath = path.join(SCREENSHOT_DIR, folder, `${slug}-${vp.name}.png`);

    try {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      // Wait for hydration + initial render
      await page.waitForTimeout(1000);

      // Scroll through the page to trigger IntersectionObserver animations
      await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        const h = document.body.scrollHeight;
        const step = Math.max(300, Math.floor(window.innerHeight * 0.6));
        for (let y = 0; y < h; y += step) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await delay(100);
        }
        window.scrollTo({ top: h, behavior: 'instant' });
        await delay(150);
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.waitForTimeout(400);

      const status = response?.status() ?? 0;
      if (status >= 400) {
        results.push({ page: label, viewport: vp.name, status: `HTTP ${status}` });
        // Still screenshot error pages
      }

      await page.screenshot({ path: filePath, fullPage: true });
      results.push({ page: label, viewport: vp.name, status: status < 400 ? 'pass' : `HTTP ${status}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ page: label, viewport: vp.name, status: 'fail', error: msg });
      // Try partial screenshot
      try {
        await page.screenshot({ path: filePath, fullPage: false });
      } catch { /* noop */ }
    }
  }
}

test.describe('Browser Test — Public Pages Screenshot Capture', () => {
  const results: { page: string; viewport: string; status: string; error?: string }[] = [];

  for (const pg of PUBLIC_PAGES) {
    test(`${pg.label} — all viewports`, async ({ page }) => {
      await captureAtViewports(page, pg.route, pg.folder, pg.label, results);
    });
  }

  // 404 page
  test('404 page — all viewports', async ({ page }) => {
    await captureAtViewports(page, '/this-page-does-not-exist-404', 'errors', '404 Page', results);
  });
});

test.describe('Browser Test — Dashboard Pages (may redirect to auth)', () => {
  for (const pg of DASHBOARD_PAGES) {
    test(`${pg.label} — all viewports`, async ({ page }) => {
      const results: { page: string; viewport: string; status: string; error?: string }[] = [];
      await captureAtViewports(page, pg.route, pg.folder, pg.label, results);
    });
  }
});

test.describe('Browser Test — Admin Pages (may redirect to auth)', () => {
  for (const pg of ADMIN_PAGES) {
    test(`${pg.label} — all viewports`, async ({ page }) => {
      const results: { page: string; viewport: string; status: string; error?: string }[] = [];
      await captureAtViewports(page, pg.route, pg.folder, pg.label, results);
    });
  }
});
