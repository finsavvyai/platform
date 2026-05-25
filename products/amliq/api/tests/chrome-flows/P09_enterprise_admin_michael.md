# Test Flow P09: Enterprise IT Administrator - Michael Chang

## Persona Profile
- **Name:** Michael Chang
- **Role:** Enterprise IT Administrator / System Administrator
- **Company:** GlobalBank International
- **Experience Level:** Advanced (10+ years IT ops, 4+ years SaaS admin)
- **Key Goals:** Deploy AMLIQ enterprise-wide, manage infrastructure, secure API access, monitor system health, configure webhooks
- **Technical Proficiency:** Very High (comfortable with APIs, webhooks, infrastructure monitoring)
- **Focus Areas:** Multi-tenancy, API key rotation, webhook security, system monitoring, data sync

## Prerequisites
- AMLIQ deployed at https://2b690a17.aegis-97g.pages.dev
- API available at http://localhost:3001/api/v1
- Enterprise admin account with full system access
- LemonSqueezy webhook URL: https://billing-webhooks.example.com/aegis
- Chrome browser with DevTools open
- System logs and infrastructure metrics accessible

## Test Flow: Enterprise Deployment & System Administration

### Step 1: Login as Enterprise Admin
- **Action:** Navigate to https://2b690a17.aegis-97g.pages.dev → Click "Login" → Email: michael.chang@globalbank.com → Password: EntAdmin#Secure2026 → "Sign In"
- **Expected Result:** Dashboard loads with "Michael Chang", "Enterprise Admin" badge. Admin-specific menu items visible (System, Infrastructure, API Management, Webhooks).
- **Verify:** URL = /dashboard, role badge present, admin sections accessible
- **Screenshot:** Take dashboard with admin role
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 2: Dashboard Overview - Monitoring Metrics
- **Action:** View Dashboard page → Locate "System Health" section with 4 metrics: API Response Time, DB Connection, Cache Hit Rate, Last Sync
- **Expected Result:** Displays: API Response Time: 145ms, DB Connection: 18/20 active, Cache Hit Rate: 94.2%, Last Sync: 2 hours ago. Status: GREEN / ALL SYSTEMS OPERATIONAL.
- **Verify:** All 4 metrics visible with current values, color coding shows health
- **Screenshot:** Take system health section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 3: Navigate to Sanctions Lists Page
- **Action:** Click "Sanctions Lists" in left sidebar → Wait for page load
- **Expected Result:** Sanctions Lists management page with table: Source Name, Entry Count, Last Sync, Next Sync, Status, Actions
- **Verify:** Page loads completely, all columns aligned
- **Screenshot:** Take full sanctions lists page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 4: Review All 9 Sanctions List Sources
- **Action:** Scroll through lists table → Verify all 9 present: OFAC, EU, UN, UK OFSI, SECO, Israeli MoD, SDFM, OpenSanctions, Custom
- **Expected Result:** All 9 lists visible with accurate entry counts and sync status
- **Verify:** Count = 9, all have entry counts > 0, recent syncs
- **Screenshot:** Take full table
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 5: Check Entry Counts and Last Sync
- **Action:** Verify for each list: entry count and last sync timestamp are recent (within 48 hours except Custom)
- **Expected Result:** OFAC: 2,847 entries (2026-03-26 12:00 UTC), EU: 1,523 (14:30), UN: 891 (11:15), UK OFSI: 645 (2026-03-25 18:00), SECO: 234 (10:00), Israeli MoD: 849 (15:32), SDFM: 512 (2026-03-24 09:00), OpenSanctions: 15,892 (08:00), Custom: 156 (2026-03-20 13:45)
- **Verify:** All counts reasonable, syncs recent
- **Screenshot:** Take table with counts and sync times
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 6: Trigger Sync on OFAC List
- **Action:** Locate OFAC row → Click "Sync Now" → Confirm in modal
- **Expected Result:** Sync initiates with progress: "Syncing... 0%" → "100%". Message: "OFAC updated: +12 new, -3 removed. Total: 2,856. Updated: 2026-03-26 16:15:42 UTC. Time: 2m 34s."
- **Verify:** Sync completes < 5 minutes, entry count updates, timestamp current
- **Screenshot:** Take completion message
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 7: Trigger Sync on EU List
- **Action:** Locate EU list row → Click "Sync Now" → Confirm
- **Expected Result:** EU syncs. Message: "EU updated: +5 new, -2 removed. Total: 1,526. Updated: 2026-03-26 16:18:15 UTC."
- **Verify:** Sync successful, entry count updates
- **Screenshot:** Take EU completion
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 8: Import Custom Sanctions List
- **Action:** Click "Import Custom List" → Select CSV file with custom sanctions data (10 test entries) → Wait for upload
- **Expected Result:** File upload completes. Message: "Custom list updated: +10 entries (all new). Total: 166. Updated: 2026-03-26 16:20:00 UTC."
- **Verify:** File uploads, entries merge, count increments correctly
- **Screenshot:** Take import completion
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 9: Navigate to Configuration Page (Admin View)
- **Action:** Click "Configuration" in left sidebar → Wait for page load
- **Expected Result:** Configuration page displays sections: Regulatory Presets, Threshold Settings, Multi-Tenant Configuration, API Key Management, Webhook Configuration, Rate Limiting, System Settings
- **Verify:** All admin sections visible
- **Screenshot:** Take full configuration page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 10: Set Up Multi-Tenant Config
- **Action:** In "Multi-Tenant Setup" section, click "Enable Multi-Tenancy" → Define: Tenant 1: "GlobalBank-US", Tenant 2: "GlobalBank-EU", Tenant 3: "GlobalBank-APAC" → "Save Configuration"
- **Expected Result:** Message: "Multi-tenancy enabled. 3 tenants configured. Each tenant isolated." All 3 tenants listed.
- **Verify:** All 3 tenants created, isolation confirmed
- **Screenshot:** Take configuration saved
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 11: Test Tenant Isolation
- **Action:** Switch to Tenant 1 → Screening "Test User 1" → Note result ID → Switch to Tenant 2 → Search for result from Tenant 1
- **Expected Result:** Result NOT found in Tenant 2. "Not Found" or permission denied message. Data isolation confirmed.
- **Verify:** Results not cross-visible, isolation working
- **Screenshot:** Take "not found" message
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 12: Generate New API Key
- **Action:** In API Key Management, click "Generate New API Key" → Name: "GlobalBank-Production-Key" → Permissions: ["screen:read", "screen:write", "lists:read", "audit:read"] → "Generate"
- **Expected Result:** New key: "aegis_api_sk_[64 random chars]". Warning: "Save this key securely. Won't be able to view again." Copy button available.
- **Verify:** Key has correct prefix, 64 chars, shown once
- **Screenshot:** Take key generation with key visible
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 13: Rotate API Key
- **Action:** Find generated key in list → Click "Rotate Key" → Confirm modal
- **Expected Result:** Old key deactivated immediately. New key generated: "aegis_api_sk_[different 64 chars]". Message: "Key rotated. Old key deactivated. New key activated. Old key revoked in 48 hours (grace period)."
- **Verify:** New key format correct, old shows "Deactivated (48h grace)"
- **Screenshot:** Take rotated key list
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 14: Revoke Old API Key
- **Action:** Before 48h grace expires, find old deactivated key → Click "Revoke Immediately" → Confirm in warning modal
- **Expected Result:** Status changes to "Revoked". Message: "Key revoked immediately. No longer valid. API calls return 401 Unauthorized."
- **Verify:** Status shows "Revoked", timestamp recorded
- **Screenshot:** Take revoked key status
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 15: Test Webhook Configuration
- **Action:** In Webhooks section, click "Add Webhook" → URL: https://billing-webhooks.example.com/aegis → Events: Select all → Security: "HMAC-SHA256" → "Save Webhook"
- **Expected Result:** Webhook registered. Message: "Webhook registered. HMAC secret generated: [secret]." Webhook shows "Active".
- **Verify:** Webhook stored, events selected, security set, secret provided
- **Screenshot:** Take webhook created with secret
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 16: Set Up LemonSqueezy Webhook URL
- **Action:** Verify webhook URL set for LemonSqueezy → Click "Send Test Webhook"
- **Expected Result:** Test webhook sent. External receiver gets POST to https://billing-webhooks.example.com/aegis with {test: true, timestamp, signature}. Message: "Test webhook sent successfully."
- **Verify:** HTTP 200 response, signature header included
- **Screenshot:** Take test confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 17: Verify HMAC-SHA256 Signature Validation
- **Action:** Capture sent webhook request → Verify HMAC-SHA256 signature header → Manually compute signature → Compare
- **Expected Result:** Received signature matches computed signature. Header: "X-AMLIQ-Signature: sha256=[hex_hash]"
- **Verify:** Signature algorithm SHA256, computation correct
- **Screenshot:** Take webhook header with signature
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 18: Check System Health Endpoint
- **Action:** Open DevTools Network → Navigate to /api/v1/health (or curl command)
- **Expected Result:** HTTP 200 response with JSON: {status: "healthy", timestamp, version: "2.0.1", database: {status: "ok", latency_ms: 12}, cache: {status: "ok", latency_ms: 2}, api: {status: "ok", response_time_ms: 145}, uptime_minutes: 14256, memory_mb: 512, cpu_percent: 34.2}
- **Verify:** Status = "healthy", all subsystems "ok", reasonable response time
- **Screenshot:** Take health endpoint response
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 19: Review Batch Job Queue
- **Action:** Click "Batch Jobs" in sidebar → View list of batch jobs
- **Expected Result:** Shows: Job ID, Status, Created, Started, Completed, Record Count, Results. Example: Job 001: COMPLETED | 2026-03-26 10:00 | 10:01 | 10:15 | 5,000 records | 847 matches
- **Verify:** Jobs listed in order, statuses accurate, counts visible
- **Screenshot:** Take batch jobs list
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 20: Create New Batch Screening Job
- **Action:** Click "Create Batch Job" → Upload CSV (1,000 test entities) → Name: "GlobalBank-Quarterly-Screening" → Mode: "High Throughput" → "Submit Job"
- **Expected Result:** Job created: "BATCH-20260326-001". Message: "Job submitted. Est. time: 8 minutes for 1,000 records. Queue position: 2."
- **Verify:** Job ID generated, confirmation received, appears in queue
- **Screenshot:** Take confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 21: Monitor Batch Job Progress
- **Action:** View job BATCH-20260326-001 → Observe progress → Wait 30 seconds → Refresh → Check progress updates
- **Expected Result:** Progress shown: Initial "0% (0 / 1,000)", After refresh "15% (150 / 1,000) | Elapsed: 1m 45s | Est. Remaining: 12m 15s"
- **Verify:** Progress increments correctly, time estimates update
- **Screenshot:** Take progress update
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 22: Check Infrastructure Monitoring
- **Action:** Navigate to Admin → Infrastructure Monitoring → View all metrics
- **Expected Result:** Shows: API Requests: 250/sec, DB Connections: 18/20, Cache Memory: 412MB / 1GB (41%), Disk Usage: 150GB / 500GB (30%), Network I/O: 85 Mbps out, 42 Mbps in. All green status.
- **Verify:** All metrics visible, thresholds not exceeded, no alerts
- **Screenshot:** Take metrics dashboard
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 23: Review Rate Limit Configuration
- **Action:** In Configuration → Rate Limiting section → Verify settings
- **Expected Result:** Shows: Standard API: 100 req/min, Enterprise API: 1,000 req/min, Batch API: 10 jobs/hr
- **Verify:** Limits configured, values reasonable, admin can edit
- **Screenshot:** Take rate limit configuration
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 24: Export Full Audit Trail
- **Action:** Navigate to Audit → Click "Export Audit Trail" → Format: "JSON" → Date Range: "Last 30 days" → "Export"
- **Expected Result:** Download initiated: "AMLIQ_Audit_Trail_2026-02-25_to_2026-03-26.json". Contains all actions: timestamp, user, action, resource, details, IP, status, hash.
- **Verify:** File downloads, format valid JSON, entries chronological
- **Screenshot:** Take export confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

## Test Summary

**Total Steps:** 24

**Pass Criteria:**
- All 24 steps complete without errors
- All 9 sanctions lists synced and accessible
- API key generation, rotation, revocation functional
- Multi-tenancy properly isolates data
- Webhook configured with HMAC-SHA256 security
- Batch job processing successful
- Infrastructure metrics within healthy thresholds
- Audit trails exportable with hash chain

**Enterprise Administration Checklist:**
- ☐ System deployed for 3+ tenants
- ☐ API keys generated with secure prefix
- ☐ Webhooks configured with HMAC-SHA256
- ☐ All 9 sanctions lists synced within 48 hours
- ☐ Batch processing handles 1,000+ records
- ☐ Infrastructure metrics monitored continuously
- ☐ Rate limiting enforced at API level
- ☐ Audit trail immutable and exportable
- ☐ Multi-tenant data isolation verified
- ☐ Health endpoints operational

**Security Checklist:**
- ☐ API keys follow naming convention (aegis_api_sk_)
- ☐ Keys are 64 random characters
- ☐ Key rotation immediate with 48hr grace
- ☐ HMAC signatures validated on webhooks
- ☐ Multi-tenant data cannot access cross-tenant
- ☐ All admin actions logged with user/IP/timestamp
- ☐ No plaintext secrets in logs

**Notes:**
- Admins monitor system health daily
- Batch jobs reviewed for performance
- API key rotation enforced quarterly
- Webhook endpoints HTTPS with valid SSL
- Audit trails retained minimum 7 years
