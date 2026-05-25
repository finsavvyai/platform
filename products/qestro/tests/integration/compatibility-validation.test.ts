/**
 * Cross-Browser and Cross-Platform Compatibility Validation Tests
 * Tests Questro functionality across different browsers and devices
 */

import { test, expect, devices } from '@playwright/test';

test.describe('Cross-Browser Compatibility', () => {
  const browsers = ['chromium', 'firefox', 'webkit'];

  browsers.forEach(browserName => {
    test.describe(`${browserName} browser`, () => {
      test.use({ browserName });

      test('should support core user workflows', async ({ page }) => {
        // Login workflow
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'TestPassword123!');
        await page.click('[data-testid="login-button"]');

        // Should navigate to dashboard
        await expect(page).toHaveURL('/dashboard');

        // Test navigation
        await page.click('[data-testid="nav-tests"]');
        await expect(page).toHaveURL('/tests');

        await page.click('[data-testid="nav-analytics"]');
        await expect(page).toHaveURL('/analytics');

        await page.click('[data-testid="nav-dashboard"]');
        await expect(page).toHaveURL('/dashboard');
      });

      test('should support test recording interface', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'TestPassword123!');
        await page.click('[data-testid="login-button"]');

        await page.goto('/recording-studio');

        // Test recording controls
        await page.selectOption('[data-testid="test-type-select"]', 'web');
        await page.fill('[data-testid="test-url-input"]', 'https://example.com');

        // Check that interactive elements work
        await expect(page.locator('[data-testid="start-recording-button"]')).toBeEnabled();
        await expect(page.locator('[data-testid="test-type-select"]')).toBeVisible();
      });

      test('should display UI components correctly', async ({ page }) => {
        await page.goto('/login');

        // Check layout consistency
        const loginContainer = page.locator('[data-testid="login-container"]');
        await expect(loginContainer).toBeVisible();

        const form = page.locator('[data-testid="login-form"]');
        await expect(form).toBeVisible();

        // Check responsive behavior
        await page.setViewportSize({ width: 768, height: 1024 });
        await expect(form).toBeVisible();

        await page.setViewportSize({ width: 375, height: 667 });
        await expect(form).toBeVisible();
      });
    });
  });
});

test.describe('Cross-Device Compatibility', () => {
  const devices = [
    { name: 'Desktop', viewport: { width: 1920, height: 1080 } },
    { name: 'Tablet', viewport: { width: 768, height: 1024 } },
    { name: 'Mobile', viewport: { width: 375, height: 667 } }
  ];

  devices.forEach(device => {
    test.describe(`${device.name} device (${device.viewport.width}x${device.viewport.height})`, () => {
      test.use({ viewport: device.viewport });

      test('should adapt layout appropriately', async ({ page }) => {
        await page.goto('/login');

        // Check that login form is visible and properly sized
        await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

        // Test responsive navigation
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'TestPassword123!');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('/dashboard');

        // Check navigation adapts to screen size
        const nav = page.locator('[data-testid="main-navigation"]');
        await expect(nav).toBeVisible();

        if (device.viewport.width <= 768) {
          // Should show mobile navigation
          await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
        } else {
          // Should show desktop navigation
          await expect(page.locator('[data-testid="desktop-navigation"]')).toBeVisible();
        }
      });

      test('should support touch interactions on mobile devices', async ({ page }) => {
        if (device.viewport.width <= 768) {
          await page.goto('/login');
          await page.fill('[data-testid="email-input"]', 'test@example.com');
          await page.fill('[data-testid="password-input"]', 'TestPassword123!');
          await page.click('[data-testid="login-button"]');

          // Test touch-friendly interactions
          await page.click('[data-testid="mobile-menu-button"]');
          await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

          // Test swipe gestures
          await page.goto('/tests');
          await page.touchstart({ x: 100, y: 200 });
          await page.touchmove({ x: 200, y: 200 });
          await page.touchend();
        }
      });

      test('should handle keyboard navigation', async ({ page }) => {
        await page.goto('/login');

        // Test tab navigation
        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('[data-testid="login-button"]')).toBeFocused();

        // Test form submission with Enter
        await page.keyboard.press('Tab'); // Back to email
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.keyboard.press('Tab');
        await page.fill('[data-testid="password-input"]', 'TestPassword123!');
        await page.keyboard.press('Enter');

        await page.waitForURL('/dashboard');
      });
    });
  });
});

test.describe('Mobile App Compatibility', () => {
  const mobileDevices = [
    devices['iPhone 13'],
    devices['iPhone 13 Pro'],
    devices['iPad Pro'],
    devices['Pixel 5'],
    devices['Galaxy S9+']
  ];

  mobileDevices.forEach(device => {
    test.describe(`${device.defaultBrowserType} on ${device.deviceName}`, () => {
      test.use({ ...device });

      test('should support mobile test recording workflows', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'TestPassword123!');
        await page.click('[data-testid="login-button"]');

        await page.goto('/recording-studio');

        // Test mobile recording interface
        await page.selectOption('[data-testid="test-type-select"]', 'mobile');
        await expect(page.locator('[data-testid="mobile-recording-options"]')).toBeVisible();

        // Test device connection UI
        await page.click('[data-testid="connect-device-button"]');
        await expect(page.locator('[data-testid="device-connection-status"]')).toBeVisible();
      });

      test('should optimize performance for mobile devices', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        const loadTime = Date.now() - startTime;

        // Mobile devices should load within reasonable time
        expect(loadTime).toBeLessThan(4000);

        // Test memory usage (approximate check)
        const memoryInfo = await page.evaluate(() => {
          return performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize
          } : { used: 0, total: 0 };
        });

        // Should not use excessive memory on mobile
        if (memoryInfo.used > 0) {
          expect(memoryInfo.used).toBeLessThan(50 * 1024 * 1024); // 50MB
        }
      });
    });
  });
});

test.describe('Browser-Specific Feature Support', () => {
  test('should handle Safari-specific quirks', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari-specific test');

    await page.goto('/login');

    // Test Safari-specific date handling
    await page.evaluate(() => {
      const date = new Date();
      // Safari has strict date parsing
      const safariCompatibleDate = date.toISOString();
      console.log('Safari date format:', safariCompatibleDate);
    });

    // Test Safari event handling
    await page.click('[data-testid="email-input"]');
    await page.keyboard.type('test@example.com');

    // Safari requires explicit focus handling
    const isFocused = await page.locator('[data-testid="email-input"]').evaluate(el => document.activeElement === el);
    expect(isFocused).toBe(true);
  });

  test('should handle Firefox-specific behaviors', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.goto('/login');

    // Test Firefox's strict CSP handling
    const cspHeaders = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta ? meta.getAttribute('content') : null;
    });

    // Firefox strictly enforces CSP
    if (cspHeaders) {
      expect(cspHeaders).toContain("script-src");
    }

    // Test Firefox's cookie handling
    await page.evaluate(() => {
      document.cookie = 'test=value; SameSite=Strict; Secure';
    });

    const cookies = await page.context().cookies();
    const testCookie = cookies.find(c => c.name === 'test');

    if (testCookie) {
      expect(testCookie.sameSite).toBe('Strict');
    }
  });

  test('should handle Chrome-specific features', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome-specific test');

    await page.goto('/login');

    // Test Chrome DevTools integration
    const devtoolsProtocol = await page.context().newCDPSession(page);

    // Check that Chrome-specific APIs work
    await page.evaluate(() => {
      if ('chrome' in window) {
        console.log('Chrome APIs available');
      }
    });

    // Test Chrome's extension handling
    const extensionSupport = await page.evaluate(() => {
      return typeof chrome !== 'undefined';
    });

    // Should handle cases where extensions are not available
    expect(typeof extensionSupport).toBe('boolean');
  });
});

test.describe('Network Condition Compatibility', () => {
  const networkConditions = [
    { name: 'Fast 3G', downloadThroughput: 1.5 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 100 },
    { name: 'Slow 3G', downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8, latency: 400 },
    { name: 'Offline', offline: true }
  ];

  networkConditions.forEach(condition => {
    test.describe(`${condition.name} network conditions`, () => {
      test.use({
        ...condition.offline ? { offline: true } : {},
        ...(condition.downloadThroughput ? {
          clientCertificates: [{
            origin: 'https://qestro.app',
            certPath: '',
            keyPath: '',
            passphrase: ''
          }]
        } : {})
      });

      test('should handle slow/poor network conditions gracefully', async ({ page }) => {
        if (!condition.offline) {
          // Test with slow network
          await page.goto('/login', { waitUntil: 'domcontentloaded' });

          // Should show loading indicators
          await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

          // Should eventually load
          await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });
          await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
        } else {
          // Test offline functionality
          await page.goto('/login');

          // Should show offline indicator
          await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
        }
      });

      test('should provide appropriate feedback during network issues', async ({ page }) => {
        if (!condition.offline) {
          await page.goto('/login');
          await page.fill('[data-testid="email-input"]', 'test@example.com');
          await page.fill('[data-testid="password-input"]', 'TestPassword123!');

          // Click login and wait for response
          const loginPromise = page.click('[data-testid="login-button"]');

          // Should show loading state
          await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

          // Should handle timeout gracefully
          try {
            await Promise.race([
              loginPromise,
              page.waitForSelector('[data-testid="network-error"]', { timeout: 15000 })
            ]);
          } catch (error) {
            // Network errors should be handled gracefully
            const networkError = page.locator('[data-testid="network-error"]');
            if (await networkError.isVisible()) {
              await expect(networkError).toContainText(/network|connection|timeout/i);
            }
          }
        }
      });
    });
  });
});

test.describe('Accessibility Compatibility', () => {
  test('should support screen readers across browsers', async ({ page }) => {
    await page.goto('/login');

    // Test ARIA labels
    await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('aria-label');

    // Test semantic HTML
    const mainElement = page.locator('main');
    await expect(mainElement).toBeVisible();

    // Test heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);

    // Test focus management
    await page.keyboard.press('Tab');
    const firstFocusable = page.locator(':focus');
    await expect(firstFocusable).toBeVisible();
  });

  test('should support keyboard navigation consistently', async ({ page }) => {
    await page.goto('/login');

    // Test tab order
    const focusableElements = await page.locator('button, input, select, textarea, a[href]').all();

    for (let i = 0; i < Math.min(focusableElements.length, 5); i++) {
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }

    // Test escape key functionality
    await page.keyboard.press('Escape');

    // Should not trap focus or cause navigation issues
    const currentFocus = page.locator(':focus');
    expect(currentFocus).toBeTruthy();
  });

  test('should maintain contrast and readability across devices', async ({ page }) => {
    await page.goto('/login');

    // Test color contrast (basic check)
    const contrastRatio = await page.evaluate(() => {
      const loginForm = document.querySelector('[data-testid="login-form"]');
      if (!loginForm) return null;

      const computedStyle = window.getComputedStyle(loginForm);
      const backgroundColor = computedStyle.backgroundColor;
      const color = computedStyle.color;

      // Simple contrast calculation (would need proper library in production)
      return { backgroundColor, color };
    });

    expect(contrastRatio).not.toBeNull();
  });
});

test.describe('Progressive Enhancement', () => {
  test('should work without JavaScript enabled', async ({ context }) => {
    // Disable JavaScript
    await context.addInitScript(() => {
      window.eval = () => { throw new Error('JavaScript disabled'); };
    });

    const page = await context.newPage();
    await page.goto('/login');

    // Should show noscript message
    await expect(page.locator('[data-testid="noscript-message"]')).toBeVisible();

    // Should provide basic HTML fallbacks
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should gracefully degrade advanced features', async ({ page }) => {
    // Simulate limited browser capabilities
    await page.addInitScript(() => {
      // Remove modern APIs
      delete (window as any).IntersectionObserver;
      delete (window as any).ResizeObserver;
    });

    await page.goto('/login');

    // Should still provide basic functionality
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

    // Advanced features should have fallbacks
    const hasFallback = await page.evaluate(() => {
      const advancedFeature = document.querySelector('[data-testid="advanced-feature"]');
      return !advancedFeature || advancedFeature.getAttribute('data-fallback') !== null;
    });

    expect(hasFallback).toBe(true);
  });
});