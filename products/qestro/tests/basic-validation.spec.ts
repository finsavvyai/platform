import { test, expect } from '@playwright/test';

test.describe('Questro Testing Infrastructure Validation', () => {
  test('should validate Playwright setup is working', async ({ page }) => {
    // Test with a reliable external site
    await page.goto('https://httpbin.org/json');
    
    // Should load JSON content
    const content = await page.textContent('body');
    expect(content).toContain('slideshow');
    
    console.log('✅ Playwright infrastructure working correctly');
  });

  test('should demonstrate API mocking capabilities', async ({ page }) => {
    // Mock API response
    await page.route('**/api/test', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Mock API working',
          timestamp: new Date().toISOString()
        })
      });
    });

    // Test page with API call
    await page.setContent(`
      <html>
        <body>
          <button id="test-btn">Test API</button>
          <div id="result"></div>
          <script>
            document.getElementById('test-btn').onclick = async () => {
              try {
                const response = await fetch('/api/test');
                const data = await response.json();
                document.getElementById('result').innerText = data.message;
              } catch (err) {
                document.getElementById('result').innerText = 'Error: ' + err.message;
              }
            };
          </script>
        </body>
      </html>
    `);

    await page.click('#test-btn');
    await expect(page.locator('#result')).toHaveText('Mock API working');
    
    console.log('✅ API mocking capabilities working correctly');
  });

  test('should validate performance measurement', async ({ page }) => {
    const startTime = Date.now();
    
    // Test with artificial delay
    await page.goto('https://httpbin.org/delay/1');
    
    const loadTime = Date.now() - startTime;
    
    // Should take at least 1 second due to delay
    expect(loadTime).toBeGreaterThan(1000);
    expect(loadTime).toBeLessThan(5000);
    
    console.log(`✅ Performance measurement working - Load time: ${loadTime}ms`);
  });

  test('should validate multi-browser capability', async ({ browserName, page }) => {
    await page.setContent(`
      <html>
        <body>
          <h1>Browser Test</h1>
          <p id="browser">${browserName}</p>
          <div id="features">
            <span id="js">JavaScript: <span id="js-status">Disabled</span></span>
          </div>
          <script>
            document.getElementById('js-status').innerText = 'Enabled';
          </script>
        </body>
      </html>
    `);

    await expect(page.locator('h1')).toHaveText('Browser Test');
    await expect(page.locator('#js-status')).toHaveText('Enabled');
    
    console.log(`✅ Browser ${browserName} working correctly with JavaScript enabled`);
  });

  test('should validate mobile simulation', async ({ page }) => {
    // Simulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.setContent(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            @media (max-width: 480px) {
              .mobile-only { display: block; }
              .desktop-only { display: none; }
            }
            @media (min-width: 481px) {
              .mobile-only { display: none; }
              .desktop-only { display: block; }
            }
          </style>
        </head>
        <body>
          <div class="mobile-only">Mobile View</div>
          <div class="desktop-only">Desktop View</div>
        </body>
      </html>
    `);

    await expect(page.locator('.mobile-only')).toBeVisible();
    await expect(page.locator('.desktop-only')).toBeHidden();
    
    console.log('✅ Mobile viewport simulation working correctly');
  });

  test('should validate form interaction capabilities', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <form id="test-form">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Submit</button>
          </form>
          <div id="validation-message"></div>
          <script>
            document.getElementById('test-form').onsubmit = (e) => {
              e.preventDefault();
              const email = document.getElementById('email').value;
              const password = document.getElementById('password').value;
              
              if (!email || !password) {
                document.getElementById('validation-message').innerText = 'All fields required';
                return;
              }
              
              if (!email.includes('@')) {
                document.getElementById('validation-message').innerText = 'Invalid email';
                return;
              }
              
              document.getElementById('validation-message').innerText = 'Form submitted successfully';
            };
          </script>
        </body>
      </html>
    `);

    // Test empty form submission
    await page.click('button[type="submit"]');
    await expect(page.locator('#validation-message')).toHaveText('All fields required');

    // Test invalid email
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('#validation-message')).toHaveText('Invalid email');

    // Test valid submission
    await page.fill('#email', 'test@example.com');
    await page.click('button[type="submit"]');
    await expect(page.locator('#validation-message')).toHaveText('Form submitted successfully');
    
    console.log('✅ Form interaction capabilities working correctly');
  });
});