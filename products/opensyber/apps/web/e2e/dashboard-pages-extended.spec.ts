import { authTest as test, expect } from './fixtures/auth';

/**
 * Extended dashboard page tests -- covers all remaining dashboard sub-pages.
 * Requires authenticated session via auth-setup.spec.ts (.auth/user.json).
 *
 * Each test navigates to a page, verifies the heading loads, and checks
 * at least one page-specific UI element.
 */

const PAGE_TIMEOUT = 15_000;

/* ---------- Security Sub-pages ---------- */

test.describe('Security -- Alert Rules', () => {
  test('loads alert rules page with heading and empty state or table', async ({ page }) => {
    await page.goto('/dashboard/security/alert-rules');
    await expect(page.getByRole('heading', { name: /alert rules/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Either an alert rules table or the "No alert rules configured" empty state
    const table = page.locator('table');
    const emptyState = page.getByText(/no alert rules configured/i);
    await expect(table.or(emptyState)).toBeVisible();
  });
});

test.describe('Security -- Supply Chain', () => {
  test('loads supply chain page with score and active defenses', async ({ page }) => {
    await page.goto('/dashboard/security/supply-chain');
    await expect(page.getByRole('heading', { name: /supply chain security/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Score card is always rendered
    await expect(page.getByText(/supply chain score/i)).toBeVisible();
    // Active defenses section always present
    await expect(page.getByText(/active defenses/i)).toBeVisible();
  });
});

test.describe('Security -- Threats', () => {
  test('loads threat map page with heading', async ({ page }) => {
    await page.goto('/dashboard/security/threats');
    await expect(page.getByRole('heading', { name: /threat map/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Either geo data table or empty state
    const geoTable = page.locator('table');
    const emptyState = page.getByText(/no geographic threat data|no instance deployed/i);
    await expect(geoTable.or(emptyState)).toBeVisible();
  });
});

test.describe('Security -- Network', () => {
  test('loads network activity page with heading', async ({ page }) => {
    await page.goto('/dashboard/security/network');
    await expect(page.getByRole('heading', { name: /network activity/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Summary cards or empty / no-instance state
    const totalRequests = page.getByText(/total requests/i);
    const emptyState = page.getByText(/no network activity|no instance deployed/i);
    await expect(totalRequests.or(emptyState)).toBeVisible();
  });
});

test.describe('Security -- Files', () => {
  test('loads file integrity page with heading', async ({ page }) => {
    await page.goto('/dashboard/security/files');
    await expect(page.getByRole('heading', { name: /file integrity/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Empty state or monitored files section
    const monitoredFiles = page.getByText(/monitored files/i);
    const emptyState = page.getByText(/no file integrity data|no instance deployed/i);
    await expect(monitoredFiles.or(emptyState)).toBeVisible();
  });
});

test.describe('Security -- Compliance', () => {
  test('loads compliance reports page with heading', async ({ page }) => {
    await page.goto('/dashboard/security/compliance');
    await expect(page.getByRole('heading', { name: /compliance reports/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Report cards or empty state
    const reportCard = page.getByText(/overall score/i);
    const emptyState = page.getByText(/no compliance reports|no instance deployed/i);
    await expect(reportCard.or(emptyState)).toBeVisible();
  });
});

test.describe('Security -- Uptime', () => {
  test('loads uptime monitoring page', async ({ page }) => {
    await page.goto('/dashboard/security/uptime');
    // Either the uptime page heading or the "select an instance" prompt
    const heading = page.getByRole('heading', { name: /uptime monitoring/i });
    const selectPrompt = page.getByText(/select an instance to view uptime/i);
    await expect(heading.or(selectPrompt)).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/* ---------- Logs & Monitoring ---------- */

test.describe('Logs', () => {
  test('loads audit logs page with heading', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await expect(page.getByRole('heading', { name: /audit logs/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Table or empty state
    const table = page.locator('table');
    const emptyState = page.getByText(/no audit logs/i);
    await expect(table.or(emptyState)).toBeVisible();
  });
});

test.describe('MCP Monitoring', () => {
  test('loads MCP server monitoring page with heading and stats', async ({ page }) => {
    await page.goto('/dashboard/mcp-monitoring');
    await expect(page.getByRole('heading', { name: /mcp server monitoring/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Preview banner is always shown
    await expect(page.getByText(/preview/i).first()).toBeVisible();
  });
});

/* ---------- Getting Started & Skills ---------- */

test.describe('Getting Started', () => {
  test('loads onboarding page with heading and prerequisites', async ({ page }) => {
    await page.goto('/dashboard/getting-started');
    await expect(page.getByRole('heading', { name: /getting started/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Prerequisites section
    await expect(page.getByText(/before you start/i)).toBeVisible();
  });
});

test.describe('Skills -- Submit', () => {
  test('loads skill submission form with heading and form fields', async ({ page }) => {
    await page.goto('/dashboard/skills/submit');
    await expect(page.getByRole('heading', { name: /submit a skill/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Form fields present
    await expect(page.locator('input[name="slug"], input#slug')).toBeVisible();
    await expect(page.locator('select[name="category"], select#category')).toBeVisible();
  });
});

test.describe('Marketplace', () => {
  test('loads marketplace page with heading', async ({ page }) => {
    await page.goto('/dashboard/marketplace');
    await expect(page.getByRole('heading', { name: /skill marketplace/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/* ---------- Kill Chain & Threats ---------- */

test.describe('Kill Chain', () => {
  test('loads kill chain correlation page with heading', async ({ page }) => {
    await page.goto('/dashboard/kill-chain');
    await expect(page.getByRole('heading', { name: /kill chain correlation/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Preview banner or rule data always present
    await expect(page.getByText(/preview/i).first()).toBeVisible();
  });
});

test.describe('Threat Feed', () => {
  test('loads threat intelligence feed with heading and stats', async ({ page }) => {
    await page.goto('/dashboard/threat-feed');
    await expect(page.getByRole('heading', { name: /threat intelligence feed/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Stats cards always rendered
    await expect(page.getByText(/tracked threats/i)).toBeVisible();
    await expect(page.getByText(/critical severity/i)).toBeVisible();
  });
});

/* ---------- Governance ---------- */

test.describe('Rule Engine', () => {
  test('loads policy rule engine page with heading', async ({ page }) => {
    await page.goto('/dashboard/rule-engine');
    await expect(page.getByRole('heading', { name: /policy rule engine/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Preview banner always shown
    await expect(page.getByText(/preview/i).first()).toBeVisible();
  });
});

test.describe('Policy Builder', () => {
  test('loads policy rule builder page with heading', async ({ page }) => {
    await page.goto('/dashboard/policies/builder');
    await expect(page.getByRole('heading', { name: /policy rule builder/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

test.describe('Cloud Setup', () => {
  test('loads cloud setup wizard with heading and step indicator', async ({ page }) => {
    await page.goto('/dashboard/cloud/setup');
    await expect(page.getByRole('heading', { name: /connect cloud account/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Step indicator always rendered
    await expect(page.getByText(/select provider/i)).toBeVisible();
  });
});

test.describe('Cloud Findings', () => {
  test('loads CSPM findings page with heading and severity filters', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Severity and status filter selects
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

/* ---------- SLO & SLA ---------- */

test.describe('SLO Dashboard', () => {
  test('loads SLO dashboard with heading and stats', async ({ page }) => {
    await page.goto('/dashboard/slo-dashboard');
    await expect(page.getByRole('heading', { name: /integration slo dashboard/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Preview banner always shown
    await expect(page.getByText(/preview/i).first()).toBeVisible();
    // Stats cards always present
    await expect(page.getByText(/healthy/i).first()).toBeVisible();
  });
});

test.describe('SLA Monitor', () => {
  test('loads SLA monitor page with heading', async ({ page }) => {
    await page.goto('/dashboard/sla');
    await expect(page.getByRole('heading', { name: /sla monitor/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/* ---------- Team ---------- */

test.describe('Team Settings', () => {
  test('loads team settings page with heading or auth fallback', async ({ page }) => {
    await page.goto('/dashboard/team/settings');
    // May show heading or "No organization found" / "Unauthorized"
    const heading = page.getByRole('heading', { name: /team settings/i });
    const noOrg = page.getByText(/no organization found|unauthorized/i);
    await expect(heading.or(noOrg)).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

test.describe('Team SSO', () => {
  test('loads SSO configuration page with heading or fallback', async ({ page }) => {
    await page.goto('/dashboard/team/sso');
    // May show heading or organization / permission error
    const heading = page.getByRole('heading', { name: /single sign-on/i });
    const fallback = page.getByText(/no organization|please sign in|admin access/i);
    await expect(heading.or(fallback)).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

test.describe('Team Data Residency', () => {
  test('loads data residency page with heading or fallback', async ({ page }) => {
    await page.goto('/dashboard/team/residency');
    const heading = page.getByRole('heading', { name: /data residency/i });
    const fallback = page.getByText(/no organization found/i);
    await expect(heading.or(fallback)).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/* ---------- Integrations ---------- */

test.describe('Integration Catalog', () => {
  test('loads integrations page with heading and integration cards', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    await expect(page.getByRole('heading', { name: /integrations/i }).first()).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Integration count is mentioned in the subtitle
    await expect(page.getByText(/integrations available/i)).toBeVisible();
  });
});

test.describe('Integration Health', () => {
  test('loads integration health page with heading', async ({ page }) => {
    await page.goto('/dashboard/integrations/health');
    await expect(page.getByRole('heading', { name: /integration health/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/* ---------- Settings ---------- */

test.describe('API Keys', () => {
  test('loads API keys page with heading and usage section', async ({ page }) => {
    await page.goto('/dashboard/settings/api-keys');
    await expect(page.getByRole('heading', { name: /api keys/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
    // Usage section with curl example always present
    await expect(page.getByText(/usage/i).first()).toBeVisible();
  });
});

test.describe('Notification Channels', () => {
  test('loads notification channels page with heading', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await expect(page.getByRole('heading', { name: /notification channels/i })).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});

/* ---------- Agent Team ---------- */

test.describe('Agent Team', () => {
  test('loads team agents page with heading or loading skeleton', async ({ page }) => {
    await page.goto('/dashboard/agents/team');
    // Client-side rendered: may show skeleton briefly, then heading
    const heading = page.getByRole('heading', { name: /team agents/i });
    const emptyState = page.getByText(/no team activity yet/i);
    await expect(heading.or(emptyState)).toBeVisible({ timeout: PAGE_TIMEOUT });
  });
});
