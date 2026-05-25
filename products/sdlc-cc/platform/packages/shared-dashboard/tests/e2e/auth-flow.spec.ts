import { test, expect } from '@playwright/test';

/**
 * AutoBoot Authentication Flow E2E Tests
 * Testing the complete user journey from landing page to dashboard
 */

test.describe('Authentication Flow', () => {

  test('Landing page loads and has correct navigation', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/AutoBoot/);

    // Check navigation links exist
    await expect(page.getByRole('link', { name: /features/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /architecture/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /pricing/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /docs/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();

    // Check hero section
    await expect(page.getByText(/Ship products/i)).toBeVisible();
    await expect(page.getByText(/10× faster/i)).toBeVisible();
  });

  test('Registration page loads with all elements', async ({ page }) => {
    await page.goto('/auth/register');

    // Check page title
    await expect(page).toHaveTitle(/Create Your Account/);

    // Check logo
    await expect(page.locator('text=AutoBoot')).toBeVisible();

    // Check form fields
    await expect(page.locator('input[type="text"]#name')).toBeVisible();
    await expect(page.locator('input[type="email"]#email')).toBeVisible();
    await expect(page.locator('input[type="password"]#password')).toBeVisible();

    // Check password strength meter
    await expect(page.locator('.password-strength')).toBeVisible();

    // Check social login buttons
    await expect(page.locator('text=/Continue with Google/i')).toBeVisible();
    await expect(page.locator('text=/Continue with GitHub/i')).toBeVisible();

    // Check submit button
    await expect(page.locator('button[type="submit"]', { hasText: /Create Account/i })).toBeVisible();

    // Check "Already have an account" link
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
  });

  test('Password strength meter works', async ({ page }) => {
    await page.goto('/auth/register');

    const passwordInput = page.locator('input[type="password"]#password');
    const strengthBar = page.locator('#password-strength-bar');

    // Weak password
    await passwordInput.fill('weak');
    await expect(strengthBar).toHaveClass(/weak/);

    // Medium password
    await passwordInput.fill('Medium123');
    await expect(strengthBar).toHaveClass(/medium/);

    // Strong password
    await passwordInput.fill('Strong123!@#');
    await expect(strengthBar).toHaveClass(/strong/);
  });

  test('Login page loads with all elements', async ({ page }) => {
    await page.goto('/auth/login');

    // Check page title
    await expect(page).toHaveTitle(/Sign In/);

    // Check form fields
    await expect(page.locator('input[type="email"]#email')).toBeVisible();
    await expect(page.locator('input[type="password"]#password')).toBeVisible();

    // Check "Forgot password" link
    await expect(page.getByRole('link', { name: /Forgot password/i })).toBeVisible();

    // Check social login buttons
    await expect(page.locator('text=/Continue with Google/i')).toBeVisible();
    await expect(page.locator('text=/Continue with GitHub/i')).toBeVisible();

    // Check submit button
    await expect(page.locator('button[type="submit"]', { hasText: /Sign In/i })).toBeVisible();

    // Check "Don't have an account" link
    await expect(page.getByRole('link', { name: /Sign up/i })).toBeVisible();
  });

  test('Pricing page loads with all tiers', async ({ page }) => {
    await page.goto('/pricing');

    // Check page title
    await expect(page).toHaveTitle(/Pricing/);

    // Check main heading
    await expect(page.getByRole('heading', { name: /Choose Your Plan/i })).toBeVisible();

    // Check billing toggle
    await expect(page.locator('button', { hasText: /Monthly/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /Annual/i })).toBeVisible();

    // Check all three pricing tiers by plan names
    await expect(page.getByRole('heading', { name: /^Free$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Pro$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Enterprise$/i })).toBeVisible();

    // Check Free tier details
    await expect(page.getByText(/5,000/i).first()).toBeVisible(); // MAUs

    // Check Pro tier details
    await expect(page.getByText(/\$49/i).first()).toBeVisible();
    await expect(page.getByText(/50,000/i).first()).toBeVisible(); // MAUs

    // Check comparison table
    await expect(page.getByText(/How We Compare to Clerk/i)).toBeVisible();

    // Check FAQ section
    await expect(page.getByText(/Frequently Asked Questions/i)).toBeVisible();
  });

  test('Billing toggle switches prices', async ({ page }) => {
    await page.goto('/pricing');

    const monthlyBtn = page.locator('button#monthly-btn');
    const annualBtn = page.locator('button#annual-btn');
    const proPrice = page.locator('#pro-price');

    // Check monthly price (default)
    await expect(proPrice).toHaveText('49');

    // Switch to annual
    await annualBtn.click();
    await expect(proPrice).toHaveText('39'); // 20% discount

    // Switch back to monthly
    await monthlyBtn.click();
    await expect(proPrice).toHaveText('49');
  });

  test('Dashboard page loads (UI only, no auth yet)', async ({ page }) => {
    // Mock localStorage to prevent redirect
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock-token-for-ui-test');
    });

    await page.goto('/dashboard');

    // Check page title
    await expect(page).toHaveTitle(/Dashboard/);

    // Check sidebar
    await expect(page.locator('.sidebar .logo')).toBeVisible();

    // Check navigation items
    await expect(page.locator('.nav-item', { hasText: /^Dashboard$/i }).first()).toBeVisible();
    await expect(page.locator('.nav-item', { hasText: /^Usage$/i })).toBeVisible();
    await expect(page.locator('.nav-item', { hasText: /^API Keys$/i })).toBeVisible();
    await expect(page.locator('.nav-item', { hasText: /^Billing$/i })).toBeVisible();
    await expect(page.locator('.nav-item', { hasText: /^Settings$/i })).toBeVisible();

    // Check stats cards
    await expect(page.locator('text=/Monthly Active Users/i')).toBeVisible();
    await expect(page.locator('text=/API Requests/i')).toBeVisible();
    await expect(page.locator('text=/Uptime/i')).toBeVisible();
    await expect(page.locator('text=/Active API Keys/i')).toBeVisible();
  });

  test('Dashboard tab switching works', async ({ page }) => {
    // Mock localStorage to prevent redirect
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock-token-for-ui-test');
    });

    await page.goto('/dashboard');

    // Click on Usage tab
    await page.locator('a[href="#usage"]').click();
    await expect(page.locator('#tab-usage')).toBeVisible();
    await expect(page.locator('#page-title')).toHaveText(/Usage/);

    // Click on API Keys tab
    await page.locator('a[href="#api-keys"]').click();
    await expect(page.locator('#tab-api-keys')).toBeVisible();
    await expect(page.locator('#page-title')).toHaveText(/API Keys/);

    // Click on Billing tab
    await page.locator('a[href="#billing"]').click();
    await expect(page.locator('#tab-billing')).toBeVisible();
    await expect(page.locator('#page-title')).toHaveText(/Billing/);

    // Click on Settings tab
    await page.locator('a[href="#settings"]').click();
    await expect(page.locator('#tab-settings')).toBeVisible();
    await expect(page.locator('#page-title')).toHaveText(/Settings/);
  });

  test('API key creation modal works', async ({ page }) => {
    // Mock localStorage to prevent redirect
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock-token-for-ui-test');
    });

    await page.goto('/dashboard');

    // Switch to API Keys tab
    await page.locator('a[href="#api-keys"]').click();

    // Click "Create New Key" button
    await page.locator('button', { hasText: /Create New Key/i }).first().click();

    // Check modal is visible
    await expect(page.locator('#create-key-modal')).toHaveClass(/active/);
    await expect(page.getByRole('heading', { name: /Create API Key/i })).toBeVisible();

    // Check form fields
    await expect(page.locator('#key-name')).toBeVisible();
    await expect(page.locator('#key-environment')).toBeVisible();

    // Close modal
    await page.locator('button', { hasText: /Cancel/i }).click();
    await expect(page.locator('#create-key-modal')).not.toHaveClass(/active/);
  });

  test('Integrations page loads', async ({ page }) => {
    await page.goto('/integrations');

    // Check page title
    await expect(page).toHaveTitle(/Integrations/);

    // Check main heading - use more specific selector
    await expect(page.locator('h1').filter({ hasText: /Integration/i })).toBeVisible();

    // Check that troubleshooting sections exist
    await expect(page.locator('h3').filter({ hasText: /Issue #1/i })).toBeVisible();
    await expect(page.getByText(/CORS/i).first()).toBeVisible();
  });

  test('API documentation page loads', async ({ page }) => {
    await page.goto('/api/v1/docs');

    // Check page title
    await expect(page).toHaveTitle(/API Documentation/);

    // Check main heading - use h1 selector
    await expect(page.locator('h1').filter({ hasText: /AutoBoot Framework API/i })).toBeVisible();

    // Check authentication section
    await expect(page.locator('h2').filter({ hasText: /Authentication/i }).first()).toBeVisible();

    // Check endpoints are documented
    await expect(page.locator('.path').filter({ hasText: /\/api\/v1\/auth\/login/i })).toBeVisible();
    await expect(page.locator('.path').filter({ hasText: /\/api\/v1\/auth\/register/i })).toBeVisible();
  });

  test('Health check endpoint works', async ({ page }) => {
    const response = await page.request.get('/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.version).toBeDefined();
    expect(data.environment).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  test('Navigation flow: Landing → Register → Pricing', async ({ page }) => {
    // Start on landing page
    await page.goto('/');

    // Click "Get Started"
    await page.getByRole('link', { name: /Get Started/i }).click();

    // Should be on register page
    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page).toHaveTitle(/Create Your Account/);

    // Note: When backend is implemented, registration will redirect to pricing
    // For now, we'll navigate directly
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/Pricing/);
  });

  test('Navigation flow: Landing → Login → Dashboard', async ({ page }) => {
    // Start on landing page
    await page.goto('/');

    // Click "Sign In"
    await page.getByRole('link', { name: /Sign In/i }).click();

    // Should be on login page
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page).toHaveTitle(/Sign In/);

    // Mock localStorage before navigating to dashboard
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'mock-token-for-ui-test');
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveTitle(/Dashboard/);
  });

  test('Responsive design: Mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test landing page
    await page.goto('/');
    await expect(page.getByText(/Ship products/i)).toBeVisible();

    // Test pricing page
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /Choose Your Plan/i })).toBeVisible();

    // Test dashboard (sidebar should stack on mobile)
    await page.goto('/dashboard');
    await expect(page.locator('text=AutoBoot').first()).toBeVisible();
  });

  test('All pages have proper meta tags', async ({ page }) => {
    const pages = [
      { url: '/', titleMatch: /AutoBoot/, needsAuth: false },
      { url: '/auth/register', titleMatch: /Create Your Account/, needsAuth: false },
      { url: '/auth/login', titleMatch: /Sign In/, needsAuth: false },
      { url: '/pricing', titleMatch: /Pricing/, needsAuth: false },
      { url: '/dashboard', titleMatch: /Dashboard/, needsAuth: true },
    ];

    for (const { url, titleMatch, needsAuth } of pages) {
      // Mock localStorage if auth is needed
      if (needsAuth) {
        await page.addInitScript(() => {
          localStorage.setItem('access_token', 'mock-token-for-ui-test');
        });
      }

      await page.goto(url);

      // Check title
      await expect(page).toHaveTitle(titleMatch);

      // Check viewport meta tag exists
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    }
  });
});

test.describe('Form Validation', () => {

  test('Registration form validates empty fields', async ({ page }) => {
    await page.goto('/auth/register');

    // Try to submit empty form
    await page.locator('button[type="submit"]').click();

    // HTML5 validation should prevent submission
    const nameInput = page.locator('input#name');
    const isValid = await nameInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('Login form validates empty fields', async ({ page }) => {
    await page.goto('/auth/login');

    // Try to submit empty form
    await page.locator('button[type="submit"]').click();

    // HTML5 validation should prevent submission
    const emailInput = page.locator('input#email');
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('Email field validates email format', async ({ page }) => {
    await page.goto('/auth/register');

    const emailInput = page.locator('input#email');

    // Invalid email
    await emailInput.fill('invalid-email');
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);

    // Valid email
    await emailInput.fill('user@example.com');
    const isValidNow = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValidNow).toBe(true);
  });
});

test.describe('Performance', () => {

  test('Pages load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('API health check responds quickly', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.request.get('/health');
    const responseTime = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    // Should respond in under 500ms
    expect(responseTime).toBeLessThan(500);
  });
});

test.describe('Accessibility', () => {

  test('Pages have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check h1 exists
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
  });

  test('Forms have labels', async ({ page }) => {
    await page.goto('/auth/register');

    // Check inputs have labels or placeholders
    const nameInput = page.locator('input#name');
    const placeholder = await nameInput.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

  test('Links have descriptive text', async ({ page }) => {
    await page.goto('/');

    // Check navigation links have text
    const links = page.locator('a.nav-link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const text = await links.nth(i).textContent();
      expect(text).toBeTruthy();
      expect(text!.trim().length).toBeGreaterThan(0);
    }
  });
});
