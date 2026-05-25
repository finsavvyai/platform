# Qestro Troubleshooting Guide & FAQ

## Table of Contents

- [Quick Help](#quick-help)
- [Common Issues](#common-issues)
- [Error Code Reference](#error-code-reference)
- [Production Incident Response](#production-incident-response)
- [Performance Troubleshooting](#performance-troubleshooting)
- [Integration Issues](#integration-issues)
- [Device-Specific Problems](#device-specific-problems)
- [FAQ](#frequently-asked-questions)
- [Diagnostic Tools](#diagnostic-tools)
- [Support Escalation](#support-escalation)

## Quick Help

### I Need Immediate Help!

1. **Test is failing right now** → [Common Test Failures](#common-test-failures)
2. **Can't connect device** → [Device Connection Issues](#device-connection-issues)
3. **Slow test execution** → [Performance Issues](#performance-issues)
4. **API errors** → [API Error Codes](#api-error-codes)
5. **Production is down** → [Incident Response](#production-incident-response)

### Self-Service Diagnosis

Run this quick diagnostic command:

```bash
# Check Qestro CLI status
qestro doctor

# Output example:
✅ CLI Version: 2.1.0 (latest)
✅ Authentication: Valid
✅ Connection: Stable (45ms)
⚠️  Device: iPhone 14 Pro - Needs update
❌ Android ADB: Not running
```

## Common Issues

### Common Test Failures

#### 1. Element Not Found

**Error Message:**
```
Error: Element "Login Button" not found
```

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| **Element not loaded** | Add wait command: `- waitForElement: "Login Button"` |
| **Wrong selector** | Use more specific selector: `- tapOn: { id: "login_button" }` |
| **iFrame/Shadow DOM** | Switch context first: `- enterFrame: "iframe-id"` |
| **App crashed** | Check app logs and restart: `- launchApp` |

**Fixed Example:**
```yaml
# Before (failing)
- tapOn: "Login"

# After (fixed)
- waitFor:
    visible: "Login"
    timeout: 10
- tapOn:
    id: "login_button"
    description: "Main login button"
```

#### 2. Test Times Out

**Error Message:**
```
TimeoutError: Test execution exceeded 30000ms
```

**Quick Fixes:**

```yaml
# Increase timeout for specific test
- tapOn: "Slow Button"
  timeout: 60000

# Or globally in test config
config:
  defaultTimeout: 60000
  actionTimeout: 30000
```

**Common Timeout Causes:**
- Network requests too slow
- Heavy animations running
- Device performance issues
- Infinite loops in code

#### 3. Authentication Failures

**Error Message:**
```
AuthenticationError: Invalid credentials or session expired
```

**Debugging Steps:**

1. **Check token validity**:
   ```bash
   # Decode JWT to check expiry
   echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d
   ```

2. **Refresh token**:
   ```bash
   qestro auth refresh
   ```

3. **Verify credentials**:
   ```bash
   qestro auth verify
   ```

#### 4. Flaky Tests (Inconsistent Results)

**Symptoms:**
- Test passes sometimes, fails other times
- No changes to test code
- Random failures

**Common Causes & Solutions:**

| Issue | Solution |
|-------|----------|
| **Race conditions** | Add explicit waits |
| **Network latency** | Mock network calls |
| **Device resources** | Clear cache before test |
| **Time-based logic** | Use fixed timestamps |

**Example Fix:**
```typescript
// Before (flaky)
await page.click('button');
await expect(page.locator('.result')).toBeVisible();

// After (stable)
await page.click('button');
await page.waitForSelector('.result', { state: 'visible', timeout: 5000 });
await expect(page.locator('.result')).toBeVisible();
```

### Device Connection Issues

#### iOS Device Issues

**Problem:** Device not showing up in Qestro

**Checklist:**
```bash
# 1. Verify device is connected
xcrun simctl list devices | grep "iPhone"

# 2. Check Xcode recognizes device
xcrun xctrace list devices

# 3. Verify developer mode
# Settings > Privacy & Security > Developer Mode = ON

# 4. Trust computer
# In device: Settings > General > VPN & Device Management > Trust

# 5. Check Qestro permissions
# System Settings > Privacy > Developer Tools > Allow Terminal
```

**Solution Steps:**
```bash
# Restart device services
sudo pkill -f Xcode
sudo xcode-select --reset

# Reconnect device
# Unplug USB > Wait 5 seconds > Replug

# Restart Qestro device manager
qestro device manager restart
```

#### Android Device Issues

**Problem:** "device offline" or "unauthorized"

**Quick Fix:**
```bash
# 1. Restart ADB
adb kill-server
adb start-server

# 2. Check device status
adb devices -l

# 3. Revoke and reauthorize
adb disconnect
# Reconnect USB and accept authorization on device

# 4. Check USB debugging
# Settings > Developer options > USB debugging = ON
```

**Advanced Troubleshooting:**
```bash
# Check for conflicting ADB instances
ps aux | grep adb

# Kill all ABD processes
sudo killall adb

# Use specific ADB from Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk
$ANDROID_HOME/platform-tools/adb devices
```

### Performance Issues

#### Slow Test Execution

**Diagnose the bottleneck:**
```bash
# Run performance profiler
qestro test run --profile --verbose test_name.yaml

# Check system resources
top -p $(pgrep qestro)

# Monitor network
nettop -d
```

**Optimization Strategies:**

1. **Parallel Execution**:
   ```yaml
   # Run tests in parallel
   qestro test run:
     tests: [test1, test2, test3]
     parallel: true
     maxConcurrent: 3
   ```

2. **Skip Unnecessary Steps**:
   ```yaml
   - launchApp
    # Skip animations
   - runCommand: "defaults write com.apple.myapp NSWindowAnimated -bool NO"
   ```

3. **Mock Network Calls**:
   ```typescript
   // Mock slow API responses
   await page.route('/api/slow-endpoint', route => {
     route.fulfill({
       status: 200,
       body: JSON.stringify({ data: 'mocked' })
     });
   });
   ```

#### High Memory Usage

**Symptoms:**
- Tests crashing with OOM errors
- Device becomes sluggish
- Tests slow down over time

**Solutions:**
```yaml
# Clear memory between tests
testSetup:
  - clearAppState
  - restartApp
  - freeMemory

# Limit batch size
batchConfig:
  maxTestsPerBatch: 10
  restartBetweenBatches: true
```

## Error Code Reference

### Qestro Platform Errors

#### 1000-1999: Authentication & Authorization

| Code | Error | Solution |
|------|-------|----------|
| 1001 | `AUTH_TOKEN_MISSING` | Include `Authorization: Bearer <token>` header |
| 1002 | `AUTH_TOKEN_EXPIRED` | Refresh token using `/auth/refresh` |
| 1003 | `AUTH_TOKEN_INVALID` | Get new token by logging in |
| 1004 | `PERMISSION_DENIED` | Check user has required permissions |
| 1005 | `SUBSCRIPTION_EXPIRED` | Renew subscription at qestro.com/billing |
| 1006 | `QUOTA_EXCEEDED` | Upgrade plan or wait for quota reset |

#### 2000-2999: Test Execution

| Code | Error | Solution |
|------|-------|----------|
| 2001 | `DEVICE_NOT_FOUND` | Add device to device pool |
| 2002 | `DEVICE_BUSY` | Wait or use different device |
| 2003 | `APP_NOT_INSTALLED` | Install app on device |
| 2004 | `TEST_TIMEOUT` | Increase timeout or optimize test |
| 2005 | `TEST_SYNTAX_ERROR` | Fix test syntax in YAML/JSON |
| 2006 | `INSUFFICIENT_RESOURCES` | Free device resources or upgrade plan |

#### 3000-3999: AI Services

| Code | Error | Solution |
|------|-------|----------|
| 3001 | `AI_SERVICE_UNAVAILABLE` | Try again in a few minutes |
| 3002 | `AI_QUOTA_EXCEEDED` | Upgrade plan for more AI credits |
| 3003 | `INVALID_PROMPT` | Improve test description clarity |
| 3004 | `AI_PROCESSING_ERROR` | Report to support with test details |
| 3005 | `MODEL_NOT_SUPPORTED` | Use supported model or contact support |

#### 4000-4999: Platform & Infrastructure

| Code | Error | Solution |
|------|-------|----------|
| 4001 | `DATABASE_CONNECTION_ERROR` | Check status page or try again |
| 4002 | `STORAGE_FULL` | Free up space or contact support |
| 4003 | `NETWORK_TIMEOUT` | Check connection and retry |
| 4004 | `SERVICE_MAINTENANCE` | Wait for maintenance window |
| 4005 | `REGION_UNAVAILABLE` | Switch to different region |

### HTTP Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 400 | Bad Request | Invalid JSON, missing fields |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal platform error |
| 503 | Service Unavailable | Maintenance or outage |

## Production Incident Response

### 🚨 CRITICAL INCIDENT PROCEDURE

#### Immediate Actions (First 5 Minutes)

1. **Check Status Page**
   ```
   https://status.qestro.com
   
   Look for:
   - Active incidents
   - Service status
   - Expected resolution time
   ```

2. **Verify Impact**
   ```bash
   # Check service health
   curl -I https://api.qestro.com/health
   
   # Check your specific service
   curl -I https://api.qestro.com/v1/test-execution/status
   ```

3. **Activate Team**
   ```bash
   # Send alert to team
   qestro alert create \
     --severity=critical \
     --message="Production tests failing" \
     --channel="#incidents"
   ```

4. **Document Everything**
   ```markdown
   # Incident Log
   - Time: 2024-11-03 14:32:00 UTC
   - Issue: Test execution failures
   - Impact: All test runs
   - Status: Investigating
   - Assignee: [Your name]
   ```

#### Investigation Phase (5-30 Minutes)

1. **Gather Logs**
   ```bash
   # Get recent error logs
   qestro logs fetch \
     --since="30m ago" \
     --level=error \
     --service=test-execution
   
   # Monitor live logs
   qestro logs tail --service=all
   ```

2. **Check Metrics**
   ```bash
   # Check error rates
   qestro metrics get \
     --metric=error_rate \
     --since="1h ago"
   
   # Check system health
   qestro health check --verbose
   ```

3. **Identify Root Cause**
   - Review error patterns
   - Check recent deployments
   - Verify external dependencies
   - Correlate with other issues

#### Resolution Phase (30+ Minutes)

1. **Apply Fix**
   ```bash
   # Option 1: Rollback
   qestro deployment rollback --version=previous
   
   # Option 2: Hotfix
   qestro deployment hotfix \
     --fix="patch_memory_leak" \
     --service=test-execution
   ```

2. **Verify Fix**
   ```bash
   # Run smoke tests
   qestro test run --suite=smoke-tests
   
   # Monitor for 5 minutes
   qestro monitor --duration=5m
   ```

3. **Full Recovery**
   - Resume normal operations
   - Monitor for regression
   - Update status page

#### Post-Incident Actions

1. **Create Incident Report**
   ```markdown
   # Incident Report: #INC-2024-001
   
   ## Summary
   - Start: 2024-11-03 14:32 UTC
   - End: 2024-11-03 15:45 UTC
   - Duration: 73 minutes
   - Impact: 100% test execution failures
   
   ## Root Cause
   Memory leak in test executor causing OOM errors
   
   ## Resolution
   Deployed hotfix to fix memory leak and restarted services
   
   ## Prevention
   - Added memory monitoring alerts
   - Implemented memory limits
   - Added load testing to CI
   ```

2. **Team Retrospective**
   - What went well?
   - What could be improved?
   - Action items for prevention

3. **Update Documentation**
   - Add to knowledge base
   - Create runbook for similar issues
   - Share learnings with team

## Performance Troubleshooting

### Test Execution Performance

#### Diagnosing Slow Tests

1. **Profile Test Execution**:
   ```bash
   qestro test profile slow_test.yaml \
     --output=profile.json \
     --detailed
   ```

2. **Analyze Profile Results**:
   ```json
   {
     "totalTime": 45000,
     "breakdown": {
       "appLaunch": 5000,
       "networkCalls": 20000,
       "uiInteractions": 15000,
       "assertions": 5000
     },
     "slowestSteps": [
       { "step": "Load Dashboard", "time": 8000 },
       { "step": "API Data Fetch", "time": 5000 }
     ]
   }
   ```

#### Optimization Strategies

1. **Reduce App Launch Time**:
   ```yaml
   # Use cached app state
   - launchApp
     coldStart: false
     cacheState: true
   
   # Or reuse existing session
   - reuseAppSession
   ```

2. **Optimize Network Calls**:
   ```typescript
   // Mock slow APIs
   await page.route('**/api/analytics/*', route => {
     route.abort(); // Skip analytics calls
   });
   
   // Use faster test data
   await page.route('**/api/products/*', route => {
     route.fulfill({
       body: JSON.stringify(mockProductData)
     });
   });
   ```

3. **Parallelize Independent Steps**:
   ```yaml
   # Run in parallel when possible
   parallel:
     - step1: "Load User Profile"
     - step2: "Load Product Data"
     - step3: "Initialize Analytics"
   ```

### Database Performance

#### Slow Query Diagnosis

```sql
-- Find slow queries
SELECT 
  query,
  COUNT(*) as executions,
  AVG(duration) as avg_duration,
  MAX(duration) as max_duration
FROM query_log 
WHERE duration > 1000 -- queries > 1 second
  AND created_at > datetime('now', '-1 hour')
GROUP BY query
ORDER BY avg_duration DESC;
```

#### Optimization Solutions

```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_test_runs_project_date 
ON test_runs(project_id, started_at DESC);

-- Optimize JOIN queries
CREATE INDEX IF NOT EXISTS idx_test_cases_project_id 
ON test_cases(project_id);

-- Use EXPLAIN to analyze query plan
EXPLAIN QUERY PLAN 
SELECT * FROM test_runs 
WHERE project_id = 'proj_123' 
  AND started_at > '2024-11-01';
```

## Integration Issues

### CI/CD Integration Problems

#### GitHub Actions Failures

**Error:** `Error: Qestro API key not found`

**Solution:**
```yaml
# Ensure secret is correctly set
- name: Run Qestro Tests
  env:
    QESTRO_API_KEY: ${{ secrets.QESTRO_API_KEY }}
    QESTRO_PROJECT_ID: ${{ secrets.QESTRO_PROJECT_ID }}
  run: |
    qestro test run --ci
```

**Error:** `Tests failing in CI but passing locally`

**Debugging Steps:**
```bash
# 1. Check CI environment
qestro doctor --env=ci

# 2. Compare environments
qestro config diff --local --ci

# 3. Run with debug mode
qestro test run --debug --verbose
```

#### Jenkins Integration Issues

**Problem:** No test results published

**Fix:**
```groovy
// Ensure test artifacts are saved
always {
  // Save test results
  archiveArtifacts artifacts: 'qestro-results/**/*', allowEmptyArchive: true
  
  // Publish HTML reports
  publishHTML([
    allowMissing: false,
    alwaysLinkToLastBuild: true,
    keepAll: true,
    reportDir: 'qestro-results/html',
    reportFiles: 'index.html',
    reportName: 'Qestro Test Report'
  ])
}
```

### Third-Party Tool Integration

#### Slack Integration Not Working

**Debug Checklist:**
```bash
# 1. Test Slack connection
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-type: application/json' \
  --data '{"text":"Test message from Qestro"}'

# 2. Check webhook permissions
# In Slack: Apps > Your App > OAuth & Permissions

# 3. Verify channel access
# Bot must be invited to channel
/invite @QestroBot
```

#### Jira Integration Failures

**Common Issues:**
- Incorrect API token
- Insufficient permissions
- Custom field requirements

**Solution:**
```typescript
// Test Jira connection
const jiraClient = new JiraClient({
  host: 'yourcompany.atlassian.net',
  username: 'qestro-bot@yourcompany.com',
  token: process.env.JIRA_TOKEN
});

// Verify connection
const projects = await jiraClient.listProjects();
console.log('Connected to Jira, projects:', projects.length);
```

## Device-Specific Problems

### iOS Device Issues

#### Simulator Problems

**Error:** "Unable to boot iOS Simulator"

**Solutions:**
```bash
# 1. Reset simulator content
xcrun simctl erase all

# 2. Reinstall simulator
xcrun simctl shutdown all
xcrun simctl uninstall all

# 3. Check available simulators
xcrun simctl list devices | grep "iOS 17"

# 4. Create new simulator
xcrun simctl create "Test iPhone" "iPhone 14" "iOS 17.0"
```

#### Physical Device Issues

**Problem:** "Device is locked" or "Trust this computer"

**Fix:**
```bash
# 1. Check device lock status
xcrun devicectl list devices

# 2. Unlock device
# On device: Swipe to unlock

# 3. Trust computer
# On device: Settings > General > VPN & Device Management > Trust

# 4. Restart device services
sudo pkill -f mobile_device
sudo launchctl start com.apple.mobile.device_manager
```

### Android Device Issues

#### Emulator Problems

**Error:** " emulator: ERROR: Can't find start_x86.exe"

**Fixes:**
```bash
# 1. Update Android SDK
sdkmanager "system-images;android-33;google_apis;x86_64"

# 2. Create new AVD
avdmanager create avd \
  -n test_device \
  -k "system-images;android-33;google_apis;x86_64" \
  -d "pixel_6"

# 3. Launch with more memory
emulator -avd test_device -memory 4096 -partition-size 1024
```

#### Physical Device Connection

**Problem:** "device unauthorized"

**Complete Fix:**
```bash
# 1. Revoke all authorizations
adb disconnect
adb kill-server

# 2. On device: Revoke USB debugging
# Settings > Developer options > Revoke USB debugging authorizations

# 3. Re-enable USB debugging
# Settings > Developer options > USB debugging = OFF then ON

# 4. Reconnect and authorize
# Unplug USB > Replug > Accept authorization dialog

# 5. Verify connection
adb devices
# Should show: XXXXXXXXXXXXXX  device
```

## Frequently Asked Questions (FAQ)

### General Questions

#### Q: What programming languages does Qestro support?
**A:** Qestro supports:
- YAML for declarative tests (most common)
- TypeScript/JavaScript for complex scenarios
- Python for API testing
- Shell scripts for custom integrations

#### Q: Can I test native apps built with React Native?
**A:** Yes! Qestro works with:
- React Native apps (iOS/Android)
- Flutter apps
- Native iOS (Swift/Objective-C)
- Native Android (Kotlin/Java)
- Hybrid apps (Cordova, Ionic)

#### Q: How much does Qestro cost?
**A:** Pricing tiers:
- **Free**: 10 tests/month, 1 concurrent execution
- **Starter**: $49/month, 100 tests/month, 5 concurrent
- **Professional**: $199/month, Unlimited tests, 20 concurrent
- **Enterprise**: Custom pricing with dedicated support

#### Q: Is my data secure?
**A:** Absolutely. Qestro implements:
- End-to-end encryption
- SOC 2 Type II compliance
- GDPR compliance
- Regular security audits
- Data never shared with third parties

### Technical Questions

#### Q: What's the difference between test suite and test case?
**A:**
- **Test Case**: Individual test scenario (e.g., "User Login")
- **Test Suite**: Collection of related test cases (e.g., "Authentication Tests")

#### Q: Can I run tests in parallel?
**A:** Yes! Configure parallel execution:
```yaml
execution:
  parallel: true
  maxConcurrent: 5
  devices: ["iPhone", "Android", "Chrome"]
```

#### Q: How do I handle dynamic test data?
**A:** Use variables and data providers:
```yaml
variables:
  email: faker.internet.email()
  password: faker.internet.password()

dataProvider:
  users:
    - email: "test1@example.com"
      role: "admin"
    - email: "test2@example.com"
      role: "user"
```

#### Q: Can Qestro test APIs?
**A:** Yes, Qestro has full API testing capabilities:
- REST/GraphQL APIs
- Authentication methods (OAuth, API Key, JWT)
- Response validation
- Performance testing
- Mock servers

### Troubleshooting FAQ

#### Q: Why are my tests flaky?
**A:** Common causes:
1. Timing issues (add explicit waits)
2. Network latency (mock external calls)
3. Device resources (clear cache between tests)
4. Test dependencies (make tests independent)

#### Q: How do I debug test failures?
**A:** Use these debugging tools:
```bash
# 1. Run with debug mode
qestro test run test.yaml --debug

# 2. Get detailed logs
qestro logs fetch --test-id=run_123 --level=debug

# 3. Visual debugging
qestro test run test.yaml --headed --slowmo=1000
```

#### Q: My tests are too slow. How can I speed them up?
**A:** Optimization strategies:
1. Run tests in parallel
2. Mock network calls
3. Skip unnecessary animations
4. Use cached app state
5. Optimize selectors (ID > CSS > XPath)

### Advanced FAQ

#### Q: Can I integrate Qestro with my existing test framework?
**A:** Yes! Qestro integrates with:
- Jest
- Cypress
- Playwright
- Selenium
- XCTest
- Espresso

#### Q: How do I test payment flows safely?
**A:** Use test environments:
- Stripe test mode
- Sandbox payment gateways
- Mock payment responses
- Test credit cards (4242424242424242)

#### Q: Can I generate reports for stakeholders?
**A:** Yes, multiple report formats:
- HTML reports with charts
- PDF summaries
- JSON/CSV data export
- Slack/Teams notifications
- Custom dashboard widgets

## Diagnostic Tools

### Qestro CLI Tools

```bash
# Health check
qestro doctor

# System information
qestro system info

# Network diagnostics
qestro network check

# Device diagnostics
qestro device check --all

# Test validation
qestro test validate test.yaml

# Performance profiler
qestro profile test.yaml

# Log analyzer
qestro logs analyze --pattern="ERROR"
```

### Browser DevTools Integration

```javascript
// Add to your test setup
await page.evaluateOnNewDocument(() => {
  // Enable performance monitoring
  window.QESTRO_DEBUG = true;
  
  // Track AJAX calls
  const originalFetch = window.fetch;
  window.fetch = (...args) => {
    console.log('Fetch:', args[0]);
    return originalFetch.apply(this, args);
  };
});
```

### Device Debugging

#### iOS Debugging
```bash
# iOS Simulator logs
xcrun simctl spawn booted log stream --predicate 'process == "YourApp"'

# Safari Web Inspector
# Safari > Develop > iPhone > YourApp

# Crash logs
xcrun simctl spawn booted crashreport
```

#### Android Debugging
```bash
# Android logs
adb logcat | grep "com.example.app"

# Network traffic
adb shell tcpdump -i any -w /sdcard/capture.pcap

# App data
adb shell dumpsys package com.example.app
```

## Support Escalation

### When to Escalate

**Escalate immediately if:**
- Production tests all failing
- Security breach suspected
- Data loss or corruption
- Service completely unavailable
- SLA breach imminent

### Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|---------------|-----------------|
| Critical | 15 minutes | Support → Engineering Manager → CTO |
| High | 1 hour | Support → Tech Lead → VP Engineering |
| Medium | 4 hours | Support → Team Lead |
| Low | 24 hours | Support ticket |

### Contact Information

**Self-Service:**
- Documentation: docs.qestro.com
- Status Page: status.qestro.com
- Community: community.qestro.com

**Direct Support:**
- Email: support@qestro.com
- Live Chat: In-app widget (9 AM - 5 PM PST)
- Phone: 1-800-QESTRO (Enterprise only)

**Emergency Contacts (Enterprise):**
- Critical incidents: emergency@qestro.com
- Security issues: security@qestro.com
- Account issues: billing@qestro.com

### Creating Support Tickets

For fastest resolution, include:

```markdown
**Issue Description:**
[Brief description of the problem]

**Environment:**
- OS: macOS 14.0
- Qestro Version: 2.1.0
- Device: iPhone 14 Pro
- App Version: 1.5.2

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Error Messages:**
[Paste full error output]

**What You've Tried:**
[List troubleshooting steps attempted]

**Additional Context:**
[Any other relevant information]
```

### Bug Report Template

```markdown
# Bug Report - [Brief Title]

## Environment
- Qestro Version: [version]
- Platform: [iOS/Android/Web]
- Device: [device info]
- App: [app name/version]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happened]

## Reproduction Steps
1. [ ]
2. [ ]
3. [ ]

## Additional Information
- Logs: [attach logs]
- Screenshots: [attach screenshots]
- Test files: [attach test files if possible]
```

---

## Quick Reference

### Common Commands

```bash
# Authentication
qestro auth login
qestro auth status
qestro auth refresh

# Test Management
qestro test create
qestro test list
qestro test run test.yaml
qestro test stop <run-id>

# Device Management
qestro device list
qestro device connect <device-id>
qestro device restart <device-id>

# Debugging
qestro logs tail
qestro doctor
qestro profile test.yaml
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + S | Save test |
| Cmd/Ctrl + Enter | Run test |
| Cmd/Ctrl + D | Debug test |
| Cmd/Ctrl + / | Toggle comment |
| F5 | Refresh device list |

### Emergency Commands

```bash
# Stop all running tests
qestro test stop-all

# Emergency restart
qestro restart --services=all

# Clear all caches
qestro cache clear --all

# Force logout
qestro auth logout --force
```

---

Last Updated: 2025-11-03
Version: 2.1.0
Emergency Contacts: support@qestro.com, emergency@qestro.com