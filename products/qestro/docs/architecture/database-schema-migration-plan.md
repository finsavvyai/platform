# Database Schema Migration Plan
## Importing Cloudflare D1 Schema to Node.js/PostgreSQL

**Status:** 📋 Planning Phase
**Target Completion:** Week 2 (Dec 19-25, 2025)
**Source:** `/archive/cloudflare-workers-backend/db/`
**Destination:** `/backend/src/database/`

---

## Executive Summary

The Cloudflare Workers implementation contains a **superior database schema** with 35+ comprehensive tables (1,666 lines of SQL). This schema represents significant architectural planning and must be migrated to the Node.js/PostgreSQL backend.

**Migration Value:**
- ✅ 35+ production-ready table definitions
- ✅ Advanced features: AI tracking, SSO/SAML, test execution
- ✅ Proper relationships, indexes, constraints
- ✅ Type-safe TypeScript interfaces
- ✅ Migration system designed

---

## Current State Analysis

### Cloudflare D1 Schema (`/archive/cloudflare-workers-backend/db/`)

**Key Tables Identified:**

#### Core Tables
- `users` - User management with SSO support
- `projects` - Project workspace management
- `recording_sessions` - Test recording sessions
- `test_cases` - Individual test case definitions
- `test_suites` - Test suite organization
- `test_runs` - Test execution tracking

#### AI & Analytics Tables
- `ai_generation_logs` - AI test generation tracking
- `ai_optimization_logs` - AI optimization history
- `coverage_analysis_logs` - Code coverage analysis
- `ai_usage_metrics` - AI service usage and costs
- `ai_providers` - Multi-provider AI configuration

#### Advanced Features
- `sso_providers` - SSO/SAML configurations
- `sso_configurations` - Enterprise SSO settings
- `integration_test_runs` - Integration test tracking
- `test_execution_queue` - Distributed test execution
- `device_reservations` - Mobile device management
- `real_time_sessions` - WebSocket collaboration sessions

#### Business & Billing
- `subscriptions` - User subscription management
- `invoices` - Billing and invoicing
- `payment_methods` - Payment processing
- `usage_metrics` - Feature usage tracking
- `audit_logs` - Comprehensive audit trail

**Total:** 35+ tables, ~1,666 lines of schema SQL

---

## Migration Strategy

### Phase 1: Schema Extraction (Week 2, Day 1-2)

#### Step 1: Extract Drizzle Schema Definitions

```bash
# Copy schema files from archive
cp archive/cloudflare-workers-backend/db/schema.ts backend/src/database/schema-cloudflare-import.ts

# Review and adapt for PostgreSQL
# D1 (SQLite) → PostgreSQL differences to address:
# - INTEGER vs SERIAL/BIGSERIAL
# - TEXT vs VARCHAR/TEXT
# - BLOB vs BYTEA
# - Index syntax differences
```

#### Step 2: Create Migration Files

```typescript
// backend/src/database/migrations/0005_comprehensive_schema.sql

-- Core Tables
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  sso_provider VARCHAR(50),
  sso_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_sso ON users(sso_provider, sso_id);

-- [Continue for all 35+ tables...]
```

### Phase 2: Adapt for PostgreSQL (Week 2, Day 3-4)

#### Type Conversions

| D1 (SQLite) | PostgreSQL | Notes |
|-------------|------------|-------|
| INTEGER | SERIAL/BIGSERIAL | Auto-incrementing IDs |
| TEXT | VARCHAR/TEXT | Size limits consideration |
| BLOB | BYTEA | Binary data |
| DATETIME | TIMESTAMP | Timezone support |
| REAL | DOUBLE PRECISION | Floating point |

#### PostgreSQL Enhancements

```sql
-- Add enum types (PostgreSQL native)
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer');
CREATE TYPE test_status AS ENUM ('pending', 'running', 'passed', 'failed');
CREATE TYPE ai_provider AS ENUM ('openai', 'anthropic', 'huggingface', 'local');

-- Add advanced indexing
CREATE INDEX CONCURRENTLY idx_test_cases_project_status
  ON test_cases(project_id, status)
  WHERE status != 'archived';

-- Add full-text search
CREATE INDEX idx_test_cases_search
  ON test_cases USING GIN(to_tsvector('english', name || ' ' || description));

-- Add partitioning for large tables
CREATE TABLE audit_logs (
  id BIGSERIAL,
  created_at TIMESTAMP NOT NULL,
  -- ... other columns
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2025_q1 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
```

### Phase 3: Drizzle ORM Integration (Week 2, Day 4-5)

#### Convert to Drizzle Schema

```typescript
// backend/src/database/schema/users.ts
import { pgTable, bigserial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  ssoProvider: varchar('sso_provider', { length: 50 }),
  ssoId: varchar('sso_id', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Add indexes
export const usersEmailIndex = index('idx_users_email').on(users.email);
export const usersSsoIndex = index('idx_users_sso').on(users.ssoProvider, users.ssoId);
```

#### Generate Migrations

```bash
# Generate migration from Drizzle schema
cd backend
npm run db:generate

# This creates: drizzle/migrations/0005_comprehensive_schema.sql
```

### Phase 4: Testing & Validation (Week 2, Day 5-7)

#### Migration Testing Checklist

```bash
# 1. Test on local PostgreSQL
createdb qestro_test
npm run db:migrate:local

# 2. Verify all tables created
psql qestro_test -c "\dt"

# 3. Verify indexes
psql qestro_test -c "\di"

# 4. Test foreign key constraints
# Insert test data, verify relationships work

# 5. Test Drizzle queries
npm run test:database

# 6. Performance testing
# Run query benchmarks on large datasets
```

---

## Table-by-Table Migration Guide

### High Priority (Week 2, Days 1-2)

#### 1. Core User & Project Tables
```sql
-- users, projects, teams, team_members
-- Status: CRITICAL - Required for authentication
-- Complexity: LOW
-- Time: 4 hours
```

#### 2. Test Management Tables
```sql
-- test_cases, test_suites, test_runs, test_results
-- Status: CRITICAL - Core product functionality
-- Complexity: MEDIUM
-- Time: 8 hours
```

#### 3. Recording & Execution Tables
```sql
-- recording_sessions, test_execution_sessions, test_execution_queue
-- Status: HIGH - Real-time features
-- Complexity: MEDIUM
-- Time: 6 hours
```

### Medium Priority (Week 2, Days 3-4)

#### 4. AI Services Tables
```sql
-- ai_generation_logs, ai_optimization_logs, ai_usage_metrics, ai_providers
-- Status: HIGH - Differentiating feature
-- Complexity: MEDIUM
-- Time: 6 hours
```

#### 5. SSO & Authentication Tables
```sql
-- sso_providers, sso_configurations, oauth_tokens
-- Status: HIGH - Enterprise requirement
-- Complexity: HIGH
-- Time: 8 hours
```

#### 6. Device Management Tables
```sql
-- devices, device_reservations, device_capabilities
-- Status: MEDIUM - Mobile testing
-- Complexity: MEDIUM
-- Time: 4 hours
```

### Lower Priority (Week 2, Days 5-7)

#### 7. Analytics & Metrics Tables
```sql
-- usage_metrics, performance_metrics, analytics_events
-- Status: MEDIUM - Business intelligence
-- Complexity: LOW
-- Time: 4 hours
```

#### 8. Billing & Subscriptions Tables
```sql
-- subscriptions, invoices, payment_methods, usage_limits
-- Status: MEDIUM - Revenue features
-- Complexity: MEDIUM
-- Time: 6 hours
```

#### 9. Audit & Compliance Tables
```sql
-- audit_logs, compliance_reports, data_retention_policies
-- Status: LOW - Nice to have
-- Complexity: LOW
-- Time: 3 hours
```

---

## Migration Commands

### Development Environment

```bash
# 1. Generate migration from Drizzle schema
cd backend
npm run db:generate

# 2. Apply migration locally
npm run db:migrate:local

# 3. Verify migration
npm run db:verify

# 4. Seed test data
npm run db:seed
```

### Staging Environment

```bash
# 1. Backup existing database
npm run db:backup

# 2. Apply migration
npm run db:migrate:staging

# 3. Verify data integrity
npm run db:verify:staging

# 4. Run smoke tests
npm run test:smoke:staging
```

### Production Environment

```bash
# 1. Create full backup
npm run db:backup:production

# 2. Run migration in transaction
npm run db:migrate:production

# 3. Verify all tables and indexes
npm run db:verify:production

# 4. Monitor performance
npm run db:monitor

# 5. Rollback if issues
npm run db:rollback:production  # Emergency only
```

---

## Validation Checklist

### Schema Validation

- [ ] All 35+ tables created
- [ ] All foreign keys defined
- [ ] All indexes created
- [ ] All constraints (UNIQUE, NOT NULL) working
- [ ] Enum types defined (PostgreSQL)
- [ ] Default values set correctly
- [ ] Timestamps auto-updating

### Data Integrity

- [ ] Can insert test records into all tables
- [ ] Foreign key relationships enforce correctly
- [ ] Cascading deletes work as expected
- [ ] Unique constraints prevent duplicates
- [ ] NULL constraints enforced

### Performance

- [ ] Indexes improve query speed (measure before/after)
- [ ] Full-text search works on text columns
- [ ] Partitioned tables perform well
- [ ] Query plan analysis shows index usage
- [ ] No N+1 query problems

### Application Integration

- [ ] Drizzle ORM queries work correctly
- [ ] All services can access their tables
- [ ] TypeScript types match schema
- [ ] Migrations run idempotently
- [ ] Rollback procedures tested

---

## Risk Mitigation

### Risk 1: Data Type Incompatibilities
**Mitigation:** Test conversion scripts, create mapping table

### Risk 2: Performance Degradation
**Mitigation:** Index strategy, query optimization, benchmarking

### Risk 3: Migration Failures
**Mitigation:** Transaction-based migrations, backup procedures, rollback plan

### Risk 4: Downtime During Migration
**Mitigation:** Blue-green deployment, schema versioning, feature flags

---

## Timeline

| Day | Activity | Time | Owner |
|-----|----------|------|-------|
| Day 1 | Extract schema, convert types | 6h | Backend Lead |
| Day 2 | Create migration files, test locally | 6h | Backend Lead |
| Day 3 | Adapt for PostgreSQL enhancements | 4h | Backend Lead |
| Day 4 | Drizzle ORM integration | 4h | Backend Lead |
| Day 5 | Testing & validation | 6h | QA + Backend |
| Day 6 | Staging deployment | 3h | DevOps |
| Day 7 | Documentation & handoff | 2h | Backend Lead |

**Total Effort:** 31 hours (~4 days)

---

## Success Criteria

✅ **Complete when:**
1. All 35+ tables created in PostgreSQL
2. All foreign keys and indexes verified
3. Drizzle ORM queries working
4. Local and staging tests passing
5. Performance benchmarks met
6. Documentation updated
7. Team trained on new schema

---

## Post-Migration Tasks

### Immediate (Week 3)
- [ ] Update all service files to use new schema
- [ ] Add database migration to CI/CD pipeline
- [ ] Create database documentation
- [ ] Train team on schema structure

### Short-term (Week 4)
- [ ] Optimize slow queries
- [ ] Add missing indexes based on usage
- [ ] Implement query caching
- [ ] Set up database monitoring

### Long-term (Month 2-3)
- [ ] Consider read replicas for scaling
- [ ] Implement connection pooling optimization
- [ ] Add database backup automation
- [ ] Plan for data archival strategy

---

**Status:** Ready to begin Week 2
**Owner:** Backend Team Lead
**Review Date:** Dec 19, 2025

---

*This migration plan ensures we preserve the excellent database design from the Cloudflare implementation while adapting it for PostgreSQL's superior features.*
