# 🌐 Questro Web Testing Complete Guide

## How Web Recording Works in Questro

Questro provides multiple powerful methods to record browser interactions and generate automated tests. Unlike generic "workflow-use" tools, Questro offers enterprise-grade recording with AI-powered optimizations.

---

## 🎯 Recording Methods Overview

### 1. **Browser Extension** (Easiest)
- One-click recording in any website
- Real-time action capture
- Multiple export formats
- Works offline

### 2. **Cloud Browser** (Most Powerful)
- Record through Questro dashboard
- Real-time preview and collaboration
- Cloud-based execution
- Team sharing

### 3. **Local Agent** (Enterprise)
- Corporate network friendly
- Local browser control
- Enterprise security
- Hybrid cloud-local setup

---

## 🚀 Getting Started with Web Recording

### Method 1: Browser Extension

**Step 1: Install Extension**
```bash
# Load the extension in Chrome:
1. Open Chrome → Extensions → Developer mode
2. Click "Load unpacked"
3. Select: questro-saas/browser-extension/
4. Pin the Questro extension
```

**Step 2: Start Recording**
1. **Navigate to your website**
2. **Click Questro extension icon**
3. **Click "Start Recording"**
4. **Interact with your website normally**
   - Click buttons, links, menus
   - Fill forms and inputs
   - Navigate between pages
   - Scroll and interact with content

**Step 3: Stop and Export**
1. **Click "Stop Recording"**
2. **Review captured actions** (e.g., "25 actions recorded")
3. **Choose export format:**
   - **Puppeteer** - Node.js browser automation
   - **Playwright** - Cross-browser testing
   - **Cypress** - Modern testing framework
   - **Selenium** - Industry standard
   - **YAML** - Questro custom format
   - **Workflow** - Human-readable format

**Example: Recording a Login Flow**
```javascript
// What you do:
1. Go to https://app.example.com
2. Click "Login" button
3. Type email: "user@example.com"
4. Type password: "password123"
5. Click "Sign In"
6. Wait for dashboard to load

// What Questro records:
- navigation: app.example.com
- click: [data-testid="login-button"]
- type: [name="email"] → "user@example.com"
- type: [name="password"] → "password123"
- click: [type="submit"]
- assert: [data-testid="dashboard"] visible
```

### Method 2: Cloud Browser Recording

**Step 1: Open Questro Dashboard**
```
https://app.questro.io/recording/new
```

**Step 2: Configure Recording**
```yaml
Recording Type: Web
Target URL: https://yoursite.com
Viewport: 1920x1080 (Desktop) or 375x667 (Mobile)
Browser: Chrome, Firefox, Safari
```

**Step 3: Start Cloud Recording**
1. **Click "Start Cloud Recording"**
2. **Cloud browser opens in iframe**
3. **Interact with website in cloud browser**
4. **Actions recorded automatically**
5. **Real-time preview shows captured actions**

**Step 4: Review and Export**
1. **Stop recording**
2. **Review action timeline**
3. **Edit/optimize actions if needed**
4. **Export to your preferred format**
5. **Add to test suite**

---

## 🔧 Advanced Features

### Smart Element Detection
Questro prioritizes reliable selectors:

```javascript
// Priority 1: Test IDs (most reliable)
[data-testid="submit-button"]
[data-test="login-form"]
[data-cy="checkout-btn"]

// Priority 2: Semantic attributes
[aria-label="Close dialog"]
[name="email"]
#unique-id

// Priority 3: Text content
button:contains("Sign Up")
a:contains("Learn More")

// Priority 4: CSS path (fallback)
.header > .nav > .login-btn:nth-child(2)
```

### AI-Powered Optimizations

**Automatic Wait Insertion**
```yaml
steps:
  - click:
      selector: "[data-testid='submit-btn']"
  - wait: 2000  # Auto-added after form submission
  - assert:
      selector: ".success-message"
      visible: true  # Auto-added assertion
```

**Action Deduplication**
```javascript
// Raw recording (rapid clicks):
click: button → 10:23:01.123
click: button → 10:23:01.234  # Removed (duplicate)
click: button → 10:23:01.345  # Removed (duplicate)

// Optimized recording:
click: button → 10:23:01.123  # Single action kept
```

**Smart Assertions**
```yaml
# After navigation
- navigate: https://app.example.com/dashboard
- assert:  # Auto-added
    selector: "body"
    visible: true

# After form submission  
- click: "[type='submit']"
- assert:  # Auto-added
    url_contains: "success"
```

---

## 📊 Export Formats Explained

### 1. Puppeteer (Node.js)
```javascript
// Generated Puppeteer script
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to initial URL
  await page.goto('https://app.example.com');
  
  // Click login button
  await page.waitForSelector('[data-testid="login-btn"]');
  await page.click('[data-testid="login-btn"]');
  
  // Fill email field
  await page.type('[name="email"]', 'user@example.com');
  
  // Submit form
  await page.click('[type="submit"]');
  
  await browser.close();
})();
```

### 2. Playwright (Cross-browser)
```javascript
// Generated Playwright script
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://app.example.com');
  await page.click('[data-testid="login-btn"]');
  await page.fill('[name="email"]', 'user@example.com');
  await page.click('[type="submit"]');
  
  await browser.close();
})();
```

### 3. Cypress (Modern Testing)
```javascript
// Generated Cypress test
describe('Login Flow', () => {
  it('should log in successfully', () => {
    cy.visit('https://app.example.com');
    cy.get('[data-testid="login-btn"]').click();
    cy.get('[name="email"]').type('user@example.com');
    cy.get('[type="submit"]').click();
    cy.get('[data-testid="dashboard"]').should('be.visible');
  });
});
```

### 4. YAML (Questro Format)
```yaml
# Generated YAML workflow
name: "Login Flow Test"
url: "https://app.example.com"
viewport:
  width: 1920
  height: 1080
steps:
  - click:
      selector: "[data-testid='login-btn']"
      text: "Login"
      
  - type:
      selector: "[name='email']"
      text: "user@example.com"
      
  - click:
      selector: "[type='submit']"
      
  - assert:
      selector: "[data-testid='dashboard']"
      visible: true
```

---

## 🎬 Real-World Examples

### E-commerce Checkout Flow
```yaml
name: "Complete Purchase Flow"
url: "https://shop.example.com"
steps:
  # Browse products
  - navigate:
      url: "https://shop.example.com/products"
      
  - click:
      selector: "[data-product-id='123']"
      text: "Add to Cart"
      
  # View cart
  - click:
      selector: ".cart-icon"
      
  - assert:
      selector: ".cart-items"
      visible: true
      
  # Checkout process
  - click:
      selector: "[data-testid='checkout-btn']"
      
  - type:
      selector: "[name='email']"
      text: "customer@example.com"
      
  - type:
      selector: "[name='address']"
      text: "123 Main St"
      
  - click:
      selector: "[name='payment-method'][value='credit']"
      
  - type:
      selector: "[name='card-number']"
      text: "4111111111111111"
      
  - click:
      selector: "[data-testid='place-order']"
      
  # Verify success
  - assert:
      selector: ".order-confirmation"
      text_contains: "Order confirmed"
      
  - screenshot: "order-complete"
```

### SaaS Dashboard Navigation
```yaml
name: "Dashboard Navigation Test"
url: "https://app.saas-example.com"
steps:
  # Login
  - type:
      selector: "[name='email']"
      text: "user@company.com"
      
  - type:
      selector: "[name='password']"
      text: "secure-password"
      
  - click:
      selector: "[type='submit']"
      
  # Navigate dashboard
  - click:
      selector: "[data-nav='analytics']"
      text: "Analytics"
      
  - wait: 2000  # Allow charts to load
  
  - assert:
      selector: ".chart-container"
      visible: true
      
  # Create new project
  - click:
      selector: "[data-testid='new-project-btn']"
      
  - type:
      selector: "[name='project-name']"
      text: "Test Project"
      
  - click:
      selector: "[data-testid='create-project']"
      
  - assert:
      selector: ".project-created-toast"
      text_contains: "Project created successfully"
```

---

## 🔄 Integration with CI/CD

### GitHub Actions
```yaml
# .github/workflows/web-tests.yml
name: Web Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Run Questro web tests
        run: |
          # Run exported Puppeteer tests
          node tests/login-flow.js
          node tests/checkout-flow.js
          
      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: screenshots
          path: screenshots/
```

---

## 🚀 Best Practices

### 1. **Use Stable Selectors**
```html
<!-- Good: Stable test IDs -->
<button data-testid="submit-button">Submit</button>
<input data-testid="email-input" name="email">

<!-- Avoid: Fragile CSS classes -->
<button class="btn btn-primary btn-lg mt-3">Submit</button>
```

### 2. **Add Meaningful Waits**
```yaml
# Good: Wait for specific conditions
- click: "[data-testid='load-data']"
- wait_for:
    selector: ".data-loaded"
    timeout: 10000

# Avoid: Fixed waits
- click: "[data-testid='load-data']"  
- wait: 5000  # May be too short or too long
```

### 3. **Include Assertions**
```yaml
# Good: Verify expected outcomes
- click: "[data-testid='delete-item']"
- assert:
    selector: ".success-message"
    text: "Item deleted successfully"

# Avoid: Actions without verification
- click: "[data-testid='delete-item']"
# No verification that action succeeded
```

### 4. **Organize into Reusable Components**
```yaml
# Login component (reusable)
login_steps: &login
  - type:
      selector: "[name='email']"
      text: "{{email}}"
  - type:
      selector: "[name='password']"  
      text: "{{password}}"
  - click:
      selector: "[type='submit']"

# Use in multiple tests
test_checkout:
  - <<: *login
  - navigate: "/checkout"
  # ... checkout steps

test_profile:
  - <<: *login
  - navigate: "/profile"
  # ... profile steps
```

---

## 🔧 Advanced Configuration

### Custom Recording Options
```javascript
// Configure recording in dashboard
const recordingConfig = {
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Custom-Bot/1.0',
  locale: 'en-US',
  timezone: 'America/New_York',
  geolocation: { latitude: 40.7128, longitude: -74.0060 },
  permissions: ['notifications', 'camera'],
  recordingOptions: {
    captureConsole: true,
    captureNetwork: true,
    captureScreenshots: true,
    optimizeActions: true,
    smartWaits: true,
    autoAssertions: true
  }
};
```

### Team Collaboration
```yaml
# Share recordings with team
recording:
  id: "rec_12345"
  name: "User Onboarding Flow"
  shared_with:
    - team: "qa-engineers"
    - user: "john@company.com"
  permissions:
    - view
    - edit
    - export
    - delete
```

---

## 📞 Support and Help

### Troubleshooting Common Issues

**Issue: Extension not recording**
```bash
# Solution:
1. Refresh the page
2. Check if extension has permissions
3. Try in incognito mode
4. Check browser console for errors
```

**Issue: Selectors breaking**
```yaml
# Solution: Use multiple fallback selectors
click:
  selector: "[data-testid='submit']"
  fallbacks:
    - "[name='submit']"
    - "button:contains('Submit')"
    - ".submit-button"
```

**Issue: Flaky tests**
```yaml
# Solution: Add better waits and assertions
- click: "[data-testid='save']"
- wait_for:
    selector: ".saving-indicator"
    hidden: true  # Wait for save to complete
- assert:
    selector: ".success-message"
    visible: true
```

### Getting Help
- 📖 **Documentation**: https://docs.questro.io/web-testing
- 💬 **Discord**: https://discord.gg/questro  
- 📧 **Support**: support@questro.io
- 🐛 **Issues**: https://github.com/questro/issues

---

## 🎉 You're Ready!

Questro's web recording system provides everything you need for modern web testing:

✅ **Multiple recording methods** (Extension, Cloud, Agent)  
✅ **AI-powered optimizations** (Smart waits, assertions, deduplication)  
✅ **Universal export formats** (Puppeteer, Playwright, Cypress, Selenium)  
✅ **Enterprise features** (Team collaboration, CI/CD integration)  
✅ **Stable selectors** (Test IDs, semantic attributes, fallbacks)  

**Start recording your first web test:** Install the browser extension or visit https://app.questro.io/recording/new

**🚀 Happy Testing with Questro!**