# Troubleshooting Guide

This comprehensive troubleshooting guide will help you resolve common issues with Qestro. If you can't find a solution here, please contact our support team.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Authentication Problems](#authentication-problems)
3. [Test Execution Issues](#test-execution-issues)
4. [Recording Problems](#recording-problems)
5. [AI Generation Issues](#ai-generation-issues)
6. [Browser Extension Issues](#browser-extension-issues)
7. [Performance Issues](#performance-issues)
8. [API Integration Problems](#api-integration-problems)
9. [Billing and Subscription Issues](#billing-and-subscription-issues)
10. [Getting Help](#getting-help)

## Common Issues

### Issue: Cannot Access Qestro Dashboard

**Symptoms:**
- Website won't load
- Getting connection timeout errors
- Blank page or loading spinner that never completes

**Solutions:**

1. **Check Internet Connection**
   ```bash
   # Test connectivity
   ping qestro.app
   ```

2. **Clear Browser Cache**
   - Chrome: Settings → Privacy and Security → Clear browsing data
   - Firefox: Settings → Privacy & Security → Clear Data
   - Safari: Develop → Empty Caches

3. **Disable Browser Extensions**
   - Temporarily disable ad blockers and other extensions
   - Try accessing Qestro in incognito/private mode

4. **Check System Status**
   - Visit [status.qestro.app](https://status.qestro.app) for service status
   - Check our Twitter [@QestroStatus](https://twitter.com/QestroStatus) for updates

5. **Try Different Browser**
   - Test with Chrome, Firefox, Safari, or Edge
   - Ensure browser is up to date

### Issue: Slow Performance

**Symptoms:**
- Pages load slowly
- Tests take longer than expected to execute
- UI feels unresponsive

**Solutions:**

1. **Check Network Speed**
   ```bash
   # Test download speed
   curl -o /dev/null -s -w "%{speed_download}\n" https://qestro.app
   ```

2. **Optimize Browser**
   - Close unnecessary tabs
   - Disable unused extensions
   - Clear browser cache and cookies

3. **Check System Resources**
   - Close other applications
   - Ensure sufficient RAM and CPU available
   - Check for background processes

4. **Use Recommended Browsers**
   - Chrome 90+ (recommended)
   - Firefox 88+
   - Safari 14+
   - Edge 90+

## Authentication Problems

### Issue: Cannot Log In

**Symptoms:**
- "Invalid credentials" error
- Login form doesn't respond
- Redirected back to login page after entering credentials

**Solutions:**

1. **Verify Credentials**
   - Double-check email address (case-sensitive)
   - Ensure password is correct
   - Check for caps lock

2. **Reset Password**
   - Click "Forgot Password" on login page
   - Check email for reset instructions
   - Check spam/junk folder

3. **Clear Browser Data**
   ```javascript
   // Clear localStorage
   localStorage.clear();
   sessionStorage.clear();
   ```

4. **Disable Password Managers**
   - Temporarily disable auto-fill
   - Manually type credentials

5. **Check Account Status**
   - Verify email address is confirmed
   - Ensure account isn't suspended
   - Contact support if account is locked

### Issue: Session Expires Too Quickly

**Symptoms:**
- Logged out frequently
- "Session expired" messages
- Need to re-authenticate often

**Solutions:**

1. **Check Browser Settings**
   - Enable cookies for qestro.app
   - Disable "Clear cookies on exit"
   - Add qestro.app to trusted sites

2. **Update Browser**
   - Ensure browser supports modern authentication
   - Update to latest version

3. **Check Network Configuration**
   - Verify corporate firewall settings
   - Check proxy configuration
   - Ensure WebSocket connections are allowed

## Test Execution Issues

### Issue: Tests Fail to Start

**Symptoms:**
- Tests stuck in "queued" status
- "Failed to initialize" errors
- Tests never begin execution

**Solutions:**

1. **Check Test Configuration**
   ```json
   {
     "url": "https://valid-url.com",
     "framework": "playwright",
     "browser": "chrome",
     "timeout": 30000
   }
   ```

2. **Verify Target URL**
   - Ensure URL is accessible
   - Check for HTTPS/HTTP issues
   - Verify no authentication required

3. **Review Browser Settings**
   - Check if target site blocks automation
   - Verify no CAPTCHA protection
   - Ensure site allows iframe embedding

4. **Check Quota Limits**
   - Verify you haven't exceeded test execution limits
   - Check subscription plan limits
   - Review usage dashboard

### Issue: Tests Fail Intermittently

**Symptoms:**
- Tests pass sometimes, fail other times
- Flaky test results
- Inconsistent behavior

**Solutions:**

1. **Add Explicit Waits**
   ```javascript
   // Wait for element to be visible
   await page.waitForSelector('#element', { visible: true });
   
   // Wait for network to be idle
   await page.waitForLoadState('networkidle');
   
   // Wait for specific condition
   await page.waitForFunction(() => window.dataLoaded === true);
   ```

2. **Improve Selectors**
   ```javascript
   // Bad: Fragile selector
   await page.click('.btn-primary');
   
   // Good: Stable selector
   await page.click('[data-testid="submit-button"]');
   ```

3. **Handle Dynamic Content**
   ```javascript
   // Wait for dynamic content
   await page.waitForSelector('.dynamic-content');
   
   // Retry mechanism
   await page.click('#button', { timeout: 10000 });
   ```

4. **Increase Timeouts**
   - Set appropriate timeouts for slow operations
   - Consider network latency
   - Account for server processing time

### Issue: Element Not Found Errors

**Symptoms:**
- "Element not found" errors
- Selector timeout errors
- Tests fail on element interactions

**Solutions:**

1. **Verify Element Exists**
   - Check if element is present in DOM
   - Ensure element is visible
   - Verify element is not in iframe

2. **Update Selectors**
   ```javascript
   // Multiple selector strategies
   const selectors = [
     '[data-testid="button"]',
     '#submit-btn',
     '.submit-button',
     'button:has-text("Submit")'
   ];
   
   for (const selector of selectors) {
     try {
       await page.click(selector);
       break;
     } catch (error) {
       continue;
     }
   }
   ```

3. **Handle Dynamic Loading**
   ```javascript
   // Wait for element to appear
   await page.waitForSelector('#dynamic-element');
   
   // Wait for element to be stable
   await page.waitForFunction(() => {
     const element = document.querySelector('#element');
     return element && element.offsetHeight > 0;
   });
   ```

## Recording Problems

### Issue: Browser Extension Not Working

**Symptoms:**
- Recording doesn't start
- Actions not captured
- Extension icon grayed out

**Solutions:**

1. **Verify Extension Installation**
   - Check if extension is installed and enabled
   - Look for Qestro icon in browser toolbar
   - Ensure extension has required permissions

2. **Update Extension**
   - Check for extension updates
   - Reinstall if necessary
   - Clear extension data

3. **Check Permissions**
   - Grant all requested permissions
   - Allow access to all websites
   - Enable in incognito mode if needed

4. **Reload Page**
   - Refresh the target page
   - Clear page cache
   - Try different website

### Issue: Actions Not Being Recorded

**Symptoms:**
- Clicks and interactions not captured
- Recording session shows no actions
- Some elements not recordable

**Solutions:**

1. **Check Element Types**
   - Ensure elements are interactive
   - Verify elements have proper event handlers
   - Test with standard HTML elements

2. **Slow Down Interactions**
   - Click slowly and deliberately
   - Wait for page responses
   - Allow animations to complete

3. **Use Supported Actions**
   ```javascript
   // Supported actions
   - Click on buttons, links, inputs
   - Type in text fields
   - Select from dropdowns
   - Navigate between pages
   ```

4. **Avoid Problematic Elements**
   - Canvas elements
   - Flash content
   - Custom JavaScript widgets
   - Shadow DOM elements

## AI Generation Issues

### Issue: AI Generates Incorrect Tests

**Symptoms:**
- Generated test doesn't match description
- Test code has syntax errors
- Test logic is incorrect

**Solutions:**

1. **Improve Description Quality**
   ```text
   // Bad description
   "Test login"
   
   // Good description
   "Test user login functionality by entering valid email 'test@example.com' 
   and password 'password123', clicking the login button, and verifying 
   the user is redirected to the dashboard page with a welcome message."
   ```

2. **Provide More Context**
   - Include specific URLs
   - Mention exact element names
   - Describe expected outcomes
   - Specify error conditions

3. **Use Structured Format**
   ```text
   Given: User is on the login page at https://example.com/login
   When: User enters email "test@example.com" in the email field
   And: User enters password "password123" in the password field
   And: User clicks the "Sign In" button
   Then: User should be redirected to https://example.com/dashboard
   And: Page should display "Welcome back, Test User"
   ```

### Issue: AI Generation Quota Exceeded

**Symptoms:**
- "Quota exceeded" error messages
- Cannot generate new tests
- AI features disabled

**Solutions:**

1. **Check Usage Limits**
   - Review current plan limits
   - Check usage dashboard
   - Monitor monthly quota

2. **Upgrade Plan**
   - Consider higher tier subscription
   - Purchase additional AI credits
   - Contact sales for enterprise options

3. **Optimize Usage**
   - Combine multiple test scenarios
   - Reuse generated test templates
   - Edit existing tests instead of regenerating

## Browser Extension Issues

### Issue: Extension Not Installing

**Symptoms:**
- Installation fails
- Extension not appearing in browser
- Permission errors during installation

**Solutions:**

1. **Check Browser Compatibility**
   - Chrome 88+
   - Firefox 85+
   - Safari 14+
   - Edge 88+

2. **Clear Browser Data**
   - Clear cache and cookies
   - Reset browser settings
   - Disable other extensions temporarily

3. **Manual Installation**
   - Download extension file directly
   - Enable developer mode
   - Load unpacked extension

4. **Check Corporate Policies**
   - Verify extension installation is allowed
   - Contact IT administrator
   - Request whitelist approval

### Issue: Extension Conflicts

**Symptoms:**
- Other extensions stop working
- Browser becomes unstable
- Recording functionality interferes with other tools

**Solutions:**

1. **Identify Conflicting Extensions**
   - Disable extensions one by one
   - Test Qestro functionality
   - Note which extensions cause issues

2. **Update All Extensions**
   - Ensure all extensions are current
   - Remove outdated extensions
   - Check for compatibility updates

3. **Configure Extension Settings**
   - Adjust Qestro extension permissions
   - Modify conflicting extension settings
   - Use different browser profiles

## Performance Issues

### Issue: Slow Test Execution

**Symptoms:**
- Tests take much longer than expected
- Timeouts during execution
- Browser becomes unresponsive

**Solutions:**

1. **Optimize Test Code**
   ```javascript
   // Use efficient selectors
   await page.locator('[data-testid="button"]').click();
   
   // Avoid unnecessary waits
   await page.waitForLoadState('domcontentloaded');
   
   // Parallel execution where possible
   await Promise.all([
     page.waitForResponse('**/api/data'),
     page.click('#load-data')
   ]);
   ```

2. **Reduce Resource Usage**
   - Disable images and CSS for faster loading
   - Use headless mode
   - Limit concurrent test execution

3. **Optimize Target Application**
   - Minimize external dependencies
   - Reduce page load times
   - Optimize database queries

### Issue: High Memory Usage

**Symptoms:**
- Browser crashes during tests
- System becomes slow
- Out of memory errors

**Solutions:**

1. **Manage Browser Instances**
   ```javascript
   // Close browsers properly
   await browser.close();
   
   // Limit concurrent browsers
   const maxConcurrency = 3;
   
   // Use browser pooling
   const browserPool = new BrowserPool(maxConcurrency);
   ```

2. **Clean Up Resources**
   - Close unused pages and contexts
   - Clear browser cache regularly
   - Dispose of large objects

3. **System Optimization**
   - Increase available RAM
   - Close unnecessary applications
   - Use SSD for better performance

## API Integration Problems

### Issue: Authentication Failures

**Symptoms:**
- 401 Unauthorized errors
- Token expired messages
- API calls rejected

**Solutions:**

1. **Verify API Credentials**
   ```javascript
   // Check token format
   const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   
   // Verify token expiration
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token expires:', new Date(payload.exp * 1000));
   ```

2. **Refresh Tokens**
   ```javascript
   // Implement token refresh
   async function refreshToken() {
     const response = await fetch('/api/auth/refresh', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${currentToken}` }
     });
     const { token } = await response.json();
     return token;
   }
   ```

3. **Handle Token Expiration**
   ```javascript
   // Automatic token refresh
   axios.interceptors.response.use(
     response => response,
     async error => {
       if (error.response?.status === 401) {
         const newToken = await refreshToken();
         error.config.headers.Authorization = `Bearer ${newToken}`;
         return axios.request(error.config);
       }
       return Promise.reject(error);
     }
   );
   ```

### Issue: Rate Limiting

**Symptoms:**
- 429 Too Many Requests errors
- API calls being throttled
- Temporary access restrictions

**Solutions:**

1. **Implement Retry Logic**
   ```javascript
   async function apiCallWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url, options);
         if (response.status === 429) {
           const retryAfter = response.headers.get('Retry-After');
           await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
           continue;
         }
         return response;
       } catch (error) {
         if (i === maxRetries - 1) throw error;
       }
     }
   }
   ```

2. **Optimize API Usage**
   - Batch multiple requests
   - Cache responses when possible
   - Reduce polling frequency

3. **Upgrade Plan**
   - Consider higher rate limits
   - Contact support for enterprise options
   - Monitor usage patterns

## Billing and Subscription Issues

### Issue: Payment Failures

**Symptoms:**
- Credit card declined
- Subscription not activated
- Billing errors

**Solutions:**

1. **Verify Payment Information**
   - Check card expiration date
   - Verify billing address
   - Ensure sufficient funds

2. **Try Alternative Payment Methods**
   - Use different credit card
   - Try PayPal or other options
   - Contact your bank

3. **Contact Billing Support**
   - Email: billing@qestro.app
   - Include account details
   - Provide transaction information

### Issue: Feature Access Problems

**Symptoms:**
- Premium features not available
- Usage limits not updated
- Subscription benefits not applied

**Solutions:**

1. **Verify Subscription Status**
   - Check account settings
   - Confirm payment processed
   - Review subscription details

2. **Clear Browser Cache**
   - Refresh account information
   - Log out and back in
   - Clear local storage

3. **Contact Support**
   - Provide subscription details
   - Include payment confirmation
   - Request manual activation

## Getting Help

### Before Contacting Support

1. **Check This Guide**
   - Search for your specific issue
   - Try suggested solutions
   - Note what you've already attempted

2. **Gather Information**
   - Browser version and type
   - Operating system
   - Error messages (exact text)
   - Steps to reproduce issue
   - Screenshots or screen recordings

3. **Check System Status**
   - Visit [status.qestro.app](https://status.qestro.app)
   - Check for known issues
   - Review maintenance schedules

### Contact Options

#### Email Support
- **General Support**: support@qestro.app
- **Technical Issues**: tech@qestro.app
- **Billing Questions**: billing@qestro.app
- **API Support**: api-support@qestro.app

#### Live Chat
- Available in the Qestro application
- Monday-Friday, 9 AM - 6 PM PST
- Response time: < 2 hours

#### Community Forum
- [community.qestro.app](https://community.qestro.app)
- Search existing discussions
- Post new questions
- Get help from other users

#### Video Support
- Schedule screen sharing session
- Available for Pro and Enterprise customers
- Book at [calendly.com/qestro-support](https://calendly.com/qestro-support)

### Information to Include

When contacting support, please provide:

1. **Account Information**
   - Email address
   - Subscription plan
   - Account ID (if known)

2. **Technical Details**
   - Browser name and version
   - Operating system
   - Qestro extension version
   - Network configuration (if relevant)

3. **Issue Description**
   - What you were trying to do
   - What happened instead
   - Error messages (exact text)
   - When the issue started

4. **Reproduction Steps**
   - Step-by-step instructions
   - Frequency of occurrence
   - Conditions when it happens

5. **Supporting Materials**
   - Screenshots
   - Screen recordings
   - Browser console logs
   - Network request details

### Emergency Support

For critical production issues:

- **Email**: emergency@qestro.app
- **Phone**: +1 (555) 123-QESTRO
- **Slack**: #qestro-emergency (Enterprise customers)

Emergency support is available 24/7 for Enterprise customers and during business hours for Pro customers.

---

## Quick Reference

### Common Error Codes

- `AUTH_001`: Invalid credentials
- `AUTH_002`: Token expired
- `TEST_001`: Test execution failed
- `TEST_002`: Element not found
- `REC_001`: Recording session error
- `API_001`: Rate limit exceeded
- `BILL_001`: Payment failed

### Useful Browser Console Commands

```javascript
// Check Qestro extension status
console.log(window.qestroExtension);

// Clear local storage
localStorage.clear();

// Check WebSocket connection
console.log(window.qestroWebSocket?.readyState);

// Get current user info
console.log(window.qestroUser);
```

### System Requirements

- **Browsers**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **Operating Systems**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Network**: Stable internet connection, WebSocket support
- **Permissions**: JavaScript enabled, cookies allowed

Remember: Most issues can be resolved quickly with the right information. Don't hesitate to reach out to our support team – we're here to help! 🚀