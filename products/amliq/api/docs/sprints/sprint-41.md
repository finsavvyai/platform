# Sprint 41: Billing Hardening

**Duration**: 2 weeks
**Priority**: HIGH
**Closes Gaps**: G6, G7, G12
**Depends On**: None
**Status**: Complete

---

## Objective

Fix all billing gaps: stubbed seats, 503 fallback, empty webhook handler, hardcoded variant IDs. Make billing production-ready.

## Tasks

### T1: Implement seats persistence
- [x] `POST /api/v1/billing/seats` — create real seat in DB, check plan limit, return seat with ID
- [x] `GET /api/v1/billing/seats` — query seats table for tenant, return real list
- [x] `DELETE /api/v1/billing/seats/{id}` — soft-delete seat, free up count
- [x] Enforce plan limits: Starter (3 seats), Pro (10 seats), Enterprise (unlimited)
- [x] **File**: `api/handler_billing_seats.go` (rewrite, <100 lines)
- [x] **File**: `internal/storage/pgx/seat_repo.go` (new or verify existing)
- [x] **Test**: `api/handler_billing_seats_test.go` (update tests for real behavior)

### T2: Free-tier fallback when LS not configured
- [x] If `LS_API_KEY` not set, don't return 503 — instead enable a free tier:
  - 100 screenings/day
  - 1 seat
  - 3 sanctions lists (OFAC, EU, UN)
  - No billing/checkout endpoints (return 404 with message "Billing not configured. Running in free tier mode.")
- [x] Usage enforcer still tracks and limits free-tier usage
- [x] **File**: `api/router_billing.go` (modify conditional registration)
- [x] **File**: `internal/billing/free_tier.go` (new, <50 lines)
- [x] **Test**: Test that endpoints work without LS env vars

### T3: Move variant IDs to environment config
- [x] Extract all hardcoded `LemonSqueezyVariantID` and `LemonSqueezyVariantIDAnnual` from `plans_registry.go`
- [x] Load from env: `LS_VARIANT_API_STARTER`, `LS_VARIANT_API_PRO`, etc. (30 env vars for 15 plans × 2 billing periods)
- [x] Keep hardcoded values as defaults for development
- [x] **File**: `internal/billing/plans_registry.go` (modify)
- [x] **File**: `internal/billing/ls_config.go` (add variant env loading)

### T4: Implement order_created webhook handler
- [x] Currently in `handler_webhook_persist.go`, `handleOrderCreated()` returns nil
- [x] Should: create initial billing record, log order event, associate order with tenant
- [x] **File**: `api/handler_webhook_persist.go` (~20 lines)

### T5: Invoice auto-generation cron
- [x] Monthly cron job (1st of each month): for each active subscription, generate invoice from usage records
- [x] Invoice includes: base subscription fee + overage charges
- [x] Store in `invoices` table
- [x] Send invoice email via Resend
- [x] **File**: `cmd/worker/invoice_generator.go` (new, <100 lines)
- [x] **Test**: `cmd/worker/invoice_generator_test.go`

### T6: Billing health check
- [x] `GET /api/v1/billing/health` — returns billing system status
  - LemonSqueezy connectivity
  - Webhook delivery success rate (last 24h)
  - Subscription count, active/paused/cancelled
  - Usage overage warnings
- [x] **File**: `api/handler_billing_health.go` (new, <60 lines)

## Acceptance Criteria

- [x] `POST/GET/DELETE /seats` persists to database, enforces plan limits
- [x] App starts and serves requests without LemonSqueezy env vars (free tier mode)
- [x] Variant IDs loaded from environment, fallback to defaults
- [x] `order_created` webhook creates billing record
- [x] Monthly invoice generation runs automatically
- [x] All existing billing tests pass + new tests for real seats behavior
