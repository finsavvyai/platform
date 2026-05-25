# P11: Comprehensive API Integration Test Suite

**Objective:** Validate all API endpoints with various inputs, auth scenarios, rate limiting, CORS, and content types.

**Base URLs:** Site: https://2b690a17.aegis-97g.pages.dev | API: http://localhost:3001/api/v1

---

## 1. Authentication Header Tests

### 1.1 Valid API Key
- [ ] Run: `fetch('http://localhost:3001/api/v1/config', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json()).then(d => console.log('Status:', d.status))`
- [ ] Expected: HTTP 200 with valid config

### 1.2 Missing API Key Header
- [ ] Run: `fetch('http://localhost:3001/api/v1/config').then(r => {console.log('Status:', r.status); return r.json();})`
- [ ] Expected: HTTP 401 with "Unauthorized"

### 1.3 Invalid API Key
- [ ] Run: `fetch('http://localhost:3001/api/v1/config', {headers: {'X-API-Key': 'invalid-key'}}).then(r => r.json()).then(d => console.log(d))`
- [ ] Expected: HTTP 401

### 1.4 Wrong Product Prefix
- [ ] Run: `fetch('http://localhost:3001/api/v1/config', {headers: {'X-API-Key': 'wrong_prefix_key'}}).then(r => r.json())`
- [ ] Expected: HTTP 403 with "Invalid product"

---

## 2. POST /api/v1/screen — Screening Submission

### 2.1 Valid Request
- [ ] Run: `fetch('http://localhost:3001/api/v1/screen', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345'}, body: JSON.stringify({entityName: 'John Doe', entityType: 'individual', jurisdictions: ['US']})}).then(r => r.json()).then(d => console.log('Created:', d.id))`
- [ ] Expected: HTTP 201 with screening ID

### 2.2 Missing entityName
- [ ] Run: `fetch('http://localhost:3001/api/v1/screen', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345'}, body: JSON.stringify({entityType: 'individual'})}).then(r => r.json())`
- [ ] Expected: HTTP 400 validation error

### 2.3 Invalid Entity Type
- [ ] Run: `fetch('http://localhost:3001/api/v1/screen', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345'}, body: JSON.stringify({entityName: 'Test', entityType: 'invalid'})}).then(r => r.json())`
- [ ] Expected: HTTP 400 validation error

---

## 3. GET /api/v1/screening/{id}

### 3.1 Valid ID
- [ ] Capture screening ID from 2.1
- [ ] Run: `fetch('http://localhost:3001/api/v1/screening/CAPTURED_ID', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json()).then(d => console.log('Screening:', d.entityName))`
- [ ] Expected: HTTP 200 with screening object

### 3.2 Invalid ID Format
- [ ] Run: `fetch('http://localhost:3001/api/v1/screening/not-a-uuid', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json())`
- [ ] Expected: HTTP 400

### 3.3 Non-Existent ID
- [ ] Run: `fetch('http://localhost:3001/api/v1/screening/00000000-0000-0000-0000-000000000000', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json())`
- [ ] Expected: HTTP 404

---

## 4. GET /api/v1/alerts — Alert Listing

### 4.1 List All Alerts
- [ ] Run: `fetch('http://localhost:3001/api/v1/alerts', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json()).then(d => console.log('Total:', d.total, 'Returned:', d.data.length))`
- [ ] Expected: HTTP 200 with alert array

### 4.2 Filter by Status
- [ ] Run: `fetch('http://localhost:3001/api/v1/alerts?status=true_positive', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json()).then(d => console.log('TP alerts:', d.data.length))`
- [ ] Expected: HTTP 200, all status = true_positive

### 4.3 Pagination
- [ ] Run: `fetch('http://localhost:3001/api/v1/alerts?page=1&pageSize=10', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json()).then(d => console.log('Page 1 items:', d.data.length))`
- [ ] Expected: ≤ 10 items returned

---

## 5. GET /api/v1/alerts/{id}

### 5.1 Valid Alert ID
- [ ] Get ID from 4.1 response
- [ ] Run: `fetch('http://localhost:3001/api/v1/alerts/ALERT_ID', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json())`
- [ ] Expected: HTTP 200 with alert object

---

## 6. PUT /api/v1/alerts/{id} — Resolution

### 6.1 Resolve as true_positive
- [ ] Run: `fetch('http://localhost:3001/api/v1/alerts/ALERT_ID', {method: 'PUT', headers: {'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345'}, body: JSON.stringify({resolution: 'true_positive'})}).then(r => r.json())`
- [ ] Expected: HTTP 200, resolution set

### 6.2 Resolve as false_positive
- [ ] Run: `fetch('http://localhost:3001/api/v1/alerts/ALERT_ID2', {method: 'PUT', headers: {'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345'}, body: JSON.stringify({resolution: 'false_positive'})}).then(r => r.json())`
- [ ] Expected: HTTP 200

---

## 7. Billing API Endpoints

### 7.1 GET /api/v1/billing/products
- [ ] Run: `fetch('http://localhost:3001/api/v1/billing/products', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json()).then(d => console.log('Plans:', d.data.length))`
- [ ] Expected: HTTP 200 with products array

### 7.2 POST /api/v1/billing/checkout
- [ ] Run: `fetch('http://localhost:3001/api/v1/billing/checkout', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345'}, body: JSON.stringify({productId: 'basic'})}).then(r => r.json())`
- [ ] Expected: HTTP 201 with checkout session

### 7.3 GET /api/v1/billing/usage
- [ ] Run: `fetch('http://localhost:3001/api/v1/billing/usage', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.json())`
- [ ] Expected: HTTP 200 with usage metrics

---

## 8. Rate Limiting Test

- [ ] Run: `Promise.all(Array.from({length: 50}, () => fetch('http://localhost:3001/api/v1/config', {headers: {'X-API-Key': 'test-key-12345'}}).then(r => r.status))).then(s => {const rate429 = s.filter(x => x === 429).length; console.log('Rate limited (429):', rate429, '/', s.length);})`
- [ ] Expected: Some 429 responses (rate limit enforced)

---

## 9. Content-Type Tests

### 9.1 JSON (Valid)
- [ ] Done in multiple tests above
- [ ] Expected: HTTP 200/201

### 9.2 Plain Text (Invalid)
- [ ] Run: `fetch('http://localhost:3001/api/v1/screen', {method: 'POST', headers: {'Content-Type': 'text/plain', 'X-API-Key': 'test-key-12345'}, body: 'entityName=John'}).then(r => console.log('Status:', r.status))`
- [ ] Expected: HTTP 400 or 415

---

## Summary Checklist
- [ ] Auth scenarios tested (valid, missing, invalid, wrong)
- [ ] Screening endpoints verified
- [ ] Alert endpoints working
- [ ] Billing APIs functional
- [ ] Rate limiting enforced
- [ ] Content-type validation correct
