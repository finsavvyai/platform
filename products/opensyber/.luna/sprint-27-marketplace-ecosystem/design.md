# Sprint 27: Marketplace + Skill Ecosystem -- Technical Design Document

**Scope**: OpenSyber / Sprint 27 Marketplace + Skill Ecosystem
**Generated**: 2026-03-07
**Agent**: Design Architect Agent
**Based on**: requirements.md
**Status**: Implementation-Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Skill SDK Design](#skill-sdk-design)
4. [Package Format](#package-format)
5. [Data Models](#data-models)
6. [API Design](#api-design)
7. [Frontend Pages](#frontend-pages)
8. [Skill Runtime](#skill-runtime)
9. [Revenue Sharing](#revenue-sharing)
10. [Security Design](#security-design)
11. [Testing Strategy](#testing-strategy)
12. [Migration Plan](#migration-plan)

---

## Executive Summary

### Design Goals

1. **Extensible SDK**: Type-safe `@opensyber/skill-sdk` package that lets developers
   build skills in isolation, test locally, and publish to the marketplace.
2. **Standardized Packaging**: `.opensyber-skill` tarball format with manifest
   validation, integrity checking, and automated security scanning.
3. **Marketplace Platform**: Browse, install, rate, and monetize skills through
   a polished marketplace UI and API.
4. **Skill Runtime**: Load and execute skills within the Worker environment with
   output validation, scheduling, and error handling.
5. **Revenue Engine**: 70/30 revenue share via LemonSqueezy with publisher dashboards.

### Key Architectural Decisions

| Decision | Rationale | Impact |
|---|---|---|
| SDK as separate npm package | Developers build without touching monorepo | `packages/skill-sdk/` in workspace |
| `.opensyber-skill` = tar.gz + manifest | Simple, inspectable, version-controllable | R2 storage, SHA-256 integrity |
| Worker-level skill execution | Avoid Hetzner VM overhead for Phase 1 | 5-min timeout, 128MB Worker limit |
| Extend existing `skills` table | Backward compatible with Sprint 2 schema | Add columns, not new table |
| LemonSqueezy per-skill checkout | Reuse existing billing infra | One variant per paid skill |
| Cursor-based pagination on marketplace | Consistent with all existing API patterns | `nextCursor` + `hasMore` |

---

## System Architecture

### High-Level Architecture

```
Developer Workstation               OpenSyber Platform                    End Users
--------------------               ------------------                    ---------

packages/skill-sdk/    ------>   apps/api/
  SkillProfile                     routes/marketplace.ts     <------   apps/web/
  SkillContext                     routes/marketplace-       marketplace/page.tsx
  SkillEmitter                       publish.ts              marketplace/[id]/page.tsx
  defineSkill()                    routes/marketplace-       marketplace/publish/page.tsx
  MockSkillContext                   install.ts              marketplace/my-skills/page.tsx
                                   routes/marketplace-
opensyber-skill pack                 admin.ts
  |                                  |
  v                                  v
.opensyber-skill  ----upload--->  R2 (STORAGE bucket)
  manifest.json                      |
  dist/index.js                      v
  README.md                       Skill Runtime Engine
                                    SkillExecutor
                                    SkillScheduler
                                    OutputValidator
                                      |
                                      v
                                  D1 Database
                                    skills (extended)
                                    marketplace_submissions
                                    marketplace_installs
                                    marketplace_ratings
                                    skill_versions
                                    skill_executions
                                    publisher_payouts
```

### Technology Stack

- **SDK**: TypeScript package, zero runtime deps, Zod for config schemas
- **API**: Hono routes on Cloudflare Workers (existing pattern)
- **Storage**: R2 for `.opensyber-skill` packages
- **Database**: D1 with Drizzle ORM (existing)
- **Frontend**: Next.js 16 server/client components (existing)
- **Auth**: Clerk JWT + RBAC middleware (existing)
- **Payments**: LemonSqueezy for paid skill subscriptions
- **Validation**: Zod on all API inputs

---

## Skill SDK Design

### Package Structure

```
packages/skill-sdk/
  src/
    types.ts           -- SkillProfile, SkillContext, SkillEmitter interfaces
    outputs.ts         -- Typed output input interfaces (FindingInput, etc.)
    targets.ts         -- SkillTarget, ResolvedTarget types
    define.ts          -- defineSkill() helper
    testing.ts         -- MockSkillContext, MockEmitter
    runner.ts          -- LocalSkillRunner for dev
    logger.ts          -- SkillLogger interface
    index.ts           -- Barrel export
  package.json         -- @opensyber/skill-sdk
  tsconfig.json
  vitest.config.ts
```

### Core Types

#### `types.ts` -- SkillProfile

```typescript
import type { z } from 'zod';
import type { Permission } from '@opensyber/shared';

export type SkillCategory =
  | 'agent_monitor'
  | 'integration'
  | 'cspm'
  | 'saas'
  | 'ai_intelligence'
  | 'automation'
  | 'compliance'
  | 'developer_tools'
  | 'identity';

export type SkillTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface SkillSchedule {
  cron?: string;
  trigger?: 'event' | 'stream' | 'on_demand' | 'webhook';
  event?: string;
}

export interface DashboardWidgetSpec {
  id: string;
  title: string;
  type: 'stat' | 'bar' | 'gauge' | 'table' | 'timeline' | 'score_card';
}

export interface SkillOutputSpec {
  type: string;
  table?: string;
  category?: string;
  source?: string;
  weight?: number;
}

export interface SkillProfile<TConfig = unknown> {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: SkillCategory;
  tier: SkillTier;
  targets: SkillTarget[];
  requiredPermissions: Permission[];
  configSchema: z.ZodSchema<TConfig>;
  outputs: SkillOutputSpec[];
  widgets: DashboardWidgetSpec[];
  schedule: SkillSchedule;
  run: (ctx: SkillContext<TConfig>) => Promise<void>;
}
```

#### `types.ts` -- SkillContext

```typescript
export interface SkillContext<TConfig = unknown> {
  orgId: string;
  instanceId: string;
  config: TConfig;
  targets: ResolvedTarget[];
  emit: SkillEmitter;
  log: SkillLogger;
  vault: VaultClient;
  http: HttpClient;
}

export interface SkillEmitter {
  finding(input: CspmFindingInput): void;
  saasFinding(input: SaasFindingInput): void;
  riskDelta(input: RiskDeltaInput): void;
  attackEdge(input: AssetRelationInput): void;
  complianceEvidence(input: EvidenceInput): void;
  remediationSuggestion(input: RemediationInput): void;
  metric(input: MetricInput): void;
}

export interface SkillLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

export interface VaultClient {
  read(key: string): Promise<string | null>;
}

export interface HttpClient {
  get(url: string, opts?: RequestInit): Promise<Response>;
  post(url: string, body: unknown, opts?: RequestInit): Promise<Response>;
}
```

#### `outputs.ts` -- Typed Emit Inputs

```typescript
export interface CspmFindingInput {
  checkId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resourceId: string;
  resourceType: string;
  region?: string;
  title: string;
  description?: string;
  remediation?: string;
  complianceFrameworks?: string[];
}

export interface SaasFindingInput {
  checkId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  provider: string;
  resourceId: string;
  title: string;
  description?: string;
  remediation?: string;
}

export interface RiskDeltaInput {
  source: string;
  weight: number;
  score: number;
  reason: string;
}

export interface AssetRelationInput {
  sourceAssetId: string;
  targetAssetId: string;
  relationType: string;
  metadata?: Record<string, unknown>;
}

export interface EvidenceInput {
  controlId: string;
  status: 'pass' | 'fail' | 'partial';
  evidence: string;
  collectedAt: string;
}

export interface RemediationInput {
  findingId: string;
  action: string;
  description: string;
  automated: boolean;
  steps?: string[];
}

export interface MetricInput {
  name: string;
  value: number;
  tags?: Record<string, string>;
}
```

#### `targets.ts` -- Target Types

```typescript
export type TargetType =
  | 'aws_account'
  | 'gcp_project'
  | 'azure_subscription'
  | 'github_org'
  | 'github_repo'
  | 'microsoft_365_tenant'
  | 'opensyber_agent'
  | 'opensyber_platform'
  | 'opensyber_data'
  | 'web_app'
  | 'database_connection'
  | 'api_spec_url'
  | 'transaction_stream';

export interface SkillTarget {
  type: TargetType;
  required: boolean;
}

export interface ResolvedTarget {
  type: TargetType;
  id: string;
  credentials?: Record<string, string>;
  metadata?: Record<string, unknown>;
}
```

#### `define.ts` -- Skill Definition Helper

```typescript
import type { SkillProfile } from './types.js';

/**
 * Type-safe skill definition helper.
 * Validates the profile shape at compile time.
 */
export function defineSkill<TConfig>(
  profile: SkillProfile<TConfig>,
): SkillProfile<TConfig> {
  if (!profile.id || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(profile.id)) {
    throw new Error(`Invalid skill id: "${profile.id}" -- use lowercase with hyphens`);
  }
  if (!profile.version || !/^\d+\.\d+\.\d+/.test(profile.version)) {
    throw new Error(`Invalid version: "${profile.version}" -- use semver`);
  }
  if (typeof profile.run !== 'function') {
    throw new Error('Skill must have a run() function');
  }
  return profile;
}
```

#### `testing.ts` -- Mock Context

```typescript
import type {
  SkillContext, SkillEmitter, SkillLogger,
  VaultClient, HttpClient,
} from './types.js';
import type {
  CspmFindingInput, SaasFindingInput, RiskDeltaInput,
  AssetRelationInput, EvidenceInput, RemediationInput, MetricInput,
} from './outputs.js';

export interface CapturedOutputs {
  findings: CspmFindingInput[];
  saasFindings: SaasFindingInput[];
  riskDeltas: RiskDeltaInput[];
  attackEdges: AssetRelationInput[];
  evidence: EvidenceInput[];
  remediations: RemediationInput[];
  metrics: MetricInput[];
  logs: Array<{ level: string; message: string; data?: Record<string, unknown> }>;
}

export function createMockContext<TConfig>(opts: {
  orgId?: string;
  instanceId?: string;
  config: TConfig;
  vaultData?: Record<string, string>;
}): { ctx: SkillContext<TConfig>; captured: CapturedOutputs } {
  const captured: CapturedOutputs = {
    findings: [], saasFindings: [], riskDeltas: [],
    attackEdges: [], evidence: [], remediations: [],
    metrics: [], logs: [],
  };

  const emit: SkillEmitter = {
    finding: (f) => captured.findings.push(f),
    saasFinding: (f) => captured.saasFindings.push(f),
    riskDelta: (d) => captured.riskDeltas.push(d),
    attackEdge: (e) => captured.attackEdges.push(e),
    complianceEvidence: (e) => captured.evidence.push(e),
    remediationSuggestion: (r) => captured.remediations.push(r),
    metric: (m) => captured.metrics.push(m),
  };

  const log: SkillLogger = {
    info: (msg, data) => captured.logs.push({ level: 'info', message: msg, data }),
    warn: (msg, data) => captured.logs.push({ level: 'warn', message: msg, data }),
    error: (msg, data) => captured.logs.push({ level: 'error', message: msg, data }),
    debug: (msg, data) => captured.logs.push({ level: 'debug', message: msg, data }),
  };

  const vault: VaultClient = {
    read: async (key) => opts.vaultData?.[key] ?? null,
  };

  const http: HttpClient = {
    get: async () => new Response('{}', { status: 200 }),
    post: async () => new Response('{}', { status: 200 }),
  };

  const ctx: SkillContext<TConfig> = {
    orgId: opts.orgId ?? 'org-test',
    instanceId: opts.instanceId ?? 'inst-test',
    config: opts.config,
    targets: [],
    emit, log, vault, http,
  };

  return { ctx, captured };
}
```

---

## Package Format

### `.opensyber-skill` Structure

```
my-skill-1.0.0.opensyber-skill   (tar.gz)
  manifest.json                    -- Serialized SkillProfile (no run fn)
  dist/
    index.js                       -- Compiled, bundled entry point
    index.js.map                   -- Optional source map
  README.md                        -- Optional documentation
  screenshots/                     -- Optional directory
    preview.png
```

### `manifest.json` Schema

```typescript
interface SkillManifest {
  // Identity
  id: string;                       // 'cursor-monitor'
  name: string;                     // 'Cursor Agent Monitor'
  version: string;                  // '1.0.0'
  description: string;
  author: string;
  license: string;                  // 'MIT' | 'proprietary'

  // Classification
  category: SkillCategory;
  tier: SkillTier;

  // Capability declarations
  targets: SkillTarget[];
  requiredPermissions: Permission[];
  configSchema: object;             // JSON Schema (from Zod .toJsonSchema())
  outputs: SkillOutputSpec[];
  widgets: DashboardWidgetSpec[];
  schedule: SkillSchedule;

  // Bundle metadata
  bundleEntry: string;              // 'dist/index.js'
  bundleHash: string;               // SHA-256 of dist/index.js
  sdkVersion: string;               // '@opensyber/skill-sdk' version used

  // Marketplace metadata
  pricing?: {
    type: 'free' | 'paid';
    monthlyPriceCents?: number;     // e.g. 1900 = $19/mo
  };
  tags?: string[];
  homepage?: string;
  repository?: string;
  screenshots?: string[];          // paths within package
}
```

### Validation Pipeline

```
Upload .opensyber-skill
  |
  v
1. Decompress + extract tar.gz
  |
  v
2. Parse manifest.json
   - Zod validation against ManifestSchema
   - Verify id format (lowercase, hyphens, 3-50 chars)
   - Verify version is valid semver
   - Verify bundleEntry file exists in archive
  |
  v
3. Integrity check
   - SHA-256(dist/index.js) === manifest.bundleHash
   - Total uncompressed size < 50MB
  |
  v
4. Static analysis (security scan)
   - Scan for eval(), Function(), dynamic import()
   - Scan for fetch() to non-declared domains
   - Scan for fs/child_process requires
   - Scan for known malicious patterns
  |
  v
5. Permission audit
   - Declared permissions match actual usage
   - No undeclared network access
  |
  v
6. Store in R2 + create submission record
   Key: skills/{skillId}/{version}/package.opensyber-skill
```

---

## Data Models

### Migration: `0014_marketplace.sql`

```sql
-- Extend existing skills table with marketplace columns
ALTER TABLE skills ADD COLUMN item_type TEXT DEFAULT 'agent_skill';
ALTER TABLE skills ADD COLUMN tier TEXT DEFAULT 'free';
ALTER TABLE skills ADD COLUMN price_cents INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN metadata TEXT;
ALTER TABLE skills ADD COLUMN manifest TEXT;
ALTER TABLE skills ADD COLUMN bundle_r2_key TEXT;
ALTER TABLE skills ADD COLUMN sdk_version TEXT;
ALTER TABLE skills ADD COLUMN publisher_id TEXT;
ALTER TABLE skills ADD COLUMN license TEXT DEFAULT 'MIT';
ALTER TABLE skills ADD COLUMN homepage TEXT;
ALTER TABLE skills ADD COLUMN repository TEXT;
ALTER TABLE skills ADD COLUMN tags TEXT;
ALTER TABLE skills ADD COLUMN screenshots TEXT;
ALTER TABLE skills ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN is_certified INTEGER DEFAULT 0;

-- Skill versions (track all published versions)
CREATE TABLE skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  manifest TEXT NOT NULL,
  bundle_r2_key TEXT NOT NULL,
  bundle_hash TEXT NOT NULL,
  changelog TEXT,
  sdk_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(skill_id, version)
);

-- Marketplace submissions (review pipeline)
CREATE TABLE marketplace_submissions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES skill_versions(id),
  submitted_by TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,
  scan_status TEXT DEFAULT 'pending',
  scan_report TEXT
);

-- Marketplace installs (org-level, not instance-level)
CREATE TABLE marketplace_installs (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  org_id TEXT,
  user_id TEXT NOT NULL,
  installed_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  config TEXT,
  ls_subscription_id TEXT,
  UNIQUE(skill_id, COALESCE(org_id, user_id))
);

-- Marketplace ratings
CREATE TABLE marketplace_ratings (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  org_id TEXT,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(skill_id, COALESCE(org_id, user_id))
);

-- Skill execution log
CREATE TABLE skill_executions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  org_id TEXT,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  output_count INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0
);

-- Publisher payouts
CREATE TABLE publisher_payouts (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_revenue_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  net_payout_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  ls_payout_id TEXT
);

-- Indexes
CREATE INDEX idx_skill_versions_skill ON skill_versions(skill_id);
CREATE INDEX idx_submissions_status ON marketplace_submissions(review_status);
CREATE INDEX idx_installs_org ON marketplace_installs(org_id);
CREATE INDEX idx_installs_skill ON marketplace_installs(skill_id);
CREATE INDEX idx_ratings_skill ON marketplace_ratings(skill_id);
CREATE INDEX idx_executions_skill ON skill_executions(skill_id);
CREATE INDEX idx_executions_org ON skill_executions(org_id);
CREATE INDEX idx_payouts_publisher ON publisher_payouts(publisher_id);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_tier ON skills(tier);
CREATE INDEX idx_skills_featured ON skills(is_featured);
```

### Drizzle Schema: `packages/db/src/schema/marketplace.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { skills } from './instances.js';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const skillVersions = sqliteTable('skill_versions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  manifest: text('manifest').notNull(), // JSON
  bundleR2Key: text('bundle_r2_key').notNull(),
  bundleHash: text('bundle_hash').notNull(),
  changelog: text('changelog'),
  sdkVersion: text('sdk_version').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const marketplaceSubmissions = sqliteTable('marketplace_submissions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  versionId: text('version_id').notNull().references(() => skillVersions.id),
  submittedBy: text('submitted_by').notNull(),
  submittedAt: text('submitted_at').notNull().default(sql`(datetime('now'))`),
  reviewStatus: text('review_status', {
    enum: ['pending', 'scanning', 'in_review', 'approved', 'rejected'],
  }).notNull().default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: text('reviewed_at'),
  reviewNotes: text('review_notes'),
  scanStatus: text('scan_status', {
    enum: ['pending', 'clean', 'flagged', 'failed'],
  }).default('pending'),
  scanReport: text('scan_report'), // JSON
});

export const marketplaceInstalls = sqliteTable('marketplace_installs', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  orgId: text('org_id').references(() => organizations.id),
  userId: text('user_id').notNull().references(() => users.id),
  installedAt: text('installed_at').notNull().default(sql`(datetime('now'))`),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  config: text('config'), // JSON
  lsSubscriptionId: text('ls_subscription_id'),
});

export const marketplaceRatings = sqliteTable('marketplace_ratings', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  orgId: text('org_id').references(() => organizations.id),
  userId: text('user_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  review: text('review'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const skillExecutions = sqliteTable('skill_executions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skills.id),
  orgId: text('org_id').references(() => organizations.id),
  userId: text('user_id').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  status: text('status', {
    enum: ['running', 'completed', 'failed', 'timeout'],
  }).notNull().default('running'),
  outputCount: integer('output_count').notNull().default(0),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  retryCount: integer('retry_count').notNull().default(0),
});

export const publisherPayouts = sqliteTable('publisher_payouts', {
  id: text('id').primaryKey(),
  publisherId: text('publisher_id').notNull(),
  skillId: text('skill_id').notNull().references(() => skills.id),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  grossRevenueCents: integer('gross_revenue_cents').notNull().default(0),
  platformFeeCents: integer('platform_fee_cents').notNull().default(0),
  netPayoutCents: integer('net_payout_cents').notNull().default(0),
  status: text('status', {
    enum: ['pending', 'processing', 'paid', 'failed'],
  }).notNull().default('pending'),
  paidAt: text('paid_at'),
  lsPayoutId: text('ls_payout_id'),
});
```

### Existing `skills` Table Column Extensions

The existing `skills` table in `instances.ts` needs these new columns added.
Rather than modifying the existing schema file (which would break backward compat),
the migration adds them and the Drizzle schema is updated in-place:

```typescript
// Added to existing skills table definition in instances.ts
itemType: text('item_type', {
  enum: ['agent_skill', 'agent_monitor', 'integration', 'compliance_pack'],
}).default('agent_skill'),
tier: text('tier', {
  enum: ['free', 'pro', 'team', 'enterprise'],
}).default('free'),
priceCents: integer('price_cents').default(0),
metadata: text('metadata'),       // JSON
manifest: text('manifest'),       // JSON
bundleR2Key: text('bundle_r2_key'),
sdkVersion: text('sdk_version'),
publisherId: text('publisher_id'),
license: text('license').default('MIT'),
homepage: text('homepage'),
repository: text('repository'),
tags: text('tags'),               // JSON array
screenshots: text('screenshots'), // JSON array
isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
isCertified: integer('is_certified', { mode: 'boolean' }).default(false),
```

---

## API Design

### New Permissions

Add to `packages/shared/src/constants/permissions.ts`:

```typescript
// Marketplace
'marketplace.browse': 'marketplace.browse',
'marketplace.install': 'marketplace.install',
'marketplace.publish': 'marketplace.publish',
'marketplace.admin': 'marketplace.admin',
```

Add `marketplace.browse` to `VIEW_PERMISSIONS`. Add `marketplace.install` and
`marketplace.publish` to `developer`, `security`, `admin`, `owner`. Add
`marketplace.admin` to `admin` and `owner`.

### Route Files

#### `apps/api/src/routes/marketplace-browse.ts`

```
GET  /api/marketplace
  Query: ?category=&tier=&search=&sort=popular|newest|rating&cursor=&limit=20
  Auth: requirePermission('marketplace.browse')
  Response: { data: SkillListItem[], nextCursor, hasMore }

GET  /api/marketplace/:id
  Auth: requirePermission('marketplace.browse')
  Response: { data: SkillDetail }

GET  /api/marketplace/:id/versions
  Auth: requirePermission('marketplace.browse')
  Response: { data: SkillVersion[] }
```

#### `apps/api/src/routes/marketplace-install.ts`

```
POST   /api/marketplace/:id/install
  Auth: requirePermission('marketplace.install')
  Body: { config?: Record<string, unknown> }
  Validation:
    - Skill exists + approved
    - Plan tier allows this skill tier
    - Plan install limit not exceeded
    - Required permissions satisfied
    - If paid: LemonSqueezy checkout URL returned
  Response: { data: MarketplaceInstall } | { checkoutUrl: string }

DELETE /api/marketplace/:id/install
  Auth: requirePermission('marketplace.install')
  Response: { data: { uninstalled: true } }

GET    /api/marketplace/installed
  Auth: requirePermission('marketplace.browse')
  Response: { data: InstalledSkill[] }

PATCH  /api/marketplace/installed/:installId/config
  Auth: requirePermission('marketplace.install')
  Body: { config: Record<string, unknown> }
  Response: { data: MarketplaceInstall }
```

#### `apps/api/src/routes/marketplace-rate.ts`

```
POST /api/marketplace/:id/rate
  Auth: requirePermission('marketplace.install')
  Body: { rating: 1-5, review?: string }
  Validation: Zod schema, one rating per org/user per skill
  Side effect: Update skills.ratingAvg + skills.ratingCount
  Response: { data: MarketplaceRating }
```

#### `apps/api/src/routes/marketplace-publish.ts`

```
POST   /api/marketplace/publish
  Auth: requirePermission('marketplace.publish')
  Body: multipart/form-data with .opensyber-skill file
  Pipeline:
    1. Extract + validate manifest
    2. Integrity check (SHA-256)
    3. Upload to R2
    4. Create skill + skill_version + submission records
    5. Trigger async security scan
  Response: { data: { skillId, versionId, submissionId } }

GET    /api/marketplace/my-skills
  Auth: requirePermission('marketplace.publish')
  Response: { data: PublisherSkill[] }

PATCH  /api/marketplace/my-skills/:id
  Auth: requirePermission('marketplace.publish')
  Body: { description?, homepage?, tags?, screenshots? }
  Response: { data: Skill }

POST   /api/marketplace/my-skills/:id/versions
  Auth: requirePermission('marketplace.publish')
  Body: multipart/form-data with .opensyber-skill file + changelog
  Response: { data: { versionId, submissionId } }
```

#### `apps/api/src/routes/marketplace-admin.ts`

```
GET    /api/admin/marketplace/submissions
  Auth: requirePermission('marketplace.admin')
  Query: ?status=pending
  Response: { data: Submission[] }

PATCH  /api/admin/marketplace/submissions/:id
  Auth: requirePermission('marketplace.admin')
  Body: { status: 'approved' | 'rejected', notes?: string }
  Side effect: If approved, set skill.verificationStatus = 'approved'
  Response: { data: Submission }

PATCH  /api/admin/marketplace/skills/:id/featured
  Auth: requirePermission('marketplace.admin')
  Body: { isFeatured: boolean }
  Response: { data: Skill }
```

### Zod Validation Schemas

```typescript
// apps/api/src/routes/marketplace-schemas.ts

import { z } from 'zod';

export const browseQuerySchema = z.object({
  category: z.string().optional(),
  tier: z.enum(['free', 'pro', 'team', 'enterprise']).optional(),
  search: z.string().max(100).optional(),
  sort: z.enum(['popular', 'newest', 'rating']).default('popular'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const installBodySchema = z.object({
  config: z.record(z.unknown()).optional(),
});

export const rateBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
});

export const updateSkillBodySchema = z.object({
  description: z.string().max(5000).optional(),
  homepage: z.string().url().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  screenshots: z.array(z.string()).max(5).optional(),
});

export const adminReviewBodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(2000).optional(),
});

export const manifestSchema = z.object({
  id: z.string().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  name: z.string().min(3).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  description: z.string().max(5000),
  author: z.string().max(100),
  license: z.string().max(50),
  category: z.enum([
    'agent_monitor', 'integration', 'cspm', 'saas',
    'ai_intelligence', 'automation', 'compliance', 'developer_tools', 'identity',
  ]),
  tier: z.enum(['free', 'pro', 'team', 'enterprise']),
  targets: z.array(z.object({
    type: z.string(),
    required: z.boolean(),
  })),
  requiredPermissions: z.array(z.string()),
  configSchema: z.record(z.unknown()),
  outputs: z.array(z.object({
    type: z.string(),
    table: z.string().optional(),
    category: z.string().optional(),
    source: z.string().optional(),
    weight: z.number().optional(),
  })),
  widgets: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['stat', 'bar', 'gauge', 'table', 'timeline', 'score_card']),
  })),
  schedule: z.object({
    cron: z.string().optional(),
    trigger: z.enum(['event', 'stream', 'on_demand', 'webhook']).optional(),
    event: z.string().optional(),
  }),
  bundleEntry: z.string(),
  bundleHash: z.string().length(64),
  sdkVersion: z.string(),
  pricing: z.object({
    type: z.enum(['free', 'paid']),
    monthlyPriceCents: z.number().int().min(0).optional(),
  }).optional(),
  tags: z.array(z.string()).max(10).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  screenshots: z.array(z.string()).max(5).optional(),
});
```

### Route Registration

Add to `apps/api/src/routes/register.ts`:

```typescript
import { marketplaceBrowseRoutes } from './marketplace-browse.js';
import { marketplaceInstallRoutes } from './marketplace-install.js';
import { marketplaceRateRoutes } from './marketplace-rate.js';
import { marketplacePublishRoutes } from './marketplace-publish.js';
import { marketplaceAdminRoutes } from './marketplace-admin.js';

// Marketplace
app.route('/api/marketplace', marketplaceBrowseRoutes);
app.route('/api/marketplace', marketplaceInstallRoutes);
app.route('/api/marketplace', marketplaceRateRoutes);
app.route('/api/marketplace', marketplacePublishRoutes);
app.route('/api/admin/marketplace', marketplaceAdminRoutes);
```

---

## Frontend Pages

### Page Structure

```
apps/web/src/app/
  dashboard/
    marketplace/
      page.tsx                  -- Browse marketplace (server component)
      MarketplaceGrid.tsx       -- Skill card grid (client component)
      MarketplaceFilters.tsx    -- Filter sidebar (client component)
      SkillCard.tsx             -- Individual skill card (client component)
    marketplace/[id]/
      page.tsx                  -- Skill detail (server component)
      SkillDetail.tsx           -- Detail view (client component)
      InstallButton.tsx         -- Install/uninstall (client component)
      RatingStars.tsx           -- Rating input (client component)
    marketplace/publish/
      page.tsx                  -- Publish wizard (server component)
      PublishWizard.tsx         -- Multi-step form (client component)
    marketplace/my-skills/
      page.tsx                  -- Publisher dashboard (server component)
      MySkillsList.tsx          -- Published skills list (client component)
    marketplace/installed/
      page.tsx                  -- Installed skills management (server component)
      InstalledSkillsList.tsx   -- Installed skills (client component)
      SkillConfigPanel.tsx      -- Config editor (client component)
  api/proxy/marketplace/
    route.ts                    -- Proxy: browse, search
    [id]/
      route.ts                  -- Proxy: detail
      install/route.ts          -- Proxy: install/uninstall
      rate/route.ts             -- Proxy: rate
    publish/route.ts            -- Proxy: publish
    my-skills/route.ts          -- Proxy: publisher skills
    installed/route.ts          -- Proxy: installed skills
```

### Design Specifications (Apple HIG)

#### Marketplace Browse Page

```
+-------------------------------------------------------------------+
| Marketplace                                         [Publish Skill] |
| Discover and install skills for your AI agent security platform    |
+-------------------------------------------------------------------+
| [Search skills...]                                                  |
|                                                                     |
| Categories:  [All] [Agent Monitor] [Integration] [CSPM] ...        |
| Tier:        [All] [Free] [Pro] [Team] [Enterprise]                |
| Sort:        [Popular v]                                            |
+-------------------------------------------------------------------+
| Featured                                                            |
| +------------------+ +------------------+ +------------------+     |
| | cursor-monitor   | | secret-vault-    | | siem-forwarder   |     |
| | Cursor telemetry | | bridge           | | Stream to Splunk |     |
| | [star][star]...  | | HashiCorp/AWS    | | Datadog, Elastic |     |
| | 1.2K installs    | | [star][star]...  | | [star][star]...  |     |
| | [Pro]  [Install] | | 890 installs     | | 756 installs     |     |
| +------------------+ | [Team] [Install] | | [Team] [Install] |     |
|                      +------------------+ +------------------+     |
| All Skills                                                          |
| +------------------+ +------------------+ +------------------+     |
| | ...              | | ...              | | ...              |     |
| +------------------+ +------------------+ +------------------+     |
+-------------------------------------------------------------------+
```

**Styling**:
- Background: `bg-neutral-950`
- Skill cards: `bg-neutral-900/30 border border-neutral-800 rounded-xl p-6`
- Category pills: `bg-neutral-800 rounded-lg px-3 py-1 text-sm`
- Active pill: `bg-blue-500/20 text-blue-400 border border-blue-500/30`
- Install button: `bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2`
- Tier badge: `bg-{color}-500/20 text-{color}-400 text-xs rounded-md px-2 py-0.5`
  - free: neutral, pro: blue, team: purple, enterprise: amber
- Rating stars: `text-amber-400`

#### Skill Detail Page

```
+-------------------------------------------------------------------+
| < Back to Marketplace                                               |
+-------------------------------------------------------------------+
| [Icon]  cursor-monitor                               [Install]     |
|         Cursor Agent Monitor                                        |
|         by OpenSyber | v1.0.0 | Updated 2 days ago                |
|         [Pro] [Agent Monitor]                                       |
|         [star][star][star][star][half-star] 4.3 (47 ratings)       |
|         1,234 installs                                              |
+-------------------------------------------------------------------+
| [Overview] [Versions] [Configuration]                               |
|                                                                     |
| Cursor-specific telemetry skill for AI agent monitoring.           |
| Captures file edits, AI completions, context windows, and more.    |
|                                                                     |
| Required Permissions:                                               |
|   cloud.read, agent.policy.read                                    |
|                                                                     |
| Outputs:                                                            |
|   - Agent activity findings                                        |
|   - Risk score deltas                                              |
|                                                                     |
| Widgets:                                                            |
|   - Cursor Completions (stat)                                      |
|   - Context Window Usage (bar)                                     |
+-------------------------------------------------------------------+
| Related Skills                                                      |
| +------------------+ +------------------+                           |
| | cline-monitor    | | siem-forwarder   |                           |
| +------------------+ +------------------+                           |
+-------------------------------------------------------------------+
```

#### Publish Wizard

4-step wizard:

1. **Upload**: Drag-and-drop `.opensyber-skill` file
2. **Preview**: Show parsed manifest, permissions, outputs
3. **Pricing**: Set free or paid (monthly price input)
4. **Submit**: Confirm and submit for review

---

## Skill Runtime

### Execution Model

Skills execute within the Cloudflare Worker environment using dynamic `import()`.
The Worker loads the skill bundle from R2, executes the `run()` function with a
constructed `SkillContext`, and validates outputs.

### SkillExecutor Service

```typescript
// apps/api/src/services/skill-executor.ts

export class SkillExecutor {
  constructor(
    private db: DrizzleD1Database,
    private storage: R2Bucket,
    private vault: KVNamespace,
  ) {}

  async execute(opts: {
    skillId: string;
    orgId: string;
    userId: string;
    config: Record<string, unknown>;
    targets: ResolvedTarget[];
  }): Promise<SkillExecutionResult> {
    // 1. Load skill manifest from DB
    // 2. Fetch bundle from R2
    // 3. Validate config against configSchema
    // 4. Build SkillContext with real emit/log/vault/http
    // 5. Execute run() with timeout (5 min)
    // 6. Validate captured outputs against output specs
    // 7. Persist outputs to respective tables
    // 8. Record execution in skill_executions
    // 9. Return result
  }
}
```

### Output Routing

The `SkillEmitter` in production routes outputs to the correct database tables:

| Emit Method | Target Table | Existing Schema |
|---|---|---|
| `finding()` | `cspm_findings` | `cspm.ts` |
| `saasFinding()` | New: `saas_findings` | Future Sprint 30 |
| `riskDelta()` | `risk_snapshots` | `risk-snapshots.ts` |
| `attackEdge()` | `asset_relations` | `attack-graph.ts` |
| `complianceEvidence()` | New: `evidence_items` | Future Sprint 26 |
| `remediationSuggestion()` | New: `remediation_items` | Future Sprint 33 |
| `metric()` | KV: `metrics:{skillId}:{name}` | New |

For emit methods targeting tables that do not yet exist (saas_findings, evidence_items,
remediation_items), the executor logs the output and stores it in the
`skill_executions.output_count` counter. When those tables are created in future
sprints, the emit routing is updated.

### SkillScheduler

```typescript
// apps/api/src/services/skill-scheduler.ts

export async function runScheduledSkills(env: Env): Promise<void> {
  // 1. Query marketplace_installs WHERE is_active = 1
  // 2. Join with skills WHERE schedule.cron matches current time
  // 3. For each matching install, queue execution
  // 4. Track in skill_executions
}
```

This runs inside the existing `scheduled()` handler in `apps/api/src/index.ts`.

---

## Revenue Sharing

### Flow

```
User clicks "Install" on paid skill
  |
  v
POST /api/marketplace/:id/install
  |
  v
Create LemonSqueezy checkout URL
  - product: skill-specific LS variant
  - custom data: { skillId, orgId, userId }
  |
  v
User completes checkout on LemonSqueezy
  |
  v
Webhook: subscription_created
  - Parse custom data
  - Create marketplace_installs record with ls_subscription_id
  - Increment skills.install_count
  |
  v
Monthly: LemonSqueezy processes recurring charge
  |
  v
Cron: calculate_publisher_payouts()
  - Sum all active subscriptions per skill per period
  - gross_revenue = sum(price_cents)
  - platform_fee = gross_revenue * 0.30
  - net_payout = gross_revenue * 0.70
  - Create publisher_payouts record
  |
  v
Admin: trigger payout via LemonSqueezy Affiliates / manual transfer
```

### Plan Enforcement

Install requests validate against plan limits:

```typescript
function canInstallSkill(
  planConfig: PlanConfig,
  skillTier: SkillTier,
  currentInstallCount: number,
): { allowed: boolean; reason?: string } {
  // Free plan: max 3 free skills, no paid skills
  // Pro plan: max 10 skills, paid allowed
  // Team: unlimited
  // Enterprise: unlimited

  const tierHierarchy = { free: 0, pro: 1, team: 2, enterprise: 3 };
  const planTier = planToTier(planConfig);

  if (tierHierarchy[skillTier] > tierHierarchy[planTier]) {
    return { allowed: false, reason: `Skill requires ${skillTier} plan or higher` };
  }

  const limit = planConfig.verifiedSkillLimit;
  if (limit !== null && currentInstallCount >= limit) {
    return { allowed: false, reason: `Plan allows max ${limit} installed skills` };
  }

  return { allowed: true };
}
```

---

## Security Design

### Package Security Scanning

Static analysis runs on every submitted skill bundle:

```typescript
// apps/api/src/services/skill-scanner.ts

export interface ScanResult {
  status: 'clean' | 'flagged';
  findings: ScanFinding[];
}

export interface ScanFinding {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  message: string;
}

const SCAN_RULES = [
  { pattern: /eval\s*\(/, rule: 'no-eval', severity: 'critical' },
  { pattern: /Function\s*\(/, rule: 'no-function-constructor', severity: 'critical' },
  { pattern: /child_process/, rule: 'no-child-process', severity: 'critical' },
  { pattern: /require\s*\(\s*['"]fs['"]/, rule: 'no-fs-require', severity: 'high' },
  { pattern: /process\.env/, rule: 'no-env-access', severity: 'high' },
  { pattern: /crypto\.createCipher/, rule: 'weak-crypto', severity: 'medium' },
];
```

### RBAC Enforcement

All marketplace routes use `requirePermission()`:

| Route | Permission |
|---|---|
| `GET /api/marketplace` | `marketplace.browse` |
| `GET /api/marketplace/:id` | `marketplace.browse` |
| `POST /api/marketplace/:id/install` | `marketplace.install` |
| `DELETE /api/marketplace/:id/install` | `marketplace.install` |
| `POST /api/marketplace/:id/rate` | `marketplace.install` |
| `POST /api/marketplace/publish` | `marketplace.publish` |
| `GET /api/marketplace/my-skills` | `marketplace.publish` |
| `PATCH /api/marketplace/my-skills/:id` | `marketplace.publish` |
| `*  /api/admin/marketplace/*` | `marketplace.admin` |

### R2 Access Control

Skill packages stored in R2 under `skills/{skillId}/{version}/package.opensyber-skill`.
Only the API Worker has R2 access. Users download through presigned URLs or
API proxy routes.

---

## Testing Strategy

### Unit Tests

| File | Test File | Coverage Target |
|---|---|---|
| `packages/skill-sdk/src/define.ts` | `define.test.ts` | 100% |
| `packages/skill-sdk/src/testing.ts` | `testing.test.ts` | 100% |
| `marketplace-browse.ts` | `marketplace-browse.test.ts` | 90% |
| `marketplace-install.ts` | `marketplace-install.test.ts` | 90% |
| `marketplace-publish.ts` | `marketplace-publish.test.ts` | 90% |
| `marketplace-rate.ts` | `marketplace-rate.test.ts` | 90% |
| `marketplace-admin.ts` | `marketplace-admin.test.ts` | 90% |
| `skill-executor.ts` | `skill-executor.test.ts` | 90% |
| `skill-scanner.ts` | `skill-scanner.test.ts` | 90% |
| `skill-scheduler.ts` | `skill-scheduler.test.ts` | 90% |

### Integration Tests

- Publish flow: upload package, verify R2 storage, verify DB records
- Install flow: install skill, verify plan limits, verify RBAC
- Rating flow: rate, update rating, verify aggregate recalculation
- Admin review flow: submit, scan, approve, verify skill status change

### Component Tests

- `MarketplaceGrid.tsx`: renders skill cards, handles empty state
- `SkillCard.tsx`: renders name, rating, install count, tier badge
- `InstallButton.tsx`: install/uninstall toggle, loading state
- `RatingStars.tsx`: interactive rating, displays average
- `PublishWizard.tsx`: step navigation, file upload, validation

---

## Migration Plan

### Phase 1: SDK + Schema (Days 1-3)

1. Create `packages/skill-sdk/` with all types, defineSkill, testing utilities
2. Create migration `0014_marketplace.sql`
3. Create `packages/db/src/schema/marketplace.ts`
4. Add marketplace permissions to `packages/shared/src/constants/permissions.ts`
5. Add `marketplace.browse` to VIEW_PERMISSIONS
6. Update `PlanConfig` with `marketplaceInstallLimit` field

### Phase 2: API Routes (Days 3-6)

7. Create marketplace browse routes + tests
8. Create marketplace install routes + tests
9. Create marketplace rate routes + tests
10. Create marketplace publish routes + tests
11. Create marketplace admin routes + tests
12. Create skill scanner service + tests
13. Create skill executor service + tests
14. Register all routes in `register.ts`

### Phase 3: Frontend (Days 6-9)

15. Create marketplace browse page + components
16. Create skill detail page + components
17. Create publish wizard page + components
18. Create installed skills management page
19. Create proxy routes for all marketplace APIs
20. Add marketplace link to sidebar navigation

### Phase 4: First-Party Skills + Polish (Days 9-12)

21. Create `cursor-monitor` skill package
22. Create `secret-vault-bridge` skill package
23. Create `siem-forwarder` skill package
24. Seed marketplace with 3 first-party skills
25. Create skill scheduler integration
26. End-to-end testing of full publish-install-execute cycle

---

## Appendices

### Design Decisions

| Decision | Alternatives Considered | Rationale |
|---|---|---|
| Extend `skills` table | New `marketplace_items` table | Backward compat, same entity |
| Worker-level execution | Hetzner VM sandboxing | Simpler Phase 1, VM in Phase 2 |
| tar.gz package format | Docker images, npm packages | Inspectable, simple, fast |
| 70/30 revenue split | 80/20, flat fee | Industry standard (Apple, Shopify) |
| Zod for manifest validation | JSON Schema, Joi | Already in codebase, TypeScript-native |
| Cursor-based pagination | Offset pagination | Consistent with all existing APIs |

### Conventions

- All marketplace route files prefixed with `marketplace-`
- All marketplace UI files under `dashboard/marketplace/`
- Skill IDs: lowercase, hyphens, 3-50 chars (`cursor-monitor`)
- Package R2 keys: `skills/{skillId}/{version}/package.opensyber-skill`
- Manifest JSON Schema stored in `skill_versions.manifest` column
