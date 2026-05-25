# AMLIQ AML Platform - Test Flow P04
## Persona: David Kim - CTO Security Evaluator

### Persona Profile
- **Name:** David Kim
- **Role:** Chief Technology Officer (CTO)
- **Company:** TechSecure Enterprise (800+ employees, Fortune 1000)
- **Experience Level:** 15 years tech leadership, strong security and architecture expertise
- **Goals:** Comprehensive security assessment; verify compliance certifications, test infrastructure security
- **Success Criteria:** Validate all security features, verify no information leakage, test attack resistance, confirm audit trail tamper-evidence

---

## Prerequisites
- [ ] Chrome browser with Developer Tools open (F12)
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] Browser console ready for monitoring security responses
- [ ] Network tab open to inspect headers and requests
- [ ] Terminal access for curl/API testing
- [ ] Test account or create during flow

---

## Test Flow Steps

### Step 1: Marketing Page Review - Security Badges
**Action:** Verify security certifications and trust indicators on landing page
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] **Verify:** Landing page loads completely
- [ ] **Screenshot:** Full hero section
- [ ] Scroll to footer or trust section
- [ ] **Verify:** Security/compliance badges visible
- [ ] **Selector:** Footer badges or trust section
- [ ] **Screenshot:** Security badges/certifications area
- [ ] Confirm presence of following certifications:
  - [ ] SOC 2 Type II badge or link
  - [ ] ISO 27001 certification badge
  - [ ] PCI DSS compliance badge
  - [ ] GDPR compliant badge
  - [ ] Link to Privacy Policy and Terms
- [ ] **Selector:** Badge or certification links
- [ ] **Screenshot:** Each certification badge/link
- [ ] Click on "SOC 2" badge
- [ ] **Verify:** Links to audit report or certification details (external or modal)
- [ ] **Selector:** SOC 2 link target
- [ ] **Screenshot:** SOC 2 details/report
- [ ] Check Privacy Policy link
- [ ] **Verify:** Privacy policy document loads
- [ ] **Screenshot:** Privacy policy content
- [ ] Verify mentions of data handling, encryption, retention
- [ ] **Pass/Fail:** ☐ All security badges and certifications present

---

### Step 2: Pricing Comparison - Security Features
**Action:** Review security features mentioned in pricing tiers
- [ ] Click "Pricing" in navigation
- [ ] **Selector:** `a[href*="pricing"]`
- [ ] **Verify:** Pricing page loads
- [ ] **Screenshot:** Pricing page overview
- [ ] Look for security features column in pricing comparison
- [ ] **Verify:** Each tier lists security features:
  - [ ] Encryption at rest (all tiers)
  - [ ] Encryption in transit (HTTPS, TLS)
  - [ ] API key-based authentication
  - [ ] Webhook signature verification
  - [ ] Audit trail logging
  - [ ] Data retention policies
- [ ] **Selector:** Feature comparison table cells
- [ ] **Screenshot:** Security features in pricing tiers
- [ ] Verify Enterprise tier shows additional security
- [ ] **Verify:** Enterprise includes: Custom encryption, IP whitelisting, SSO, advanced audit controls
- [ ] **Screenshot:** Enterprise security features
- [ ] **Pass/Fail:** ☐ Security features documented in pricing

---

### Step 3: API Security Review
**Action:** Navigate to and review API security documentation
- [ ] Click "Documentation" or "API Docs" link
- [ ] **Selector:** `a[href*="docs"]`
- [ ] **Verify:** API documentation loads
- [ ] **Screenshot:** API docs page
- [ ] Click on "Security" or "API Security" section
- [ ] **Selector:** API security section heading/link
- [ ] **Verify:** Security documentation appears
- [ ] **Screenshot:** API security documentation
- [ ] Review documentation sections:
  - [ ] Authentication (API keys)
  - [ ] HTTPS/TLS requirements
  - [ ] Rate limiting
  - [ ] Webhook security/signatures
  - [ ] Data encryption
  - [ ] Error handling/no data leakage
- [ ] **Selector:** Documentation sections
- [ ] **Screenshot:** Each security section
- [ ] **Pass/Fail:** ☐ API security documentation complete

---

### Step 4: Test CORS Headers
**Action:** Verify CORS headers are properly configured
- [ ] Open browser Developer Tools (F12)
- [ ] **Verify:** DevTools panel opens (usually bottom of screen)
- [ ] **Screenshot:** DevTools with Console and Network tabs visible
- [ ] Navigate to home page or any page on https://2b690a17.aegis-97g.pages.dev
- [ ] Open Network tab in DevTools
- [ ] Make a request to the page
- [ ] Find any successful API or request in Network tab
- [ ] Right-click and inspect request/response
- [ ] **Selector:** Network tab, any HTTP request
- [ ] Look for response headers
- [ ] **Verify:** Response headers visible in DevTools
- [ ] Check for CORS-related headers:
  - [ ] `Access-Control-Allow-Origin`: Should be specific domain, not "*"
  - [ ] `Access-Control-Allow-Methods`: Should list specific methods (GET, POST, etc.)
  - [ ] `Access-Control-Allow-Headers`: Should specify allowed headers
  - [ ] `Access-Control-Max-Age`: Should limit preflight cache
- [ ] **Screenshot:** CORS headers in Network inspector
- [ ] Test CORS from different origin (optional)
- [ ] Open browser console
- [ ] **Selector:** Console tab in DevTools
- [ ] Run JavaScript fetch from different origin:
```javascript
fetch('https://2b690a17.aegis-97g.pages.dev/api/v1/health', {
  method: 'GET',
  headers: {'Content-Type': 'application/json'}
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.log('CORS Error:', e))
```
- [ ] **Verify:** Either request succeeds with proper CORS, or blocked (expected)
- [ ] **Screenshot:** Console showing CORS test result
- [ ] **Pass/Fail:** ☐ CORS headers properly configured (restrictive)

---

### Step 5: Test CSP Headers
**Action:** Verify Content Security Policy headers prevent XSS
- [ ] In DevTools Network tab, find main page request (HTML document)
- [ ] Click to expand request details
- [ ] Look for response headers section
- [ ] **Verify:** `Content-Security-Policy` header present
- [ ] **Selector:** Response headers
- [ ] **Screenshot:** CSP header visible
- [ ] Check CSP policy content
- [ ] **Verify:** CSP includes directives like:
  - [ ] `default-src 'self'` (restricts to same origin)
  - [ ] `script-src 'self'` (only self-hosted scripts)
  - [ ] `style-src 'self' 'unsafe-inline'` (stylesheet sources)
  - [ ] `img-src 'self' data:` (image sources)
  - [ ] `font-src 'self'` (font sources)
  - [ ] `connect-src 'self'` (API connections to self)
  - [ ] Missing: `unsafe-inline` in script-src (good)
- [ ] **Screenshot:** Full CSP policy value
- [ ] Verify no overly permissive policies
- [ ] **Verify:** No `'unsafe-eval'` directive
- [ ] **Verify:** No wildcard `*` in critical directives
- [ ] **Pass/Fail:** ☐ CSP headers properly configured

---

### Step 6: Test XSS Injection in Search Field
**Action:** Attempt stored/reflected XSS attack to verify prevention
- [ ] Navigate to a page with search or input field
- [ ] Locate "Search Entity" or similar input field
- [ ] **Selector:** `input[type="search"]` or search field
- [ ] **Screenshot:** Search input field
- [ ] Click in search field
- [ ] Type XSS payload: `<script>alert('xss')</script>`
- [ ] **Verify:** Script tag appears in input field
- [ ] **Screenshot:** XSS payload entered in search field
- [ ] Press Enter or click Search button
- [ ] Wait 2-3 seconds
- [ ] **Verify:** NO alert dialog appears (XSS prevented)
- [ ] **Verify:** Page either shows "No results" or processes input safely
- [ ] **Screenshot:** Page after XSS attempt (no alert should appear)
- [ ] Check page source or DevTools console
- [ ] **Verify:** No JavaScript errors about malicious content
- [ ] Verify input is HTML-encoded in page
- [ ] **Verify:** If visible, search term shows as `&lt;script&gt;...&lt;/script&gt;` (encoded)
- [ ] **Screenshot:** Encoded input in page source/inspector
- [ ] Try another XSS vector in different field
- [ ] Enter: `<img src=x onerror="alert('xss')">`
- [ ] **Verify:** Again, no alert and input safely handled
- [ ] **Screenshot:** Second XSS attempt result
- [ ] **Pass/Fail:** ☐ XSS injections blocked successfully

---

### Step 7: Test SQL Injection in Entity Name Field
**Action:** Attempt SQL injection to verify input sanitization
- [ ] Navigate to entity screening form
- [ ] Click on "Full Name" or "Entity Name" input field
- [ ] **Selector:** `input[name="fullName"]` or entity name field
- [ ] Type SQL injection payload: `'; DROP TABLE alerts--`
- [ ] **Verify:** Payload entered in field
- [ ] **Screenshot:** SQL injection payload in field
- [ ] Click "Screen Entity" or Submit button
- [ ] **Verify:** Request processes (no immediate SQL error)
- [ ] **Screenshot:** Form submission with SQL payload
- [ ] Wait 2-3 seconds for response
- [ ] **Verify:** Request completes without SQL error messages
- [ ] **Verify:** Page shows normal "No results" or processing result
- [ ] **Verify:** NO database errors displayed (would indicate SQL injection vulnerability)
- [ ] **Screenshot:** Response page without SQL errors
- [ ] Try second SQL payload in different field
- [ ] Enter passport field: `123456' OR '1'='1`
- [ ] Submit form
- [ ] **Verify:** Treated as literal string, no SQL injection
- [ ] **Verify:** No records returned for this "passport"
- [ ] **Screenshot:** Second SQL injection attempt result
- [ ] Open DevTools console
- [ ] **Verify:** No SQL error traces in console
- [ ] **Screenshot:** Console clear of database errors
- [ ] **Pass/Fail:** ☐ SQL injection attempts blocked

---

### Step 8: Check HTTPS Enforcement
**Action:** Verify platform enforces HTTPS throughout
- [ ] Navigate to http://2b690a17.aegis-97g.pages.dev (note: HTTP, not HTTPS)
- [ ] **Verify:** Either connection refused OR auto-redirects to HTTPS
- [ ] **Screenshot:** Browser address bar showing HTTPS redirect result
- [ ] Check final URL in address bar
- [ ] **Verify:** Shows `https://` protocol
- [ ] Open DevTools Network tab
- [ ] Check HTTP response code for HTTP request
- [ ] **Verify:** Shows 301/302 redirect to HTTPS, or connection refused
- [ ] **Screenshot:** Network showing redirect response code
- [ ] Verify security protocol in DevTools
- [ ] Click lock icon in address bar
- [ ] **Verify:** Shows "Secure" and "HTTPS"
- [ ] **Screenshot:** Security indicator details
- [ ] Check TLS version
- [ ] **Verify:** Shows TLS 1.2 or higher (1.3 preferred)
- [ ] **Screenshot:** TLS version details
- [ ] Check certificate details
- [ ] **Verify:** Certificate valid (not expired)
- [ ] **Verify:** Certificate matches domain
- [ ] **Verify:** Certificate issued by trusted CA
- [ ] **Screenshot:** Certificate details
- [ ] **Pass/Fail:** ☐ HTTPS enforced with valid certificate

---

### Step 9: Test Rate Limiting
**Action:** Verify rate limiting prevents brute force/DoS attacks
- [ ] Open terminal/command line
- [ ] Send rapid API requests to test rate limiting
```bash
for i in {1..50}; do
  curl -s -X POST http://localhost:3001/api/v1/screen \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer invalid_key" \
    -d '{"entityType":"individual","fullName":"Test"}' \
    -w " %{http_code}" &
done
wait
```
- [ ] **Verify:** Requests sent rapidly (all in parallel)
- [ ] **Screenshot:** Terminal showing rapid request loop
- [ ] Monitor HTTP response codes
- [ ] **Verify:** Initial requests return 401 (bad auth) or 200 (if valid key)
- [ ] **Verify:** After ~10-20 requests, get 429 (Too Many Requests)
- [ ] **Screenshot:** Mix of status codes showing rate limiting kicks in
- [ ] Check response headers for rate limit info
```bash
curl -i -X GET http://localhost:3001/api/v1/health 2>/dev/null | grep -i "X-RateLimit"
```
- [ ] **Verify:** Response headers include rate limit info:
  - [ ] `X-RateLimit-Limit`: Max requests
  - [ ] `X-RateLimit-Remaining`: Requests left
  - [ ] `X-RateLimit-Reset`: Unix timestamp of reset
- [ ] **Screenshot:** Rate limit headers visible
- [ ] **Pass/Fail:** ☐ Rate limiting active and preventing abuse

---

### Step 10: Review Audit Trail Tamper-Evidence
**Action:** Verify audit trail cannot be modified after logging
- [ ] Navigate to an alert in the system
- [ ] Scroll to "Audit Trail" section
- [ ] **Verify:** Chronological log of all actions visible
- [ ] **Selector:** Audit trail entries
- [ ] **Screenshot:** Audit trail with multiple entries
- [ ] Check for immutability indicators:
  - [ ] NO "Edit" button on any audit entry
  - [ ] NO "Delete" button on any audit entry
  - [ ] NO "Modify" option
- [ ] **Verify:** Entries are read-only
- [ ] **Screenshot:** Audit entry showing no edit/delete buttons
- [ ] Check for tamper-evidence hash
- [ ] **Verify:** Each entry includes:
  - [ ] Timestamp (immutable)
  - [ ] User ID (immutable)
  - [ ] Action taken (immutable)
  - [ ] Hash or checksum of entry
- [ ] **Selector:** Hash/checksum field if present
- [ ] **Screenshot:** Audit entry with hash value
- [ ] Click on hash value
- [ ] **Verify:** Shows hash algorithm and value
- [ ] **Screenshot:** Hash details
- [ ] Open DevTools console
- [ ] Try to modify audit trail entry via JavaScript
```javascript
document.querySelectorAll('[class*="audit"]')[0].innerText = 'MODIFIED';
```
- [ ] **Verify:** Changes appear in DOM but don't persist
- [ ] Refresh page
- [ ] **Verify:** Audit trail back to original (changes didn't persist)
- [ ] **Screenshot:** Audit trail unchanged after page refresh
- [ ] **Pass/Fail:** ☐ Audit trail tamper-evident

---

### Step 11: Check Hash Chain Integrity
**Action:** Verify hash chain linking consecutive audit entries
- [ ] In audit trail section, find multiple consecutive entries
- [ ] **Verify:** Each entry shows:
  - [ ] Current hash: `H(n)`
  - [ ] Previous hash: `H(n-1)` (reference to prior entry)
- [ ] **Selector:** Hash fields in audit entries
- [ ] **Screenshot:** Hash chain showing H(n) and H(n-1) references
- [ ] Verify chain references:
  - [ ] Entry 3's "previous hash" = Entry 2's "current hash"
  - [ ] Entry 2's "previous hash" = Entry 1's "current hash"
- [ ] **Selector:** Previous hash reference field
- [ ] **Screenshot:** Linked hash values between entries
- [ ] Open terminal
- [ ] Attempt to verify hash manually (if API exposes hash verification):
```bash
curl -s http://localhost:3001/api/v1/alerts/[ALERT_ID]/audit \
  -H "Authorization: Bearer [API_KEY]" | jq '.auditTrail[0]'
```
- [ ] **Verify:** Response includes hash data
- [ ] **Screenshot:** Audit trail API response with hashes
- [ ] Check that hash algorithm is strong (SHA-256 or better)
- [ ] **Verify:** If documented, shows SHA-256 or SHA-512
- [ ] **Screenshot:** Hash algorithm documentation
- [ ] **Pass/Fail:** ☐ Hash chain integrity verified

---

### Step 12: Test API Key Rotation
**Action:** Verify ability to rotate API keys and old keys invalidate
- [ ] Log in to account dashboard
- [ ] Navigate to "API Keys" or "Credentials" section
- [ ] **Selector:** API keys management area
- [ ] **Verify:** Active API key listed
- [ ] **Screenshot:** Current API key visible
- [ ] Note current API key value: `sk_test_OLDKEY...`
- [ ] Click "Rotate Key" or "Generate New Key" button
- [ ] **Verify:** Rotation/generation dialog appears
- [ ] **Selector:** Key rotation dialog
- [ ] **Screenshot:** Key rotation prompt
- [ ] Confirm rotation
- [ ] **Verify:** New key generated: `sk_test_NEWKEY...`
- [ ] **Verify:** Old key shows as "Rotated" or "Inactive"
- [ ] **Screenshot:** Old and new keys displayed
- [ ] Test old key with API request
```bash
curl -X GET http://localhost:3001/api/v1/health \
  -H "Authorization: Bearer sk_test_OLDKEY..."
```
- [ ] **Verify:** Old key returns 401 Unauthorized
- [ ] **Screenshot:** 401 error for old key
- [ ] Test new key with same request
```bash
curl -X GET http://localhost:3001/api/v1/health \
  -H "Authorization: Bearer sk_test_NEWKEY..."
```
- [ ] **Verify:** New key returns 200 OK
- [ ] **Verify:** Request succeeds with new key
- [ ] **Screenshot:** 200 success with new key
- [ ] **Pass/Fail:** ☐ API key rotation working

---

### Step 13: Test Webhook Signature Verification
**Action:** Verify webhooks are cryptographically signed
- [ ] Navigate to Webhooks configuration section
- [ ] **Verify:** Webhook list visible with endpoints
- [ ] **Selector:** Webhooks management area
- [ ] **Screenshot:** Webhooks list
- [ ] Click to view webhook details
- [ ] **Verify:** Shows:
  - [ ] Webhook URL
  - [ ] Secret key (usually masked)
  - [ ] Events subscribed
  - [ ] Last triggered info
- [ ] **Selector:** Webhook details
- [ ] **Screenshot:** Webhook configuration details
- [ ] Look for webhook secret/signing key
- [ ] **Verify:** Secret is masked or can be revealed
- [ ] **Selector:** Secret field or reveal button
- [ ] Test webhook signature verification
- [ ] Trigger a screening to generate webhook event
- [ ] Set up local webhook receiver or inspect webhook request
- [ ] **Verify:** Webhook request includes signature header
- [ ] **Verify:** Header name like `X-Aegis-Signature` or `X-Webhook-Signature`
- [ ] Check signature format
- [ ] **Verify:** Format is typically `sha256=HEXVALUE` or similar
- [ ] **Screenshot:** Webhook request with signature header
- [ ] If possible, verify signature locally:
  - [ ] Extract payload body
  - [ ] Use webhook secret and HMAC-SHA256
  - [ ] Compute: `hmac_sha256(secret, body)`
  - [ ] Compare computed hash to header signature
- [ ] **Verify:** Signatures match (tamper-detection)
- [ ] **Screenshot:** Signature verification confirmation
- [ ] **Pass/Fail:** ☐ Webhook signatures implemented

---

### Step 14: Review Infrastructure Monitoring Page
**Action:** Check infrastructure health and monitoring capabilities
- [ ] Look for "Infrastructure" or "Health" monitoring page
- [ ] Check admin panel or Settings > Monitoring
- [ ] **Selector:** Admin or monitoring section link
- [ ] **Verify:** Infrastructure monitoring dashboard appears
- [ ] **Screenshot:** Infrastructure monitoring page
- [ ] Check monitoring components visible:
  - [ ] API Server Status: Should show "Healthy"
  - [ ] Database Connection: Should show "Connected"
  - [ ] Cache Service: Should show "Operational"
  - [ ] Message Queue: Should show "Running"
  - [ ] Webhook Service: Should show "Active"
- [ ] **Selector:** Service status indicators
- [ ] **Screenshot:** All infrastructure components visible
- [ ] Check for alerts or warnings
- [ ] **Verify:** No critical alerts showing
- [ ] **Verify:** Any warnings are minor/resolved
- [ ] **Screenshot:** Status of all services
- [ ] **Pass/Fail:** ☐ Infrastructure monitoring accessible and operational

---

### Step 15: Check API Response Times
**Action:** Monitor and verify API performance metrics
- [ ] In infrastructure monitoring or API docs, check performance SLA
- [ ] **Verify:** API response time targets documented:
  - [ ] Typical: < 500ms for screening endpoint
  - [ ] P99: < 2 seconds
  - [ ] P95: < 1 second
- [ ] **Selector:** Performance documentation section
- [ ] **Screenshot:** Performance SLA documentation
- [ ] Monitor actual response times
- [ ] Send API request and time response
```bash
time curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_VALIDKEY" \
  -d '{"entityType":"individual","fullName":"Test Entity"}'
```
- [ ] **Verify:** Total time shown by `time` command
- [ ] **Screenshot:** API response time output
- [ ] Send multiple requests and average
```bash
for i in {1..5}; do
  time curl -s -X POST http://localhost:3001/api/v1/screen ... > /dev/null
done
```
- [ ] **Verify:** Responses consistently under SLA
- [ ] **Verify:** Average response time < 1 second
- [ ] **Screenshot:** Multiple response time measurements
- [ ] **Pass/Fail:** ☐ API response times within SLA

---

### Step 16: Verify Error Responses Don't Leak Internal Details
**Action:** Test that error messages don't expose sensitive information
- [ ] Trigger various error conditions and check responses
- [ ] Test 1: Invalid entity type
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_VALIDKEY" \
  -d '{"entityType":"invalid_type","fullName":"Test"}'
```
- [ ] **Verify:** Response contains user-friendly error message
- [ ] **Verify:** NO database error details
- [ ] **Verify:** NO stack traces visible
- [ ] **Verify:** NO internal file paths shown
- [ ] **Verify:** NO SQL error details
- [ ] **Screenshot:** Error response format
- [ ] Test 2: Database error (if testable)
- [ ] Test 3: Authentication failure
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid" \
  -d '{"entityType":"individual","fullName":"Test"}'
```
- [ ] **Verify:** Returns `401 Unauthorized` without details about auth system
- [ ] **Verify:** Generic error message like "Invalid credentials"
- [ ] **Verify:** NO information about auth provider/system
- [ ] **Screenshot:** Auth error response
- [ ] Test 4: Rate limit exceeded
- [ ] Already tested in Step 9, verify 429 response is generic
- [ ] **Verify:** 429 response doesn't reveal rate limit algorithm
- [ ] **Screenshot:** 429 error response
- [ ] **Pass/Fail:** ☐ Error responses properly sanitized

---

## Summary
- [ ] All 16 security tests completed
- [ ] Security badges and certifications verified
- [ ] CORS headers properly configured
- [ ] CSP headers prevent XSS attacks
- [ ] XSS injection attempts blocked
- [ ] SQL injection attempts blocked
- [ ] HTTPS enforced with valid certificate
- [ ] Rate limiting prevents abuse
- [ ] Audit trail is tamper-evident
- [ ] Hash chain integrity verified
- [ ] API key rotation functional
- [ ] Webhook signatures verified
- [ ] Infrastructure monitoring accessible
- [ ] API response times within SLA
- [ ] Error messages don't leak sensitive details

**Overall Result:** ☐ PASS / ☐ FAIL

**Security Assessment Notes:**

**Critical Findings:** (If any)

**High Priority Issues:** (If any)

**Medium Priority Recommendations:** (If any)

**Compliance Status:**
- [ ] SOC 2 Type II Compliant
- [ ] ISO 27001 Certified
- [ ] PCI DSS Compliant
- [ ] GDPR Compliant

**Overall Security Rating:** ☐ PASS / ☐ FAIL / ☐ CONDITIONAL

**Recommendations for Enterprise Deployment:**
