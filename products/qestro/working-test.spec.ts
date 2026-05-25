import { test, expect } from '@playwright/test';

test.describe('Questro Testing Infrastructure Validation', () => {
  test('should demonstrate Playwright is working properly', async ({ page }) => {
    // Test external site to verify Playwright setup
    await page.goto('https://httpbin.org/json');
    
    // Verify JSON response is displayed
    const content = await page.textContent('body');
    expect(content).toContain('slideshow');
    
    console.log('✅ Playwright test infrastructure is working correctly');
  });

  test('should validate test configuration and browser capabilities', async ({ page, browserName }) => {
    // Test browser capabilities
    await page.goto('data:text/html,<html><body><h1>Test Page</h1><p>Browser: ' + browserName + '</p></body></html>');
    
    await expect(page.locator('h1')).toHaveText('Test Page');
    await expect(page.locator('p')).toContainText('Browser:');
    
    console.log(`✅ Browser ${browserName} is working correctly`);
  });

  test('should demonstrate mock API capabilities', async ({ page }) => {
    // Mock an API endpoint
    await page.route('**/api/test', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Mock API response working',
          timestamp: new Date().toISOString()
        })
      });
    });

    // Test the mock
    await page.goto('data:text/html,<html><body><button onclick="fetch(\'/api/test\').then(r=>r.json()).then(d=>document.getElementById(\'result\').innerText=d.message)">Test API</button><div id="result"></div></body></html>');
    
    await page.click('button');
    await expect(page.locator('#result')).toHaveText('Mock API response working');
    
    console.log('✅ API mocking capabilities are working correctly');
  });

  test('should validate performance measurement capabilities', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('https://httpbin.org/delay/1');
    
    const loadTime = Date.now() - startTime;
    
    // Should take at least 1 second due to delay
    expect(loadTime).toBeGreaterThan(1000);
    expect(loadTime).toBeLessThan(5000); // But not too long
    
    console.log(`✅ Performance measurement working - Load time: ${loadTime}ms`);
  });
});