/**
 * Capture Play Store + App Store + manifest screenshots.
 *
 * Run twice:
 *
 *   1. SETUP (once, opens visible browser, you log in, saves auth):
 *      pnpm tsx apps/web/scripts/capture-store-screenshots.ts --setup
 *
 *   2. CAPTURE (uses saved auth, runs headless, writes screenshots):
 *      pnpm tsx apps/web/scripts/capture-store-screenshots.ts
 *
 * Output:
 *   apps/web/static/brand/screenshots/phone/      — 1080x1920 (Play Store + manifest)
 *   apps/web/static/brand/screenshots/desktop/    — 1920x1080 (manifest)
 *   apps/web/static/brand/screenshots/iphone/     — 1290x2796 (App Store, when ready)
 *
 * After capture: copy phone/01-dashboard.png to manifest screenshot path,
 * upload others to Play Console / App Store Connect manually.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'https://app.tenantiq.app';
const ROOT = resolve(__dirname, '..');
const SCREENSHOT_DIR = resolve(ROOT, 'static/brand/screenshots');
const AUTH_STATE_PATH = resolve(ROOT, '.screenshot-auth.json');

interface Viewport { width: number; height: number; deviceScaleFactor?: number; }

const VIEWPORTS: Record<string, Viewport> = {
	phone: { width: 1080, height: 1920, deviceScaleFactor: 1 },
	iphone: { width: 1290, height: 2796, deviceScaleFactor: 1 },
	desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
};

const PAGES = [
	{ slug: '01-dashboard', path: '/', waitFor: 'h1, [data-testid="dashboard-grid"]' },
	{ slug: '02-alerts', path: '/alerts', waitFor: 'h1, table, [class*="alert"]' },
	{ slug: '03-cis', path: '/security/cis', waitFor: 'h1, [class*="control"]' },
	{ slug: '04-chat', path: '/ai', waitFor: 'h1, textarea, [class*="chat"]' },
	{ slug: '05-settings', path: '/settings', waitFor: 'h1, [class*="setting"]' },
];

async function ensureDirs() {
	for (const v of Object.keys(VIEWPORTS)) {
		await mkdir(resolve(SCREENSHOT_DIR, v), { recursive: true });
	}
}

async function setup() {
	console.log(`Opening ${BASE_URL} for interactive login...`);
	console.log('Sign in normally. Once you reach the dashboard, return to this terminal.');
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(BASE_URL);

	console.log('\nWaiting for you to log in. Press Ctrl+C in this terminal once you see the dashboard.');
	console.log(`Auth will be saved to ${AUTH_STATE_PATH}.`);

	// Wait until user navigates to / and sees authenticated content (presence of sidebar).
	await page.waitForFunction(() => document.querySelector('aside, nav[role="navigation"]'), { timeout: 5 * 60_000 });

	await context.storageState({ path: AUTH_STATE_PATH });
	console.log(`✅ Auth saved to ${AUTH_STATE_PATH}. You can now run without --setup.`);
	await browser.close();
}

async function capture() {
	if (!existsSync(AUTH_STATE_PATH)) {
		console.error(`No auth state at ${AUTH_STATE_PATH}. Run with --setup first.`);
		process.exit(1);
	}

	const browser = await chromium.launch({ headless: true });

	for (const [vName, vp] of Object.entries(VIEWPORTS)) {
		console.log(`\n── ${vName.toUpperCase()} (${vp.width}x${vp.height}) ──`);
		const context = await browser.newContext({
			viewport: { width: vp.width, height: vp.height },
			deviceScaleFactor: vp.deviceScaleFactor,
			storageState: AUTH_STATE_PATH,
		});
		const page = await context.newPage();

		for (const p of PAGES) {
			const target = `${BASE_URL}${p.path}`;
			console.log(`  → ${p.slug}: ${target}`);
			try {
				await page.goto(target, { waitUntil: 'networkidle', timeout: 30_000 });
				await page.waitForSelector(p.waitFor, { timeout: 8_000 }).catch(() => {});
				// Settle animations + lazy data.
				await page.waitForTimeout(1500);
				const out = resolve(SCREENSHOT_DIR, vName, `${p.slug}.png`);
				await page.screenshot({ path: out, fullPage: false });
				console.log(`    ✓ ${out}`);
			} catch (err) {
				console.error(`    ✗ ${p.slug}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		await context.close();
	}

	await browser.close();
	console.log(`\n✅ Done. Screenshots in ${SCREENSHOT_DIR}/`);
	console.log('Next:');
	console.log('  - Copy static/brand/screenshots/phone/01-dashboard.png → static/brand/screenshot-mobile.png');
	console.log('  - Copy static/brand/screenshots/desktop/01-dashboard.png → static/brand/screenshot-desktop.png');
	console.log('  - Upload phone/* to Play Console (Store listing → Phone screenshots)');
	console.log('  - Upload iphone/* to App Store Connect (when Apple unblocked)');
}

(async () => {
	await ensureDirs();
	if (process.argv.includes('--setup')) {
		await setup();
	} else {
		await capture();
	}
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
