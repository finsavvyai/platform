# API_REFERENCE.md — All Endpoints

## Authentication

All endpoints require one of:

**Bearer Token** (JWT)
```
Authorization: Bearer eyJhbGc...
```

**API Key** (per-product)
```
X-API-Key: api_sk_abc123...
```

Missing or invalid auth → `401 Unauthorized`

## Screening Endpoints

### POST /screen

Screen a single entity.

```http
POST /screen
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "entity_name": "John Smith",
  "entity_type": "Individual",
  "date_of_birth": "1980-01-15",
  "identifiers": [
    {"type": "Passport", "value": "AB123456"}
  ],
  "transaction_id": "txn_123",
  "customer_id": "cust_456"
}
```

**Response** (200 OK):
```json
{
  "screening_id": "scr_abc123",
  "matches": [
    {
      "entity_id": "ent_x1y2z3",
      "confidence": 87,
      "disposition": "NeedsReview",
      "evidence": [
        {
          "layer": "Exact",
          "score": 1.0,
          "details": "Exact match on family name"
        },
        {
          "layer": "Fuzzy",
          "score": 0.92,
          "details": "Jaro-Winkler distance: 0.92"
        }
      ],
      "explanation": "Matched on exact family name (Smith) + fuzzy match on given name (John vs Jon, 92%)"
    }
  ],
  "summary": {
    "total_matches": 1,
    "highest_confidence": 87,
    "disposition": "NeedsReview"
  },
  "timestamp": "2024-03-26T12:00:00Z"
}
```

**Errors**:
- `400 Bad Request` — Missing required field
- `402 Payment Required` — Quota exceeded, add credits
- `429 Too Many Requests` — Rate limit exceeded

**Rate limit**: Depends on plan (100-10000 req/sec)

---

### POST /batch

Screen multiple entities (async, returns job ID).

```http
POST /batch
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "entities": [
    {"entity_name": "John Smith", "entity_type": "Individual", "transaction_id": "txn_1"},
    {"entity_name": "ACME Corp", "entity_type": "Company", "transaction_id": "txn_2"}
  ]
}
```

**Response** (202 Accepted):
```json
{
  "batch_id": "batch_xyz789",
  "status": "Processing",
  "total": 2,
  "completed": 0,
  "created_at": "2024-03-26T12:00:00Z"
}
```

**Errors**:
- `413 Payload Too Large` — >10000 entities
- `402 Payment Required` — Insufficient quota

---

### GET /screenings/{id}

Retrieve a screening result.

```http
GET /screenings/scr_abc123
X-API-Key: api_sk_abc123
```

**Response** (200 OK): [Same as POST /screen response]

**Errors**:
- `404 Not Found` — Screening not found
- `403 Forbidden` — Not your screening (tenant isolation)

---

### GET /batch/{batch_id}

Get batch job status.

```http
GET /batch/batch_xyz789
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "batch_id": "batch_xyz789",
  "status": "Completed",
  "total": 2,
  "completed": 2,
  "results_url": "/batch/batch_xyz789/results",
  "created_at": "2024-03-26T12:00:00Z",
  "completed_at": "2024-03-26T12:05:00Z"
}
```

---

### GET /batch/{batch_id}/results

Download batch results (CSV or JSONL).

```http
GET /batch/batch_xyz789/results?format=csv
X-API-Key: api_sk_abc123
```

**Response**: CSV with columns: transaction_id, matches, confidence, disposition, explanation

---

## Alert Endpoints

### GET /alerts

List alerts for your tenant (filtered by status, priority).

```http
GET /alerts?status=Pending&priority=High&limit=50&offset=0
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "alerts": [
    {
      "alert_id": "alr_123",
      "screening_id": "scr_abc123",
      "match_result": {
        "entity_id": "ent_x1y2z3",
        "confidence": 87,
        "disposition": "NeedsReview"
      },
      "status": "Pending",
      "priority": "High",
      "created_at": "2024-03-26T12:00:00Z",
      "resolved_at": null
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Filters**:
- `status=Pending|Resolved|FalsePositive`
- `priority=Low|Medium|High|Critical`
- `created_after=2024-03-01`
- `created_before=2024-03-31`

---

### GET /alerts/{alert_id}

Get alert details.

```http
GET /alerts/alr_123
X-API-Key: api_sk_abc123
```

**Response**: Single alert object (detailed)

---

### PUT /alerts/{alert_id}/resolve

Resolve an alert with disposition and justification.

```http
PUT /alerts/alr_123/resolve
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "disposition": "FalsePositive",
  "justification": "Customer verified as legitimate through KYC",
  "notes": "Name collision with different person"
}
```

**Response**:
```json
{
  "alert_id": "alr_123",
  "status": "Resolved",
  "disposition": "FalsePositive",
  "resolved_at": "2024-03-26T12:05:00Z",
  "resolved_by": "user_456"
}
```

**Dispositions**: `FalsePositive`, `Reject`, `Accept`

---

## Configuration Endpoints

### GET /config

Get your tenant's screening configuration.

```http
GET /config
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "tenant_id": "ten_abc123",
  "screening_weights": {
    "exact": 30,
    "fuzzy": 25,
    "phonetic": 15,
    "token": 15,
    "embedding": 10,
    "graph": 5
  },
  "confidence_threshold": 75,
  "list_priorities": ["OFAC", "UN", "EU"],
  "enable_embedding": false,
  "enable_graph": false,
  "allowlist_entity_ids": ["ent_safe1", "ent_safe2"]
}
```

---

### PUT /config

Update your tenant's screening configuration.

```http
PUT /config
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "screening_weights": {
    "exact": 40,
    "fuzzy": 20,
    "phonetic": 10,
    "token": 15,
    "embedding": 10,
    "graph": 5
  },
  "confidence_threshold": 80,
  "enable_embedding": true
}
```

**Response**: Updated config object

**Validation**:
- Weights must sum to 100
- Threshold must be 0-100
- Requires Admin role

---

### POST /config/sandbox/test

Test screening config against sample data (no usage count).

```http
POST /config/sandbox/test
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "query": {"entity_name": "John Smith", "entity_type": "Individual"},
  "weights": {"exact": 40, "fuzzy": 20, ...}
}
```

**Response**: Mock screening result with proposed weights applied

---

## Billing Endpoints

### GET /billing/products

List all available products and pricing.

```http
GET /billing/products
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "products": [
    {
      "id": "api",
      "name": "API",
      "tiers": [
        {
          "tier": "Lite",
          "monthly": 500,
          "annual": 5000,
          "features": {
            "screenings_per_month": 10000,
            "rate_limit": 100
          }
        }
      ]
    }
  ]
}
```

---

### GET /billing/usage

Get current usage for your subscription.

```http
GET /billing/usage?product=API&period=month
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "product": "API",
  "period": "2024-03",
  "usage": {
    "screenings": 5243,
    "limit": 10000,
    "percentage": 52.43
  },
  "current_plan": "Lite",
  "resets_at": "2024-04-01T00:00:00Z"
}
```

---

### POST /billing/checkout

Create a checkout session to upgrade/change subscription.

```http
POST /billing/checkout
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "product": "API",
  "tier": "Pro",
  "billing_cycle": "monthly",
  "promo_code": "EARLYBIRD"
}
```

**Response**:
```json
{
  "checkout_url": "https://checkout.lemonsqueezy.com/...",
  "checkout_id": "chk_123",
  "expires_at": "2024-03-26T13:00:00Z"
}
```

Redirect user to `checkout_url`. Webhook will create subscription.

---

### GET /billing/invoices

List invoices for your account.

```http
GET /billing/invoices?limit=12&offset=0
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "invoices": [
    {
      "id": "inv_123",
      "date": "2024-03-01",
      "amount": 500.00,
      "status": "Paid",
      "pdf_url": "https://..."
    }
  ],
  "total": 24
}
```

---

## Audit Endpoints

### GET /audit

List audit trail for your tenant.

```http
GET /audit?resource_type=Alert&action=Resolve&limit=50&offset=0
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "entries": [
    {
      "id": "aud_123",
      "resource_type": "Alert",
      "resource_id": "alr_456",
      "action": "Resolve",
      "changes": {
        "status": {"old": "Pending", "new": "Resolved"},
        "disposition": {"old": null, "new": "FalsePositive"}
      },
      "created_by": "user_789",
      "created_at": "2024-03-26T12:05:00Z"
    }
  ],
  "total": 3421
}
```

**Filters**:
- `resource_type=Entity|Alert|Screening|Subscription|Config`
- `action=Create|Update|Delete|Resolve|Export`
- `created_after`, `created_before`

---

### GET /audit/{audit_id}

Get specific audit entry with hash chain verification.

```http
GET /audit/aud_123
X-API-Key: api_sk_abc123
```

**Response**: Single audit entry + hash validation result

---

## List Management Endpoints

### GET /lists

List all available sanctions lists and their metadata.

```http
GET /lists
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "lists": [
    {
      "id": "ofac",
      "name": "OFAC SDN",
      "source": "US Treasury",
      "entity_count": 1234,
      "last_updated": "2024-03-25T18:00:00Z",
      "next_update": "2024-03-26T18:00:00Z"
    },
    {
      "id": "un",
      "name": "UN Security Council",
      "entity_count": 567,
      "last_updated": "2024-03-24T12:00:00Z"
    }
  ]
}
```

---

### POST /lists/{list_id}/sync

Manually trigger a list update (normally automatic).

```http
POST /lists/ofac/sync
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "sync_id": "sync_123",
  "status": "Processing",
  "started_at": "2024-03-26T12:00:00Z"
}
```

Check status: `GET /lists/{list_id}/sync/{sync_id}`

---

## Dataset Endpoints

### GET /dataset/latest

Download latest sanctions data (requires Dataset product).

```http
GET /dataset/latest?format=json&lists=ofac,un,eu
X-API-Key: dataset_sk_abc123
```

**Response**: NDJSON (newline-delimited JSON) or CSV

```json
{"entity_id": "ent_1", "name": "John Smith", "entity_type": "Individual", "lists": ["OFAC"]}
{"entity_id": "ent_2", "name": "ACME Corp", "entity_type": "Company", "lists": ["UN", "EU"]}
```

---

### GET /dataset/delta

Download only changes since last export (efficient syncing).

```http
GET /dataset/delta?since=2024-03-20T00:00:00Z&format=json
X-API-Key: dataset_sk_abc123
```

**Response**:
```json
{
  "period": {"start": "2024-03-20", "end": "2024-03-26"},
  "added": [...],
  "removed": [...],
  "modified": [...]
}
```

---

## Vessel Screening Endpoints

### POST /api/v1/vessel/screen

Screen maritime vessel against sanctions lists.

```http
POST /api/v1/vessel/screen
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "vessel_name": "TORM MARINER",
  "imo": "9765432",
  "mmsi": "123456789",
  "flag": "DK"
}
```

**Response** (200 OK):
```json
{
  "matches": [
    {
      "match_id": "ent_vessel_123",
      "vessel_name": "TORM MARINER",
      "list_source": "OFAC",
      "confidence": 0.99,
      "rule_id": "vessel_imo_exact",
      "explanation": "Exact IMO match (globally unique identifier)",
      "vessel_details": {
        "imo": "9765432",
        "flag": "DK",
        "vessel_type": "Tanker",
        "owner": "A.P. Moller-Maersk"
      }
    }
  ],
  "total": 1
}
```

**Errors**:
- `400 Bad Request` — Missing vessel_name
- `402 Payment Required` — Quota exceeded

---

## UBO & PEP Screening Endpoints

### POST /api/v1/ubo/{company_id}/screen

Screen Ultimate Beneficial Owner (UBO) against sanctions lists with PEP classification.

```http
POST /api/v1/ubo/company_456/screen
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "ubo_name": "John Smith",
  "date_of_birth": "1970-01-15",
  "nationality": "US",
  "pep_classification": "foreign"
}
```

**Response** (200 OK):
```json
{
  "ubo_id": "ubo_789",
  "company_id": "company_456",
  "matches": [
    {
      "entity_id": "ent_x1y2z3",
      "confidence": 87,
      "pep_classification": "foreign",
      "risk_multiplier": 0.9,
      "risk_adjusted_confidence": 78.3,
      "explanation": "PEP (Foreign) - Foreign official flag applies 0.9x risk multiplier"
    }
  ]
}
```

---

### GET /api/v1/ubo/{ubo_id}

Get UBO screening result.

```http
GET /api/v1/ubo/ubo_789
X-API-Key: api_sk_abc123
```

**Response**: UBO object with screening history

---

### POST /api/v1/ubo/{ubo_id}/classify

Update PEP classification for a UBO.

```http
POST /api/v1/ubo/ubo_789/classify
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "pep_classification": "rca",
  "reason": "Identified as relative of sanctioned official"
}
```

**Response**:
```json
{
  "ubo_id": "ubo_789",
  "pep_classification": "rca",
  "risk_multiplier": 0.6,
  "updated_at": "2024-03-26T12:00:00Z"
}
```

---

### DELETE /api/v1/ubo/{ubo_id}

Delete UBO record (audit logged).

```http
DELETE /api/v1/ubo/ubo_789
X-API-Key: api_sk_abc123
```

**Response** (204 No Content)

---

## Country Risk Endpoints

### GET /api/v1/country-risk/{country_code}

Get country risk score and level.

```http
GET /api/v1/country-risk/CN
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "country_code": "CN",
  "country_name": "China",
  "risk_score": 0.68,
  "risk_level": "high",
  "sources": ["FATF", "CPI", "Basel", "OpenSanctions"],
  "updated_at": "2024-03-20T00:00:00Z"
}
```

---

### PUT /api/v1/country-risk/{country_code}/override

Set tenant-specific country risk override.

```http
PUT /api/v1/country-risk/RU/override
X-API-Key: api_sk_abc123
Content-Type: application/json

{
  "score": 0.95,
  "reason": "Sanctions escalation due to geopolitical event"
}
```

**Response**:
```json
{
  "country_code": "RU",
  "tenant_id": "ten_abc123",
  "override_score": 0.95,
  "updated_at": "2024-03-26T12:00:00Z"
}
```

---

### GET /api/v1/country-risk

List country risk index (paginated).

```http
GET /api/v1/country-risk?limit=50&offset=0
X-API-Key: api_sk_abc123
```

**Response**:
```json
{
  "countries": [
    {
      "country_code": "KP",
      "country_name": "North Korea",
      "risk_score": 0.99,
      "risk_level": "very_high"
    }
  ],
  "total": 240,
  "limit": 50,
  "offset": 0
}
```

---

## iFrame Endpoints

### GET /iframe/widget.js

Embed screening widget in partner sites.

```html
<script src="https://api.amliq.finance/iframe/widget.js"></script>
<script>
  AmliqWidget.init({
    apiKey: 'iframe_sk_abc123',
    containerId: 'amliq-screening'
  });
</script>
<div id="amliq-screening"></div>
```

---

### POST /iframe/screen

Screen entity from embedded widget (internal).

```http
POST /iframe/screen
X-API-Key: iframe_sk_abc123
Content-Type: application/json

{
  "entity_name": "John Smith",
  "entity_type": "Individual"
}
```

**Response**: Screening result (same as POST /screen)

---

## Webhook Endpoints

### POST /webhooks/lemonsqueezy

LemonSqueezy sends subscription events here.

```http
POST /webhooks/lemonsqueezy
X-Signature: HMAC-SHA256(body, webhook_secret)
Content-Type: application/json

{
  "meta": {"event_name": "subscription.created"},
  "data": {
    "id": "sub_123",
    "attributes": {
      "customer_id": 456,
      "product_id": 789,
      "status": "active"
    }
  }
}
```

**No response body required** — Return 200 OK

---

## AI Endpoints

All AI endpoints DLP-scrub free text via `MaskAML` (PII + PAN +
IBAN + BIC + Israeli ID with check-digit validation) before the
prompt reaches the model. Backend selection at boot:
`AWS_BEDROCK_REGION` set → Bedrock (data-residency); otherwise
`ANTHROPIC_API_KEY` → direct Anthropic.

### POST /api/v1/ai/summarize

AML-shaped summarization for alerts, adverse media, and case files.

```http
POST /api/v1/ai/summarize
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "text": "Entity: Smith\nMatch: OFAC SDN\n...",
  "type": "alert"
}
```

`type` ∈ `alert | adverse_media | case`. Each maps to a fixed prompt
template; arbitrary prompts are not accepted here (use /v1/messages).

**Response** (200 OK):
```json
{
  "data": {"summary": "...", "model": "claude-haiku-4-5"},
  "timestamp": 1746201600
}
```

Errors:
- `400 BAD_REQUEST` — empty text, invalid type, sanitization left empty
- `503 AI_UNAVAILABLE` — no provider configured at boot
- `502 AI_ERROR` — upstream Anthropic/Bedrock failure
- `500 AUDIT_FAILED` — fail-closed; the AI call did not produce a recorded summary

Every successful call writes one `AuditActionAISummarized` row.

---

### POST /v1/messages

Anthropic Messages API drop-in. Lets clients (Claude Code, official
SDK, Cowork) point at aegis via `ANTHROPIC_BASE_URL`.

```http
POST /v1/messages
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "model": "claude-haiku-4-5",
  "max_tokens": 256,
  "system": "you are a compliance assistant",
  "messages": [
    {"role": "user", "content": "Screen entity: Acme Holdings"}
  ]
}
```

**Response** (200 OK) follows the Anthropic shape:
```json
{
  "data": {
    "id": "msg_aegis_...",
    "type": "message",
    "role": "assistant",
    "content": [{"type": "text", "text": "..."}],
    "model": "claude-haiku-4-5",
    "stop_reason": "end_turn",
    "usage": {"input_tokens": 42, "output_tokens": 128}
  }
}
```

Token counts are 4-chars-per-token estimates (aegis's internal AI
interface doesn't surface real upstream usage). Tool use, image
content blocks, and streaming are NOT supported in this drop-in.

---

## SSO Endpoints

Per-tenant SAML 2.0. Each tenant has its own SP keypair (migration
070_tenant_saml_config). Setup runbook: see `docs/SAML_SSO_SETUP.md`.

### GET /sso/{tenant}/login

Kicks off the SAML flow. 302s to the tenant's IdP with a signed
AuthnRequest. The request ID is persisted in a short-TTL HttpOnly
cookie scoped to the ACS path.

**Errors**:
- `400 MISSING_TENANT` — no tenant in path
- `404 SSO_NOT_CONFIGURED` — no enabled SAML row for tenant
- `500 SSO_REQUEST_FAILED` — keypair load or AuthnRequest build error

### POST /sso/{tenant}/acs

Assertion Consumer Service. Validates the IdP's SAML response (XML
signature + audience + InResponseTo) and returns the mapped
identity. JWT minting happens in a follow-up handler — this endpoint
is the validator only.

**Response** (200 OK):
```json
{
  "data": {
    "NameID": "...",
    "Email": "user@bank.example.com",
    "Role": "compliance_officer"
  }
}
```

Role defaults to `viewer` when the IdP doesn't supply one. Email is
read from `email`, the standard XMLSoap claim URI, or the LDAP-style
`urn:oid:0.9.2342.19200300.100.1.3` — whichever is present.

---

## Health & Status Endpoints

### GET /health

Health check (liveness).

```http
GET /health
```

**Response** (200 OK):
```json
{"status": "healthy", "version": "2.0.0"}
```

---

### GET /ready

Readiness check (dependencies working).

```http
GET /ready
```

**Response** (200 OK if ready, 503 if not):
```json
{
  "ready": true,
  "database": "ok",
  "redis": "ok",
  "lemonsqueezy": "ok"
}
```

---

## Error Responses

All errors follow standard format:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Entity name is required",
    "details": {
      "field": "entity_name"
    }
  }
}
```

**Common HTTP Status Codes**:
- `200 OK` — Success
- `202 Accepted` — Async job (batch)
- `400 Bad Request` — Invalid input
- `401 Unauthorized` — Missing/invalid auth
- `402 Payment Required` — Quota exceeded or payment failed
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `429 Too Many Requests` — Rate limit exceeded
- `500 Internal Server Error` — Server error

---

**API Base URL**: `https://api.amliq.finance` (production) or `http://localhost:8080` (dev)

**Docs**: Full OpenAPI spec at `/openapi.json`
