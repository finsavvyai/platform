import { test, expect, request as pwRequest } from '@playwright/test';

const APP = process.env.BASE_URL || 'http://localhost:5173';

test.describe('static assets', () => {
	const ASSETS = [
		'/favicon.png',
		'/favicon.svg',
		'/favicon.ico',
		'/apple-touch-icon.png',
		'/manifest.json',
		'/robots.txt',
		'/sitemap.xml',
		'/og-image.png',
		'/sw.js',
	];

	for (const asset of ASSETS) {
		test(`${asset} returns 200`, async () => {
			const ctx = await pwRequest.newContext();
			const res = await ctx.get(`${APP}${asset}`);
			expect(res.status()).toBe(200);
		});
	}

	test('robots.txt allows crawling', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${APP}/robots.txt`);
		const body = await res.text();
		expect(body).toContain('User-agent');
	});

	test('manifest.json is valid JSON with name', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${APP}/manifest.json`);
		const json = await res.json();
		expect(json.name).toBeTruthy();
	});

	test('sitemap.xml contains URLs', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${APP}/sitemap.xml`);
		const body = await res.text();
		expect(body).toContain('<url>');
		expect(body).toContain('tenantiq');
	});
});

test.describe('LLM crawl endpoints', () => {
	test('llms.txt exists', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${APP}/llms.txt`);
		expect(res.status()).toBe(200);
	});

	test('llms-full.txt exists', async () => {
		const ctx = await pwRequest.newContext();
		const res = await ctx.get(`${APP}/llms-full.txt`);
		expect(res.status()).toBe(200);
	});
});
