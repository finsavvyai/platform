import { test, expect } from '@playwright/test';

test.describe('OpenAgent Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/openagent');
  });

  test('page loads with heading and value proposition', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('has install CTA button linking to /openagent/install', async ({ page }) => {
    const installLink = page.getByRole('link', { name: /install|download|get started/i });
    await expect(installLink.first()).toBeVisible();
  });

  test('feature section describes agent monitoring', async ({ page }) => {
    // Should mention monitoring, security, or agent visibility
    await expect(
      page.getByText(/monitor|security|visibility|file|command/i).first()
    ).toBeVisible();
  });

  test('has navigation header', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('icons render as SVG elements', async ({ page }) => {
    const svgIcons = page.locator('svg');
    const count = await svgIcons.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('OpenAgent Install Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/openagent/install');
  });

  test('page loads with install heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Install OpenAgent');
  });

  test('download button links to .vsix file', async ({ page }) => {
    const downloadBtn = page.getByRole('link', { name: /download/i });
    await expect(downloadBtn).toBeVisible();
    const href = await downloadBtn.getAttribute('href');
    expect(href).toContain('.vsix');
  });

  test('installation steps are visible', async ({ page }) => {
    await expect(page.getByText('Download the extension')).toBeVisible();
    await expect(page.getByText('Install via VS Code CLI')).toBeVisible();
    await expect(page.getByText('Reload VS Code')).toBeVisible();
    await expect(page.getByText('Start monitoring')).toBeVisible();
  });

  test('CLI command is displayed in code block', async ({ page }) => {
    const codeBlock = page.locator('code');
    await expect(codeBlock.first()).toBeVisible();
    await expect(codeBlock.first()).toContainText('--install-extension');
  });

  test('post-install CTA links to sign-up and back', async ({ page }) => {
    await expect(page.getByRole('link', { name: /cloud dashboard|sign.up/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to openagent/i })).toBeVisible();
  });

  test('free badge is visible', async ({ page }) => {
    await expect(page.getByText(/free/i).first()).toBeVisible();
  });

  test('step numbers render 1-4', async ({ page }) => {
    for (const n of ['1', '2', '3', '4']) {
      await expect(page.getByText(n, { exact: true }).first()).toBeVisible();
    }
  });

  test('all step icons render as SVGs', async ({ page }) => {
    // Download, Terminal, CheckCircle, Shield icons
    const svgIcons = page.locator('svg');
    const count = await svgIcons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
