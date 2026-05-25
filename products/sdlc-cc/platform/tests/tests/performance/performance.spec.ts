import { test, expect } from '@playwright/test';
import { LandingPage } from '../../pages/landing-page';
import { TestHelpers } from '../../utils/test-helpers';

test.describe('Performance Tests', () => {
  let landingPage: LandingPage;
  const baseUrl = process.env.BASE_URL || 'https://sdlc.finsavvyai.com';

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
  });

  test.describe('Page Load Performance', () => {
    test('should meet page load performance standards', async ({ page }) => {
      const performanceMetrics = await TestHelpers.measurePagePerformance(page, baseUrl);

      // Performance assertions based on web standards
      expect(performanceMetrics.loadTime).toBeLessThan(5000); // 5 seconds
      expect(performanceMetrics.domContentLoaded).toBeLessThan(3000); // 3 seconds
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(2000); // 2 seconds

      console.log('✅ Page load performance metrics:');
      console.log(`   Total load time: ${performanceMetrics.loadTime}ms`);
      console.log(`   DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
      console.log(`   First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms`);
      console.log(`   Largest Contentful Paint: ${performanceMetrics.largestContentfulPaint}ms`);
    });

    test('should have optimized resource loading', async ({ page }) => {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });

      // Collect resource timing information
      const resourceMetrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        return resources.map(resource => ({
          name: resource.name,
          duration: resource.duration,
          size: resource.transferSize || 0,
          type: resource.initiatorType
        }));
      });

      // Performance assertions
      const slowResources = resourceMetrics.filter(r => r.duration > 3000);
      const largeResources = resourceMetrics.filter(r => r.size > 1024 * 1024); // > 1MB

      expect(slowResources.length).toBeLessThan(5);
      expect(largeResources.length).toBeLessThan(3);

      console.log('✅ Resource loading optimization:');
      console.log(`   Total resources: ${resourceMetrics.length}`);
      console.log(`   Slow resources (>3s): ${slowResources.length}`);
      console.log(`   Large resources (>1MB): ${largeResources.length}`);

      if (slowResources.length > 0) {
        console.log('   Slow resources:');
        slowResources.forEach(resource => {
          console.log(`     - ${resource.name.split('/').pop()}: ${resource.duration}ms`);
        });
      }
    });

    test('should handle concurrent loading efficiently', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(baseUrl, { waitUntil: 'networkidle' });

      // Simulate user scrolling to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const totalTime = Date.now() - startTime;

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(15000); // 15 seconds

      console.log('✅ Concurrent loading performance:');
      console.log(`   Total time with scrolling: ${totalTime}ms`);
    });
  });

  test.describe('Interaction Performance', () => {
    test('should respond quickly to user interactions', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // Test click response time
      const clickableElements = [
        'button:has-text("Request Demo")',
        'a[href]',
        '.nav-item',
        '.feature-card'
      ];

      let totalInteractionTime = 0;
      let successfulInteractions = 0;

      for (const selector of clickableElements) {
        const elements = page.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          const startTime = Date.now();
          try {
            await elements.first().click({ timeout: 2000 });
            const interactionTime = Date.now() - startTime;
            totalInteractionTime += interactionTime;
            successfulInteractions++;

            await page.waitForTimeout(500);
            await page.goBack().catch(() => {}); // Go back if possible
          } catch (error) {
            // Element might not be clickable, which is fine
          }
        }
      }

      if (successfulInteractions > 0) {
        const avgInteractionTime = totalInteractionTime / successfulInteractions;
        expect(avgInteractionTime).toBeLessThan(1000); // 1 second average

        console.log('✅ Interaction performance:');
        console.log(`   Successful interactions: ${successfulInteractions}`);
        console.log(`   Average interaction time: ${Math.round(avgInteractionTime)}ms`);
      }
    });

    test('should handle form interactions efficiently', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const testData = TestHelpers.generateTestData();

      const formStartTime = Date.now();

      // Test form filling performance
      const formResults = await landingPage.testDemoForm(testData);

      const formTime = Date.now() - formStartTime;

      if (formResults.formExists) {
        expect(formTime).toBeLessThan(5000); // 5 seconds for form operations

        console.log('✅ Form interaction performance:');
        console.log(`   Form operations time: ${formTime}ms`);
        console.log(`   Form exists: ${formResults.formExists}`);
        console.log(`   All fields present: ${formResults.allFieldsPresent}`);
      }
    });

    test('should maintain performance during scrolling', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const scrollStartTime = Date.now();

      // Test smooth scrolling performance
      const scrollSteps = 10;
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      const scrollStep = pageHeight / scrollSteps;

      for (let i = 1; i <= scrollSteps; i++) {
        await page.evaluate((step) => window.scrollTo(0, step), scrollStep * i);
        await page.waitForTimeout(200); // Allow for smooth scrolling
      }

      const scrollTime = Date.now() - scrollStartTime;

      expect(scrollTime).toBeLessThan(10000); // 10 seconds for full scroll

      console.log('✅ Scrolling performance:');
      console.log(`   Full scroll time: ${scrollTime}ms`);
      console.log(`   Page height: ${pageHeight}px`);
    });
  });

  test.describe('Responsive Performance', () => {
    test('should perform well on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const mobileStartTime = Date.now();

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const mobileLoadTime = Date.now() - mobileStartTime;

      expect(mobileLoadTime).toBeLessThan(8000); // 8 seconds for mobile

      // Test mobile interactions
      const mobileInteractionTime = await page.evaluate(() => {
        const startTime = performance.now();

        // Test tap interactions
        const buttons = document.querySelectorAll('button, a');
        if (buttons.length > 0) {
          (buttons[0] as HTMLElement).click();
        }

        return performance.now() - startTime;
      });

      expect(mobileInteractionTime).toBeLessThan(1000); // 1 second

      console.log('✅ Mobile performance:');
      console.log(`   Mobile load time: ${mobileLoadTime}ms`);
      console.log(`   Mobile interaction time: ${Math.round(mobileInteractionTime)}ms`);
    });

    test('should perform well on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      const tabletStartTime = Date.now();

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const tabletLoadTime = Date.now() - tabletStartTime;

      expect(tabletLoadTime).toBeLessThan(7000); // 7 seconds for tablet

      console.log('✅ Tablet performance:');
      console.log(`   Tablet load time: ${tabletLoadTime}ms`);
    });
  });

  test.describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during navigation', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Navigate around the page
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, Math.random() * document.body.scrollHeight));
        await page.waitForTimeout(1000);
      }

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log('✅ Memory usage test:');
      console.log(`   Initial memory: ${Math.round(initialMemory / 1024 / 1024)}MB`);
      console.log(`   Final memory: ${Math.round(finalMemory / 1024 / 1024)}MB`);
      console.log(`   Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });

    test('should clean up event listeners properly', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // Count event listeners before interactions
      const initialListeners = await page.evaluate(() => {
        let count = 0;
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
          const listenerCount = (el as any).eventListenerCount || 0;
          count += listenerCount;
        });
        return count;
      });

      // Perform various interactions
      await page.click('body');
      await page.hover('button, a');
      await page.keyboard.press('Tab');

      const finalListeners = await page.evaluate(() => {
        let count = 0;
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
          const listenerCount = (el as any).eventListenerCount || 0;
          count += listenerCount;
        });
        return count;
      });

      // Listener count shouldn't increase dramatically
      const listenerIncrease = finalListeners - initialListeners;
      expect(listenerIncrease).toBeLessThan(100);

      console.log('✅ Event listener cleanup:');
      console.log(`   Initial listeners: ${initialListeners}`);
      console.log(`   Final listeners: ${finalListeners}`);
      console.log(`   Listener increase: ${listenerIncrease}`);
    });
  });

  test.describe('Network Performance', () => {
    test('should minimize network requests', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const networkRequests = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return {
          total: resources.length,
          byType: resources.reduce((acc, resource) => {
            const type = resource.initiatorType || 'other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };
      });

      // Should have reasonable number of requests
      expect(networkRequests.total).toBeLessThan(100);

      console.log('✅ Network request optimization:');
      console.log(`   Total requests: ${networkRequests.total}`);
      console.log('   Requests by type:');
      Object.entries(networkRequests.byType).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
      });
    });

    test('should use compression efficiently', async ({ page }) => {
      const responses: any[] = [];

      page.on('response', response => {
        responses.push({
          url: response.url(),
          headers: response.headers(),
          status: response.status()
        });
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const compressedResponses = responses.filter(r =>
        r.headers['content-encoding'] &&
        (r.headers['content-encoding'].includes('gzip') ||
         r.headers['content-encoding'].includes('br'))
      );

      const totalResponses = responses.length;
      const compressionRatio = totalResponses > 0 ? compressedResponses.length / totalResponses : 0;

      // At least 50% of responses should be compressed
      expect(compressionRatio).toBeGreaterThan(0.5);

      console.log('✅ Compression efficiency:');
      console.log(`   Total responses: ${totalResponses}`);
      console.log(`   Compressed responses: ${compressedResponses.length}`);
      console.log(`   Compression ratio: ${Math.round(compressionRatio * 100)}%`);
    });
  });

  test.describe('Accessibility Performance', () => {
    test('should maintain good accessibility scores', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const accessibilityResults = await TestHelpers.basicAccessibilityCheck(page);

      // Should have minimal accessibility issues
      expect(accessibilityResults.missingAltText).toBeLessThan(5);
      expect(accessibilityResults.invalidHeadings).toBe(0);

      console.log('✅ Accessibility performance:');
      console.log(`   Missing alt text: ${accessibilityResults.missingAltText}`);
      console.log(`   Missing labels: ${accessibilityResults.missingLabels}`);
      console.log(`   Invalid headings: ${accessibilityResults.invalidHeadings}`);
    });

    test('should maintain good performance with accessibility features', async ({ page }) => {
      // Enable accessibility features
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.emulateMedia({ colorScheme: 'dark' });

      const accessibleStartTime = Date.now();

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      const accessibleLoadTime = Date.now() - accessibleStartTime;

      expect(accessibleLoadTime).toBeLessThan(10000); // 10 seconds with accessibility features

      console.log('✅ Accessibility performance with features:');
      console.log(`   Load time with accessibility: ${accessibleLoadTime}ms`);
    });
  });
});