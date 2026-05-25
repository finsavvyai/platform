# Sprint 46: Payment Rail Integration

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: None (new capability — competitive with World-Check Verify)
**Depends On**: S-35 (full engine for screening), S-39 (expanded lists)
**Status**: Complete

---

## Objective

Enable real-time sanctions screening within payment transaction flows. Compete with World-Check Verify (AWS-powered, sub-second screening for payments).

## Tasks

### T1: Fast screening mode
- [x] New API endpoint: `POST /api/v1/screen/fast`
- [x] Uses only Exact + Fuzzy layers (skip Phonetic, Token, Embedding, Graph)
- [x] Target: <10ms p95 latency
- [x] Returns: match/no-match with confidence, no full evidence (for speed)
- [x] **File**: `api/handler_screen_fast.go` (new, <60 lines)
- [x] **File**: `internal/screening/engine_fast.go` (new, <60 lines)

### T2: Stripe Connect middleware
- [x] Webhook handler for Stripe Connect `payment_intent.created` events
- [x] Screen originator and beneficiary before payment completes
- [x] If match: hold payment, create alert, notify compliance team
- [x] If clear: allow payment to proceed
- [x] **File**: `internal/integration/stripe_screening.go` (new, <100 lines)
- [x] **Test**: `internal/integration/stripe_screening_test.go`

### T3: SWIFT MT103/MT202 screening
- [x] Parse SWIFT message fields: originator (50K), beneficiary (59), intermediary (56)
- [x] Screen all parties against sanctions lists
- [x] Return screening result per party
- [x] **File**: `internal/integration/swift_parser.go` (new, <100 lines)
- [x] **File**: `internal/integration/swift_parser_test.go`

### T4: Transaction screening API
- [x] Enhance existing `POST /api/v1/txn/screen`:
  ```json
  {
      "transaction_id": "TXN-001",
      "originator": {"name": "...", "country": "US"},
      "beneficiary": {"name": "...", "country": "RU"},
      "amount": 50000,
      "currency": "USD",
      "purpose": "Trade payment"
  }
  ```
- [x] Screen both parties + flag high-risk corridors (configurable)
- [x] **File**: `api/handler_txn.go` (enhance)

### T5: Rate limiting for payment flows
- [x] Payment screening needs dedicated rate limit tier (higher than standard API)
- [x] Plan-based: Pro (1K req/sec), Enterprise (10K req/sec)
- [x] **File**: `api/middleware_rate_limit.go` (add payment tier)

## Acceptance Criteria

- [x] Fast screening mode: <10ms p95 latency
- [x] Stripe Connect integration screens payments in real-time
- [x] SWIFT MT103/MT202 parsing and screening works
- [x] Transaction screening API returns per-party results
- [x] Dedicated rate limits for payment flows
