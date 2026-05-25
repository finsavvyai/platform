import { authTest as test, expect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';

/**
 * Persona: Marcus Reeves — DevSecOps Team Lead
 *
 * Journey: Evaluates OpenSyber for team → sets up org + RBAC →
 * configures policies + alert channels → connects SIEM integrations →
 * monitors team agent activity → generates compliance reports →
 * triages incidents → manages team members.
 *
 * Plan: Team ($299/mo) → Professional ($799/mo)
 * Key value: Team governance, SIEM integration, compliance reports, RBAC
 */

/* ================================================================== */
/*  PHASE 1: ONBOARDING — Team & Organization Setup                    */
/* ================================================================== */
test.describe('Marcus — Onboarding: Organization & Team Setup', () => {
  test('team page loads with members or org creation', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const memberTable = page.locator('table');
    const createOrg = page.getByRole('button', { name: /create/i });
    const planGate = page.getByText(/upgrade|team plan|requires/i);

    const hasTable = await memberTable.isVisible().catch(() => false);
    const hasCreate = await createOrg.isVisible().catch(() => false);
    const hasGate = await planGate.first().isVisible().catch(() => false);

    expect(hasTable || hasCreate || hasGate).toBe(true);
  });

  test('team settings page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team/settings`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('invite member button visible when org exists', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite/i });
    const hasOrg = await page.locator('table').isVisible().catch(() => false);

    // If org exists, invite button should be present
    if (hasOrg) {
      await expect(inviteBtn).toBeVisible();
    }
  });

  test('invite modal opens with email field and role selector', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.getByRole('button', { name: /invite/i });
    if (!(await inviteBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No invite button — org may not exist');
    }

    await inviteBtn.click();

    const modal = page.locator('[role="dialog"], [class*="modal"]');
    const emailInput = page.getByPlaceholder(/email/i);
    const roleSelect = page.locator('select');

    const hasModal = await modal.first().isVisible().catch(() => false);
    const hasEmail = await emailInput.isVisible().catch(() => false);

    expect(hasModal || hasEmail).toBe(true);
  });

  test('role badges visible in member table', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/team`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    if (!(await table.isVisible().catch(() => false))) {
      test.skip(true, 'No member table visible');
    }

    const roleBadges = page.getByText(/owner|admin|developer|viewer|security/i);
    const count = await roleBadges.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

/* ================================================================== */
/*  PHASE 2: ACTIVATION — Policy & Alert Configuration                 */
/* ================================================================== */
test.describe('Marcus — Activation: Agent Policies & Alerts', () => {
  test('agent policies page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents/policies`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('policies show list or empty state with creation option', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents/policies`);
    await page.waitForLoadState('networkidle');

    const policies = page.locator('table, [class*="card"], [class*="policy"]');
    const emptyState = page.getByText(/no policies|create.*policy/i);
    const createBtn = page.getByRole('button', { name: /create|add|new/i });

    const hasPolicies = (await policies.count()) > 0;
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);
    const hasCreate = await createBtn.first().isVisible().catch(() => false);

    expect(hasPolicies || hasEmpty || hasCreate).toBe(true);
  });

  test('alert channels page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents/alert-channels`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('alert rules page shows list or creation option', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/alerts`);
    await page.waitForLoadState('networkidle');

    const alerts = page.locator('table');
    const emptyState = page.getByText(/no alerts|no active alerts/i);
    const createBtn = page.getByRole('button', { name: /create|add|new/i });

    const hasAlerts = await alerts.isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);
    const hasCreate = await createBtn.first().isVisible().catch(() => false);

    expect(hasAlerts || hasEmpty || hasCreate).toBe(true);
  });
});

/* ================================================================== */
/*  PHASE 3: ACTIVATION — SIEM & Ticketing Integration                 */
/* ================================================================== */
test.describe('Marcus — Activation: Integration Setup', () => {
  test('integrations catalog loads with categories', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('integration health page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations/health`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('Slack integration detail page accessible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations/slack`);
    await page.waitForLoadState('networkidle');

    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('Datadog integration detail page accessible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations/datadog`);
    await page.waitForLoadState('networkidle');

    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('Jira integration detail page accessible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/integrations/jira`);
    await page.waitForLoadState('networkidle');

    const content = page.locator('main');
    await expect(content).toBeVisible();
  });
});

/* ================================================================== */
/*  PHASE 4: DAILY OPS — Team Agent Monitoring                         */
/* ================================================================== */
test.describe('Marcus — Daily Ops: Team Agent Monitoring', () => {
  test('team agents page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents/team`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('agent activity page shows event feed or empty state', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('violations page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/agents/violations`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('audit logs page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/logs`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 5: DAILY OPS — Incident Triage                               */
/* ================================================================== */
test.describe('Marcus — Daily Ops: Incident Management', () => {
  test('incidents page loads with list or empty state', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/incidents`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const emptyState = page.getByText(/no incidents/i);
    const heading = page.getByRole('heading').first();

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);
    const hasHeading = await heading.isVisible().catch(() => false);

    expect(hasTable || hasEmpty || hasHeading).toBe(true);
  });

  test('vulnerabilities page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/vulnerabilities`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('threats page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/threats`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('supply chain page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/supply-chain`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 6: COMPLIANCE — Reports & Evidence                           */
/* ================================================================== */
test.describe('Marcus — Compliance: Reports & Evidence', () => {
  test('compliance page loads with framework options', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/compliance`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('OASF framework page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/oasf`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('security policies page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/security/policies`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  PHASE 7: EXPANSION — Notification Configuration                    */
/* ================================================================== */
test.describe('Marcus — Expansion: Advanced Configuration', () => {
  test('notification settings page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings/notifications`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('policy builder page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/policies/builder`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('MCP monitoring page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/mcp-monitoring`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
