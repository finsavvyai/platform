# Sprint 40: Continuous Monitoring

**Duration**: 2 weeks
**Priority**: HIGH
**Closes Gaps**: G8
**Depends On**: S-39 (expanded list sync for meaningful deltas)
**Status**: Not Started

---

## Objective

Transform AMLIQ from point-in-time screening to continuous compliance. When a previously-screened entity's status changes (new sanctions hit, PEP change, adverse media), automatically notify the tenant.

## Background

- `ongoing_monitors` database table already exists
- List sync already computes deltas (adds/removals/modifications)
- **Missing**: No rescreening of monitored entities. No webhook/email notifications on status change.

## Tasks

### T1: Monitoring registration API
- [ ] `POST /api/v1/monitors` — register entity for ongoing monitoring
  ```json
  {
      "entity_name": "John Smith",
      "entity_type": "individual",
      "identifiers": {"dob": "1970-01-15"},
      "notification_url": "https://customer.com/webhooks/amliq",
      "notification_channels": ["webhook", "email"],
      "check_frequency": "on_list_update"
  }
  ```
- [ ] `GET /api/v1/monitors` — list all monitored entities for tenant
- [ ] `DELETE /api/v1/monitors/{id}` — stop monitoring
- [ ] `GET /api/v1/monitors/{id}/history` — screening history for monitored entity
- [ ] **File**: `api/handler_monitors.go` (new, <100 lines)
- [ ] **File**: `api/router_monitors.go` (new)

### T2: Delta-triggered rescreening
- [ ] After list sync computes delta (new/modified/removed entities):
  1. Get all monitored entities for tenants subscribed to that list
  2. Rescreen each monitored entity against the delta entries
  3. If match score changed significantly (>0.1 difference), create an alert
  4. If new match found (was clean, now hits), create HIGH priority alert
  5. If delisted (was hit, now clean), create INFO alert
- [ ] **File**: `cmd/worker/monitor_rescreener.go` (new, <100 lines)
- [ ] **Test**: `cmd/worker/monitor_rescreener_test.go`

### T3: Webhook notification system
- [ ] When rescreening produces a status change, fire webhook to tenant's configured URL
- [ ] Webhook payload:
  ```json
  {
      "event": "monitoring.status_change",
      "monitor_id": "...",
      "entity_name": "John Smith",
      "previous_status": "CLEAR",
      "new_status": "MATCH",
      "confidence": 0.87,
      "matched_list": "OFAC SDN",
      "matched_entity": "JOHN ALAN SMITH",
      "timestamp": "2026-04-15T10:30:00Z"
  }
  ```
- [ ] Retry logic: 3 attempts with exponential backoff (1s, 5s, 30s)
- [ ] Store webhook delivery status in `webhook_deliveries` table
- [ ] **File**: `internal/notification/webhook.go` (new, <80 lines)
- [ ] **File**: `internal/notification/webhook_test.go`
- [ ] **Migration**: `032_create_webhook_deliveries.up.sql`

### T4: Email notifications
- [ ] Use existing Resend integration (if configured) or SMTP fallback
- [ ] Email template: "AMLIQ Alert: [Entity Name] status changed to [STATUS]"
- [ ] Include: match details, confidence score, link to dashboard alert
- [ ] **File**: `internal/notification/email.go` (new, <80 lines)

### T5: Slack integration
- [ ] Accept Slack webhook URL in tenant config
- [ ] Post formatted message to Slack channel on status change
- [ ] **File**: `internal/notification/slack.go` (new, <60 lines)

### T6: Monitoring dashboard
- [ ] Add monitoring section to dashboard: total monitored entities, status distribution, recent changes
- [ ] List view: all monitored entities with last check time, current status, trend
- [ ] **File**: `web/src/pages/Monitoring.tsx` (verify/enhance)

### T7: Usage metering for monitoring
- [ ] Track monitored entity count per tenant
- [ ] Plan limits: Starter: 100, Pro: 10K, Enterprise: unlimited
- [ ] Count rescreenings against usage quota
- [ ] **File**: `api/middleware_usage.go` (add monitoring metrics)

## Acceptance Criteria

- [ ] Entities registered for monitoring are automatically rescreened on every relevant list update
- [ ] Webhook notifications fire within 5 minutes of status change
- [ ] Email and Slack notifications work
- [ ] Retry logic handles transient webhook failures
- [ ] Monitoring dashboard shows real-time status of all monitored entities
- [ ] Usage metering tracks monitored entity count
