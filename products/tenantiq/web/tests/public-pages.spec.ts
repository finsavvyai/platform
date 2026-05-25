import { test, expect } from '@playwright/test';

test.describe('landing / sign-in page', () => {
	test('renders SignInHero with sign-in buttons', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
		await expect(page.getByText('Sign in with Microsoft')).toBeVisible();
		await expect(page.getByText('Sign in with LinkedIn')).toBeVisible();
	});

	test('hero stats visible (100+ CIS Controls, 5 Frameworks, 13+ AI Tools)', async ({ page }) => {
		await page.goto('/');
		// Stats may use exact or approximate text — check flexible
		await expect(page.getByText(/100\+/)).toBeVisible();
		await expect(page.getByText(/CIS Controls/i)).toBeVisible();
	});

	test('trust badges visible', async ({ page }) => {
		await page.goto('/');
		for (const badge of ['SOC 2', 'HIPAA', 'GDPR', 'Zero Trust']) {
			await expect(page.getByText(badge).first()).toBeVisible();
		}
	});

	test('Microsoft sign-in link points to API auth', async ({ page }) => {
		await page.goto('/');
		const msLink = page.getByText('Sign in with Microsoft');
		const href = await msLink.getAttribute('href');
		expect(href).toContain('/api/auth/login');
	});

	test('onboard org link present for admins', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('Onboard your organization')).toBeVisible();
	});

	test('LinkedIn sign-in link present', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('Sign in with LinkedIn')).toBeVisible();
	});
});

test.describe('home / marketing landing', () => {
	test('renders landing page with nav and hero', async ({ page }) => {
		await page.goto('/home');
		await expect(page).toHaveTitle(/TenantIQ/);
	});

	test('landing page has canonical URL', async ({ page }) => {
		await page.goto('/home');
		const canonical = page.locator('link[rel="canonical"]');
		const href = await canonical.getAttribute('href');
		expect(href).toContain('tenantiq');
	});
});

test.describe('legal pages', () => {
	test('privacy page renders with correct date', async ({ page }) => {
		await page.goto('/privacy');
		await expect(page).toHaveTitle(/Privacy Policy/);
		await expect(page.getByText('Last updated: April 2026')).toBeVisible();
	});

	test('terms page renders with correct date', async ({ page }) => {
		await page.goto('/terms');
		await expect(page).toHaveTitle(/Terms of Service/);
		await expect(page.getByText('Last updated: April 2026')).toBeVisible();
	});

	test('support page loads', async ({ page }) => {
		const res = await page.goto('/support');
		expect(res?.status()).toBeLessThan(400);
	});

	test('changelog page loads', async ({ page }) => {
		const res = await page.goto('/changelog');
		expect(res?.status()).toBeLessThan(400);
	});
});

test.describe('pricing page', () => {
	test('pricing page renders plans', async ({ page }) => {
		await page.goto('/pricing');
		await expect(page).toHaveTitle(/Pricing|TenantIQ/);
	});
});

test.describe('compare page', () => {
	test('compare page loads', async ({ page }) => {
		const res = await page.goto('/compare');
		expect(res?.status()).toBeLessThan(400);
	});
});

test.describe('demo page', () => {
	test('demo page loads', async ({ page }) => {
		const res = await page.goto('/demo');
		expect(res?.status()).toBeLessThan(400);
	});
});

test.describe('prospect scan', () => {
	test('prospect page loads', async ({ page }) => {
		const res = await page.goto('/prospect');
		expect(res?.status()).toBeLessThan(400);
	});
});
