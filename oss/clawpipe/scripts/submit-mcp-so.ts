/** Submit ClawPipe MCP server to mcp.so/submit via Playwright.
 *
 * Usage: npx tsx scripts/submit-mcp-so.ts
 * No login required. Saves a screenshot of the result to /tmp/.
 */
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

const ROOT = path.resolve(__dirname, '..');
const PROFILE = path.join(os.homedir(), '.cache', 'clawpipe-playwright');

function ask(q: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, () => { rl.close(); r(); }));
}

async function main() {
  const interactive = process.argv.includes('--interactive');
  const serverJson = fs.readFileSync(path.join(ROOT, 'mcp-server/server.json'), 'utf8');
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: !interactive,
    viewport: { width: 1280, height: 900 },
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  try {
    await page.goto('https://mcp.so/submit', { waitUntil: 'domcontentloaded' });
    await page.fill('input#name', 'ClawPipe');
    await page.fill('input#url', 'https://github.com/finsavvyai/clawpipe');
    const configField = page.locator('textarea[name="server_config"], textarea#server_config, [name="server_config"]').first();
    if (await configField.count()) await configField.fill(serverJson);
    await page.screenshot({ path: '/tmp/mcp-so-before.png', fullPage: true });

    if (interactive) {
      console.log('Browser open. Sign in with Google/GitHub, then press Enter here to submit.');
      await ask('> ');
    }

    const submit = page.locator('button[type="submit"], button:has-text("Submit")').first();
    if (await submit.count()) {
      await submit.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: '/tmp/mcp-so-after.png', fullPage: true });
    console.log('screenshots: /tmp/mcp-so-before.png + /tmp/mcp-so-after.png');
    console.log('final URL:', page.url());
    if (!interactive) {
      console.log('NOTE: mcp.so requires Google/GitHub sign-in. Re-run with --interactive to complete.');
    }
  } finally {
    await ctx.close();
  }
}

main().catch((e) => { console.error('submit-mcp-so failed:', e.message); process.exit(1); });
