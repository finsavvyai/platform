# TenantIQ API Reference

Complete REST API documentation for TenantIQ.

## Base URL

```
Production: https://api.tenantiq.io/v1
Preview:    https://preview-api.tenantiq.io/v1
```

## Authentication

All API requests require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

## Rate Limiting

- 1,000 requests per minute per API key
- 10,000 requests per hour per API key
- Returns `429 Too Many Requests` when exceeded

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Descriptive error message",
    "details": {
      "field": "fieldName",
      "reason": "Field validation failed"
    }
  }
}
```

## Endpoints

### Authentication

#### POST /auth/login
Authenticate user and obtain JWT token.

**Request:**
```json
{
  "email": "user@company.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGc...",
  "expiresIn": 86400,
  "user": {
    "id": "user-123",
    "email": "user@company.com",
    "role": "admin"
  }
}
```

#### POST /auth/refresh
Refresh an expired token.

**Request:**
```json
{
  "refreshToken": "refresh_token_123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGc...",
  "expiresIn": 86400
}
```

### Tenants

#### POST /tenants
Create a new tenant connection.

**Request:**
```json
{
  "name": "Acme Corporation",
  "domain": "acme.com",
  "tenantId": "12345678-1234-1234-1234-123456789abc",
  "config": {
    "region": "us-east-1",
    "features": ["security", "licensing", "compliance"]
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "tenant-456",
  "name": "Acme Corporation",
  "domain": "acme.com",
  "status": "active",
  "createdAt": "2026-03-20T10:30:00Z",
  "config": { "region": "us-east-1" }
}
```

#### GET /tenants
List all tenants for the authenticated MSP.

**Query Parameters:**
- `skip` (number): Skip N records (default: 0)
- `limit` (number): Return N records (default: 20, max: 100)
- `status` (string): Filter by status (active, paused, error)

**Response:** `200 OK`
```json
{
  "tenants": [
    {
      "id": "tenant-456",
      "name": "Acme Corporation",
      "domain": "acme.com",
      "status": "active",
      "securityScore": 267,
      "licenseCount": 500
    }
  ],
  "total": 42,
  "skip": 0,
  "limit": 20
}
```

#### GET /tenants/:id
Get detailed tenant information.

**Response:** `200 OK`
```json
{
  "id": "tenant-456",
  "name": "Acme Corporation",
  "domain": "acme.com",
  "status": "active",
  "createdAt": "2026-03-20T10:30:00Z",
  "lastSyncAt": "2026-03-20T14:22:00Z",
  "config": { "region": "us-east-1" },
  "stats": {
    "users": 850,
    "licenses": 500,
    "securityScore": 267
  }
}
```

#### PATCH /tenants/:id
Update tenant configuration.

**Request:**
```json
{
  "config": {
    "features": ["security", "licensing", "compliance", "remediation"],
    "alertThreshold": "medium"
  }
}
```

**Response:** `200 OK` with updated tenant object.

#### DELETE /tenants/:id
Remove a tenant connection.

**Response:** `204 No Content`

### Security

#### GET /tenants/:id/security
Get current security posture and scores.

**Response:** `200 OK`
```json
{
  "tenantId": "tenant-456",
  "secureScore": {
    "current": 267,
    "max": 287,
    "percentage": 93,
    "trend": "up"
  },
  "cisScore": {
    "overall": 95,
    "categories": {
      "authentication": 100,
      "accessControl": 90,
      "auditLogging": 95
    }
  },
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Enable DMARC",
      "severity": "high",
      "impact": 10,
      "implemented": false
    }
  ],
  "lastScannedAt": "2026-03-20T14:22:00Z"
}
```

#### GET /tenants/:id/security/drift
Get security configuration drift history.

**Query Parameters:**
- `days` (number): Look back N days (default: 7)

**Response:** `200 OK`
```json
{
  "tenantId": "tenant-456",
  "hasDrift": true,
  "drifts": [
    {
      "date": "2026-03-18T08:15:00Z",
      "setting": "mfaPolicy.enforced",
      "previousValue": true,
      "currentValue": false,
      "severity": "high"
    }
  ]
}
```

#### GET /tenants/:id/security/cis-report
Generate CIS benchmark compliance report.

**Query Parameters:**
- `format` (string): pdf, json, html (default: json)

**Response:** `200 OK`
```json
{
  "reportId": "report-789",
  "tenantId": "tenant-456",
  "generatedAt": "2026-03-20T15:00:00Z",
  "overallScore": 95,
  "complianceLevel": "High",
  "sections": [
    {
      "benchmark": "CIS 1.1",
      "title": "Password Policy",
      "compliant": true,
      "score": 100,
      "findings": []
    }
  ]
}
```

#### POST /tenants/:id/security/remediate
Trigger automated security remediation.

**Request:**
```json
{
  "findings": ["rec-1", "rec-2"],
  "severity": "high",
  "requireApproval": true
}
```

**Response:** `202 Accepted`
```json
{
  "remediationId": "rem-123",
  "status": "pending_approval",
  "estimatedDuration": "2 hours",
  "affectedSettings": 2,
  "approvalRequired": true
}
```

### Licensing

#### GET /tenants/:id/licenses
Get license usage and optimization analysis.

**Response:** `200 OK`
```json
{
  "tenantId": "tenant-456",
  "licenses": [
    {
      "sku": "Microsoft 365 E5",
      "total": 200,
      "assigned": 180,
      "utilized": 165,
      "utilizationRate": 0.825,
      "monthlyCost": 4000
    },
    {
      "sku": "Microsoft 365 E3",
      "total": 500,
      "assigned": 450,
      "utilized": 400,
      "utilizationRate": 0.8,
      "monthlyCost": 2700
    }
  ],
  "costAnalysis": {
    "totalMonthly": 6700,
    "totalAnnual": 80400,
    "utilizationRate": 0.81
  }
}
```

#### GET /tenants/:id/licenses/recommendations
Get license optimization recommendations.

**Query Parameters:**
- `priority` (string): high, medium, low (default: high)

**Response:** `200 OK`
```json
{
  "tenantId": "tenant-456",
  "recommendations": [
    {
      "id": "rec-001",
      "type": "downgrade",
      "affectedUsers": 25,
      "currentLicense": "Microsoft 365 E5",
      "recommendedLicense": "Microsoft 365 E3",
      "estimatedMonthlySavings": 250,
      "confidence": 0.92
    },
    {
      "id": "rec-002",
      "type": "removal",
      "affectedUsers": 5,
      "license": "Microsoft 365 E3",
      "reason": "Inactive for 180+ days",
      "estimatedMonthlySavings": 30,
      "confidence": 0.98
    }
  ],
  "totalPotentialSavings": 280,
  "estimationConfidence": 0.95
}
```

#### POST /tenants/:id/licenses/apply-recommendations
Apply license optimization recommendations.

**Request:**
```json
{
  "recommendationIds": ["rec-001", "rec-002"],
  "scheduleAppliance": "2026-03-25T00:00:00Z",
  "notifyUsers": true
}
```

**Response:** `202 Accepted`
```json
{
  "operationId": "op-456",
  "status": "scheduled",
  "scheduledFor": "2026-03-25T00:00:00Z",
  "affectedUsers": 30,
  "estimatedSavings": 280
}
```

#### GET /tenants/:id/licenses/cost-forecast
Forecast future licensing costs.

**Query Parameters:**
- `months` (number): Forecast N months ahead (default: 12)

**Response:** `200 OK`
```json
{
  "tenantId": "tenant-456",
  "forecast": [
    { "month": "2026-04", "projectedCost": 6700, "confidence": 0.95 },
    { "month": "2026-05", "projectedCost": 6850, "confidence": 0.92 },
    { "month": "2026-06", "projectedCost": 7000, "confidence": 0.88 }
  ]
}
```

### Compliance

#### GET /tenants/:id/compliance
Get compliance status across frameworks.

**Response:** `200 OK`
```json
{
  "tenantId": "tenant-456",
  "frameworks": [
    {
      "name": "GDPR",
      "score": 0.92,
      "status": "compliant",
      "lastAssessment": "2026-03-20T10:00:00Z"
    },
    {
      "name": "HIPAA",
      "score": 0.88,
      "status": "compliant_with_exceptions",
      "exceptions": ["Data residency verification"]
    },
    {
      "name": "SOC 2",
      "score": 0.95,
      "status": "compliant"
    }
  ]
}
```

#### POST /tenants/:id/compliance/report
Generate compliance report.

**Request:**
```json
{
  "frameworks": ["GDPR", "HIPAA"],
  "format": "pdf",
  "includeEvidence": true
}
```

**Response:** `200 OK`
```json
{
  "reportId": "comp-report-123",
  "url": "https://reports.tenantiq.io/comp-report-123.pdf",
  "expiresAt": "2026-06-20T15:00:00Z"
}
```

### Remediation

#### GET /remediation/status/:id
Get status of a remediation operation.

**Response:** `200 OK`
```json
{
  "remediationId": "rem-123",
  "status": "in_progress",
  "progress": {
    "completed": 15,
    "total": 20,
    "percentage": 75
  },
  "actions": [
    {
      "id": "action-1",
      "description": "Disable legacy authentication",
      "status": "completed"
    }
  ]
}
```

#### POST /remediation/approve/:id
Approve a pending remediation.

**Response:** `200 OK`
```json
{
  "remediationId": "rem-123",
  "status": "executing",
  "startedAt": "2026-03-20T15:30:00Z"
}
```

#### POST /remediation/cancel/:id
Cancel a pending or in-progress remediation.

**Response:** `200 OK`
```json
{
  "remediationId": "rem-123",
  "status": "cancelled"
}
```

### Webhooks

#### POST /webhooks
Register a webhook for tenant events.

**Request:**
```json
{
  "url": "https://yourserver.com/webhooks/tenantiq",
  "events": ["security.drift", "license.optimization", "compliance.report"],
  "secret": "webhook-secret"
}
```

**Response:** `201 Created`
```json
{
  "webhookId": "wh-789",
  "url": "https://yourserver.com/webhooks/tenantiq",
  "events": ["security.drift", "license.optimization"],
  "active": true
}
```

#### DELETE /webhooks/:id
Remove a webhook.

**Response:** `204 No Content`

### Analytics

#### GET /analytics/tenant/:id
Get analytics dashboard data.

**Query Parameters:**
- `period` (string): 7d, 30d, 90d, 1y (default: 30d)

**Response:** `200 OK`
```json
{
  "period": "30d",
  "metrics": {
    "securityScoreTrend": [{ "date": "2026-02-20", "score": 250 }, ...],
    "licenseCostTrend": [{ "date": "2026-02-20", "cost": 6500 }, ...],
    "remediationActions": 12,
    "driftEvents": 3
  }
}
```

## Rate Limits

Implement exponential backoff with jitter for rate limit handling:

```javascript
async function apiCall(endpoint, options = {}) {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
        ...options
      });

      if (response.status === 429) {
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
        retries++;
        continue;
      }

      return response;
    } catch (error) {
      retries++;
    }
  }
}
```

## Pagination

List endpoints support cursor-based pagination:

```json
{
  "data": [...],
  "pageInfo": {
    "nextCursor": "cursor_123",
    "hasMore": true,
    "total": 250
  }
}
```

## Versioning

The API uses URL versioning (`/v1`, `/v2`). Version sunset policy: previous version supported for 12 months after new version release.

## Support

For API support, email api-support@tenantiq.io or consult https://docs.tenantiq.io/api.
