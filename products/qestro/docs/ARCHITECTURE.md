# Qestro Architecture Overview

Complete system design for AI-powered testing automation platform.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
│              React + Vite + TailwindCSS                     │
│  Dashboard | Projects | Test Results | Visual Reports      │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────────────────┐
│             Cloudflare Edge Network                         │
│  (CDN, Security, Rate Limiting, CORS)                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
┌──────▼───┐ ┌──────▼────┐ ┌──▼────────┐
│ Workers  │ │ Durable   │ │ KV Cache  │
│ (REST)   │ │ Objects   │ │ (Sessions)│
└──────┬───┘ └───────────┘ └───────────┘
       │
┌──────▼────────────────────────────────────┐
│         Application Services               │
│  • Test Generation (AI)                   │
│  • Test Execution Orchestration           │
│  • Visual Regression Engine               │
│  • CI/CD Integration                      │
│  • Subscription Management                │
└──────┬────────────────────────────────────┘
       │
   ┌───┴────┬─────────┬─────────┐
   │        │         │         │
┌──▼──┐ ┌──▼──┐ ┌────▼──┐ ┌───▼────┐
│ D1  │ │ R2  │ │Maestro│ │OpenAI  │
│(SQL)│ │(CDN)│ │Cloud  │ │(LLM)   │
└─────┘ └─────┘ └───────┘ └────────┘
```

## Core Components

### Frontend (`frontend/`)

**Technology**: React 18 + Vite + TypeScript

**Key Features**:
- Real-time test execution dashboard
- AI-powered test generator UI
- Visual regression viewer
- Project and team management
- OAuth integration (GitHub, Azure)

**Structure**:
```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Route pages
│   ├── services/      # API clients
│   ├── store/         # State management (Zustand)
│   └── hooks/         # Custom React hooks
├── vite.config.ts
└── vitest.config.ts
```

### Workers API (`src/workers/`)

**Technology**: Cloudflare Workers + Typescript

**Key Endpoints**:
- `POST /api/v1/tests/generate` - AI test generation
- `POST /api/v1/tests/run` - Execute tests
- `POST /api/v1/visual/baseline` - Save baselines
- `POST /api/v1/visual/compare` - Compare screenshots
- `GET /api/v1/tests/executions/:id` - Poll status

**Features**:
- Request routing and validation
- JWT authentication
- Rate limiting (KV-backed)
- Response caching
- WebSocket upgrade handling

### Test Generation Service

**Components**:
- Natural Language Parser (NLP)
- AI Prompt Engineer (OpenAI GPT-4)
- Code Validator
- Test Optimizer

**Flow**:
```
User Prompt → Parse → Build AI Prompt → OpenAI → Validate → Optimize → Return Code
```

**Confidence Scoring**:
- Syntax validation: +0.10
- Assertions present: +0.10
- Framework match: +0.20
- Base score: 0.60

### Test Execution Engine

**Supported Frameworks**:
- Playwright (Chromium, Firefox, WebKit)
- Cypress (Chrome, Electron)
- Vitest (Node.js)

**Browsers**:
- Chromium (desktop, tablet, mobile)
- Firefox (desktop)
- WebKit (Safari - desktop, iPad)
- Mobile devices (iOS, Android via Maestro)

**Execution Strategy**:
```
Test Queue → Browser Pool (max 10 concurrent)
  ├── Chromium Runner
  ├── Firefox Runner
  ├── WebKit Runner
  └── Mobile Runner (Maestro)

Results → Screenshot Capture → Visual Diff → Report
```

### Visual Regression Engine

**Baseline Management**:
- Per-browser baselines (chromium, firefox, webkit)
- Per-viewport baselines (desktop, tablet, mobile)
- Versioning and rollback support
- Git-like baseline history

**Comparison Algorithm**:
```
Current Screenshot → Resize to Baseline Dimensions
  ↓
Pixel-by-Pixel Comparison (RGBA)
  ↓
Calculate Diff Percentage
  ↓
Apply Threshold (default: 1%)
  ↓
Pass/Fail Status
```

**Masking**:
- By CSS selector (hide dynamic content)
- Regex-based element matching
- Region masking for timestamps, ads, etc.

### Data Storage

**D1 Database** (SQLite):
```sql
-- Users and organizations
users (id, email, password_hash, created_at)
organizations (id, name, owner_id)
organization_members (org_id, user_id, role)

-- Projects and tests
projects (id, org_id, name, description)
tests (id, project_id, prompt, code, framework, confidence)
test_executions (id, test_id, browser, viewport, status, duration)

-- Visual regression
visual_baselines (id, test_id, browser, viewport, r2_key, created_at)
visual_comparisons (id, baseline_id, diff_percentage, passed)

-- Subscriptions
subscriptions (id, org_id, plan, status, renewal_date)
```

**R2 Storage** (Object):
```
/screenshots/          # Baseline images
  {testId}/baseline-{browser}-{viewport}.png

/recordings/           # Test video recordings
  {executionId}.mp4

/reports/              # HTML reports
  {executionId}/index.html
```

**KV Namespaces**:
- `SESSIONS`: JWT token cache, session data
- `CACHE`: API response caching, rate limit counters
- `RATE_LIMIT`: Per-user request counts

### Durable Objects

**Collaboration DO**:
- Real-time multi-user editing
- WebSocket connections
- Conflict-free replicated data types (CRDTs)

**Test Execution DO**:
- Per-execution state management
- Browser process lifecycle
- Screenshot aggregation
- Result aggregation

## Deployment Architecture

### Development Environment

```
Local Machine
├── Frontend Dev Server (Vite - port 5173)
├── Workers Local (Wrangler - port 8787)
├── SQLite Database (local)
└── Mock External Services
```

### Staging Environment

```
Cloudflare Edge
├── Workers (staging-api.qestro.app)
├── D1 Database (staging)
├── R2 Buckets (staging)
└── KV Namespaces (staging)

External Services
├── OpenAI (GPT-4 turbo)
├── Maestro Cloud (mobile testing)
├── GitHub OAuth
└── Resend (email)
```

### Production Environment

```
┌─ Cloudflare Global Network
│
├─ Workers (api.qestro.app)
│  ├── Web handlers (80, 443)
│  ├── WebSocket (wss://)
│  └── Durable Objects (globally distributed)
│
├─ D1 Database
│  ├── Primary (us-east)
│  └── Replicas (auto-scaling)
│
├─ R2 Storage
│  ├── us-east (primary)
│  ├── eu-west (replica)
│  └── ap-southeast (replica)
│
└─ KV Namespace
   └── Global replication

External Services
├── OpenAI (with retry + fallback)
├── Maestro Cloud (dedicated account)
├── Auth Providers (OAuth)
├── Resend (email + backup SMTP)
└── Sentry (error tracking)
```

## Security Architecture

### Authentication Flow

```
User Email/Password or OAuth
        ↓
  Validate Credentials
        ↓
  Generate JWT (15min) + Refresh Token (7d)
        ↓
  Store Refresh Token in KV (encrypted)
        ↓
  Return Access + Refresh Tokens
```

### Authorization

```
Request with JWT
        ↓
  Verify Signature & Expiry
        ↓
  Extract User ID & Organization
        ↓
  Check Resource Ownership
        ↓
  Check Role-Based Permissions
        ↓
  Allow/Deny
```

### Sensitive Data Protection

- Passwords: bcrypt hashing
- API Keys: AES-256 encryption at rest
- Secrets: Cloudflare secret bindings (never logged)
- CORS: Whitelist allowed origins
- Rate Limiting: Per-user throttling

## Performance Optimization

### Caching Strategy

```
Frontend
  ↓ (static assets)
  → Cloudflare CDN (1 hour)

API Responses
  ↓ (GET requests)
  → KV Cache (5 minutes)
  ↓ (miss)
  → Workers computation

Database Queries
  ↓ (high-frequency reads)
  → KV Cache (15 minutes)
```

### Execution Optimization

- **Test Parallelization**: 10 concurrent browsers max
- **Browser Pooling**: Reuse browser instances
- **Screenshot Compression**: JPEG with 85% quality
- **Deduplication**: Skip unchanged tests

### Database Optimization

- Connection pooling in D1
- Query result caching
- Index optimization for common queries
- Automatic vacuum on large tables

## Monitoring & Observability

### Logging

```javascript
// Structured logging
logger.info('test_started', {
  testId: 'tst_123',
  browser: 'chromium',
  timestamp: new Date(),
  userId: 'user_456'
});
```

### Metrics

- Test execution time (p50, p95, p99)
- AI generation success rate
- Visual regression false positive rate
- API response time by endpoint
- User concurrency
- Error rate by type

### Tracing

- End-to-end request tracing via X-Trace-ID
- Distributed tracing for multi-service workflows
- Durable Object execution traces

### Alerting

- Test execution timeout (>5min)
- AI generation failures (>5%)
- High error rate (>1%)
- Database query slowness (>1sec)
- R2 upload failures

## Disaster Recovery

### Backup Strategy

- D1: Continuous replication to geographic replicas
- R2: Cross-region replication (us, eu, ap)
- KV: Automatic geo-distribution
- Secrets: Encrypted in Cloudflare vault

### Failover

- Multi-region R2 access with automatic fallback
- Database read replicas for query distribution
- Worker instance auto-scaling
- Manual failover procedures documented

## Scalability

### Horizontal Scaling

- Workers: Auto-scale based on traffic
- Durable Objects: Consistent hashing for distribution
- R2: Unlimited scalability
- D1: Automatic query optimization

### Limits & Quotas

- Tests per execution: 100
- Test duration: 5 minutes (max)
- Screenshot size: 10 MB
- Concurrent executions per user: 5
- Free plan: 100 tests/month
- Team plan: Unlimited tests

## Development Workflow

```
Feature Branch → Local Dev → Unit Tests → Integration Tests
  ↓
  → Deploy to Staging → E2E Tests → Manual QA
  ↓
  → Code Review → Staging Validation
  ↓
  → Production Deploy → Monitoring & Alerts
```

## CI/CD Pipeline

**GitHub Actions**:
- Run tests on PR
- Check coverage (>95%)
- Run security scanning (bandit)
- Build and deploy preview
- Deploy to production on merge to main
