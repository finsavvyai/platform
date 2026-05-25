import { test, expect } from '@playwright/test';

test.describe('Blog Pages', () => {
  test('blog index loads with heading and post list', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Should show at least one blog post link
    const postLinks = page.locator('a[href*="/blog/"]');
    await expect(postLinks.first()).toBeVisible();
  });

  test('blog index has navigation back to site', async ({ page }) => {
    await page.goto('/blog');
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    // Nav should have a link back to home or site — either logo or text link
    const homeLink = nav.getByRole('link').first();
    await expect(homeLink).toBeVisible();
  });

  test('introducing-opensyber article loads', async ({ page }) => {
    await page.goto('/blog/introducing-opensyber');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Article should have body content
    const article = page.locator('article, main, [class*="prose"]').first();
    await expect(article).toBeVisible();
  });

  test('security-risk article loads', async ({ page }) => {
    await page.goto('/blog/why-self-hosted-ai-agents-are-a-security-risk');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('blog posts have share buttons or back link', async ({ page }) => {
    await page.goto('/blog/introducing-opensyber');
    // Either share buttons or a back-to-blog link should exist
    const backLink = page.getByRole('link', { name: /blog|back/i });
    const shareSection = page.locator('[class*="share"], [data-testid*="share"]');
    const hasBack = await backLink.first().isVisible().catch(() => false);
    const hasShare = await shareSection.first().isVisible().catch(() => false);
    expect(hasBack || hasShare).toBe(true);
  });

  test('blog index links navigate to articles', async ({ page }) => {
    await page.goto('/blog');
    const firstPost = page.locator('a[href*="/blog/"]').first();
    const href = await firstPost.getAttribute('href');
    expect(href).toBeTruthy();
    await firstPost.click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
