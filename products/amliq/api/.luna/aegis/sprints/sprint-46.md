# Sprint 46: Payment Rail Integration

**Duration**: 2 weeks
**Priority**: MEDIUM
**Closes Gaps**: None (new capability — competitive with World-Check Verify)
**Depends On**: S-35 (full engine for screening), S-39 (expanded lists)
**Status**: Not Started

---

## Objective

Enable real-time sanctions screening within payment transaction flows. Compete with World-Check Verify (AWS-powered, sub-second screening for payments).

## Tasks

### T1: Fast screening mode
- [ ] New API endpoint: `POST /api/v1/screen/fast`
- [ ] Uses only Exact + Fuzzy layers (skip Phonetic, Token, Embedding, Graph)
- [ ] Target: <10ms p95 latency
- [ ] Returns: match/no-match with confidence, no full evidence (for speed)
- [ ] **File**: `api/handler_screen_fast.go` (new, <60 lines)
- [ ] **File**: `internal/screening/engine_fast.go` (new, <60 lines)

### T2: Stripe Connect middleware
- [ ] Webhook handler for Stripe Connect `payment_intent.created` events
- [ ] Screen originator and beneficiary before payment completes
- [ ] If match: hold payment, create alert, notify compliance team
- [ ] If clear: allow payment to proceed
- [ ] **File**: `internal/integration/stripe_screening.go` (new, <100 lines)
- [ ] **Test**: `internal/integration/stripe_screening_test.go`

### T3: SWIFT MT103/MT202 screening
- [ ] Parse SWIFT message fields: originator (50K), beneficiary (59), intermediary (56)
- [ ] Screen all parties against sanctions lists
- [ ] Return screening result per party
- [ ] **File**: `internal/integration/swift_parser.go` (new, <100 lines)
- [ ] **File**: `internal/integration/swift_parser_test.go`

### T4: Transaction screening API
- [ ] Enhance existing `POST /api/v1/txn/screen`:
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
- [ ] Screen both parties + flag high-risk corridors (configurable)
- [ ] **File**: `api/handler_txn.go` (enhance)

### T5: Rate limiting for payment flows
- [ ] Payment screening needs dedicated rate limit tier (higher than standard API)
- [ ] Plan-based: Pro (1K req/sec), Enterprise (10K req/sec)
- [ ] **File**: `api/middleware_rate_limit.go` (add payment tier)

## Acceptance Criteria

- [ ] Fast screening mode: <10ms p95 latency
- [ ] Stripe Connect integration screens payments in real-time
- [ ] SWIFT MT103/MT202 parsing and screening works
- [ ] Transaction screening API returns per-party results
- [ ] Dedicated rate limits for payment flows
