# Questro Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with Questro, covering installation, setup, test execution, and performance problems.

## Table of Contents

1. [Installation and Setup Issues](#installation-and-setup-issues)
2. [Connection and Authentication Problems](#connection-and-authentication-problems)
3. [Test Recording Issues](#test-recording-issues)
4. [Test Execution Problems](#test-execution-problems)
5. [Performance Issues](#performance-issues)
6. [AI and Integration Problems](#ai-and-integration-problems)
7. [Platform-Specific Issues](#platform-specific-issues)
8. [Network and Firewall Issues](#network-and-firewall-issues)
9. [Data and Storage Issues](#data-and-storage-issues)
10. [Advanced Debugging](#advanced-debugging)

## Installation and Setup Issues

### Problem: Questro Agent Won't Install

**Symptoms:**
- App Store/Play Store installation fails
- "Unable to install" error message
- Installation progress gets stuck

**Solutions:**

#### iOS Installation Issues
1. **Check Device Compatibility**:
   - Ensure iOS 13.0 or later
   - Verify device has sufficient storage (at least 500MB free)
   
2. **Update iOS**:
   ```bash
   Settings > General > Software Update
   ```

3. **Restart Device**:
   - Hold power button + volume down (iPhone X and later)
   - Slide to power off, then restart

4. **Check Apple ID**:
   - Verify you're signed in to the App Store
   - Try signing out and back in

#### Android Installation Issues
1. **Check Android Version**:
   - Requires Android 7.0 (API level 24) or later
   - Go to Settings > About phone to check version

2. **Enable Unknown Sources** (if installing APK directly):
   ```bash
   Settings > Security > Unknown sources > Enable
   ```

3. **Clear Google Play Cache**:
   ```bash
   Settings > Apps > Google Play Store > Storage > Clear cache
   ```

4. **Check Storage Space**:
   - Ensure at least 500MB free storage

### Problem: Browser Extension Won't Install

**Symptoms:**
- Chrome Web Store installation fails
- Extension shows as disabled
- "Could not install extension" error

**Solutions:**

1. **Check Browser Version**:
   - Chrome 90+ or Firefox 88+ required
   - Update browser to latest version

2. **Enable Extensions**:
   ```bash
   # Chrome
   chrome://extensions/ > Enable "Developer mode"
   
   # Firefox
   about:addons > Extensions > Enable "Debug mode"
   ```

3. **Clear Extension Cache**:
   ```bash
   # Chrome
   chrome://extensions/ > Details > Extension options > Clear storage
   
   # Firefox
   about:config > extensions.webextensions.uuids > Right-click > Reset
   ```

4. **Disable Conflicting Extensions**:
   - Temporarily disable other testing/automation extensions
   - Try installing Questro extension again

### Problem: Desktop App Won't Start

**Symptoms:**
- Application crashes on launch
- "Cannot connect to server" error
- Blank white screen

**Solutions:**

1. **Check System Requirements**:
   - Windows 10+, macOS 10.14+, or Ubuntu 18.04+
   - Minimum 4GB RAM, 2GB free disk space

2. **Clear Application Cache**:
   ```bash
   # Windows
   %APPDATA%/Questro/Cache
   
   # macOS
   ~/Library/Caches/com.questro.app
   
   # Linux
   ~/.cache/questro
   ```

3. **Reinstall Application**:
   - Uninstall completely
   - Restart computer
   - Reinstall from official website

4. **Check Firewall/Antivirus**:
   - Add Questro to firewall exceptions
   - Temporarily disable antivirus to test

## Connection and Authentication Problems

### Problem: Can't Connect to Questro Cloud

**Symptoms:**
- "Connection failed" error
- Timeout during authentication
- WebSocket connection errors

**Solutions:**

1. **Check Network Connectivity**:
   ```bash
   # Test basic connectivity
   ping api.questro.com
   
   # Test HTTPS connectivity
   curl -I https://api.questro.com/health
   ```

2. **Verify DNS Resolution**:
   ```bash
   nslookup api.questro.com
   dig api.questro.com
   ```

3. **Check Proxy Settings**:
   - Verify proxy configuration allows HTTPS
   - Try bypassing proxy temporarily

4. **Firewall Configuration**:
   ```bash
   # Required ports
   - HTTPS (443)
   - WebSocket (443)
   - WSS (443)
   
   # Allow domains
   - api.questro.com
   - app.questro.com
   - cdn.questro.com
   ```

5. **Time Synchronization**:
   ```bash
   # Windows
   w32tm /resync
   
   # macOS
   sudo sntp -sS time.apple.com
   
   # Linux
   sudo ntpdate -s time.nist.gov
   ```

### Problem: Authentication Failures

**Symptoms:**
- "Invalid credentials" error
- Token expiration issues
- Session timeout problems

**Solutions:**

1. **Verify Credentials**:
   - Check email spelling and case
   - Reset password if necessary
   - Ensure account is active

2. **Clear Browser Data**:
   ```bash
   # Clear cookies and cache
   # In browser settings, clear:
   - Cookies
   - Cached images and files
   - Site data
   ```

3. **Check Token Expiration**:
   ```javascript
   // Decode JWT token to check expiration
   const token = localStorage.getItem('questro_token');
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token expires:', new Date(payload.exp * 1000));
   ```

4. **Refresh Token Issues**:
   - Logout and login again
   - Clear local storage completely
   - Contact support if issue persists

### Problem: Two-Factor Authentication (2FA) Problems

**Symptoms:**
- Can't receive 2FA codes
- "Invalid code" error
- Backup codes not working

**Solutions:**

1. **Check Time Sync**:
   - Ensure device time is synchronized
   - Use authenticator app with time sync

2. **Verify Code Format**:
   - Use 6-digit code without spaces
   - Code expires after 30 seconds

3. **Use Backup Codes**:
   - Each backup code works only once
   - Store backup codes securely

4. **Reset 2FA**:
   - Contact support for 2FA reset
   - Provide identity verification

## Test Recording Issues

### Problem: Recording Won't Start

**Symptoms:**
- "Start recording" button disabled
- Error when initiating recording
- Agent not connecting

**Solutions:**

1. **Check Device/App Status**:
   ```bash
   # Mobile
   - Ensure Questro Agent is running
   - Verify app is installed on device
   - Check device is unlocked
   
   # Web
   - Verify browser extension is enabled
   - Check target URL is accessible
   - Ensure no pop-up blockers active
   ```

2. **Verify Permissions**:
   ```bash
   # iOS
   Settings > Privacy > Screen Recording > Enable Questro
   
   # Android
   Settings > Apps > Questro > Permissions > Enable all
   
   # Browser Extension
   - Site permissions: allow screen recording
   - Extension permissions: full access
   ```

3. **Restart Recording Session**:
   - Stop current session if active
   - Close and reopen Questro Agent
   - Start new recording session

4. **Check Application Compatibility**:
   - Verify target app is supported
   - Check app version compatibility
   - Try with a different app for testing

### Problem: Actions Not Being Recorded

**Symptoms:**
- Taps/clicks not captured
- Text input not recorded
- Scroll actions missing

**Solutions:**

1. **Verify Element Recognition**:
   - Check if elements have proper accessibility labels
   - Verify elements are not obscured
   - Test with different UI elements

2. **Adjust Recording Settings**:
   ```bash
   Recording Settings:
   - Sensitivity: Medium to High
   - Capture delay: 100-300ms
   - Element detection: Smart mode
   ```

3. **Check Device Responsiveness**:
   - Ensure device is responsive to touch
   - Test with system apps to verify recording works
   - Restart device if needed

4. **Manual Action Entry**:
   - Use manual action entry as workaround
   - Record steps manually after test flow
   - Add custom actions for complex interactions

### Problem: Recording Session Interrupted

**Symptoms:**
- Recording stops unexpectedly
- Connection drops during recording
- Agent crashes

**Solutions:**

1. **Check Network Stability**:
   - Ensure stable Wi-Fi or cellular connection
   - Monitor network signal strength
   - Try different network if available

2. **Device Resource Management**:
   ```bash
   # Check available memory
   # iOS: Settings > General > iPhone Storage
   # Android: Settings > Storage
   
   # Close background apps
   # Restart device before recording
   ```

3. **Application Conflicts**:
   - Close other automation tools
   - Disable screen recording apps
   - Turn on battery saver mode

4. **Auto-Save Configuration**:
   - Enable auto-save during recording
   - Set shorter recording intervals
   - Save frequently during long recordings

## Test Execution Problems

### Problem: Tests Fail to Start

**Symptoms:**
- "Test execution failed to start" error
- Tests stuck in "queued" status
- Device connection errors

**Solutions:**

1. **Verify Device/Environment Setup**:
   ```bash
   # Mobile
   - Device connected and recognized
   - App installed and accessible
   - Device not locked or in Do Not Disturb mode
   
   # Web
   - Browser driver up to date
   - Target URL accessible
   - No conflicting extensions
   ```

2. **Check Test Configuration**:
   - Verify project settings are correct
   - Check test data availability
   - Ensure proper environment selection

3. **Validate Test Syntax**:
   ```bash
   # Use Questro CLI to validate
   questro validate --test-file="test.json"
   
   # Check for syntax errors
   # Verify element selectors are valid
   # Ensure proper test structure
   ```

4. **Resource Availability**:
   - Check device pool availability
   - Verify sufficient test credits/quota
   - Ensure network bandwidth is adequate

### Problem: Tests Fail Mid-Execution

**Symptoms:**
- Tests stop at random points
- Element not found errors
- Timeout failures

**Solutions:**

1. **Improve Element Selectors**:
   ```javascript
   // Use stable selectors
   // Good: ID, accessibility label, semantic class
   element = driver.findElement(By.id('submit-button'));
   
   // Avoid: XPath, dynamic classes, absolute positions
   element = driver.findElement(By.xpath('//div[3]/button[2]'));
   ```

2. **Add Explicit Waits**:
   ```javascript
   // Wait for element to be clickable
   await driver.wait(until.elementLocated(By.id('submit')), 10000);
   await driver.wait(until.elementIsEnabled(submitButton), 5000);
   
   // Wait for page to load
   await driver.wait(until.titleContains('Dashboard'), 15000);
   ```

3. **Handle Dynamic Content**:
   - Use flexible matching patterns
   - Implement retry logic for flaky elements
   - Add loading state checks

4. **Increase Timeouts**:
   ```javascript
   // Global timeout settings
   driver.manage().setTimeouts({
     implicit: 10000,    // Element search timeout
     pageLoad: 30000,    // Page load timeout
     script: 30000       // Script execution timeout
   });
   ```

### Problem: Tests Pass but Don't Verify Correctly

**Symptoms:**
- Tests show as passed but don't catch actual bugs
- Assertions not working as expected
- False positive results

**Solutions:**

1. **Add Meaningful Assertions**:
   ```javascript
   // Verify business outcomes, not just UI presence
   await expect(page.locator('.success-message')).toContainText('Order placed successfully');
   await expect(page.locator('.order-confirmation')).toBeVisible();
   
   // Check database state if possible
   const order = await database.getOrder(orderId);
   expect(order.status).toBe('confirmed');
   ```

2. **Improve Test Coverage**:
   - Test negative scenarios
   - Include edge cases and boundary conditions
   - Verify error handling and validation

3. **Add Visual Assertions**:
   ```javascript
   // Visual regression testing
   await expect(page).toHaveScreenshot('checkout-page.png');
   
   // Element visibility checks
   await expect(page.locator('.price-total')).toBeVisible();
   ```

4. **Review Test Logic**:
   - Ensure tests actually verify the expected behavior
   - Check that assertions cover critical functionality
   - Validate test data and expected results

## Performance Issues

### Problem: Slow Test Execution

**Symptoms:**
- Tests taking much longer than expected
- High CPU/memory usage during tests
- Execution timeout errors

**Solutions:**

1. **Optimize Test Structure**:
   ```javascript
   // Parallel test execution
   describe('User Registration', () => {
     // Tests can run in parallel if independent
     test('with valid email', async () => { /* ... */ });
     test('with invalid email', async () => { /* ... */ });
   });
   
   // Shared setup/teardown
   beforeAll(async () => {
     // One-time setup for all tests
   });
   
   afterAll(async () => {
     // One-time cleanup
   });
   ```

2. **Reduce Unnecessary Waits**:
   ```javascript
   // Replace fixed waits with smart waits
   // Bad: await page.waitForTimeout(5000);
   
   // Good: await page.waitForSelector('.loading', { state: 'hidden' });
   await page.waitForLoadState('networkidle');
   ```

3. **Optimize Data Management**:
   - Use efficient test data generation
   - Reuse test data where possible
   - Clean up data efficiently

4. **Enable Test Caching**:
   ```javascript
   // Cache expensive operations
   let authToken;
   
   beforeAll(async () => {
     if (!authToken) {
       authToken = await authenticateUser();
     }
   });
   ```

### Problem: Memory Leaks During Test Execution

**Symptoms:**
- Memory usage increases continuously
- Tests crash after extended runs
- System becomes sluggish

**Solutions:**

1. **Proper Resource Cleanup**:
   ```javascript
   afterAll(async () => {
     // Close browser instances
     if (browser) {
       await browser.close();
     }
     
     // Clear temporary files
     await cleanupTempFiles();
     
     // Close database connections
     if (database) {
       await database.disconnect();
     }
   });
   ```

2. **Limit Concurrent Tests**:
   ```javascript
   // Limit parallel execution
   jest.concurrent = true;
   jest.maxWorkers = 4; // Adjust based on system resources
   ```

3. **Monitor Memory Usage**:
   ```javascript
   // Add memory monitoring
   setInterval(() => {
     const memoryUsage = process.memoryUsage();
     console.log('Memory usage:', {
       rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
       heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
       heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
     });
   }, 30000);
   ```

4. **Optimize Test Data**:
   - Use smaller test datasets
   - Clean up data between tests
   - Avoid memory-intensive operations

## AI and Integration Problems

### Problem: AI Test Generation Issues

**Symptoms:**
- AI generates irrelevant or incorrect tests
- Generation process fails or times out
- Poor quality test cases

**Solutions:**

1. **Improve Test Descriptions**:
   ```text
   # Vague description (poor results)
   "Test the login page"
   
   # Detailed description (better results)
   "Generate tests for user login including:
   - Valid credentials authentication
   - Email format validation
   - Password strength validation
   - 'Forgot password' flow
   - Account lockout after 5 failed attempts
   - Remember me functionality"
   ```

2. **Provide Context Information**:
   - Include application type and framework
   - Describe key user workflows
   - Mention business rules and constraints
   - Specify testing priorities

3. **Adjust Generation Parameters**:
   ```javascript
   const generationConfig = {
     complexity: 'medium',           // simple, medium, complex
     includeNegativeTests: true,     // include error scenarios
     includeEdgeCases: true,         // boundary conditions
     maxTestCount: 10,              // limit number of tests
     targetCoverage: 85             // desired coverage percentage
   };
   ```

4. **Refine Generated Tests**:
   - Review and edit AI-generated tests
   - Add domain-specific assertions
   - Customize test data and scenarios
   - Optimize test sequences

### Problem: CI/CD Integration Issues

**Symptoms:**
- Tests fail in CI but pass locally
- Authentication problems in pipeline
- Configuration issues in CI environment

**Solutions:**

1. **Environment Configuration**:
   ```yaml
   # GitHub Actions example
   - name: Setup Environment
     run: |
       echo "QUESTRO_API_KEY=${{ secrets.QUESTRO_API_KEY }}" >> $GITHUB_ENV
       echo "QUESTRO_PROJECT_ID=${{ secrets.QUESTRO_PROJECT_ID }}" >> $GITHUB_ENV
   ```

2. **Container and Environment Setup**:
   ```dockerfile
   # Dockerfile for CI
   FROM node:18-alpine
   
   # Install browser dependencies
   RUN apk add --no-cache \
       chromium \
       nss \
       freetype \
       freetype-dev \
       harfbuzz \
       ca-certificates \
       ttf-freefont
   
   # Set Puppeteer to use installed Chromium
   ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
       PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
   ```

3. **Authentication in CI**:
   ```bash
   # Use service accounts for CI
   QUESTRO_API_KEY="ci-service-account-key"
   QUESTRO_PROJECT_ID="your-project-id"
   
   # Or use temporary tokens
   QUESTRO_TOKEN=$(curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"clientId": "ci-client", "clientSecret": "${CI_SECRET}"}' \
     https://api.questro.com/auth/token)
   ```

4. **Debug CI Failures**:
   ```bash
   # Add verbose logging
   QUESTRO_LOG_LEVEL=debug questro run --verbose
   
   # Run tests locally with CI environment
   docker run -v $(pwd):/app questro-ci-image questro run
   ```

## Platform-Specific Issues

### iOS Testing Problems

**Problem: App Installation Fails**
```bash
# Solutions:
# 1. Check provisioning profile
# 2. Verify app is signed correctly
# 3. Ensure device is trusted
# 4. Check iOS version compatibility

# Fix device trust
Settings > General > VPN & Device Management > Trust Developer
```

**Problem: Simulator Issues**
```bash
# Reset simulator
xcrun simctl erase all

# Reinstall simulator
xcrun simctl shutdown all
xcrun simctl delete all
```

### Android Testing Problems

**Problem: ADB Connection Issues**
```bash
# Check ADB connection
adb devices

# Restart ADB server
adb kill-server
adb start-server

# Check device permissions
adb shell pm list packages | grep questro
```

**Problem: App Installation Fails**
```bash
# Enable installation from unknown sources
adb shell settings put global install_non_market_apps 1

# Install using ADB
adb install app.apk

# Grant permissions post-install
adb shell pm grant com.questro.agent android.permission.WRITE_EXTERNAL_STORAGE
```

### Web Testing Problems

**Problem: Browser Driver Issues**
```bash
# Update ChromeDriver
chromedriver --version
npm install chromedriver --update

# Check browser version
google-chrome --version

# Verify driver compatibility
chromedriver --verbose
```

**Problem: Cross-Browser Compatibility**
```javascript
// Use browser-specific waits
const waitConditions = {
  chrome: 'networkidle0',
  firefox: 'networkidle2',
  safari: 'domcontentloaded'
};

await page.goto(url, { 
  waitUntil: waitConditions[browser] 
});
```

## Network and Firewall Issues

### Problem: Corporate Firewall Blocking

**Symptoms:**
- Connection timeout errors
- "Unable to reach Questro servers"
- WebSocket connection failures

**Solutions:**

1. **Whitelist Required Domains**:
   ```
   # Add to firewall whitelist
   api.questro.com:443
   app.questro.com:443
   cdn.questro.com:443
   updates.questro.com:443
   ```

2. **Configure Proxy Settings**:
   ```bash
   # Set HTTP proxy
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   export NO_PROXY=localhost,127.0.0.1
   ```

3. **SSL Certificate Issues**:
   ```bash
   # Add corporate CA certificates
   export NODE_EXTRA_CA_CERTS=/path/to/corpora-ca.pem
   
   # Or disable SSL verification (not recommended for production)
   export NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

### Problem: Slow Network Performance

**Symptoms:**
- High latency in API calls
- Recording interruptions
- Test execution delays

**Solutions:**

1. **Optimize Network Settings**:
   ```javascript
   // Configure timeout settings
   const config = {
     timeout: 30000,
     retryAttempts: 3,
     retryDelay: 1000
   };
   ```

2. **Use Local Caching**:
   ```javascript
   // Enable local caching
   const cache = new Map();
   
   async function cachedRequest(url) {
     if (cache.has(url)) {
       return cache.get(url);
     }
     
     const response = await fetch(url);
     cache.set(url, response.clone());
     return response;
   }
   ```

3. **Compress Data Transfer**:
   ```javascript
   // Enable compression
   const headers = {
     'Accept-Encoding': 'gzip, deflate, br',
     'Content-Encoding': 'gzip'
   };
   ```

## Data and Storage Issues

### Problem: Test Data Management

**Symptoms:**
- Tests fail due to missing test data
- Data conflicts between tests
- Storage quota exceeded

**Solutions:**

1. **Implement Test Data Factories**:
   ```javascript
   // Test data factory pattern
   class UserFactory {
     static create(overrides = {}) {
       return {
         email: faker.internet.email(),
         password: faker.internet.password(),
         firstName: faker.name.firstName(),
         lastName: faker.name.lastName(),
         ...overrides
       };
     }
   }
   
   // Usage in tests
   const user = UserFactory.create({
     email: 'test@example.com'
   });
   ```

2. **Use Database Transactions**:
   ```javascript
   // Wrap tests in transactions for cleanup
   beforeAll(async () => {
     await database.beginTransaction();
   });
   
   afterAll(async () => {
     await database.rollbackTransaction();
   });
   ```

3. **Clean Up Test Artifacts**:
   ```javascript
   // Automatic cleanup
   afterAll(async () => {
     await cleanupTempFiles();
     await cleanupTestScreenshots();
     await cleanupTestVideos();
   });
   ```

### Problem: Storage Quota Issues

**Symptoms:**
- "Storage quota exceeded" errors
- Unable to upload test results
- Slow performance due to full storage

**Solutions:**

1. **Monitor Storage Usage**:
   ```javascript
   // Check storage usage
   const storage = await navigator.storage.estimate();
   console.log('Storage usage:', {
     quota: storage.quota,
     usage: storage.usage,
     percentage: (storage.usage / storage.quota * 100).toFixed(2) + '%'
   });
   ```

2. **Implement Cleanup Policies**:
   ```javascript
   // Automatic cleanup old data
   async function cleanupOldData() {
     const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
     await deleteOldTestResults(cutoffDate);
     await deleteOldScreenshots(cutoffDate);
     await deleteOldVideos(cutoffDate);
   }
   ```

3. **Compress Test Artifacts**:
   ```javascript
   // Compress screenshots before storage
   async function compressScreenshot(buffer) {
     return await sharp(buffer)
       .resize(800, 600, { fit: 'inside' })
       .jpeg({ quality: 80 })
       .toBuffer();
   }
   ```

## Advanced Debugging

### Enable Debug Logging

```bash
# Set debug environment variables
export QUESTRO_LOG_LEVEL=debug
export QUESTRO_LOG_FORMAT=json
export DEBUG=questro:*

# Run with verbose output
questro run --verbose --log-level=debug
```

### Use Debug Mode in Browser

```javascript
// Enable browser debugging
const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({
  headless: false,
  devtools: true,
  slowMo: 100,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'
  ]
});
```

### Network Request Debugging

```javascript
// Log all network requests
page.on('request', request => {
  console.log('Request:', request.url(), request.method());
});

page.on('response', response => {
  console.log('Response:', response.url(), response.status());
});
```

### Memory and Performance Profiling

```javascript
// Enable performance monitoring
page.coverage.startCSSCoverage();
page.coverage.startJSCoverage();

// After test execution
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage()
]);

console.log('JS Coverage:', jsCoverage);
console.log('CSS Coverage:', cssCoverage);
```

## Getting Additional Help

### Collect Debug Information

When contacting support, gather this information:

```bash
# System information
questro --version
node --version
npm --version

# Configuration
questro config --list

# Logs
questro logs --last 100

# Test results (sanitized)
questro export --format=json --output=debug-info.json
```

### Create Support Ticket

Include this information in your support request:

1. **Description**: Detailed problem description
2. **Steps to Reproduce**: Exact steps to reproduce the issue
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment Details**: OS, browser, Questro version
6. **Error Messages**: Complete error messages and stack traces
7. **Debug Logs**: Relevant log files (sanitized if needed)

### Community Resources

- **Questro Community Forum**: https://community.questro.com
- **Stack Overflow**: Use tag `questro-testing`
- **GitHub Issues**: https://github.com/questro/questro/issues
- **Discord Server**: Real-time chat with community

---

**Contact Information:**
- **Support Email**: support@questro.com
- **Emergency Support**: emergency@questro.com
- **Documentation**: https://docs.questro.com
- **Status Page**: https://status.questro.com

Remember to check the Questro status page for ongoing service issues before contacting support.