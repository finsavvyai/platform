/**
 * Live billing-checkout smoke against production. Uses the saved auth state
 * from cert-prep-signed-in (.auth/tenantiq.json).
 *
 *   npx playwright test billing-checkout --project=chromium
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const API = process.env.API_URL || 'https://api.tenantiq.app';
const AUTH_STATE = path.resolve('.auth/tenantiq.json');

test.skip(!fs.existsSync(AUTH_STATE), 'sign-in saved state required (run cert-prep-signed-in first)');

for (const cycle of ['monthly', 'annual'] as const) {
	for (const plan of ['core', 'professional', 'security_suite', 'enterprise'] as const) {
		test(`POST /billing/checkout — ${plan} ${cycle} returns checkout url`, async ({ browser }) => {
			const ctx = await browser.newContext({ storageState: AUTH_STATE });
			const page = await ctx.newPage();
			const res = await page.request.post(`${API}/api/billing/checkout`, {
				data: { plan, cycle },
				headers: { 'Content-Type': 'application/json' },
			});
			expect(res.status(), `${plan} ${cycle}`).toBe(200);
			const json = await res.json();
			expect(json.checkoutUrl, `${plan} ${cycle} url`).toMatch(/^https:\/\/.*lemonsqueezy\.com\//);
			await ctx.close();
		});
	}
}
