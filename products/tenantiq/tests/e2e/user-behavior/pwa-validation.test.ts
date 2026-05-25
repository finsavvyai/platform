/**
 * PWA Validation Tests
 *
 * Verifies the Progressive Web App configuration:
 * - manifest.json is valid and contains required fields
 * - Service worker is reachable and parseable
 * - Offline fallback page exists
 * - All required icons are generated and accessible
 * - Service worker is registered in the SvelteKit layout
 */
import { describe, it, expect } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';

const TIMEOUT = 10_000;

function getBase(): string {
	const env = process.env.BASE_URL;
	if (env && env.startsWith('http')) return env.replace(/\/$/, '');
	return 'http://localhost:5173';
}

function httpGet(urlStr: string): Promise<{ status: number; text: string; headers: Record<string, string> }> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timeout: ${urlStr}`)), TIMEOUT);
		const match = urlStr.match(/^https?:\/\/([^:/]+):?(\d+)?(\/.*)?$/);
		if (!match) { reject(new Error(`Bad URL: ${urlStr}`)); return; }
		const req = http.get({
			hostname: match[1], port: match[2] ? parseInt(match[2]) : 80,
			path: match[3] || '/',
		}, (res) => {
			let data = '';
			res.on('data', (c: Buffer) => { data += c.toString(); });
			res.on('end', () => {
				clearTimeout(timer);
				const hdrs: Record<string, string> = {};
				for (const [k, v] of Object.entries(res.headers)) {
					if (typeof v === 'string') hdrs[k] = v;
				}
				resolve({ status: res.statusCode ?? 0, text: data, headers: hdrs });
			});
		});
		req.on('error', (e) => { clearTimeout(timer); reject(e); });
	});
}

async function fetchPage(p: string) {
	return httpGet(`${getBase()}${p}`);
}

/* ================================================================ */
/*  PWA Manifest Validation                                         */
/* ================================================================ */

describe('PWA: Manifest', () => {
	let manifest: any;

	it('/manifest.json returns 200 with JSON', async () => {
		const { status, text, headers } = await fetchPage('/manifest.json');
		expect(status).toBe(200);
		expect(text.length).toBeGreaterThan(100);
		manifest = JSON.parse(text);
		expect(manifest).toBeTruthy();
	});

	it('has required PWA fields', () => {
		expect(manifest.name).toBeTruthy();
		expect(manifest.short_name).toBeTruthy();
		expect(manifest.start_url).toBeTruthy();
		expect(manifest.display).toBeTruthy();
		expect(manifest.icons).toBeTruthy();
	});

	it('display mode is standalone (makes it installable)', () => {
		expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
	});

	it('has theme_color and background_color', () => {
		expect(manifest.theme_color).toMatch(/^#[0-9a-f]{3,8}$/i);
		expect(manifest.background_color).toMatch(/^#[0-9a-f]{3,8}$/i);
	});

	it('has 192x192 PNG icon (required for Android install)', () => {
		const icon192 = manifest.icons.find(
			(i: any) => i.sizes === '192x192' && i.type === 'image/png'
		);
		expect(icon192).toBeTruthy();
	});

	it('has 512x512 PNG icon (required for splash screen)', () => {
		const icon512 = manifest.icons.find(
			(i: any) => i.sizes === '512x512' && i.type === 'image/png'
		);
		expect(icon512).toBeTruthy();
	});

	it('has maskable icon (for adaptive icon support)', () => {
		const maskable = manifest.icons.find(
			(i: any) => i.purpose && i.purpose.includes('maskable')
		);
		expect(maskable).toBeTruthy();
	});

	it('has start_url scoped to root', () => {
		expect(manifest.start_url).toBe('/');
	});

	it('has scope field', () => {
		expect(manifest.scope).toBe('/');
	});

	it('has app shortcuts for quick access', () => {
		expect(Array.isArray(manifest.shortcuts)).toBe(true);
		expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(1);
		for (const sc of manifest.shortcuts) {
			expect(sc.name).toBeTruthy();
			expect(sc.url).toBeTruthy();
		}
	});

	it('categories include business/security', () => {
		expect(Array.isArray(manifest.categories)).toBe(true);
		const hasRelevant = manifest.categories.some((c: string) =>
			['business', 'security', 'productivity'].includes(c)
		);
		expect(hasRelevant).toBe(true);
	});
});

/* ================================================================ */
/*  Service Worker                                                  */
/* ================================================================ */

describe('PWA: Service Worker', () => {
	let swText = '';

	it('/sw.js returns 200 with JavaScript', async () => {
		const { status, text, headers } = await fetchPage('/sw.js');
		expect(status).toBe(200);
		expect(text.length).toBeGreaterThan(500);
		swText = text;
	});

	it('service worker handles install event', () => {
		expect(swText).toContain("addEventListener('install'");
	});

	it('service worker handles activate event', () => {
		expect(swText).toContain("addEventListener('activate'");
	});

	it('service worker handles fetch event', () => {
		expect(swText).toContain("addEventListener('fetch'");
	});

	it('service worker precaches essential assets', () => {
		expect(swText).toContain('PRECACHE_URLS');
		expect(swText).toContain('/offline.html');
	});

	it('service worker skips non-GET requests', () => {
		expect(swText).toContain("method !== 'GET'");
	});

	it('service worker skips API calls (network-only)', () => {
		expect(swText).toContain('/api/');
	});

	it('service worker uses cache-first for static assets', () => {
		expect(swText).toMatch(/\.(js|css|svg|png)/);
	});

	it('service worker has offline fallback logic', () => {
		expect(swText).toContain('OFFLINE_URL');
	});

	it('service worker cleans old caches on activate', () => {
		expect(swText).toContain('caches.delete');
	});
});

/* ================================================================ */
/*  Offline Page                                                    */
/* ================================================================ */

describe('PWA: Offline Fallback Page', () => {
	let html = '';

	it('/offline.html returns 200 with HTML', async () => {
		const { status, text } = await fetchPage('/offline.html');
		expect(status).toBe(200);
		html = text;
	});

	it('has doctype and charset', () => {
		expect(html.toLowerCase()).toContain('<!doctype html');
		expect(html.toLowerCase()).toContain('charset');
	});

	it('has viewport meta tag', () => {
		expect(html).toMatch(/viewport/i);
	});

	it('has theme-color meta tag', () => {
		expect(html).toMatch(/theme-color/i);
	});

	it('shows offline message to user', () => {
		expect(html.toLowerCase()).toContain('offline');
	});

	it('has retry button', () => {
		expect(html.toLowerCase()).toMatch(/retry|reload/i);
	});

	it('is self-contained (no external resources)', () => {
		// Offline page should work without network
		expect(html).not.toMatch(/<script[^>]+src=["']https?:/);
		expect(html).not.toMatch(/<link[^>]+href=["']https?:/);
	});
});

/* ================================================================ */
/*  PWA Icons                                                       */
/* ================================================================ */

describe('PWA: Icon Assets', () => {
	const icons = [
		'/icons/icon-192.png',
		'/icons/icon-512.png',
		'/icons/icon-maskable-192.png',
		'/icons/icon-maskable-512.png',
		'/icons/apple-touch-icon.png',
		'/favicon.svg',
	];

	for (const icon of icons) {
		it(`${icon} returns 200`, async () => {
			const { status, headers } = await fetchPage(icon);
			expect(status).toBe(200);
			// Should have image content-type
			const ct = headers['content-type'] || '';
			expect(ct).toMatch(/image|svg/i);
		});
	}
});

/* ================================================================ */
/*  Service Worker Registration in App                              */
/* ================================================================ */

describe('PWA: App Registration', () => {
	it('root layout registers service worker', () => {
		const layoutPath = path.resolve(
			process.cwd(),
			'apps/web/src/routes/+layout.svelte'
		);
		const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
		expect(layoutContent).toContain('serviceWorker');
		expect(layoutContent).toContain('register');
	});

	it('app.html links to manifest', () => {
		const appHtmlPath = path.resolve(
			process.cwd(),
			'apps/web/src/app.html'
		);
		const appHtml = fs.readFileSync(appHtmlPath, 'utf-8');
		expect(appHtml).toContain('rel="manifest"');
	});

	it('app.html has apple-mobile-web-app-capable meta', () => {
		const appHtml = fs.readFileSync(
			path.resolve(process.cwd(), 'apps/web/src/app.html'),
			'utf-8'
		);
		expect(appHtml).toContain('apple-mobile-web-app-capable');
	});

	it('app.html has theme-color meta', () => {
		const appHtml = fs.readFileSync(
			path.resolve(process.cwd(), 'apps/web/src/app.html'),
			'utf-8'
		);
		expect(appHtml).toContain('name="theme-color"');
	});

	it('app.html has apple-touch-icon link', () => {
		const appHtml = fs.readFileSync(
			path.resolve(process.cwd(), 'apps/web/src/app.html'),
			'utf-8'
		);
		expect(appHtml).toContain('apple-touch-icon');
	});

	it('app.html has viewport meta with viewport-fit=cover', () => {
		const appHtml = fs.readFileSync(
			path.resolve(process.cwd(), 'apps/web/src/app.html'),
			'utf-8'
		);
		expect(appHtml).toContain('viewport-fit=cover');
	});
});
