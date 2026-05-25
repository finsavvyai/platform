# ARCHITECTURE.md — System Design Overview

## High-Level Data Flow

```
HTTP Request
    ↓
Authentication (JWT/API Key)
    ↓
Rate Limiter (token bucket)
    ↓
Tenant Context (multi-tenant isolation)
    ↓
Handler Layer (api/handler_*.go)
    ↓
Domain Layer (internal/domain/ value objects)
    ↓
Screening Engine (internal/screening/ — 6 matchers)
    ↓
Repository Layer (internal/storage/ interfaces)
    ↓
PostgreSQL + pgvector
    ↓
Webhook (LemonSqueezy billing)
    ↓
HTTP Response (JSON + Confidence Score)
```

## Layered Architecture

### 1. Transport Layer (api/)
- HTTP handlers for each domain (screening, alerts, config, billing, audit)
- Middleware: auth, rate limit, CORS, request logging
- Request validation (no primitives, use domain value objects)
- Response formatting (JSON with status codes)

### 2. Domain Layer (internal/domain/)
- Rich value objects: EntityID, TenantID, Name, Confidence, Disposition
- Entities: Entity, Alert, ScreenRequest, ScreenResponse, Subscription
- Enums: EntityType, AlertStatus, AlertPriority, MatchLayer, DispositionType
- All construct with validation: NewXxx() → (Xxx, error)
- No persistence logic (repositories handle that)

### 3. Screening Engine (internal/screening/)
- 6-layer cascade matching system
- Layer 1 (Exact): Hash-based exact match (normalizer → exact.go)
- Layer 2 (Fuzzy): Jaro-Winkler distance algorithm
- Layer 3 (Phonetic): Soundex + Metaphone for pronunciation
- Layer 4 (Token): Jaccard similarity on tokenized names
- Layer 5 (Embedding): Vector cosine similarity (pgvector)
- Layer 6 (Graph): Neo4j-style relationship traversal
- WeightedScorer combines evidence with configurable weights
- Explainer generates human-readable match reasoning

### 4. Ingestion Layer (internal/ingestion/)
- Parser registry pattern (pluggable parsers)
- Supported lists: OFAC SDN, UN, EU, UK, Swiss, Israeli, Ukrainian, OpenSanctions
- ListFetcher: HTTP with ETag caching and retry logic
- DeltaEngine: Computes additions/removals/modifications
- Batch updates to PostgreSQL

### 5. Billing Layer (internal/billing/)
- LemonSqueezy integration (webhooks + API)
- 5 products × 3 tiers = 15 plan SKUs
- Subscription state machine (PendingPayment → Active → Paused → Cancelled)
- Usage metering (screenings, seats, API calls tracked per tenant)
- PromoCode validation (discount % + expiry)
- Invoice generation (monthly + annual)

### 6. Storage Layer (internal/storage/)
- Repository interfaces (no concrete DB logic)
- EntityRepository: CRUD on sanctioned entities
- ScreeningRepository: Store results + history
- AlertRepository: Lifecycle management
- AuditRepository: Immutable append-only log
- TenantRepository: Multi-tenancy config
- All repositories support in-memory and PostgreSQL backends

### 7. Configuration Layer (internal/config/)
- Environment-driven: DATABASE_URL, REDIS_URL, PORT, etc.
- TenantScreeningConfig: Per-customer layer weights, thresholds, list priorities
- FeatureFlags: Beta features behind toggles

## Request Lifecycle (Screening Endpoint)

```
POST /screen with ScreenRequest
    ↓
ValidateAPIKey (X-API-Key header)
    ↓
CheckRateLimit (100 req/second per API key)
    ↓
CheckBillingUsage (sufficient credits/subscriptions)
    ↓
ExtractTenant (API key → TenantID)
    ↓
LoadTenantConfig (screening weights, thresholds)
    ↓
LoadSanctionedEntities (from database for query type)
    ↓
Engine.Screen(queryEntity, candidates)
    ├─ Layer 1: Exact match (0.1ms)
    ├─ Layer 2: Fuzzy match (1ms)
    ├─ Layer 3: Phonetic (2ms)
    ├─ Layer 4: Token (3ms)
    ├─ Layer 5: Embedding (10ms) [if configured]
    └─ Layer 6: Graph (20ms) [if configured]
    ↓
ScoreEvidence (weighted combination → Confidence)
    ↓
ShortCircuit? (confidence > tenant threshold) → STOP
    ↓
CreateAlert (if confidence > review threshold)
    ↓
RecordUsage (LemonSqueezy metering)
    ↓
Response (ScreenResponse + MatchResults)
```

## Database Schema (PostgreSQL)

```
entities (sanctioned data from lists)
├─ id (EntityID)
├─ list_id (which list: OFAC, UN, etc)
├─ entity_type (Individual, Company, Vessel, Aircraft)
├─ names (JSONB array of Name objects)
├─ identifiers (DOB, Passport, Company reg, etc)
└─ metadata (JSONB: sanctions reason, date_added, country)

screenings (results)
├─ id (ScreeningID)
├─ tenant_id (multi-tenancy)
├─ request (JSONB: what was screened)
├─ matches (JSONB array of MatchResult)
└─ created_at

alerts (matches needing review)
├─ id (AlertID)
├─ screening_id (link to screening)
├─ match_result (JSONB)
├─ status (Pending, Resolved, FalsePositive)
├─ disposition (NeedsReview, Reject, Accept, etc)
└─ notes (compliance officer comments)

audit (immutable log)
├─ id (AuditID)
├─ tenant_id
├─ resource_type (Entity, Alert, Subscription, etc)
├─ action (Create, Update, Resolve, etc)
├─ changes (JSONB delta)
├─ prev_hash (hash chain integrity)
└─ created_at

subscriptions
├─ id (SubscriptionID)
├─ tenant_id
├─ product_id (API, Dashboard, SDK, iFrame, Dataset)
├─ plan_tier (Lite, Pro, Enterprise)
├─ status (Active, Paused, Cancelled)
└─ expires_at

usage_records
├─ id
├─ tenant_id
├─ metric_type (screenings, seats, api_calls)
├─ quantity
├─ period_start, period_end
└─ billed (T/F)
```

## Key Design Decisions & Why

1. **Cascade matching** (not ensemble): Stop at first high-confidence match
   - Why: Faster (p95 <50ms), sufficient for screening (true positives rare)

2. **Value objects with validation**: NewXxx() → (Xxx, error)
   - Why: Compile-time safety (impossible states unrepresentable)

3. **Repository pattern**: No DB logic in domain
   - Why: Easy to swap PostgreSQL ↔ in-memory for testing

4. **Per-tenant config**: Weights, thresholds, list priorities
   - Why: Banks have different risk appetites (banks ≠ crypto exchanges)

5. **Explainer module**: Every match has human-readable reasoning
   - Why: Regulators demand explainability (AI Act, GDPR)

6. **Usage metering**: Fine-grained tracking (screenings, seats, API calls)
   - Why: SaaS pricing depends on accurate metering (no disputes)

7. **Immutable audit trail**: Hash-chain integrity
   - Why: Regulatory compliance (Dodd-Frank, PSD2, MiFID II)

## Scaling Considerations

- **Horizontal**: Stateless API servers behind load balancer
- **Database**: PostgreSQL read replicas for reporting, single write primary
- **Vector store**: pgvector indexes for embedding similarity (IVFFLAT)
- **Cache layer**: Redis for frequent entity lookups
- **Batch processing**: Background worker processes large datasets async
- **Rate limiting**: Token bucket per API key (in-memory or Redis)

---

See `docs/CODE_MAP.md` for file-by-file breakdown of each layer.
