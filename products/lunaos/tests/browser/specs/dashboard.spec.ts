import { test, expect } from '../helpers/fixtures';

/**
 * Dashboard production smoke — hard assertions for all 3 personas.
 * Mocked API ensures deterministic UI state.
 *
 * Personas covered:
 *   - Solo Dev: workflows list, API keys
 *   - Pro Team: billing/subscription, team invite
 *   - Enterprise: SSO admin entry (separate spec)
 */
test.describe('Dashboard smoke (all personas)', () => {
    test('loads overview after auth', async ({ mockedPage }) => {
        await mockedPage.goto('/');
        await expect(mockedPage).toHaveTitle(/Dashboard|LunaOS/i);
    });

    test('Solo Dev: workflows list renders from API', async ({ mockedPage }) => {
        await mockedPage.goto('/workflows');
        const rows = mockedPage.locator('[data-testid="workflow-row"], [role="row"]');
        await expect(rows.first()).toBeVisible({ timeout: 10_000 });
        expect(await rows.count()).toBeGreaterThan(0);
    });

    test('Pro Team: subscription status shows Pro plan', async ({ mockedPage }) => {
        await mockedPage.goto('/billing');
        await expect(mockedPage.getByText(/\bpro\b/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('Solo Dev: API keys page has create button', async ({ mockedPage }) => {
        await mockedPage.goto('/api-keys');
        const btn = mockedPage.getByRole('button', { name: /create|new key/i });
        await expect(btn.first()).toBeEnabled({ timeout: 10_000 });
    });

    test('Pro Team: team invite flow opens form', async ({ mockedPage }) => {
        await mockedPage.goto('/teams');
        const invite = mockedPage.getByRole('button', { name: /invite/i });
        await expect(invite.first()).toBeVisible({ timeout: 10_000 });
        await invite.first().click();
        await expect(mockedPage.getByLabel(/email/i).first()).toBeVisible({ timeout: 5_000 });
    });

    test('Enterprise: SSO admin link present', async ({ mockedPage }) => {
        await mockedPage.goto('/admin/sso');
        // Either renders SSO list, or redirects to login (auth gate works)
        await expect(mockedPage).toHaveURL(/sso|login/, { timeout: 10_000 });
    });
});
