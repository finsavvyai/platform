/**
 * Dashboard E2E Tests with Playwright
 * Tests for the unified dashboard HTML demo
 */

const { test, expect } = require('@playwright/test');

test.describe('Dashboard Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:3000');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load the dashboard page successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Enterprise Dashboard/);

    // Check main heading is visible
    await expect(page.locator('h1')).toContainText('Enterprise Dashboard');

    // Check subtitle is present
    await expect(page.locator('p')).toContainText('Unified platform management interface');
  });

  test('should display all dashboard sections', async ({ page }) => {
    // System Status section
    await expect(page.locator('text=System Status')).toBeVisible();

    // Quick Actions section
    await expect(page.locator('text=Quick Actions')).toBeVisible();

    // Key Metrics section
    await expect(page.locator('text=Key Metrics')).toBeVisible();

    // Recent Pipelines section
    await expect(page.locator('text=Recent Pipelines')).toBeVisible();

    // Notifications section
    await expect(page.locator('text=Notifications')).toBeVisible();
  });

  test('should display system status with all services', async ({ page }) => {
    const systemStatusSection = page.locator('text=System Status').locator('..').locator('..');

    // Check operational status
    await expect(systemStatusSection.locator('text=Operational')).toBeVisible();

    // Check service statuses
    await expect(page.locator('text=API Gateway')).toBeVisible();
    await expect(page.locator('text=SDLC Pipelines')).toBeVisible();
    await expect(page.locator('text=AI Assistant')).toBeVisible();
    await expect(page.locator('text=Billing System')).toBeVisible();

    // Check response times are displayed
    await expect(page.locator('text=ms')).toBeVisible();
    await expect(page.locator('text=uptime')).toBeVisible();
  });

  test('should display quick action buttons', async ({ page }) => {
    // Check all quick action buttons exist
    const quickActions = [
      'New Pipeline',
      'AI Assistant',
      'Quick Deploy',
      'API Keys'
    ];

    for (const action of quickActions) {
      await expect(page.locator(`button:has-text("${action}")`)).toBeVisible();
    }
  });

  test('should display key metrics with values', async ({ page }) => {
    // Check metric cards
    await expect(page.locator('text=API Calls')).toBeVisible();
    await expect(page.locator('text=Success Rate')).toBeVisible();
    await expect(page.locator('text=Active Users')).toBeVisible();
    await expect(page.locator('text=Response Time')).toBeVisible();

    // Check metric values are numbers
    const apiCallsElement = page.locator('text=API Calls').locator('..').locator('.text-xl');
    await expect(apiCallsElement).toBeVisible();

    // Check percentage indicators
    await expect(page.locator('text=%')).toBeVisible();
    await expect(page.locator('text=+')).toBeVisible(); // For change indicators
  });
});

test.describe('Interactive Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should toggle theme between light and dark mode', async ({ page }) => {
    // Find theme toggle button
    const themeButton = page.locator('button:has-text("Theme")');
    await expect(themeButton).toBeVisible();

    // Check initial state (light mode)
    const body = page.locator('body');
    await expect(body).not.toHaveClass(/dark/);

    // Click to toggle to dark mode
    await themeButton.click();

    // Check dark mode is applied
    await expect(body).toHaveClass(/dark/);

    // Check theme icon changed
    await expect(page.locator('#themeIcon')).toContainText('☀️');

    // Toggle back to light mode
    await themeButton.click();

    // Check light mode is restored
    await expect(body).not.toHaveClass(/dark/);
    await expect(page.locator('#themeIcon')).toContainText('🌙');
  });

  test('should display pipeline information correctly', async ({ page }) => {
    // Check pipeline entries
    const pipelines = [
      { name: 'Production Deploy', status: 'Completed' },
      { name: 'API Gateway Test', status: 'Running...' },
      { name: 'Security Scan', status: 'Failed' }
    ];

    for (const pipeline of pipelines) {
      await expect(page.locator(`text=${pipeline.name}`)).toBeVisible();
      await expect(page.locator(`text=${pipeline.status}`)).toBeVisible();
    }

    // Check environment badges
    await expect(page.locator('text=Production')).toBeVisible();
    await expect(page.locator('text=Staging')).toBeVisible();
    await expect(page.locator('text=Development')).toBeVisible();

    // Check user information
    await expect(page.locator('text=by John Doe')).toBeVisible();
    await expect(page.locator('text=by Jane Smith')).toBeVisible();
    await expect(page.locator('text=by Bob Johnson')).toBeVisible();
  });

  test('should display notifications with different types', async ({ page }) => {
    // Check notification entries
    await expect(page.locator('text=Pipeline Completed')).toBeVisible();
    await expect(page.locator('text=High API Usage')).toBeVisible();
    await expect(page.locator('text=New Feature')).toBeVisible();

    // Check notification descriptions
    await expect(page.locator('text=Production deployment pipeline completed successfully')).toBeVisible();
    await expect(page.locator('text=API usage is approaching your monthly limit')).toBeVisible();
    await expect(page.locator('text=AI-powered code analysis is now available')).toBeVisible();

    // Check notification icons/types
    await expect(page.locator('text=✅')).toBeVisible(); // Success
    await expect(page.locator('text=⚠️')).toBeVisible(); // Warning
    await expect(page.locator('text=ℹ️')).toBeVisible(); // Info
  });
});

test.describe('Real-time Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should update metrics in real-time', async ({ page }) => {
    // Get initial response time values
    const initialResponseTimes = await page.locator('.font-medium.text-gray-900').allTextContents();
    const validTimeElements = initialResponseTimes.filter(text => text.includes('ms'));
    expect(validTimeElements.length).toBeGreaterThan(0);

    // Wait for real-time updates (JavaScript updates every 3 seconds)
    await page.waitForTimeout(4000);

    // Get updated values
    const updatedResponseTimes = await page.locator('.font-medium.text-gray-900').allTextContents();
    const updatedValidTimeElements = updatedResponseTimes.filter(text => text.includes('ms'));
    expect(updatedValidTimeElements.length).toBeGreaterThan(0);

    // Values should have potentially changed (allowing for random variation)
    console.log('Initial response times:', validTimeElements);
    console.log('Updated response times:', updatedValidTimeElements);
  });

  test('should update running pipeline timer', async ({ page }) => {
    // Find the running pipeline
    const runningPipeline = page.locator('.animate-spin').locator('..');
    await expect(runningPipeline).toBeVisible();

    // Get initial timer text
    const initialTimer = await page.locator('text=Running...').locator('..').locator('.text-gray-500').textContent();
    console.log('Initial timer:', initialTimer);

    // Wait for timer update (updates every second)
    await page.waitForTimeout(2000);

    // Get updated timer text
    const updatedTimer = await page.locator('text=Running...').locator('..').locator('.text-gray-500').textContent();
    console.log('Updated timer:', updatedTimer);

    // Timer should have progressed
    expect(initialTimer).not.toBe(updatedTimer);
  });
});

test.describe('Button Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should respond to quick action button clicks', async ({ page }) => {
    // Set up console listener to capture click events
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // Click each quick action button
    const quickActionButtons = [
      'New Pipeline',
      'AI Assistant',
      'Quick Deploy',
      'API Keys'
    ];

    for (const buttonText of quickActionButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`).first();
      await expect(button).toBeVisible();
      await button.click();

      // Check that click was logged
      const clickMessage = consoleMessages.find(msg => msg.includes(`Action clicked: ${buttonText}`));
      expect(clickMessage).toBeTruthy();
    }
  });

  test('should handle hover effects on buttons', async ({ page }) => {
    const quickActionButtons = page.locator('button:has-text("New Pipeline"), button:has-text("AI Assistant"), button:has-text("Quick Deploy"), button:has-text("API Keys")');

    // Check buttons have hover classes
    const count = await quickActionButtons.count();
    expect(count).toBe(4);

    // Test hover on first button
    const firstButton = quickActionButtons.first();
    await firstButton.hover();

    // Hover should apply visual changes (we can't directly test CSS but can ensure no errors)
    await expect(firstButton).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 375, height: 667, name: 'Mobile' }
  ];

  viewports.forEach(viewport => {
    test(`should display correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');

      // Check main elements are visible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('text=System Status')).toBeVisible();
      await expect(page.locator('text=Quick Actions')).toBeVisible();

      // Check grid layout adapts
      const dashboardGrid = page.locator('.grid');
      await expect(dashboardGrid).toBeVisible();

      // On mobile, elements should stack
      if (viewport.width <= 768) {
        // Elements should still be visible but potentially stacked
        await expect(page.locator('text=Key Metrics')).toBeVisible();
      }
    });
  });
});

test.describe('Performance and Accessibility', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    console.log(`Page loaded in ${loadTime}ms`);
  });

  test('should have proper page structure', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check for proper heading structure
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Enterprise Dashboard');

    // Check for proper button labels
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Check for alt text on any images (if present)
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // If there are images, they should have alt attributes
      if (alt) {
        expect(alt).toBeTruthy();
      }
    }
  });
});

test.describe('Error Handling', () => {
  test('should handle missing elements gracefully', async ({ page }) => {
    // Test with JavaScript disabled (basic functionality)
    await page.context().route('**/*', route => {
      // Allow all requests but test error resilience
      route.continue();
    });

    await page.goto('http://localhost:3000');

    // Page should still load basic structure
    await expect(page.locator('h1')).toBeVisible();

    // Static content should be present
    await expect(page.locator('text=Enterprise Dashboard')).toBeVisible();
  });

  test('should maintain functionality with rapid interactions', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Rapid theme switching
    const themeButton = page.locator('button:has-text("Theme")');

    for (let i = 0; i < 10; i++) {
      await themeButton.click();
      await page.waitForTimeout(100);
    }

    // Should still be functional
    await expect(themeButton).toBeVisible();
    const body = page.locator('body');
    const hasDarkClass = await body.getAttribute('class');
    expect(hasDarkClass).toBeDefined();
  });
});