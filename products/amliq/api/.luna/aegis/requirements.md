# AMLIQ v2 -- Comprehensive Requirements Document

**Project**: AMLIQ (AI-Enhanced Global Intelligence Screening)
**Version**: 2.0
**Generated**: 2026-03-29
**Scope**: Full Platform (Backend, Frontend, Infrastructure)
**Reviewer**: Luna Requirements Agent

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [User Stories and Use Cases](#4-user-stories-and-use-cases)
5. [Technical Constraints and Dependencies](#5-technical-constraints-and-dependencies)
6. [Gap Analysis](#6-gap-analysis)

---

## 1. Product Overview

AMLIQ is an AI-powered AML/CFT sanctions screening platform that replaces expensive, opaque tools like World-Check with a configurable, explainable, multi-tenant SaaS product for financial institutions.

**Target Market**: Mid-market banks, payment processors, fintechs, crypto exchanges (US/EU/APAC/IL).

**Core Value Propositions**:
- 6-layer cascade matching (Exact, Fuzzy, Phonetic, Token, Embedding, Graph)
- Configurable per-tenant weights, thresholds, and list priorities
- Explainable match reasoning for regulatory compliance
- Sub-50ms p95 latency per screening
- 5 product lines: API, Dashboard, SDK, iFrame, Dataset

**Tech Stack**: Go 1.22 backend, React 18 + TypeScript frontend (Vite), PostgreSQL + pgvector, LemonSqueezy billing, Docker/Kubernetes-ready.

---

## 2. Functional Requirements

### 2.1 Screening Engine

#### FR-SCR-001: Single Entity Screening
**Priority**: Critical
**Status**: Implemented

The system shall screen a single entity against configured sanctions lists using the 6-layer cascade matching engine.

**Acceptance Criteria**:
- [x] POST /api/v1/screen accepts entity_name, entity_type, date_of_birth, identifiers
- [x] Engine runs Exact, Fuzzy, Phonetic, and Token matchers in cascade
- [x] Weighted scorer combines evidence into a Confidence score (0-100)
- [x] Explainer generates human-readable match reasoning
- [x] Response includes screening_id, matches array with evidence, and disposition
- [x] Screening results are persisted to the ScreeningRepository
- [ ] Short-circuit optimization stops at high-confidence match (not implemented in engine.go -- all layers always run)
- [ ] Per-list confidence thresholds applied (documented but not wired in Engine.Screen)

#### FR-SCR-002: Batch Entity Screening
**Priority**: High
**Status**: Implemented

The system shall support asynchronous batch screening of multiple entities via CSV or JSON upload.

**Acceptance Criteria**:
- [x] POST /api/v1/batch accepts array of entities or CSV upload
- [x] Returns batch_id with 202 Accepted
- [x] Background worker processes batch asynchronously
- [x] GET /api/v1/batch/{id} returns job status (Processing, Completed, Failed)
- [x] GET /api/v1/batch/{id}/results returns results in CSV/JSON
- [x] Batch respects per-tenant screening configuration
- [ ] Batch size limit of 10,000 entities validated on submission
- [ ] Progress reporting (completed count updates during processing)

#### FR-SCR-003: Embedding Layer (Vector Similarity)
**Priority**: Medium
**Status**: Partially Implemented

The system shall support semantic similarity matching using vector embeddings.

**Acceptance Criteria**:
- [x] EmbeddingMatcher exists and implements Matcher interface
- [x] Cosine similarity calculation implemented
- [x] pgvector migration (020_add_pgvector.up.sql) created
- [x] Entity embedding storage (entity_embedding.go) in pgx layer
- [ ] Embedding matcher is NOT wired into Engine.Screen() -- only 4 layers active (Exact, Fuzzy, Phonetic, Token)
- [ ] Embedding generation pipeline not connected to real embedding model (uses manual SetVector cache only)
- [ ] No auto-embedding on entity ingestion
- [ ] pgvector IVFFLAT index not configured for production-scale nearest neighbor search

#### FR-SCR-004: Graph Layer (Relationship Traversal)
**Priority**: Medium
**Status**: Stub Implementation

The system shall support relationship-based matching via graph traversal.

**Acceptance Criteria**:
- [x] GraphMatcher struct exists with GraphDB interface
- [x] MatchByID traverses relationships at configurable depth
- [ ] GraphMatcher.Match() returns empty evidence (stub -- no actual implementation)
- [ ] Graph matcher NOT wired into Engine.Screen()
- [ ] No GraphDB implementation exists (no Neo4j or PostgreSQL JSONB graph)
- [ ] No relationship data ingestion pipeline
- [ ] No UI for viewing relationship graphs

#### FR-SCR-005: Match Explainability
**Priority**: Critical
**Status**: Implemented

Every match shall include human-readable explanation of why it matched.

**Acceptance Criteria**:
- [x] Explainer generates text explaining which layers matched and scores
- [x] Evidence includes layer name, algorithm, score, and matched values
- [x] Explanation included in ScreenResponse for API consumers
- [x] Dashboard displays match explanation to compliance officers

#### FR-SCR-006: Configurable Match Weights
**Priority**: Critical
**Status**: Implemented

Each tenant shall configure per-layer matching weights that sum to 100.

**Acceptance Criteria**:
- [x] MatchWeights domain model with validation (must sum to 100)
- [x] Default weights provided (Exact: 30, Fuzzy: 25, Phonetic: 15, Token: 15, Embedding: 10, Graph: 5)
- [x] WeightedScorer uses tenant-specific weights
- [x] PUT /api/v1/config allows Admin to update weights
- [x] Validation rejects weights that do not sum to 100

#### FR-SCR-007: Short-Circuit Optimization
**Priority**: High
**Status**: Not Implemented

The engine shall stop evaluating expensive layers when a high-confidence match is found early.

**Acceptance Criteria**:
- [ ] If confidence exceeds tenant's ConfidenceThreshold after early layers, skip remaining
- [ ] Documented in ARCHITECTURE.md and SCREENING_ENGINE.md but not coded
- [ ] Engine.Screen() currently runs all 4 active layers for every candidate

#### FR-SCR-008: Post-Processing (Auto-Escalate / Auto-Dismiss)
**Priority**: High
**Status**: Implemented

Matches shall be automatically escalated or dismissed based on tenant-configured thresholds.

**Acceptance Criteria**:
- [x] post_process.go exists with tests
- [x] TenantConfig has AutoDismissBelow and AutoEscalateAbove fields
- [x] Matches below AutoDismissBelow automatically dismissed
- [x] Matches above AutoEscalateAbove automatically escalated

---

### 2.2 Sanctions List Management

#### FR-LST-001: Multi-Source List Ingestion
**Priority**: Critical
**Status**: Implemented

The system shall ingest and parse sanctions lists from multiple international sources.

**Acceptance Criteria**:
- [x] Parser interface with pluggable implementations
- [x] Registry pattern for parser lookup by type
- [x] OFAC SDN parser implemented and tested
- [x] UN Consolidated list parser implemented
- [x] EU sanctions list parser implemented
- [x] UK (HMRC) parser implemented
- [x] Swiss (SECO) parser implemented
- [x] Israeli MOD (NBCTF) parser implemented
- [x] OpenSanctions parser implemented
- [x] Custom CSV parser for user-provided lists
- [x] SDFM parser implemented

#### FR-LST-002: Automated List Synchronization
**Priority**: Critical
**Status**: Implemented

The system shall automatically fetch and sync sanctions lists on configurable schedules.

**Acceptance Criteria**:
- [x] SyncService orchestrates fetch, parse, delta, and upsert
- [x] ListFetcher with ETag caching and retry logic
- [x] Per-tenant sync schedules (cron-based)
- [x] Delta engine computes additions, removals, modifications
- [x] Manual sync trigger via POST /api/v1/lists/{id}/sync
- [x] List metadata tracked (last_synced, entity_count, next_sync, etag)

#### FR-LST-003: Delta Updates
**Priority**: High
**Status**: Implemented

List updates shall apply only changes (delta), not full reimport.

**Acceptance Criteria**:
- [x] DeltaEngine computes diff between old and new entity sets
- [x] Upserts new entities, updates changed, soft-deletes removed
- [x] Delta removal tested (delta_remove_test.go)

#### FR-LST-004: Custom List Sources
**Priority**: Medium
**Status**: Implemented

Tenants shall configure custom list source URLs with specified parsers.

**Acceptance Criteria**:
- [x] ListConfig supports custom_source_url per list
- [x] EffectiveURL() returns custom URL when set, default otherwise
- [x] Custom CSV parser for arbitrary list formats

#### FR-LST-005: Full-Text Entity Search
**Priority**: Medium
**Status**: Implemented

The system shall support full-text and trigram search on entity names.

**Acceptance Criteria**:
- [x] PostgreSQL tsvector and trigram index migration (018_add_fts_trigram.up.sql)
- [x] entity_fts.go and entity_trigram.go in pgx layer
- [x] Tests for full-text search queries

---

### 2.3 Alert Management

#### FR-ALR-001: Alert Lifecycle
**Priority**: Critical
**Status**: Implemented

The system shall create alerts from screening matches and support a full resolution lifecycle.

**Acceptance Criteria**:
- [x] Alerts auto-created when screening confidence exceeds review threshold
- [x] Alert statuses: Pending, Resolved, FalsePositive
- [x] Priority auto-assigned from confidence (Critical, High, Medium, Low)
- [x] GET /api/v1/alerts with filters (status, priority, date range, pagination)
- [x] GET /api/v1/alerts/{id} for detail view
- [x] PUT /api/v1/alerts/{id}/resolve with disposition and justification
- [x] Only Admin and Analyst roles can resolve (WriteAccess middleware)

#### FR-ALR-002: Alert Assignment
**Priority**: Medium
**Status**: Partially Implemented

Alerts shall be assignable to specific team members.

**Acceptance Criteria**:
- [x] Alert.AssignedTo field exists in domain model
- [ ] No API endpoint to assign alerts (assignment happens only through case management)
- [ ] No round-robin or load-balanced auto-assignment
- [ ] Dashboard does not show assignment UI on alert queue

---

### 2.4 Compliance Case Management

#### FR-CAS-001: Case Lifecycle
**Priority**: High
**Status**: Implemented

The system shall support compliance case workflows for investigating matches.

**Acceptance Criteria**:
- [x] ComplianceCase domain model with statuses (Open, InReview, Escalated, Resolved, FalsePositive, TrueMatch, Archived)
- [x] Priority classification from confidence score
- [x] GET /api/v1/cases with listing and filtering
- [x] GET /api/v1/cases/{id} for detail
- [x] PUT /api/v1/cases/{id}/assign to assign analyst
- [x] PUT /api/v1/cases/{id}/escalate to escalate
- [x] PUT /api/v1/cases/{id}/resolve to resolve
- [x] CaseCreator in screening package auto-creates cases from matches
- [x] Database migration for compliance_cases table

#### FR-CAS-002: Case Comments
**Priority**: Medium
**Status**: Implemented

Cases shall support threaded comments for investigation notes.

**Acceptance Criteria**:
- [x] CaseComment domain model exists
- [x] CaseCommentRepository interface defined
- [x] case_comment_repo.go in pgx layer
- [x] Database migration (022_create_case_comments.up.sql)

---

### 2.5 Enhanced Due Diligence (EDD)

#### FR-EDD-001: EDD Workflow
**Priority**: High
**Status**: Implemented

The system shall provide an EDD workflow with a verification checklist.

**Acceptance Criteria**:
- [x] EDDReport domain model with status tracking
- [x] 9-item checklist (identity, source of funds/wealth, PEP, adverse media, sanctions, UBO, country risk, transaction history)
- [x] API endpoints for EDD workflow
- [x] Frontend page (EDDWorkflow.tsx)
- [x] Database migration (026_create_edd_reports.up.sql)

---

### 2.6 PEP Screening

#### FR-PEP-001: Politically Exposed Person Detection
**Priority**: High
**Status**: Implemented

The system shall screen entities against PEP databases with tiered risk classification.

**Acceptance Criteria**:
- [x] PEP tier model (Tier1-HeadOfState through Tier4-IntlOrg) with risk weights
- [x] POST /api/v1/pep/screen endpoint
- [x] GET /api/v1/pep for listing by country
- [x] PEP profiles database table (029_create_pep_profiles.up.sql)
- [x] Frontend PEP screening page (PEPScreening.tsx)
- [ ] No PEP data source ingestion pipeline (profiles must be manually populated)
- [ ] PEP screening not integrated into main screening cascade (separate endpoint only)

---

### 2.7 Adverse Media Screening

#### FR-MED-001: Adverse Media Detection
**Priority**: Medium
**Status**: Partially Implemented

The system shall track and review adverse media findings for screened entities.

**Acceptance Criteria**:
- [x] AdverseMediaHit domain model with 14 media categories
- [x] Severity scoring (1-10)
- [x] GET /api/v1/media/entity/{id} endpoint
- [x] Database migration (024_create_adverse_media_hits.up.sql)
- [x] Frontend page (AdverseMedia.tsx)
- [ ] No automated media screening (hits must be manually created or imported)
- [ ] No integration with media screening APIs (Dow Jones, LexisNexis, etc.)
- [ ] handler_media_screen.go exists but unclear if connected to real source

---

### 2.8 UBO (Ultimate Beneficial Ownership)

#### FR-UBO-001: Beneficial Ownership Tracking
**Priority**: Medium
**Status**: Implemented

The system shall track and verify Ultimate Beneficial Owners of organizations.

**Acceptance Criteria**:
- [x] BeneficialOwner domain model with ownership percentage and PEP flag
- [x] OwnershipChain for hierarchical ownership display
- [x] UBO verification statuses (Pending, Verified, Flagged, Rejected)
- [x] Database migration (025_create_beneficial_owners.up.sql)
- [x] Frontend page (UBOChain.tsx)
- [ ] No automated UBO registry lookup (manual entry only)
- [ ] No ownership chain visualization (tree/graph)

---

### 2.9 Transaction Monitoring

#### FR-TXN-001: Transaction Monitoring Rules
**Priority**: High
**Status**: Implemented

The system shall monitor financial transactions against configurable rules.

**Acceptance Criteria**:
- [x] Transaction domain model with amount, currency, direction, country
- [x] TxnAlert model with types (high_value, rapid_movement, structuring, high_risk_country, unusual_pattern)
- [x] Transaction monitoring rules engine (txn_rules.go, txn_rules_eval.go)
- [x] Worker-based monitoring loop (txn_monitor.go)
- [x] API routes for transaction management
- [x] Frontend page (TransactionMonitoring.tsx)
- [x] Database migration (027_create_transactions.up.sql)

---

### 2.10 Ongoing Monitoring

#### FR-MON-001: Continuous Entity Monitoring
**Priority**: High
**Status**: Implemented

The system shall continuously re-screen entities on configurable schedules.

**Acceptance Criteria**:
- [x] OngoingMonitor domain model with frequency (daily, weekly, monthly)
- [x] Monitor statuses (Active, Paused, Expired)
- [x] Worker process for ongoing monitoring (ongoing_monitor.go)
- [x] Database migration (023_create_ongoing_monitors.up.sql)
- [x] Frontend monitoring page (Monitoring.tsx)

---

### 2.11 Risk Assessment

#### FR-RSK-001: Composite Risk Scoring
**Priority**: High
**Status**: Implemented

The system shall compute composite risk scores from multiple factors.

**Acceptance Criteria**:
- [x] RiskScore model with 5 factors (Sanctions, PEP, AdverseMedia, Country, Industry)
- [x] Configurable RiskWeights per tenant
- [x] Risk levels: Critical, High, Medium, Low
- [x] Risk factors identification
- [x] Frontend page (RiskAssessment.tsx)
- [ ] Risk scores not automatically computed during screening (manual API call only)
- [ ] Country risk data source not integrated (no FATF list integration)
- [ ] Industry risk classification not implemented

---

### 2.12 Compliance Reporting

#### FR-RPT-001: Regulatory Report Generation
**Priority**: Medium
**Status**: Implemented

The system shall generate compliance reports (SAR, STR, CTR, Audit).

**Acceptance Criteria**:
- [x] ComplianceReport domain model with report types
- [x] ReportSummary aggregates (screenings, alerts, cases, high-risk entities, SARs)
- [x] POST /api/v1/reports/generate endpoint
- [x] GET /api/v1/reports listing endpoint
- [ ] No PDF generation for reports (JSON summary only)
- [ ] No automated SAR/STR filing to regulators
- [ ] No report templates for specific jurisdictions (FinCEN, IMPA, etc.)

---

### 2.13 Entity Resolution / Deduplication

#### FR-ENT-001: Entity Deduplication
**Priority**: Medium
**Status**: Partially Implemented

The system shall detect and cluster potentially duplicate entities.

**Acceptance Criteria**:
- [x] EntityCluster domain model for grouping duplicates
- [x] NormalizeName and SimpleDedupeScore utility functions
- [x] EntityClusterRepository interface and pgx implementation
- [x] Database migration (028_create_entity_clusters.up.sql)
- [ ] No automated deduplication pipeline (manual cluster creation only)
- [ ] No UI for reviewing and confirming entity clusters
- [ ] handler_entities_map.go exists but unclear if it drives dedup workflow

---

### 2.14 Authentication and Authorization

#### FR-AUTH-001: JWT Authentication
**Priority**: Critical
**Status**: Implemented

The system shall authenticate users via JWT tokens.

**Acceptance Criteria**:
- [x] JWT signing and verification (HS256)
- [x] Claims include tenant_id, role, expiry
- [x] JWT middleware validates token on protected routes
- [x] Login endpoint issues JWT
- [x] Token expiry configurable

#### FR-AUTH-002: API Key Authentication
**Priority**: Critical
**Status**: Implemented

The system shall authenticate API consumers via product-prefixed API keys.

**Acceptance Criteria**:
- [x] API keys with product prefixes (api_sk_, dash_sk_, sdk_sk_, iframe_sk_, dataset_sk_)
- [x] Keys stored as SHA-256 hashes (never plaintext)
- [x] API key middleware extracts tenant and product
- [x] Key validation tested

#### FR-AUTH-003: OAuth2 Integration
**Priority**: Medium
**Status**: Implemented

The system shall support OAuth2 login flows.

**Acceptance Criteria**:
- [x] handler_oauth.go, handler_oauth_callback.go, handler_oauth_userinfo.go exist
- [x] Auth routes setup in router_auth.go
- [ ] OAuth providers not documented (unclear which providers supported)
- [ ] No SSO (SAML) support for Enterprise tier

#### FR-AUTH-004: Role-Based Access Control
**Priority**: Critical
**Status**: Implemented

The system shall enforce RBAC with 4 roles.

**Acceptance Criteria**:
- [x] Roles: Admin, Analyst, Auditor, Viewer
- [x] Permission methods: CanWrite, CanResolve, CanManageTeam, CanViewAudit, CanEditConfig
- [x] RBAC middleware (middleware_rbac.go) with tests
- [x] AdminOnly and WriteAccess middleware helpers
- [ ] Security doc describes 6 roles (including ComplianceOfficer, AnalystL1/L2/L3) but code only has 4
- [ ] No Compliance Officer or tiered Analyst roles implemented

---

### 2.15 Billing and Subscription Management

#### FR-BIL-001: LemonSqueezy Integration
**Priority**: High
**Status**: Implemented

The system shall integrate with LemonSqueezy for subscription management.

**Acceptance Criteria**:
- [x] LemonSqueezyClient with API key authentication
- [x] Checkout URL creation
- [x] Webhook handler for subscription events (created, updated, cancelled, expired, resumed)
- [x] HMAC-SHA256 webhook signature verification
- [x] Subscription persistence to PostgreSQL
- [x] Plan registry with all 15 SKUs (5 products x 3 tiers)

#### FR-BIL-002: Usage Metering and Enforcement
**Priority**: High
**Status**: Implemented

The system shall track and enforce usage limits per subscription tier.

**Acceptance Criteria**:
- [x] Usage recording per tenant per metric (screenings, seats, API calls)
- [x] Usage enforcement middleware blocks requests when quota exceeded (402)
- [x] Enforcer checks subscription status and plan limits
- [x] Usage endpoint GET /api/v1/billing/usage

#### FR-BIL-003: Seat Management
**Priority**: Medium
**Status**: Implemented

The system shall manage per-tenant seat limits for Dashboard product.

**Acceptance Criteria**:
- [x] Seat domain model with roles and statuses
- [x] SeatRepository interface and pgx implementation
- [x] API endpoints for seat management
- [x] Seat limit validation per tier

#### FR-BIL-004: Promo Codes
**Priority**: Low
**Status**: Implemented

The system shall support promotional discount codes.

**Acceptance Criteria**:
- [x] PromoCode domain model with discount, product scope, expiry, max uses
- [x] LS promo integration (ls_promo.go)
- [x] Database migration (014_create_promo_codes.up.sql)

#### FR-BIL-005: Invoice Generation
**Priority**: Medium
**Status**: Partially Implemented

The system shall generate monthly invoices from usage records.

**Acceptance Criteria**:
- [x] Invoice domain model with line items, subtotal, discount, tax, total
- [x] InvoiceRepository interface and pgx implementation
- [x] Worker job for invoice generation (invoices.go in worker)
- [ ] No PDF generation
- [ ] No email delivery integration
- [ ] ls_invoices.go exists but scope unclear

---

### 2.16 Multi-Tenancy

#### FR-TEN-001: Tenant Isolation
**Priority**: Critical
**Status**: Implemented

All data and operations shall be scoped to the requesting tenant.

**Acceptance Criteria**:
- [x] TenantID extracted from JWT/API key on every request
- [x] All repository queries filter by tenant_id
- [x] Tenant middleware (middleware_tenant.go) sets context
- [x] Cross-tenant access returns 403 Forbidden

#### FR-TEN-002: Tenant Configuration
**Priority**: Critical
**Status**: Implemented

Each tenant shall have independent screening configuration.

**Acceptance Criteria**:
- [x] TenantConfig with country, regulation framework, enabled lists, thresholds
- [x] Per-list thresholds and custom source URLs
- [x] Screening mode (realtime, batch, both)
- [x] Webhook configuration per tenant
- [x] Configuration validation on update
- [x] SuggestedLists by country for onboarding

---

### 2.17 Audit Trail

#### FR-AUD-001: Immutable Audit Log
**Priority**: Critical
**Status**: Implemented

The system shall maintain an immutable, hash-chained audit trail.

**Acceptance Criteria**:
- [x] AuditEntry domain model with hash chain integrity
- [x] Append-only audit repository
- [x] GET /api/v1/audit with filters (resource_type, action, date range)
- [x] GET /api/v1/audit/{id} with hash verification
- [x] Frontend audit trail page (AuditTrail.tsx)
- [x] Database migration (005_create_audit.up.sql)

---

### 2.18 Dataset Export

#### FR-DAT-001: Sanctions Data Export
**Priority**: Medium
**Status**: Implemented

The system shall provide raw sanctions data download for Dataset product subscribers.

**Acceptance Criteria**:
- [x] GET /api/v1/dataset/latest with format and list filters
- [x] GET /api/v1/dataset/delta for changes since a given date
- [x] handler_dataset.go and handler_dataset_delta.go exist
- [x] Dataset routes setup in router_dataset.go

---

### 2.19 iFrame Widget

#### FR-IFR-001: Embeddable Screening Widget
**Priority**: Medium
**Status**: Implemented

The system shall provide an embeddable screening widget for partner platforms.

**Acceptance Criteria**:
- [x] POST /api/v1/iframe/screen endpoint
- [x] handler_iframe.go with widget serving
- [x] Domain whitelist middleware (middleware_iframe.go)
- [x] Widget routes setup in router_widget.go
- [ ] widget.js static file not found in codebase (may need build step)

---

### 2.20 Admin and Platform Management

#### FR-ADM-001: Super Admin Dashboard
**Priority**: Medium
**Status**: Implemented

Platform administrators shall manage all tenants, users, and system health.

**Acceptance Criteria**:
- [x] Platform overview endpoint (GET /api/v1/platform/overview)
- [x] List all users across tenants (GET /api/v1/platform/users)
- [x] API key management (list, revoke)
- [x] Tenant suspend/activate
- [x] Admin routes protected with AdminOnly middleware
- [x] Frontend pages: AdminTenants, TenantDetail, SystemHealth

---

### 2.21 Onboarding

#### FR-ONB-001: Guided Onboarding Wizard
**Priority**: Medium
**Status**: Implemented

New users shall be guided through initial setup.

**Acceptance Criteria**:
- [x] Onboarding page (Onboarding.tsx)
- [x] Suggested lists by country endpoint (GET /api/v1/onboarding/lists)
- [x] Country selection triggers list recommendations
- [ ] No step-by-step wizard UI (single page only)
- [ ] No first-screen guided experience
- [ ] No onboarding completion tracking per tenant

---

### 2.22 Webhooks (Outbound)

#### FR-WHK-001: Tenant Webhook Notifications
**Priority**: Medium
**Status**: Implemented

The system shall send webhook notifications to tenant-configured endpoints.

**Acceptance Criteria**:
- [x] WebhookConfig domain model with URL and events
- [x] WebhookEndpoint model for tenant-registered endpoints
- [x] Webhook dispatcher (webhook/dispatcher.go)
- [x] Webhook routes (router_webhooks.go)
- [x] Configurable events (match_found, list_updated, batch_complete)

---

### 2.23 Frontend Dashboard

#### FR-FE-001: Dashboard Overview
**Priority**: High
**Status**: Implemented

The dashboard shall provide a compliance overview with key metrics.

**Acceptance Criteria**:
- [x] Dashboard page with compliance stats
- [x] API: GET /api/v1/dashboard/compliance
- [x] Protected route with AppShell layout

#### FR-FE-002: Screen Entity Page
**Priority**: Critical
**Status**: Implemented

Compliance officers shall screen entities via web UI.

**Acceptance Criteria**:
- [x] ScreenEntity page with name, type, DOB, identifier inputs
- [x] Real-time screening against API
- [x] Match result cards with confidence and evidence

#### FR-FE-003: Alert Queue Page
**Priority**: Critical
**Status**: Implemented

Compliance officers shall review and resolve alerts.

**Acceptance Criteria**:
- [x] AlertQueue page with filtering and pagination
- [x] AlertDetailPage for individual alert review
- [x] Resolution workflow with disposition and justification

#### FR-FE-004: Configuration Page
**Priority**: High
**Status**: Implemented

Admins shall configure screening parameters via UI.

**Acceptance Criteria**:
- [x] Configuration page for weights, thresholds, lists
- [x] Validation feedback on invalid configuration

#### FR-FE-005: Marketing Landing Page
**Priority**: Medium
**Status**: Implemented

Public landing page for product marketing.

**Acceptance Criteria**:
- [x] LandingPage.tsx with PublicLayout
- [x] Route at / (root)

---

## 3. Non-Functional Requirements

### 3.1 Performance

#### NFR-PERF-001: Screening Latency
**Priority**: Critical

- Single entity screening: p95 < 50ms (4 active layers)
- Batch screening: 10,000 entities in < 5 minutes
- API response time: p99 < 200ms for all non-batch endpoints

**Current Status**: Load tests exist (k6_screen.js, k6_batch.js) but target validation unclear.

#### NFR-PERF-002: Rate Limiting
**Priority**: High

- Token bucket rate limiting per API key
- Tier-based limits: Lite=100/sec, Pro=1000/sec, Enterprise=10000/sec
- 429 Too Many Requests when exceeded

**Current Status**: Implemented (rate_bucket.go, middleware_rate.go with tests).

#### NFR-PERF-003: Database Performance
**Priority**: High

- Full-text search with tsvector and trigram indexes
- pgvector IVFFLAT index for embedding similarity
- Entity bulk operations for batch ingestion
- Soft-delete for entity lifecycle

**Current Status**: Indexes created via migrations. Bulk operations implemented (entity_bulk.go).

### 3.2 Security

#### NFR-SEC-001: Transport Security
**Priority**: Critical

- TLS 1.3 minimum for all connections
- mTLS support for B2B integrations
- CORS configuration (middleware_cors.go)

**Current Status**: CORS middleware implemented. TLS configuration documented.

#### NFR-SEC-002: Data Encryption
**Priority**: Critical

- AES-256-GCM for PII at rest
- Separate encryption key for PII fields
- API keys stored as SHA-256 hashes only

**Current Status**: API key hashing implemented (apikey_hash.go). PII encryption at rest documented but implementation in storage layer unclear.

#### NFR-SEC-003: Webhook Security
**Priority**: High

- HMAC-SHA256 signature verification on all inbound webhooks
- Webhook secret rotation support

**Current Status**: LemonSqueezy webhook verification implemented (ls_webhook_verify.go with tests).

#### NFR-SEC-004: Audit Compliance
**Priority**: Critical

- Hash-chained immutable audit log
- All auth events, admin actions, and data mutations logged
- GDPR, SOC 2, Dodd-Frank, PSD2 compliance patterns

**Current Status**: Audit trail implemented with hash chain. Append-only enforcement.

#### NFR-SEC-005: Secret Management
**Priority**: High

- Environment-variable based secrets
- No secrets in code or logs
- Secret redaction in log output

**Current Status**: Documented patterns. No .env file committed.

### 3.3 Scalability

#### NFR-SCA-001: Horizontal Scaling
**Priority**: Medium

- Stateless API servers behind load balancer
- PostgreSQL read replicas for reporting
- Redis for rate limiting and caching

**Current Status**: Architecture supports horizontal scaling. Redis integration exists in configuration.

#### NFR-SCA-002: Background Processing
**Priority**: High

- Worker process for batch screening, list sync, monitoring, invoicing
- Scheduler for cron-based jobs
- Batch polling for async job management

**Current Status**: Worker implemented (cmd/worker/) with scheduler, batch processing, compliance loop, transaction monitoring, ongoing monitoring, and invoice generation.

### 3.4 Reliability

#### NFR-REL-001: Health Checks
**Priority**: High

- GET /health for liveness probe
- GET /ready for readiness probe (checks DB, Redis, external services)

**Current Status**: Health handler implemented (handler_health.go with tests).

#### NFR-REL-002: Error Handling
**Priority**: High

- Standardized JSON error responses
- No panic() in production code
- Error boundaries in frontend

**Current Status**: Error response format defined. ErrorBoundary component in frontend.

### 3.5 Observability

#### NFR-OBS-001: Request Logging
**Priority**: High

- All HTTP requests logged with method, path, status, duration
- Request logging middleware

**Current Status**: middleware_logging.go implemented.

#### NFR-OBS-002: Monitoring Dashboard
**Priority**: Medium

- handler_monitoring.go with system metrics endpoint
- Frontend Monitoring page

**Current Status**: Implemented with tests (handler_monitoring_test.go).

### 3.6 Code Quality

#### NFR-QUA-001: File Size Limits
**Priority**: Medium

- Maximum 100 lines per source file (project CLAUDE.md rule)
- Refactor when approaching limit

**Current Status**: Enforced via code review. Not validated by CI.

#### NFR-QUA-002: Test Coverage
**Priority**: High

- 100% coverage for critical paths (auth, billing, screening)
- >= 90% line coverage overall
- >= 85% branch coverage overall
- Table-driven tests for all Go code

**Current Status**: Extensive test files exist alongside implementation. Integration tests in tests/integration/.

#### NFR-QUA-003: API Contract
**Priority**: Medium

- OpenAPI spec for all endpoints
- Spec updated in same PR as handler changes

**Current Status**: Multiple OpenAPI specs exist (openapi.yaml, openapi_extended.yaml, openapi_platform.yaml, openapi_compliance.yaml).

### 3.7 Deployment

#### NFR-DEP-001: Containerization
**Priority**: High

- Dockerfile for API server
- Docker Compose for local development
- Kubernetes-ready configuration

**Current Status**: Dockerfile exists. deploy/docker/ directory. Makefile with docker-up/docker-down.

#### NFR-DEP-002: CI/CD
**Priority**: High

- GitHub Actions for test, build, deploy
- CI blocks merge on red tests

**Current Status**: .github/workflows/ci.yml and deploy.yml exist.

---

## 4. User Stories and Use Cases

### 4.1 Compliance Officer (Sarah, P01)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-001 | As a compliance officer, I want to screen a customer name against OFAC and Israeli MOD lists so I can assess sanctions risk during onboarding | Critical | Implemented |
| US-002 | As a compliance officer, I want to see why a name matched so I can justify my disposition to regulators | Critical | Implemented |
| US-003 | As a compliance officer, I want to resolve alerts with a justification note so there is an auditable trail | Critical | Implemented |
| US-004 | As a compliance officer, I want auto-escalation of high-confidence matches so critical alerts are not missed | High | Implemented |
| US-005 | As a compliance officer, I want to force-sync a list immediately when I hear about new sanctions additions | Medium | Implemented |
| US-006 | As a compliance officer, I want to configure different thresholds for different lists since transliteration varies | High | Partially (domain exists, not wired in engine) |

### 4.2 API Developer (Alex, P02)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-007 | As a developer, I want a RESTful screening API with clear error responses so I can integrate AML checks into my payment flow | Critical | Implemented |
| US-008 | As a developer, I want batch screening via CSV upload so I can screen my entire customer base periodically | High | Implemented |
| US-009 | As a developer, I want to download sanctions data as JSON/CSV so I can run matching locally | Medium | Implemented |
| US-010 | As a developer, I want interactive API docs (Swagger) so I can test endpoints while building | Medium | Implemented |

### 4.3 Enterprise Admin (Michael, P09)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-011 | As an admin, I want to manage all tenants and their configurations from a single dashboard | Medium | Implemented |
| US-012 | As an admin, I want to invite team members and assign roles so each person has appropriate access | Medium | Implemented |
| US-013 | As an admin, I want a system health dashboard showing DB, worker, and sync status | Medium | Implemented |
| US-014 | As an admin, I want to suspend/activate tenants for compliance or billing reasons | Medium | Implemented |

### 4.4 Billing Admin (Rachel, P06)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-015 | As a billing admin, I want to see current usage against my plan limit so I can budget | High | Implemented |
| US-016 | As a billing admin, I want to upgrade my plan when approaching limits | High | Implemented |
| US-017 | As a billing admin, I want monthly invoices for accounting reconciliation | Medium | Partial (no PDF, no email) |

### 4.5 Regulator/Auditor (Yael, P07)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-018 | As an auditor, I want read-only access to the complete audit trail for regulatory inspection | Critical | Implemented |
| US-019 | As an auditor, I want hash-chain verification to prove audit logs have not been tampered with | Critical | Implemented |
| US-020 | As an auditor, I want compliance reports summarizing screening activity for a period | Medium | Partial (JSON only, no PDF) |

### 4.6 New User (Emma, P10)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-021 | As a new user, I want an onboarding wizard that suggests lists based on my country | Medium | Partial (endpoint exists, no step-by-step wizard) |
| US-022 | As a new user, I want to run my first screen during onboarding to see the platform in action | Medium | Not implemented |

---

## 5. Technical Constraints and Dependencies

### 5.1 External Dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| PostgreSQL 14+ | Primary database with pgvector | Low (self-hosted) |
| pgvector extension | Vector embedding storage and search | Low (open source) |
| Redis | Rate limiting, caching | Low (optional, in-memory fallback) |
| LemonSqueezy | Payment processing, subscriptions | Medium (vendor lock-in, uptime dependency) |
| OFAC SDN API | US Treasury sanctions list | Low (public endpoint) |
| UN Consolidated List | UN Security Council sanctions | Low (public endpoint) |
| EU Sanctions List | European Union restrictive measures | Low (public endpoint) |
| NBCTF (Israel MOD) | Israeli counter-terrorism financing list | Medium (government endpoint, may have access restrictions) |
| OpenSanctions | Aggregated sanctions data | Low (open source) |

### 5.2 Architecture Constraints

- Go 1.22 required (uses new router patterns)
- Maximum 100 lines per file (project convention)
- Maximum 3 methods per interface
- Value objects validate on construction (NewXxx pattern)
- No panic() in production code
- Table-driven tests only
- Repository pattern (no DB logic in domain)

### 5.3 Regulatory Constraints

- GDPR: Data retention policies, right to erasure, encryption
- SOC 2: Access control, audit trail, change management
- FATF: Sanctions screening requirements
- AI Act (EU): Explainability requirements for AI matching
- BSA/AML (US): FinCEN reporting
- IMPA (Israel): Bank of Israel compliance directives
- PSD2 (EU): Payment services directive

### 5.4 Infrastructure Constraints

- Docker-based deployment
- Kubernetes-ready but not yet deployed to K8s
- Single-region deployment (no multi-region yet)
- PostgreSQL single-write-primary (no multi-master)

---

## 6. Gap Analysis

### 6.1 Critical Gaps

| ID | Gap | Impact | Recommendation |
|----|-----|--------|----------------|
| GAP-001 | **Embedding matcher not wired into screening engine** -- Engine.Screen() only uses 4 of 6 layers (Exact, Fuzzy, Phonetic, Token). EmbeddingMatcher exists but is not called. | Reduces matching accuracy for transliterated names and cross-script variations. A key differentiator is inoperative. | Wire EmbeddingMatcher into Engine with feature flag controlled by TenantConfig.EnableEmbedding. Connect to pgvector for production use. |
| GAP-002 | **Graph matcher is a stub** -- GraphMatcher.Match() returns empty. No GraphDB implementation. No relationship data. | Relationship-based matching (family, business associates) is non-functional. Documented as a feature but not delivered. | Implement GraphDB using PostgreSQL JSONB edges or defer and remove from documentation. Prioritize for Month 9-10 per roadmap. |
| GAP-003 | **Short-circuit optimization not implemented** -- Engine.Screen() runs all layers for all candidates regardless of early high-confidence matches. | Performance degradation at scale. p95 < 50ms target at risk with 6 layers active. | Add break condition after scoring: if confidence > threshold, skip remaining layers per candidate. |
| GAP-004 | **Per-list confidence thresholds not applied** -- TenantConfig supports per-list thresholds but Engine.Screen() uses a single global threshold. | Israeli NBCTF needs different threshold than OFAC due to transliteration. Banks cannot customize screening sensitivity per list. | Pass ListConfig to Engine.Screen() and apply per-list threshold during result filtering. |
| GAP-005 | **Role model mismatch** -- SECURITY.md documents 6 roles (Admin, ComplianceOfficer, AnalystL1/L2/L3, Auditor) but code only implements 4 (Admin, Analyst, Auditor, Viewer). | Tiered analyst access and compliance officer role missing. Cannot enforce investigation depth by analyst level. | Either implement documented roles or update SECURITY.md to match the 4-role implementation. |

### 6.2 High-Priority Gaps

| ID | Gap | Impact | Recommendation |
|----|-----|--------|----------------|
| GAP-006 | **No embedding generation pipeline** -- Embeddings must be manually set via SetVector(). No integration with an embedding model (OpenAI, local). | Embedding layer is unusable in production without manual vector population. | Build embedding generation service using OpenAI text-embedding-3 or a local model. Auto-embed on entity ingestion. |
| GAP-007 | **PEP screening not integrated into main cascade** -- PEP is a separate endpoint, not part of the screening engine. | Compliance officers must run two separate screens (sanctions + PEP) per entity. Missed PEP risk during standard screening. | Add PEP check as post-processing step in screening pipeline or integrate as part of risk score computation. |
| GAP-008 | **No automated adverse media screening** -- AdverseMediaHit records exist but no automated data source. | Media screening is manual-entry only. Key compliance feature not automated. | Integrate with a media screening API or build web scraping pipeline. |
| GAP-009 | **Risk scores not auto-computed during screening** -- RiskScore exists but is not called from the screening pipeline. | Composite risk assessment requires separate manual action. | Compute risk score as screening post-processing and store alongside screening result. |
| GAP-010 | **Invoice PDF and email not implemented** -- Invoice model exists but no PDF generation or email delivery. | Billing admin cannot receive monthly invoices. | Integrate a PDF generation library and email service (SendGrid, SES). |
| GAP-011 | **No alert auto-assignment** -- Alerts have AssignedTo field but no assignment logic or round-robin. | All alerts land in a single queue. No workload distribution. | Implement round-robin or rule-based auto-assignment based on alert priority and analyst capacity. |

### 6.3 Medium-Priority Gaps

| ID | Gap | Impact | Recommendation |
|----|-----|--------|----------------|
| GAP-012 | **No GDPR right-to-erasure implementation** -- Documented as compliance requirement but no deletion endpoint. | Cannot honor data deletion requests. GDPR violation risk. | Add tenant data purge endpoint with cascading deletion and audit record. |
| GAP-013 | **No UBO registry integration** -- Beneficial owners manually entered, no automated lookup. | UBO verification is time-consuming and error-prone. | Integrate with UBO registries (OpenCorporates, national registries). |
| GAP-014 | **No country/industry risk data sources** -- Risk scoring has Country and Industry factors but no data source. | Risk scores cannot include geographic or industry risk without manual input. | Integrate FATF high-risk country list and build industry risk classification. |
| GAP-015 | **Onboarding wizard is single-page** -- No step-by-step guided experience or first-screen walkthrough. | New users may not complete setup properly. | Build multi-step wizard with progress tracking and guided first screen. |
| GAP-016 | **No SSO/SAML support** -- Enterprise tier promises SSO but only OAuth2 implemented. | Enterprise customers with Okta/Azure AD cannot integrate. | Add SAML 2.0 support for Enterprise tier. |
| GAP-017 | **SDK product not implemented** -- VISION.md lists SDK as product line 3 but no downloadable library exists. | SDK product line cannot be sold. Roadmap item for Month 5-6. | Build Go and Python SDK packages that wrap the screening engine for offline use. |
| GAP-018 | **No real-time WebSocket notifications** -- All communication is REST-based polling. | Dashboard users must refresh to see new alerts. | Add WebSocket support for real-time alert notifications. |
| GAP-019 | **No data retention/archival policy** -- Screening data grows indefinitely. | Storage costs increase. GDPR retention compliance unclear. | Implement configurable data retention with automated archival and deletion. |
| GAP-020 | **100-line file limit not enforced in CI** -- CLAUDE.md mandates 100-line limit but no CI lint check. | Files may exceed limit without detection. | Add a CI step that checks file line counts. |

### 6.4 Documentation vs Implementation Gaps

| Area | Documented | Implemented | Status |
|------|-----------|-------------|--------|
| 6-layer matching | 6 layers | 4 active layers | Partial -- Embedding and Graph not wired |
| Short-circuit | Yes (ARCHITECTURE.md) | No | Missing |
| Per-list thresholds | Yes (SPRINT_PLAN.md) | Domain model only | Not wired |
| 6 RBAC roles | Yes (SECURITY.md) | 4 roles | Mismatch |
| PII encryption at rest | Yes (SECURITY.md) | API keys only | Partial |
| Invoice PDF + email | Yes (BILLING_MODEL.md) | JSON model only | Missing |
| SDK product line | Yes (VISION.md) | No implementation | Missing |
| Enterprise SLAs | Yes (VISION.md) | No SLA tooling | Missing |
| Load test validation | Yes (SPRINT_PLAN.md) | k6 scripts exist | Tests exist, results unverified |

### 6.5 Completeness Summary

| Category | Total Requirements | Fully Implemented | Partially Implemented | Not Implemented |
|----------|-------------------|-------------------|-----------------------|-----------------|
| Screening Engine | 8 | 4 | 2 | 2 |
| List Management | 5 | 5 | 0 | 0 |
| Alert Management | 2 | 1 | 1 | 0 |
| Case Management | 2 | 2 | 0 | 0 |
| EDD/PEP/Media/UBO | 4 | 1 | 3 | 0 |
| Transaction Monitoring | 1 | 1 | 0 | 0 |
| Ongoing Monitoring | 1 | 1 | 0 | 0 |
| Risk Assessment | 1 | 0 | 1 | 0 |
| Compliance Reporting | 1 | 0 | 1 | 0 |
| Entity Resolution | 1 | 0 | 1 | 0 |
| Auth/RBAC | 4 | 3 | 1 | 0 |
| Billing | 5 | 3 | 2 | 0 |
| Multi-Tenancy | 2 | 2 | 0 | 0 |
| Audit Trail | 1 | 1 | 0 | 0 |
| Dataset/iFrame | 2 | 1 | 1 | 0 |
| Admin/Platform | 1 | 1 | 0 | 0 |
| Onboarding | 1 | 0 | 1 | 0 |
| Webhooks | 1 | 1 | 0 | 0 |
| Frontend | 5 | 5 | 0 | 0 |
| **TOTAL** | **48** | **32 (67%)** | **14 (29%)** | **2 (4%)** |

---

### 6.6 Prioritized Remediation Roadmap

**Immediate (Sprint Current)**:
1. Wire Embedding matcher into Engine.Screen() behind feature flag (GAP-001)
2. Implement short-circuit optimization (GAP-003)
3. Apply per-list confidence thresholds (GAP-004)
4. Align RBAC roles between code and documentation (GAP-005)

**Next Sprint**:
5. Build embedding generation pipeline (GAP-006)
6. Integrate PEP check into screening pipeline (GAP-007)
7. Auto-compute risk scores during screening (GAP-009)
8. Implement alert auto-assignment (GAP-011)

**Following Sprint**:
9. Add automated adverse media screening (GAP-008)
10. Build invoice PDF generation and email delivery (GAP-010)
11. Implement GDPR data erasure endpoint (GAP-012)
12. Build multi-step onboarding wizard (GAP-015)

**Backlog**:
13. Graph matcher implementation (GAP-002)
14. UBO registry integration (GAP-013)
15. Country/industry risk data sources (GAP-014)
16. SSO/SAML support (GAP-016)
17. SDK product line (GAP-017)
18. Real-time WebSocket notifications (GAP-018)
19. Data retention policy (GAP-019)

---

*This requirements document was generated by deep analysis of the AMLIQ v2 codebase at /Users/shaharsolomon/dev/projects/portfolio/aegis, cross-referencing implementation files, documentation, migration scripts, test files, and architecture documents.*
