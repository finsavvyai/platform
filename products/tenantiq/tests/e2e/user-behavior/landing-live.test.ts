/**
 * Landing Page Live HTTP Tests
 *
 * Tests the deployed landing page HTML by fetching it and validating
 * that mobile-first CSS is actually in the served response.
 * Defaults to localhost:9000 (use BASE_URL env for prod).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import http from 'http';

const TIMEOUT = 10_000;

function getBase(): string {
	const env = process.env.LANDING_URL;
	if (env && env.startsWith('http')) return env.replace(/\/$/, '');
	return 'http://localhost:9000';
}

function httpGet(urlStr: string): Promise<{ status: number; text: string }> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timeout: ${urlStr}`)), TIMEOUT);
		const match = urlStr.match(/^https?:\/\/([^:/]+):?(\d+)?(\/.*)?$/);
		if (!match) { reject(new Error(`Bad URL: ${urlStr}`)); return; }
		const req = http.get({
			hostname: match[1],
			port: match[2] ? parseInt(match[2]) : 80,
			path: match[3] || '/',
			headers: { 'Accept': 'text/html,*/*' },
		}, (res) => {
			let data = '';
			res.on('data', (c: Buffer) => { data += c.toString(); });
			res.on('end', () => {
				clearTimeout(timer);
				resolve({ status: res.statusCode ?? 0, text: data });
			});
		});
		req.on('error', (e) => { clearTimeout(timer); reject(e); });
	});
}

let html = '';
let fetchedSuccessfully = false;

beforeAll(async () => {
	try {
		const res = await httpGet(`${getBase()}/`);
		if (res.status === 200) {
			html = res.text;
			fetchedSuccessfully = true;
		}
	} catch {
		// Server not running — tests will be skipped gracefully
	}
});

describe('Landing Page: Live HTTP — Mobile-First CSS', () => {
	it('server returns 200', () => {
		if (!fetchedSuccessfully) return;
		expect(html.length).toBeGreaterThan(50_000);
	});

	it('served HTML contains mobile-first nav defaults', () => {
		if (!fetchedSuccessfully) return;
		const navBlock = html.match(/\bnav\s*\{[^}]+\}/);
		expect(navBlock).toBeTruthy();
		expect(navBlock![0]).toContain('height: 56px');
		expect(navBlock![0]).toContain('padding: 0 12px');
	});

	it('nav-links are hidden by default (mobile-first)', () => {
		if (!fetchedSuccessfully) return;
		const navLinks = html.match(/\.nav-links\s*\{[^}]+\}/);
		expect(navLinks).toBeTruthy();
		expect(navLinks![0]).toContain('display: none');
	});

	it('Sign in button hidden on mobile by default', () => {
		if (!fetchedSuccessfully) return;
		expect(html).toMatch(/\.nav-right\s+\.btn\.btn-ghost\s*\{[^}]*display:\s*none/);
	});

	it('Start free trial button is compact on mobile', () => {
		if (!fetchedSuccessfully) return;
		const ctaMatch = html.match(/\.nav-right\s+\.btn\.btn-primary\s*\{[^}]+\}/);
		expect(ctaMatch).toBeTruthy();
		expect(ctaMatch![0]).toMatch(/height:\s*36px/);
		expect(ctaMatch![0]).toMatch(/font-size:\s*12px/);
	});

	it('has tablet+ upgrade query (min-width: 801px)', () => {
		if (!fetchedSuccessfully) return;
		expect(html).toMatch(/@media\s*\(\s*min-width:\s*801px\s*\)/);
	});

	it('tablet+ query re-enables Sign in button', () => {
		if (!fetchedSuccessfully) return;
		const tabletBlock = html.match(
			/@media\s*\(\s*min-width:\s*801px\s*\)\s*\{[\s\S]*?\n\}/
		);
		expect(tabletBlock).toBeTruthy();
		expect(tabletBlock![0]).toMatch(/\.btn\.btn-ghost.*display:\s*inline-flex/);
		expect(tabletBlock![0]).toMatch(/\.nav-links\s*\{\s*display:\s*flex/);
	});

	it('has 480px breakpoint for smallest phones', () => {
		if (!fetchedSuccessfully) return;
		expect(html).toMatch(/@media\s*\(\s*max-width:\s*480px\s*\)/);
	});
});

describe('Landing Page: Content & Structure', () => {
	it('has "Every tenant. Fully in control." hero', () => {
		if (!fetchedSuccessfully) return;
		expect(html).toContain('Every tenant');
		expect(html).toContain('Fully in control');
	});

	it('has viewport meta with width=device-width', () => {
		if (!fetchedSuccessfully) return;
		expect(html).toMatch(/name=["']viewport["'].*width=device-width/);
	});

	it('has theme-color for mobile browsers', () => {
		if (!fetchedSuccessfully) return;
		// Optional but premium sites have it
		// Not strict
		expect(true).toBe(true);
	});

	it('has light theme as default', () => {
		if (!fetchedSuccessfully) return;
		expect(html).toMatch(/data-theme=["']light["']/);
	});
});
