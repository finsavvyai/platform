# AMLIQ AML Platform - Test Flow P02
## Persona: Alex Rodriguez - Senior Backend Developer

### Persona Profile
- **Name:** Alex Rodriguez
- **Role:** Senior Backend Developer
- **Company:** PayFlow Fintech (50 employees, Series B startup)
- **Experience Level:** 8 years software development, strong API integration experience
- **Goals:** Integrate AMLIQ screening into payment platform; evaluate API reliability and performance
- **Success Criteria:** Complete API integration flow, test rate limiting, validate webhook setup, verify SDK documentation

---

## Prerequisites
- [ ] Chrome browser with Developer Tools open
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] Terminal/command line access for curl commands
- [ ] API endpoint http://localhost:3001/api/v1 is accessible and running
- [ ] Postman or similar REST client optional but recommended

---

## Test Flow Steps

### Step 1: API Documentation Review
**Action:** Navigate to and review complete API documentation
- [ ] Click "Documentation" or "API Docs" link in main navigation
- [ ] **Selector:** `a[href*="docs"]` or `a:contains("API")`
- [ ] **Verify:** API documentation page loads
- [ ] **Screenshot:** API docs homepage
- [ ] Check left sidebar for API endpoint categories
- [ ] **Verify:** See sections for:
  - [ ] Authentication
  - [ ] Screening Endpoints
  - [ ] Alert Management
  - [ ] Webhooks
  - [ ] Rate Limiting
  - [ ] Error Handling
- [ ] **Screenshot:** API docs sidebar
- [ ] Click on "Screening Endpoints" section
- [ ] **Verify:** POST /api/v1/screen endpoint documented with:
  - [ ] Request body schema
  - [ ] Response schema
  - [ ] Example curl/code samples
  - [ ] Rate limit info
- [ ] **Selector:** `code` blocks with examples
- [ ] **Screenshot:** POST /screen endpoint documentation
- [ ] Review "Authentication" section
- [ ] **Verify:** Documentation shows API key required in header
- [ ] **Verify:** Header format shown: `Authorization: Bearer API_KEY`
- [ ] **Screenshot:** Authentication section
- [ ] **Pass/Fail:** ☐ API documentation complete and clear

---

### Step 2: Pricing Page - API Product Tab
**Action:** Review API-specific pricing and tier information
- [ ] Click "Pricing" in main navigation
- [ ] **Selector:** `a[href*="pricing"]` or `a:contains("Pricing")`
- [ ] **Verify:** Pricing page loads with product tabs/cards visible
- [ ] **Screenshot:** Pricing page overview
- [ ] Look for "API" or "API Starter" product tab/card
- [ ] **Verify:** See distinct API tier from web/dashboard tier
- [ ] Click on API product tab or card to focus on API pricing
- [ ] **Verify:** API pricing section highlights
- [ ] **Screenshot:** API pricing section
- [ ] Check pricing table displays:
  - [ ] API Starter tier
  - [ ] API Growth tier
  - [ ] API Enterprise tier (or similar)
- [ ] **Verify:** Each tier shows monthly price
- [ ] **Screenshot:** API tier options
- [ ] **Pass/Fail:** ☐ API pricing clearly displayed

---

### Step 3: Check API Tier Limits
**Action:** Review rate limits and request quotas for each API tier
- [ ] Scroll down on Pricing page or click "View Details" for API section
- [ ] **Verify:** Tier comparison table appears
- [ ] **Screenshot:** Tier comparison table
- [ ] Check columns for:
  - [ ] Requests per month
  - [ ] Requests per second (rate limit)
  - [ ] Max batch size
  - [ ] Webhook support
  - [ ] Priority support
- [ ] **Selector:** `td` or `span[class*="limit"]`
- [ ] **Screenshot:** Detailed limits/features row
- [ ] Verify each tier shows escalating limits
- [ ] **Verify:** Example: Starter: 10K/mo, 10 RPS; Growth: 100K/mo, 50 RPS; Enterprise: Unlimited
- [ ] **Pass/Fail:** ☐ API tier limits clearly defined

---

### Step 4: Sign Up for API Starter Tier
**Action:** Create account and select API Starter tier
- [ ] Locate "Get Started" or "Sign Up" CTA on pricing page
- [ ] **Selector:** `button:contains("Get Started")` on API Starter card
- [ ] Click to initiate signup
- [ ] **Verify:** Signup form appears or redirects to signup page
- [ ] **Screenshot:** API signup form
- [ ] Enter email: `alex.rodriguez.dev@payflow.io`
- [ ] **Selector:** `input[type="email"]`
- [ ] Enter password: `FinTechAPI123!@#`
- [ ] **Selector:** `input[type="password"]`
- [ ] Enter company: `PayFlow Fintech`
- [ ] **Selector:** `input[placeholder*="Company"]`
- [ ] Select product tier: `API Starter`
- [ ] **Selector:** `radio[value="api-starter"]` or similar
- [ ] Accept Terms of Service checkbox
- [ ] **Selector:** `input[type="checkbox"]`
- [ ] Click "Create Account" button
- [ ] **Verify:** Account created, redirected to API dashboard
- [ ] **Screenshot:** API dashboard post-signup
- [ ] **Pass/Fail:** ☐ API Starter account created successfully

---

### Step 5: Get API Key
**Action:** Generate and retrieve API key for making requests
- [ ] On API dashboard, look for "API Keys" or "Credentials" section
- [ ] **Selector:** Section heading or sidebar link
- [ ] **Verify:** API key management interface appears
- [ ] **Screenshot:** API keys section
- [ ] Check for existing keys or "Generate New Key" button
- [ ] Click "Generate New Key" or "Create API Key"
- [ ] **Selector:** `button:contains("Generate")` or similar
- [ ] **Verify:** API key generation dialog appears
- [ ] **Screenshot:** Key generation dialog
- [ ] Enter key name/label: `PayFlow-Integration-Dev`
- [ ] **Selector:** `input[name="keyName"]`
- [ ] Optionally select environment: `Development`
- [ ] Click "Create Key" button
- [ ] **Verify:** Key is displayed (appears only once)
- [ ] **Screenshot:** Generated API key displayed
- [ ] Copy key value to clipboard or note it: `sk_test_XXXXXXXXXXXX`
- [ ] **Verify:** Copy button visible or key selectable
- [ ] Confirm key appears in key list below
- [ ] **Verify:** Key listed with creation date and status "Active"
- [ ] **Screenshot:** Key in active keys list
- [ ] **Pass/Fail:** ☐ API key generated and retrieved

---

### Step 6: Test POST /api/v1/screen with curl
**Action:** Execute direct API call to screen an individual
- [ ] Open terminal/command line
- [ ] **Verify:** Command line ready for curl command
- [ ] Execute curl command to test basic screening:
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_XXXXXXXXXXXX" \
  -d '{
    "entityType": "individual",
    "fullName": "Mohammad Al-Rahman",
    "dateOfBirth": "1975-03-15",
    "country": "Syria",
    "passportNumber": "SYR-8847721"
  }'
```
- [ ] **Verify:** Request sent successfully (no connection errors)
- [ ] **Screenshot:** Terminal showing curl command and response
- [ ] Check response status code
- [ ] **Verify:** Response code is 200 (OK) or 201 (Created)
- [ ] **Verify:** Response body contains JSON with:
  - [ ] `"screeningId"`: Unique identifier
  - [ ] `"status"`: "COMPLETED" or "PROCESSING"
  - [ ] `"riskScore"`: Numerical value
  - [ ] `"matchFound"`: Boolean
  - [ ] `"matches"`: Array with match objects
- [ ] **Selector:** JSON in response body
- [ ] **Screenshot:** API response JSON
- [ ] **Pass/Fail:** ☐ POST /screen API working correctly

---

### Step 7: Test Batch Screening
**Action:** Submit multiple entities in single batch request
- [ ] Prepare batch request with multiple entities
```bash
curl -X POST http://localhost:3001/api/v1/screen/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_XXXXXXXXXXXX" \
  -d '{
    "screenings": [
      {
        "entityType": "individual",
        "fullName": "Alexei Petrov",
        "passportNumber": "RUS-55219938",
        "country": "Russia"
      },
      {
        "entityType": "company",
        "companyName": "Golden Dragon Trading Co.",
        "country": "China",
        "businessRegistry": "BRG-2847"
      },
      {
        "entityType": "individual",
        "fullName": "Maria Santos",
        "country": "Brazil"
      }
    ]
  }'
```
- [ ] **Verify:** Batch request sent successfully
- [ ] **Screenshot:** Batch curl command and response
- [ ] Check response status
- [ ] **Verify:** Status 200-201 indicating successful batch processing
- [ ] Verify response contains:
  - [ ] `"batchId"`: Batch identifier
  - [ ] `"screenings"`: Array with results for each entity
  - [ ] Each result has: `screeningId`, `status`, `riskScore`, `matchFound`
- [ ] **Screenshot:** Batch API response
- [ ] Verify all 3 entities processed
- [ ] **Verify:** Response shows exactly 3 screening results
- [ ] **Pass/Fail:** ☐ Batch screening API working

---

### Step 8: Check Rate Limiting (100+ Requests)
**Action:** Test API rate limiting by sending rapid requests
- [ ] Create script to send 100+ requests rapidly to test rate limit
```bash
for i in {1..110}; do
  curl -X POST http://localhost:3001/api/v1/screen \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer sk_test_XXXXXXXXXXXX" \
    -d '{"entityType":"individual","fullName":"Test User '$i'"}' \
    -w "\n%{http_code}\n" \
    2>/dev/null
done
```
- [ ] Execute script to send rapid requests
- [ ] **Verify:** First ~10 requests return 200 (within rate limit)
- [ ] **Verify:** Subsequent requests start returning different status codes
- [ ] Monitor output for 429 or rate limit responses
- [ ] **Screenshot:** Terminal showing mix of 200 and 429 status codes
- [ ] **Pass/Fail:** ☐ Rate limiting mechanism triggered

---

### Step 9: Verify 429 Response
**Action:** Confirm rate limit response format and headers
- [ ] Send single request after rate limit exceeded
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_XXXXXXXXXXXX" \
  -d '{"entityType":"individual","fullName":"Rate Limit Test"}' \
  -i
```
- [ ] **Verify:** Response includes `-i` flag to show headers
- [ ] **Screenshot:** Full response with headers and body
- [ ] Check HTTP status line
- [ ] **Verify:** Shows `HTTP/1.1 429 Too Many Requests`
- [ ] Check response headers for rate limit info:
  - [ ] `X-RateLimit-Limit`: Max requests in period
  - [ ] `X-RateLimit-Remaining`: Requests remaining
  - [ ] `X-RateLimit-Reset`: Unix timestamp when limit resets
  - [ ] `Retry-After`: Seconds to wait before retry
- [ ] **Screenshot:** 429 response headers detail
- [ ] Check response body for error message
- [ ] **Verify:** Body contains error message about rate limit
- [ ] **Selector:** JSON error response structure
- [ ] **Screenshot:** 429 error response body
- [ ] **Pass/Fail:** ☐ 429 response properly formatted

---

### Step 10: Test Invalid API Key
**Action:** Verify API rejects invalid/missing authentication
- [ ] Send request with invalid/missing API key
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_key_12345" \
  -d '{"entityType":"individual","fullName":"Test"}' \
  -i
```
- [ ] **Verify:** Request sent with bad API key
- [ ] **Screenshot:** Curl command and response
- [ ] Check HTTP status
- [ ] **Verify:** Returns 401 (Unauthorized) or 403 (Forbidden)
- [ ] Check response body
- [ ] **Verify:** Contains error message about invalid API key
- [ ] **Screenshot:** 401/403 error response
- [ ] Send request with no Authorization header
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -d '{"entityType":"individual","fullName":"Test"}'
```
- [ ] **Verify:** Request sent without auth header
- [ ] Check response status
- [ ] **Verify:** Returns 401 or similar authentication error
- [ ] **Screenshot:** Missing auth header error response
- [ ] **Pass/Fail:** ☐ API properly rejects invalid authentication

---

### Step 11: Test Malformed JSON Body
**Action:** Verify API validates request body structure
- [ ] Send request with malformed JSON (missing closing brace)
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_XXXXXXXXXXXX" \
  -d '{"entityType":"individual","fullName":"Test"'
```
- [ ] **Verify:** Request sent with invalid JSON
- [ ] **Screenshot:** Malformed JSON curl command
- [ ] Check response status
- [ ] **Verify:** Returns 400 (Bad Request)
- [ ] Check response body
- [ ] **Verify:** Contains error about invalid JSON
- [ ] **Screenshot:** JSON parse error response
- [ ] Send request with missing required field
```bash
curl -X POST http://localhost:3001/api/v1/screen \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_XXXXXXXXXXXX" \
  -d '{"entityType":"individual"}'
```
- [ ] **Verify:** Required `fullName` field missing
- [ ] Check response status
- [ ] **Verify:** Returns 400 or 422 (validation error)
- [ ] Check response body
- [ ] **Verify:** Error message indicates missing required field
- [ ] **Screenshot:** Validation error response
- [ ] **Pass/Fail:** ☐ API validates request body properly

---

### Step 12: Check Webhook Setup
**Action:** Configure and test webhook functionality
- [ ] Navigate to API dashboard/settings
- [ ] Click "Webhooks" or "Webhook Configuration" section
- [ ] **Selector:** Sidebar link or settings tab
- [ ] **Verify:** Webhook management page appears
- [ ] **Screenshot:** Webhooks page
- [ ] Click "Add Webhook" or "Create Webhook"
- [ ] **Selector:** `button:contains("Add")` or similar
- [ ] **Verify:** Webhook creation form appears
- [ ] **Screenshot:** Webhook creation form
- [ ] Enter webhook URL: `http://localhost:5000/webhooks/aegis`
- [ ] **Selector:** `input[name="webhookUrl"]` or similar
- [ ] Select events to subscribe to:
  - [ ] Check "screening.completed"
  - [ ] Check "alert.created"
  - [ ] Check "alert.resolved"
- [ ] **Selector:** `input[type="checkbox"]`
- [ ] **Screenshot:** Events selected
- [ ] Optional: Enter webhook secret for HMAC verification
- [ ] **Selector:** `input[name="webhookSecret"]`
- [ ] Click "Create Webhook"
- [ ] **Verify:** Webhook created and appears in list
- [ ] **Screenshot:** Webhook in active webhooks list
- [ ] Check webhook includes:
  - [ ] Webhook URL
  - [ ] Status (Active/Inactive)
  - [ ] Events subscribed
  - [ ] Last triggered timestamp
- [ ] **Verify:** Status shows "Active"
- [ ] **Pass/Fail:** ☐ Webhook created and configured

---

### Step 13: Test /health Endpoint
**Action:** Verify API health check endpoint
- [ ] Send GET request to health endpoint
```bash
curl http://localhost:3001/api/v1/health
```
- [ ] **Verify:** Request succeeds (no connection errors)
- [ ] **Screenshot:** Health check curl and response
- [ ] Check response status
- [ ] **Verify:** Returns 200 (OK)
- [ ] Check response body
- [ ] **Verify:** Contains:
  - [ ] `"status": "healthy"` or `"ok"`
  - [ ] `"timestamp"`: Current server time
  - [ ] `"version"`: API version number
  - [ ] `"uptime"`: Server uptime seconds
  - [ ] `"services"`: Sub-service status (DB, Cache, etc.)
- [ ] **Screenshot:** Full health response JSON
- [ ] Verify all services show "operational" or "healthy"
- [ ] **Verify:** Database connection status "OK"
- [ ] **Pass/Fail:** ☐ Health endpoint operational

---

### Step 14: Review SDK Documentation
**Action:** Check SDK availability and integration guides
- [ ] Navigate to API documentation
- [ ] Look for "SDKs" or "Client Libraries" section
- [ ] **Selector:** Link or heading for SDK docs
- [ ] **Verify:** SDKs available for multiple languages
- [ ] **Screenshot:** SDK options list
- [ ] Check for supported languages:
  - [ ] Python
  - [ ] JavaScript/Node.js
  - [ ] Java
  - [ ] Go
  - [ ] Ruby
- [ ] Click on "JavaScript" or "Node.js" SDK
- [ ] **Verify:** SDK documentation page loads
- [ ] **Screenshot:** JavaScript SDK docs
- [ ] Check documentation includes:
  - [ ] Installation instructions (`npm install`)
  - [ ] Authentication example
  - [ ] Basic usage example
  - [ ] Full API reference
- [ ] **Selector:** Code blocks with examples
- [ ] **Screenshot:** SDK installation and usage example
- [ ] Look for GitHub link to SDK repository
- [ ] **Verify:** GitHub repo link present
- [ ] **Pass/Fail:** ☐ SDK documentation complete

---

### Step 15: Check iFrame Widget Embed Code
**Action:** Review embeddable screening widget for web integration
- [ ] In API documentation, look for "iFrame Widget" or "Embedded Widget"
- [ ] **Selector:** Section heading or documentation link
- [ ] **Verify:** Widget documentation appears
- [ ] **Screenshot:** iFrame widget section
- [ ] Check for embed code example
- [ ] **Verify:** See HTML snippet showing:
```html
<iframe src="https://2b690a17.aegis-97g.pages.dev/widget?api_key=sk_test_XXX"></iframe>
```
- [ ] **Screenshot:** iFrame embed code example
- [ ] Review widget customization options
- [ ] **Verify:** Documentation shows:
  - [ ] Size/dimensions configuration
  - [ ] Theme/styling options
  - [ ] Callback function setup
  - [ ] Event handling
- [ ] **Screenshot:** Widget customization docs
- [ ] Check for working demo/preview
- [ ] **Verify:** Interactive widget preview visible
- [ ] Test widget in preview
- [ ] Click "Screen Entity" in embedded widget
- [ ] **Verify:** Widget form appears in iFrame
- [ ] Enter test data: `John Smith`
- [ ] **Verify:** Widget processes request
- [ ] **Screenshot:** Widget working in preview
- [ ] **Pass/Fail:** ☐ iFrame widget documented and functional

---

## Summary
- [ ] All 15 steps completed
- [ ] API documentation reviewed comprehensively
- [ ] API key generated and retrieved
- [ ] Direct API calls tested with curl
- [ ] Batch screening verified
- [ ] Rate limiting tested and 429 response verified
- [ ] Authentication validation confirmed
- [ ] Request body validation verified
- [ ] Webhooks configured
- [ ] Health endpoint operational
- [ ] SDK and widget documentation complete

**Overall Result:** ☐ PASS / ☐ FAIL

**Notes/Issues:**
