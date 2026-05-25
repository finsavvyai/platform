# Sprint 8: Enterprise RBAC, Teams & Organizations -- Technical Design Document

**Scope**: OpenSyber / Sprint 8 RBAC
**Generated**: 2026-02-28
**Agent**: Design Architect Agent
**Based on**: requirements.md

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Design](#3-database-design)
4. [RBAC Architecture](#4-rbac-architecture)
5. [API Design](#5-api-design)
6. [UI Component Design](#6-ui-component-design)
7. [Email Flow Design](#7-email-flow-design)
8. [Migration Strategy](#8-migration-strategy)
9. [File Organization](#9-file-organization)
10. [Testing Strategy](#10-testing-strategy)
11. [Security Design](#11-security-design)
12. [Performance Design](#12-performance-design)
13. [Deployment Strategy](#13-deployment-strategy)

---

## 1. Overview

Sprint 8 transforms OpenSyber from a single-user product into a multi-user, organization-based platform with role-based access control. The design must satisfy three constraints simultaneously:

1. **Backward compatibility** -- solo users without an org must retain full access to all features with zero changes to their workflow.
2. **Granular RBAC** -- 5 roles (owner, admin, security, developer, viewer) with 30+ permissions enforced on every API route.
3. **200-line file limit** -- six existing oversized files must be split, and all new files must comply.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Org resolution | `X-Org-Id` request header | Keeps URL structure clean; web app sets header from localStorage/cookie |
| Permission model | Static in-memory map, not DB-stored | Zero-latency permission checks; no extra D1 query per request |
| Solo user fallback | null orgId = full access | Backward compatible; existing tests pass without changes |
| Membership lookup | Single DB query per request | Indexed on (org_id, user_id); cached in Hono context for request lifetime |
| Schema split | 5 domain files + barrel export | Each under 200 lines; import paths unchanged via re-export |

---

## 2. Architecture

### 2.1 High-Level Request Flow

```
Browser Request
    |
    v
[Next.js Proxy Route] -- adds Clerk JWT + X-Org-Id header
    |
    v
[Cloudflare Worker -- Hono]
    |
    +-- CORS middleware
    +-- Body limit middleware
    +-- TokenForge middleware
    +-- Rate limit middleware
    |
    v
[dbMiddleware] -- creates Drizzle D1 instance
    |
    v
[authMiddleware] -- verifies Clerk JWT, sets userId
    |
    v
[requirePermission(permission)] -- NEW: resolves org membership, checks permission
    |   - Reads X-Org-Id header
    |   - If null: solo mode, skip permission check
    |   - If present: query org_members, verify role has permission
    |   - Sets orgId, role, orgMember on context
    |
    v
[Route Handler] -- uses c.get('orgId') to scope queries
```

### 2.2 Data Flow for Organization-Scoped Requests

```
                   Web App (Next.js)
                        |
          +-------------+-------------+
          |                           |
    [localStorage]              [Clerk Auth]
    activeOrgId                   JWT token
          |                           |
          v                           v
    X-Org-Id header          Authorization header
          |                           |
          +-------------+-------------+
                        |
                   API Worker
                        |
          +-------------+-------------+
          |                           |
    [RBAC Middleware]          [Auth Middleware]
    org_members lookup          userId from JWT
          |                           |
          v                           v
    c.set('orgId')            c.set('userId')
    c.set('role')
    c.set('orgMember')
          |
          v
    [Route Handler]
    Scopes DB queries:
      orgId ? WHERE org_id = :orgId
             : WHERE user_id = :userId
```

### 2.3 Technology Stack (No Changes)

- **Frontend**: Next.js 16, React, Tailwind CSS, Clerk (auth), Framer Motion
- **Backend**: Hono on Cloudflare Workers, Drizzle ORM, D1 (SQLite)
- **Email**: Resend API
- **Auth**: Clerk JWT (unchanged)
- **Payments**: LemonSqueezy (unchanged)

---

## 3. Database Design

### 3.1 Migration File

**File**: `packages/db/migrations/0008_organizations_rbac.sql`

```sql
-- ============================================================================
-- Migration 0008: Organizations, RBAC, and Multi-Tenancy
-- ============================================================================

-- Organizations
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  max_instances INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Organization Members
CREATE TABLE org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by TEXT REFERENCES users(id),
  invited_at TEXT NOT NULL,
  accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org_user_status ON org_members(org_id, user_id, status);

-- Organization Invitations
CREATE TABLE org_invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_org_invitations_token ON org_invitations(token);
CREATE INDEX idx_org_invitations_org ON org_invitations(org_id);
CREATE INDEX idx_org_invitations_email ON org_invitations(email);

-- Add orgId to existing tables (nullable for backward compatibility)
ALTER TABLE instances ADD COLUMN org_id TEXT REFERENCES organizations(id);
CREATE INDEX idx_instances_org ON instances(org_id);

ALTER TABLE security_policies ADD COLUMN org_id TEXT REFERENCES organizations(id);
ALTER TABLE incidents ADD COLUMN org_id TEXT REFERENCES organizations(id);
```

### 3.2 Drizzle Schema -- Split Plan

The current `packages/db/src/schema.ts` (635 lines) must be split into a `schema/` directory. Each file re-exports its tables so that `import { ... } from '@opensyber/db'` continues to work unchanged.

#### packages/db/src/schema/index.ts (~15 lines)

```typescript
export * from './users.js';
export * from './instances.js';
export * from './security.js';
export * from './organizations.js';
export * from './tokenforge.js';
```

#### packages/db/src/schema/users.ts (~30 lines)

Contains: `users`, `credentials`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  plan: text('plan', { enum: ['free', 'personal', 'pro', 'team'] })
    .notNull()
    .default('free'),
  lemonSqueezyCustomerId: text('lemonsqueezy_customer_id'),
  lemonSqueezySubscriptionId: text('lemonsqueezy_subscription_id'),
  onboardingCompletedAt: text('onboarding_completed_at'),
  onboardingProgress: text('onboarding_progress'),
  trialStartedAt: text('trial_started_at'),
  emailFlags: text('email_flags'),
  paymentGraceUntil: text('payment_grace_until'),
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  referralCredits: integer('referral_credits').notNull().default(0),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  instanceId: text('instance_id').notNull(),
  key: text('key').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});
```

#### packages/db/src/schema/instances.ts (~60 lines)

Contains: `instances`, `skills`, `skillInstallations`

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const instances = sqliteTable('instances', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orgId: text('org_id'),  // NEW: nullable FK to organizations
  name: text('name').notNull().default('My Agent'),
  hetznerServerId: integer('hetzner_server_id'),
  ipv4: text('ipv4'),
  ipv6: text('ipv6'),
  region: text('region', {
    enum: ['eu-central', 'us-east', 'us-west', 'ap-southeast'],
  }).notNull(),
  status: text('status', {
    enum: ['provisioning', 'installing', 'ready', 'running',
           'stopped', 'error', 'suspended', 'destroying'],
  }).notNull().default('provisioning'),
  engineVersion: text('engine_version'),
  agentVersion: text('agent_version'),
  gatewayTokenEncrypted: text('gateway_token_encrypted'),
  lastHealthCheck: text('last_health_check'),
  lastBackup: text('last_backup'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

export const skills = sqliteTable('skills', { /* unchanged, ~30 lines */ });
export const skillInstallations = sqliteTable('skill_installations', { /* unchanged, ~15 lines */ });
```

Note: `instances.orgId` uses a plain text reference (not `.references(() => organizations.id)`) to avoid circular import between `instances.ts` and `organizations.ts`. The FK constraint is enforced at the SQL level in the migration.

#### packages/db/src/schema/organizations.ts (~80 lines)

Contains: `organizations`, `orgMembers`, `orgInvitations`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  plan: text('plan', { enum: ['free', 'personal', 'pro', 'team'] })
    .notNull()
    .default('free'),
  maxInstances: integer('max_instances').notNull().default(1),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

export const orgMembers = sqliteTable('org_members', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', {
    enum: ['owner', 'admin', 'security', 'developer', 'viewer'],
  }).notNull().default('viewer'),
  invitedBy: text('invited_by').references(() => users.id),
  invitedAt: text('invited_at').notNull(),
  acceptedAt: text('accepted_at'),
  status: text('status', {
    enum: ['pending', 'active', 'removed'],
  }).notNull().default('pending'),
});

export const orgInvitations = sqliteTable('org_invitations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  email: text('email').notNull(),
  role: text('role', {
    enum: ['owner', 'admin', 'security', 'developer', 'viewer'],
  }).notNull().default('viewer'),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),
  status: text('status', {
    enum: ['pending', 'accepted', 'cancelled', 'expired'],
  }).notNull().default('pending'),
});
```

#### packages/db/src/schema/security.ts (~190 lines)

Contains: `securityEvents`, `auditLog`, `securityPolicies`, `incidents`, `incidentEvents`, `incidentSecurityEvents`, `securityScoreHistory`, `alertRules`, `alerts`, `notificationChannels`, `networkActivity`, `fileBaselines`, `fileIntegrityEvents`, `vulnerabilityScans`, `vulnerabilities`, `complianceReports`, `accessControlLog`

This is the largest file. It is close to 200 lines because it contains 17 table definitions. Each table definition is compact (5-15 lines). The `incidents` and `securityPolicies` tables gain an `orgId` column.

#### packages/db/src/schema/tokenforge.ts (~100 lines)

Contains: `tfTenants`, `tfApiKeys`, `deviceSessions`, `tfSecurityEvents`, `stepUpChallenges`, `tfUsage`

Unchanged from current schema.

#### packages/db/src/index.ts (update)

Change from exporting `./schema.ts` to `./schema/index.js`:

```typescript
export * from './schema/index.js';
```

### 3.3 Index Strategy

| Table | Index | Purpose |
|---|---|---|
| organizations | `idx_organizations_owner` on owner_id | Find orgs by owner |
| organizations | `idx_organizations_slug` on slug | Slug lookup for URLs |
| org_members | `idx_org_members_org` on org_id | List members of org |
| org_members | `idx_org_members_user` on user_id | Find user's memberships |
| org_members | `idx_org_members_org_user_status` on (org_id, user_id, status) | RBAC membership lookup (covering index) |
| org_invitations | `idx_org_invitations_token` on token | Accept flow token lookup |
| org_invitations | `idx_org_invitations_org` on org_id | List org invitations |
| org_invitations | `idx_org_invitations_email` on email | Check existing invites for email |
| instances | `idx_instances_org` on org_id | Org-scoped instance listing |

---

## 4. RBAC Architecture

### 4.1 Role Constants

**File**: `packages/shared/src/constants/roles.ts` (~40 lines)

```typescript
export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  security: 'security',
  developer: 'developer',
  viewer: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Higher number = more authority. Used for hierarchy checks. */
export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 5,
  admin: 4,
  security: 3,
  developer: 2,
  viewer: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  security: 'Security',
  developer: 'Developer',
  viewer: 'Viewer',
};

/** Returns true if role A outranks role B. */
export function isHigherRole(a: Role, b: Role): boolean {
  return ROLE_HIERARCHY[a] > ROLE_HIERARCHY[b];
}

/** Roles that can be assigned via invite (excludes owner). */
export const ASSIGNABLE_ROLES: Role[] = ['admin', 'security', 'developer', 'viewer'];
```

### 4.2 Permission Constants

**File**: `packages/shared/src/constants/permissions.ts` (~150 lines)

```typescript
import type { Role } from './roles.js';

export const PERMISSIONS = {
  // Instance
  'instance.create': 'instance.create',
  'instance.delete': 'instance.delete',
  'instance.restart': 'instance.restart',
  'instance.view': 'instance.view',
  // Skill
  'skill.install': 'skill.install',
  'skill.uninstall': 'skill.uninstall',
  'skill.view': 'skill.view',
  // Policy
  'policy.create': 'policy.create',
  'policy.update': 'policy.update',
  'policy.delete': 'policy.delete',
  'policy.view': 'policy.view',
  // Incident
  'incident.create': 'incident.create',
  'incident.update': 'incident.update',
  'incident.assign': 'incident.assign',
  'incident.view': 'incident.view',
  // Alert Rule
  'alert_rule.create': 'alert_rule.create',
  'alert_rule.update': 'alert_rule.update',
  'alert_rule.delete': 'alert_rule.delete',
  'alert_rule.view': 'alert_rule.view',
  // Vault
  'vault.read': 'vault.read',
  'vault.write': 'vault.write',
  'vault.delete': 'vault.delete',
  // Member
  'member.invite': 'member.invite',
  'member.remove': 'member.remove',
  'member.change_role': 'member.change_role',
  'member.view': 'member.view',
  // Billing
  'billing.view': 'billing.view',
  'billing.manage': 'billing.manage',
  // Audit
  'audit.view': 'audit.view',
  'audit.export': 'audit.export',
  // Org
  'org.update': 'org.update',
  'org.delete': 'org.delete',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Static permission sets per role. Evaluated at module load time. */
const ownerPerms = new Set<Permission>(Object.values(PERMISSIONS));

const adminPerms = new Set<Permission>([
  'instance.create', 'instance.delete', 'instance.restart', 'instance.view',
  'skill.install', 'skill.uninstall', 'skill.view',
  'policy.create', 'policy.update', 'policy.delete', 'policy.view',
  'incident.create', 'incident.update', 'incident.assign', 'incident.view',
  'alert_rule.create', 'alert_rule.update', 'alert_rule.delete', 'alert_rule.view',
  'vault.read', 'vault.write', 'vault.delete',
  'member.invite', 'member.remove', 'member.change_role', 'member.view',
  'billing.view',
  'audit.view', 'audit.export',
  'org.update',
]);

const securityPerms = new Set<Permission>([
  'instance.view',
  'skill.view',
  'policy.create', 'policy.update', 'policy.delete', 'policy.view',
  'incident.create', 'incident.update', 'incident.assign', 'incident.view',
  'alert_rule.create', 'alert_rule.update', 'alert_rule.delete', 'alert_rule.view',
  'vault.read',
  'member.view',
  'audit.view', 'audit.export',
]);

const developerPerms = new Set<Permission>([
  'instance.create', 'instance.restart', 'instance.view',
  'skill.install', 'skill.uninstall', 'skill.view',
  'policy.view',
  'incident.view',
  'alert_rule.view',
  'vault.read', 'vault.write',
  'member.view',
  'audit.view',
]);

const viewerPerms = new Set<Permission>([
  'instance.view',
  'skill.view',
  'policy.view',
  'incident.view',
  'alert_rule.view',
  'vault.read',
  'member.view',
  'audit.view',
]);

export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: ownerPerms,
  admin: adminPerms,
  security: securityPerms,
  developer: developerPerms,
  viewer: viewerPerms,
};

/** Check if a role has a specific permission. O(1) lookup. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
```

### 4.3 RBAC Types

**File**: `packages/shared/src/types/rbac.ts` (~55 lines)

```typescript
import type { Role } from '../constants/roles.js';
import type { Permission } from '../constants/permissions.js';
import type { Plan } from './user.js';

export type { Role, Permission };

export type OrgMemberStatus = 'pending' | 'active' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: Plan;
  maxInstances: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  status: OrgMemberStatus;
}

export interface OrgInvitation {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: InvitationStatus;
}

/** Org with user's membership context, used in list responses. */
export interface OrgWithMembership extends Organization {
  memberCount: number;
  currentUserRole: Role;
}
```

### 4.4 Updated Hono Variables

**File**: `apps/api/src/types.ts`

```typescript
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import type { Role, OrgMember } from '@opensyber/shared';

export interface Env {
  // (unchanged -- same bindings as current)
  DB: D1Database;
  CREDENTIAL_VAULT: KVNamespace;
  CACHE: KVNamespace;
  TF_NONCES: KVNamespace;
  STORAGE: R2Bucket;
  ENVIRONMENT: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  LEMONSQUEEZY_STORE_ID: string;
  OPENSYBER_LS_PRODUCT_ID: string;
  OPENSYBER_LS_VARIANT_PERSONAL: string;
  OPENSYBER_LS_VARIANT_PRO: string;
  OPENSYBER_LS_VARIANT_TEAM: string;
  HETZNER_API_TOKEN: string;
  ENCRYPTION_KEY: string;
  RESEND_API_KEY: string;
}

export interface Variables {
  db: DrizzleD1Database<typeof schema>;
  userId: string;
  orgId: string | null;       // NEW
  role: Role | null;          // NEW
  orgMember: OrgMember | null; // NEW
}
```

### 4.5 RBAC Middleware Implementation

**File**: `apps/api/src/middleware/rbac.ts` (~90 lines)

```typescript
import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { orgMembers } from '@opensyber/db';
import { hasPermission } from '@opensyber/shared';
import type { Permission, Role, OrgMember } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';

type AppContext = { Bindings: Env; Variables: Variables };

/**
 * RBAC middleware factory.
 *
 * Usage: `route.post('/', requirePermission('instance.create'), handler)`
 *
 * Behavior:
 * - If no X-Org-Id header: solo mode. orgId/role/orgMember set to null.
 *   All permissions granted (backward compatible).
 * - If X-Org-Id present: looks up org_members for (orgId, userId, status=active).
 *   Checks permission against role. Sets orgId, role, orgMember on context.
 */
export function requirePermission(permission: Permission) {
  return createMiddleware<AppContext>(async (c, next) => {
    const orgId = c.req.header('X-Org-Id') ?? null;

    // Solo mode: no org context, full access
    if (!orgId) {
      c.set('orgId', null);
      c.set('role', null);
      c.set('orgMember', null);
      return next();
    }

    const userId = c.get('userId');
    const db = c.get('db');

    // Look up active membership
    const [member] = await db
      .select()
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, orgId),
          eq(orgMembers.userId, userId),
          eq(orgMembers.status, 'active'),
        ),
      );

    if (!member) {
      return c.json(
        { error: 'Forbidden', message: 'Not a member of this organization' },
        403,
      );
    }

    const role = member.role as Role;

    if (!hasPermission(role, permission)) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Insufficient permissions: ${permission} required`,
        },
        403,
      );
    }

    // Set context for downstream handlers
    c.set('orgId', orgId);
    c.set('role', role);
    c.set('orgMember', {
      id: member.id,
      orgId: member.orgId,
      userId: member.userId,
      role,
      invitedBy: member.invitedBy,
      invitedAt: member.invitedAt,
      acceptedAt: member.acceptedAt,
      status: member.status,
    } as OrgMember);

    return next();
  });
}

/**
 * Helper to resolve org context without requiring a specific permission.
 * Used for routes that need org context but handle permissions internally
 * (e.g., org CRUD routes that check ownership separately).
 */
export function resolveOrgContext() {
  return requirePermission('member.view');
}
```

### 4.6 Instance Ownership Helper (Updated for Multi-Tenancy)

**File**: `apps/api/src/utils/verify-instance.ts` (~35 lines)

Extracted from `security.ts` and enhanced for org context:

```typescript
import { eq, and } from 'drizzle-orm';
import { instances } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Verifies that the requesting user/org has access to an instance.
 *
 * If orgId is provided: checks instances.orgId matches.
 * If orgId is null: checks instances.userId matches (solo user mode).
 */
export async function verifyInstanceAccess(
  db: DrizzleD1Database<any>,
  instanceId: string,
  userId: string,
  orgId: string | null,
): Promise<typeof instances.$inferSelect | null> {
  if (orgId) {
    const [instance] = await db
      .select()
      .from(instances)
      .where(and(eq(instances.id, instanceId), eq(instances.orgId, orgId)));
    return instance ?? null;
  }

  const [instance] = await db
    .select()
    .from(instances)
    .where(and(eq(instances.id, instanceId), eq(instances.userId, userId)));
  return instance ?? null;
}
```

---

## 5. API Design

### 5.1 Zod Schemas (Shared Validation)

**File**: `apps/api/src/validation/organizations.ts` (~80 lines)

```typescript
import { z } from 'zod';
import { ASSIGNABLE_ROLES } from '@opensyber/shared';

const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export const deleteOrgSchema = z.object({
  confirm: z.literal(true),
});

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'security', 'developer', 'viewer']),
});

export const changeRoleSchema = z.object({
  role: z.enum(['admin', 'security', 'developer', 'viewer']),
});
```

### 5.2 Organization CRUD Routes

**File**: `apps/api/src/routes/organizations.ts` (~180 lines)

```
POST   /api/organizations                              -- Create org
GET    /api/organizations                              -- List user's orgs
GET    /api/organizations/:orgId                       -- Org detail + members
PATCH  /api/organizations/:orgId                       -- Update org
DELETE /api/organizations/:orgId                       -- Delete org
```

**Middleware chain**: `dbMiddleware -> authMiddleware -> handler`

Note: Org CRUD routes do NOT use `requirePermission` for create/list (no org context yet). For get/update/delete, they use `resolveOrgContext()` or do inline permission checks.

**POST /api/organizations** -- Create Organization

```typescript
// Request
{ name: "Acme Corp", slug?: "acme-corp" }

// Response 201
{
  organization: {
    id: "uuid",
    name: "Acme Corp",
    slug: "acme-corp",
    ownerId: "user_xxx",
    plan: "free",
    maxInstances: 1,
    createdAt: "ISO",
    updatedAt: "ISO"
  },
  membership: {
    id: "uuid",
    orgId: "uuid",
    userId: "user_xxx",
    role: "owner",
    status: "active",
    invitedAt: "ISO",
    acceptedAt: "ISO"
  }
}
```

Logic:
1. Validate body with `createOrgSchema`
2. Auto-generate slug from name if not provided: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`
3. Check slug uniqueness in `organizations` table
4. Insert organization with `plan: 'free'`, `maxInstances: 1`
5. Insert org_member with `role: 'owner'`, `status: 'active'`, `acceptedAt: now`
6. Return 201

**GET /api/organizations** -- List User's Organizations

```typescript
// Response 200
{
  organizations: [
    {
      id: "uuid",
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "team",
      maxInstances: 5,
      memberCount: 4,
      currentUserRole: "admin",
      createdAt: "ISO"
    }
  ]
}
```

Logic:
1. Query `org_members` WHERE `userId = :userId AND status = 'active'`
2. Join with `organizations` table
3. Count members per org
4. Return with user's role in each org

**GET /api/organizations/:orgId** -- Organization Detail

Requires: `member.view` (via `resolveOrgContext()`)

```typescript
// Response 200
{
  organization: { /* full org object */ },
  members: [
    {
      id: "uuid",
      userId: "user_xxx",
      role: "admin",
      status: "active",
      invitedAt: "ISO",
      acceptedAt: "ISO",
      user: { id: "user_xxx", email: "a@b.com", name: "Alice" }
    }
  ]
}
```

**PATCH /api/organizations/:orgId** -- Update Organization

Requires: `org.update` permission

**DELETE /api/organizations/:orgId** -- Delete Organization

Requires: `org.delete` permission (owner only). Body: `{ confirm: true }`. Sets `org_id = NULL` on instances. Cascades delete members and invitations (ON DELETE CASCADE).

### 5.3 Invitation Routes

**File**: `apps/api/src/routes/organizations-invitations.ts` (~150 lines)

```
POST   /api/organizations/:orgId/invitations           -- Send invite
GET    /api/organizations/:orgId/invitations           -- List pending
DELETE /api/organizations/:orgId/invitations/:id       -- Cancel invite
POST   /api/invitations/:token/accept                  -- Accept invite
```

**POST /api/organizations/:orgId/invitations** -- Send Invitation

Requires: `member.invite` permission

```typescript
// Request
{ email: "bob@example.com", role: "developer" }

// Response 201
{
  invitation: {
    id: "uuid",
    orgId: "uuid",
    email: "bob@example.com",
    role: "developer",
    status: "pending",
    expiresAt: "ISO"
    // Note: token NOT returned in response
  }
}
```

Logic:
1. Validate with `createInvitationSchema`
2. Check inviter's role >= invited role (`isHigherRole` or equal)
3. Check email is not already an active member
4. Check no pending invitation for same email+org
5. Generate token: `crypto.randomUUID()`
6. Set `expiresAt` to 7 days from now
7. Insert `org_invitations` with status 'pending'
8. Send invitation email via Resend (non-blocking, catch errors)
9. Return 201

**POST /api/invitations/:token/accept** -- Accept Invitation

Requires: auth only (userId from Clerk JWT). No org context needed.

```typescript
// Response 200
{
  organization: { /* full org object */ },
  membership: { /* new org_member record */ }
}

// Response 410
{ error: "Gone", message: "Invitation has expired" }

// Response 409
{ error: "Conflict", message: "Already a member of this organization" }
```

Logic:
1. Look up invitation by token
2. If not found: 404
3. If status !== 'pending': 409
4. If `expiresAt < now`: update status to 'expired', return 410
5. Check if user is already an active member of the org: 409
6. Insert `org_members` with `role: invitation.role`, `status: 'active'`
7. Update invitation: `status: 'accepted'`, `acceptedAt: now`
8. Return org details + membership

### 5.4 Member Management Routes

**File**: `apps/api/src/routes/organizations-members.ts` (~130 lines)

```
PATCH  /api/organizations/:orgId/members/:userId       -- Change role
DELETE /api/organizations/:orgId/members/:userId       -- Remove member
POST   /api/organizations/:orgId/members/:userId/transfer -- Transfer ownership
```

**PATCH** -- Change Role

Requires: `member.change_role`

Logic:
1. Validate with `changeRoleSchema`
2. Cannot change owner's role (use transfer)
3. Cannot set role higher than your own (`isHigherRole` check)
4. Update `org_members.role`
5. Audit log: `{ action: 'role_changed', actorId, targetUserId, from, to }`

**DELETE** -- Remove Member

Requires: `member.remove`

Logic:
1. Cannot remove the owner
2. Set `status: 'removed'` (soft delete for audit trail)
3. Audit log: `{ action: 'member_removed', actorId, targetUserId }`

**POST /transfer** -- Transfer Ownership

Requires: current user must be owner (checked inline, not via permission)

Logic:
1. Verify current user is the org owner
2. Verify target user is an active member
3. In single batch: update target to 'owner', update current owner to 'admin'
4. Update `organizations.ownerId` to target user
5. Audit log: `{ action: 'ownership_transferred', from, to }`

### 5.5 Multi-Tenancy Updates to Existing Routes

Every existing route handler that queries `instances`, `securityPolicies`, or `incidents` must be updated to scope queries by `orgId` when present.

**Pattern before** (current):
```typescript
const [instance] = await db.select().from(instances)
  .where(and(eq(instances.id, instanceId), eq(instances.userId, userId)));
```

**Pattern after** (multi-tenant):
```typescript
const instance = await verifyInstanceAccess(db, instanceId, userId, c.get('orgId'));
```

**Instance routes changes** (`instances-crud.ts`, `instances-skills.ts`):

| Route | Permission | Scoping Change |
|---|---|---|
| GET /instances | instance.view | orgId ? `WHERE org_id = :orgId` : `WHERE user_id = :userId` |
| GET /instances/:id | instance.view | `verifyInstanceAccess()` |
| POST /instances | instance.create | orgId ? check org plan limit : check user plan limit |
| POST /instances/:id/restart | instance.restart | `verifyInstanceAccess()` |
| DELETE /instances/:id | instance.delete | `verifyInstanceAccess()` |
| PATCH /instances/:id | instance.create | `verifyInstanceAccess()` |
| POST /instances/:id/skills | skill.install | `verifyInstanceAccess()` |
| DELETE /instances/:id/skills/:skillId | skill.uninstall | `verifyInstanceAccess()` |

When creating an instance within an org: set `orgId` on the new instance record. The plan limit check uses `org.maxInstances` instead of user-level `PLAN_INSTANCE_LIMITS`.

**Security routes changes**: Same pattern -- replace `verifyInstance(db, instanceId, userId)` with `verifyInstanceAccess(db, instanceId, userId, orgId)`.

**Policy routes changes**: Add `requirePermission('policy.create')` / `'policy.update'` / `'policy.delete'` before handlers.

**Incident routes changes**: Add `requirePermission('incident.create')` etc. When assigning an incident, validate the assignee is an active org member.

**Alert routes changes**: Add `requirePermission('alert_rule.create')` etc.

**Vault routes changes**: Add `requirePermission('vault.read')` / `'vault.write'` / `'vault.delete'`.

### 5.6 Route Mounting (Updated index.ts)

```typescript
// NEW: Organization routes
import { organizationRoutes } from './routes/organizations.js';
import { invitationRoutes } from './routes/organizations-invitations.js';
import { memberRoutes } from './routes/organizations-members.js';

app.route('/api/organizations', organizationRoutes);
app.route('/api/organizations', invitationRoutes);
app.route('/api/organizations', memberRoutes);
app.route('/api', invitationRoutes); // for /api/invitations/:token/accept
```

---

## 6. UI Component Design

### 6.1 Dashboard Sidebar Update

**File**: `apps/web/src/app/dashboard/layout.tsx` (modify)

Add a `teamItems` array between `mainItems` and `securityItems`:

```typescript
import { Users, Settings2 } from 'lucide-react';

const teamItems = [
  { href: '/dashboard/team', label: 'Members', icon: Users },
  { href: '/dashboard/team/settings', label: 'Team Settings', icon: Settings2 },
];
```

Conditionally render the Team section:

```tsx
{userOrg && (
  <>
    <div className="pt-4 pb-1">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">
        Team
      </p>
    </div>
    {teamItems.map((item) => {
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </Link>
      );
    })}
  </>
)}
```

The layout fetches org membership status via `GET /api/organizations` and stores in `userOrg`. If user has at least one org, show the Team section.

### 6.2 Team Overview Page

**File**: `apps/web/src/app/dashboard/team/page.tsx` (~180 lines)

Server Component that fetches org details and members.

**Layout**:
```
+---------------------------------------------------+
| Team                                [Invite Member]|
| Acme Corp -- 4 members                            |
+---------------------------------------------------+
|                                                    |
|  Member List Table                                 |
|  +---------+----------+--------+--------+--------+ |
|  | Name    | Email    | Role   | Joined | Actions| |
|  +---------+----------+--------+--------+--------+ |
|  | Alice   | a@b.com  | Owner  | Feb 1  |   --   | |
|  | Bob     | b@c.com  | Admin  | Feb 5  | [...] | |
|  | Carol   | c@d.com  | Dev    | Feb 10 | [...] | |
|  +---------+----------+--------+--------+--------+ |
|                                                    |
|  Pending Invitations                               |
|  +---------+----------+--------+--------+--------+ |
|  | Email   | Role     | Sent   | Expire | Cancel | |
|  +---------+----------+--------+--------+--------+ |
|                                                    |
+---------------------------------------------------+
```

Role badges use the design system colors:
- Owner: `bg-amber-500/10 text-amber-400`
- Admin: `bg-blue-500/10 text-blue-400`
- Security: `bg-purple-500/10 text-purple-400`
- Developer: `bg-green-500/10 text-green-400`
- Viewer: `bg-neutral-500/10 text-neutral-400`

Empty state when user has no org: centered icon + "Create your team" + CTA button.

### 6.3 InviteMemberModal

**File**: `apps/web/src/components/dashboard/team/InviteMemberModal.tsx` (~130 lines)

Client Component (`'use client'`).

**Props**:
```typescript
interface InviteMemberModalProps {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: Role;
}
```

**Layout**:
```
+------------------------------------------+
| Invite Team Member                    [X] |
|                                           |
| Email                                     |
| [bob@example.com                       ]  |
|                                           |
| Role                                      |
| [Developer           v]                   |
|                                           |
| [Cancel]                   [Send Invite]  |
+------------------------------------------+
```

**Behavior**:
1. Email input with client-side validation
2. Role dropdown showing only roles <= current user's hierarchy level
3. On submit: POST to `/api/proxy/organizations/:orgId/invitations`
4. Success: close modal, `window.location.reload()`
5. Error: show inline error message below form
6. Loading state: disable button, show spinner

### 6.4 MemberRoleSelect

**File**: `apps/web/src/components/dashboard/team/MemberRoleSelect.tsx` (~80 lines)

Client Component.

**Props**:
```typescript
interface MemberRoleSelectProps {
  orgId: string;
  memberId: string;
  currentRole: Role;
  currentUserRole: Role;
  isOwner: boolean;
}
```

**Behavior**:
- Disabled if `isOwner` (cannot change owner role via dropdown)
- Only shows roles lower than or equal to `currentUserRole`
- On change: PATCH to `/api/proxy/organizations/:orgId/members/:userId`
- Optimistic UI: show new role immediately, revert on error

### 6.5 RemoveMemberButton

**File**: `apps/web/src/components/dashboard/team/RemoveMemberButton.tsx` (~70 lines)

Client Component.

**Props**:
```typescript
interface RemoveMemberButtonProps {
  orgId: string;
  memberId: string;
  memberName: string;
  isOwner: boolean;
}
```

**Behavior**:
- Hidden if `isOwner` (cannot remove owner)
- Click: show confirmation dialog "Remove {memberName}?"
- Confirm: DELETE to `/api/proxy/organizations/:orgId/members/:userId`
- Success: `window.location.reload()`

### 6.6 Team Settings Page

**File**: `apps/web/src/app/dashboard/team/settings/page.tsx` (~150 lines)

Server Component with client form components.

**Layout**:
```
+---------------------------------------------------+
| Team Settings                                      |
+---------------------------------------------------+
|                                                    |
|  Organization Name                                 |
|  [Acme Corp                            ] [Save]   |
|                                                    |
|  Organization Slug                                 |
|  [acme-corp                            ] [Save]   |
|                                                    |
|  Plan: Team ($399/mo)                              |
|  Instance Limit: 5                                 |
|                                                    |
+---------------------------------------------------+
|  Danger Zone                                       |
|  +-------------------------------------------------+
|  | Delete Organization                              |
|  | This will permanently remove the organization    |
|  | and all member associations.                     |
|  | [Delete Organization]                            |
|  +-------------------------------------------------+
+---------------------------------------------------+
```

Danger zone: red border, requires typing org name to confirm deletion.

### 6.7 Invitation Accept Page

**File**: `apps/web/src/app/invitations/[token]/accept/page.tsx` (~100 lines)

Server Component (outside dashboard layout -- no sidebar).

**Flow**:
1. Check auth status via Clerk
2. If not authenticated: redirect to `/sign-up?redirect_url=/invitations/${token}/accept`
3. If authenticated: call `POST /api/invitations/${token}/accept` server-side
4. On success: redirect to `/dashboard/team`
5. On 410: show "Invitation expired" message
6. On 409: show "Already a member" message with link to dashboard

### 6.8 Org Context in Web App

The web app needs to track the user's active organization. Design:

1. On layout load, fetch `GET /api/organizations` to get user's org list
2. If user has exactly one org, use it automatically
3. If user has multiple orgs, store selection in `localStorage('activeOrgId')`
4. The `apiClient` helper adds `X-Org-Id` header when `activeOrgId` is set

**File**: `apps/web/src/lib/api.ts` (modify)

```typescript
export async function apiClient<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Add org context if available (browser-only)
  if (typeof window !== 'undefined') {
    const activeOrgId = localStorage.getItem('activeOrgId');
    if (activeOrgId) {
      headers['X-Org-Id'] = activeOrgId;
    }
  }

  // ... rest unchanged
}
```

For server-side API calls (Server Components), pass org ID from a cookie or query the orgs endpoint. Design choice: use a `activeOrgId` cookie set by a client component on org selection.

### 6.9 Proxy Routes (New)

Each proxy route follows the existing pattern. New proxy routes needed:

| Proxy Route Path | API Path | Methods |
|---|---|---|
| `/api/proxy/organizations/route.ts` | `/api/organizations` | GET, POST |
| `/api/proxy/organizations/[orgId]/route.ts` | `/api/organizations/:orgId` | GET, PATCH, DELETE |
| `/api/proxy/organizations/[orgId]/invitations/route.ts` | `/api/organizations/:orgId/invitations` | GET, POST |
| `/api/proxy/organizations/[orgId]/invitations/[id]/route.ts` | `/api/organizations/:orgId/invitations/:id` | DELETE |
| `/api/proxy/organizations/[orgId]/members/[userId]/route.ts` | `/api/organizations/:orgId/members/:userId` | PATCH, DELETE |
| `/api/proxy/organizations/[orgId]/members/[userId]/transfer/route.ts` | `/api/organizations/:orgId/members/:userId/transfer` | POST |
| `/api/proxy/invitations/[token]/accept/route.ts` | `/api/invitations/:token/accept` | POST |

Each proxy route (~30 lines) follows this pattern:

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiClient } from '@/lib/api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { orgId } = await params;
    const body = await request.json();
    const data = await apiClient(`/api/organizations/${orgId}/invitations`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 },
    );
  }
}
```

---

## 7. Email Flow Design

### 7.1 Invitation Email

**File**: `apps/api/src/services/email.ts` (add method to existing `EmailService` interface)

New interface method:

```typescript
sendInvitationEmail(opts: {
  to: string;
  inviterName: string | null;
  orgName: string;
  role: string;
  acceptUrl: string;
  apiKey: string;
}): Promise<void>;
```

Implementation:

```typescript
async sendInvitationEmail({ to, inviterName, orgName, role, acceptUrl, apiKey }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'OpenSyber <noreply@opensyber.cloud>',
      to: [to],
      subject: `You've been invited to ${orgName} on OpenSyber`,
      html: `<p>Hi,</p>
<p>${inviterName ? `<strong>${inviterName}</strong>` : 'A team member'} has invited you to join <strong>${orgName}</strong> as a <strong>${role}</strong> on OpenSyber.</p>
<p>OpenSyber is a secure, managed AI agent hosting platform. Accept the invitation to start collaborating with your team.</p>
<p><a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invitation</a></p>
<p style="color:#999;font-size:13px;">This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
<p>-- The OpenSyber Team</p>`,
    }),
  });

  if (!response.ok) {
    console.error('[Email] Failed to send invitation email:', await response.text());
  }
},
```

### 7.2 Accept Flow

```
Invitation Email
    |
    v
Click "Accept Invitation"
    |
    v
/invitations/{token}/accept page
    |
    +--> Not logged in?
    |       |
    |       v
    |    Redirect to /sign-up?redirect_url=/invitations/{token}/accept
    |       |
    |       v
    |    After sign-up, redirected back to accept page
    |
    +--> Logged in?
            |
            v
        POST /api/invitations/{token}/accept
            |
            +--> 200: Redirect to /dashboard/team (success toast)
            +--> 410: Show "Invitation expired" page
            +--> 409: Show "Already a member" page
            +--> 404: Show "Invitation not found" page
```

### 7.3 Token Design

- Generated via `crypto.randomUUID()` (128-bit entropy)
- Stored in `org_invitations.token` with unique index
- Single-use: status transitions from 'pending' to 'accepted'
- 7-day TTL: `expiresAt` checked server-side on every accept attempt
- Not included in API responses (only sent in email link)

---

## 8. Migration Strategy

### 8.1 Phase 1: Schema Migration (Sprint 8, Day 1)

Non-destructive migration:
1. Run `0008_organizations_rbac.sql` to create new tables and add nullable columns
2. No existing data is modified
3. Application handles `NULL orgId` as "solo mode"

### 8.2 Phase 2: Application Deploy (Sprint 8, Days 2-10)

1. Deploy `packages/shared` with roles, permissions, types
2. Deploy `packages/db` with split schema (barrel export preserves imports)
3. Deploy API with RBAC middleware + new routes
4. Deploy web app with team UI

### 8.3 Phase 3: Data Backfill (Optional, Post-Sprint 8)

Script to create personal organizations for existing users (if desired):

```typescript
async function backfillPersonalOrgs(db: DrizzleD1Database) {
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    // Check if user already has an org
    const [existing] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, user.id), eq(orgMembers.status, 'active')));

    if (existing) continue;

    const orgId = generateId();
    const now = new Date().toISOString();
    const slug = `personal-${user.id.slice(0, 8)}`;

    await db.insert(organizations).values({
      id: orgId,
      name: `${user.name ?? user.email}'s Workspace`,
      slug,
      ownerId: user.id,
      plan: user.plan,
      maxInstances: PLAN_INSTANCE_LIMITS[user.plan] ?? 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(orgMembers).values({
      id: generateId(),
      orgId,
      userId: user.id,
      role: 'owner',
      invitedAt: now,
      acceptedAt: now,
      status: 'active',
    });

    // Link user's instances to the org
    await db.update(instances)
      .set({ orgId })
      .where(eq(instances.userId, user.id));
  }
}
```

This is deferred and optional. Solo users work fine without it.

### 8.4 Rollback Plan

All changes are additive and backward compatible:
- New tables can be dropped without affecting existing data
- New nullable columns are ignored by existing queries
- RBAC middleware passes through when no `X-Org-Id` header is present
- New web pages are independent routes that do not affect existing pages

---

## 9. File Organization

### 9.1 New Files

| File | Purpose | Target Lines |
|---|---|---|
| **Database** | | |
| `packages/db/migrations/0008_organizations_rbac.sql` | SQL migration | ~45 |
| `packages/db/src/schema/index.ts` | Barrel export | ~10 |
| `packages/db/src/schema/users.ts` | User + credential tables | ~35 |
| `packages/db/src/schema/instances.ts` | Instance + skill tables | ~75 |
| `packages/db/src/schema/security.ts` | All security-related tables | ~190 |
| `packages/db/src/schema/organizations.ts` | Org, member, invitation tables | ~80 |
| `packages/db/src/schema/tokenforge.ts` | TokenForge tables | ~100 |
| **Shared Package** | | |
| `packages/shared/src/constants/roles.ts` | Role constants + hierarchy | ~40 |
| `packages/shared/src/constants/permissions.ts` | Permission matrix + hasPermission | ~150 |
| `packages/shared/src/constants/permissions.test.ts` | Permission matrix tests | ~200 |
| `packages/shared/src/types/rbac.ts` | Organization, OrgMember, OrgInvitation types | ~55 |
| `packages/shared/src/utils/slug.ts` | Slug generation utility | ~20 |
| `packages/shared/src/utils/slug.test.ts` | Slug tests | ~40 |
| **API Middleware** | | |
| `apps/api/src/middleware/rbac.ts` | requirePermission middleware | ~90 |
| `apps/api/src/middleware/rbac.test.ts` | RBAC middleware tests | ~200 |
| **API Routes** | | |
| `apps/api/src/routes/organizations.ts` | Org CRUD routes | ~180 |
| `apps/api/src/routes/organizations-invitations.ts` | Invitation routes | ~150 |
| `apps/api/src/routes/organizations-members.ts` | Member management routes | ~130 |
| `apps/api/src/routes/organizations.test.ts` | Org route tests | ~200 |
| `apps/api/src/routes/organizations-invitations.test.ts` | Invitation route tests | ~200 |
| `apps/api/src/routes/organizations-members.test.ts` | Member route tests | ~200 |
| **API Utils** | | |
| `apps/api/src/utils/verify-instance.ts` | Multi-tenant instance verification helper | ~35 |
| `apps/api/src/validation/organizations.ts` | Zod schemas for org endpoints | ~80 |
| **API Route Splits (from oversized files)** | | |
| `apps/api/src/routes/instances-crud.ts` | Instance CRUD (list, get, create, update, delete) | ~190 |
| `apps/api/src/routes/instances-skills.ts` | Instance skill install/uninstall | ~80 |
| `apps/api/src/routes/security-dashboard.ts` | Security dashboard + score history | ~120 |
| `apps/api/src/routes/security-events.ts` | Security events + audit log | ~60 |
| `apps/api/src/routes/security-vulns.ts` | Vulnerability management | ~100 |
| `apps/api/src/routes/security-network.ts` | Network activity + file integrity + access log | ~120 |
| `apps/api/src/routes/security-threats.ts` | Threat map | ~80 |
| `apps/api/src/routes/security-gateway.ts` | Gateway-authenticated agent routes | ~200 |
| `apps/api/src/routes/incidents-crud.ts` | Incident CRUD | ~180 |
| `apps/api/src/routes/incidents-events.ts` | Incident timeline events + linking | ~130 |
| `apps/api/src/routes/alerts-rules.ts` | Alert rule CRUD | ~130 |
| `apps/api/src/routes/alerts-triggered.ts` | Triggered alerts list + acknowledge/resolve | ~80 |
| `apps/api/src/routes/alerts-channels.ts` | Notification channel CRUD | ~90 |
| **Web Pages** | | |
| `apps/web/src/app/dashboard/team/page.tsx` | Team overview page | ~180 |
| `apps/web/src/app/dashboard/team/settings/page.tsx` | Team settings page | ~150 |
| `apps/web/src/app/invitations/[token]/accept/page.tsx` | Invitation accept page | ~100 |
| **Web Components** | | |
| `apps/web/src/components/dashboard/team/InviteMemberModal.tsx` | Invite modal | ~130 |
| `apps/web/src/components/dashboard/team/MemberRoleSelect.tsx` | Role dropdown | ~80 |
| `apps/web/src/components/dashboard/team/RemoveMemberButton.tsx` | Remove button with confirm | ~70 |
| `apps/web/src/components/dashboard/team/RoleBadge.tsx` | Color-coded role badge | ~30 |
| `apps/web/src/components/dashboard/team/CreateOrgButton.tsx` | Create org CTA for empty state | ~60 |
| **Web Proxy Routes** | | |
| `apps/web/src/app/api/proxy/organizations/route.ts` | GET, POST | ~40 |
| `apps/web/src/app/api/proxy/organizations/[orgId]/route.ts` | GET, PATCH, DELETE | ~60 |
| `apps/web/src/app/api/proxy/organizations/[orgId]/invitations/route.ts` | GET, POST | ~45 |
| `apps/web/src/app/api/proxy/organizations/[orgId]/invitations/[id]/route.ts` | DELETE | ~30 |
| `apps/web/src/app/api/proxy/organizations/[orgId]/members/[userId]/route.ts` | PATCH, DELETE | ~50 |
| `apps/web/src/app/api/proxy/organizations/[orgId]/members/[userId]/transfer/route.ts` | POST | ~30 |
| `apps/web/src/app/api/proxy/invitations/[token]/accept/route.ts` | POST | ~30 |

### 9.2 Modified Files

| File | Change Description |
|---|---|
| `packages/db/src/schema.ts` | Replaced by `schema/index.ts` -- delete this file and replace with re-export |
| `packages/db/src/index.ts` | Update export path from `./schema.js` to `./schema/index.js` |
| `packages/shared/src/constants/index.ts` | Add `export * from './roles.js'` and `export * from './permissions.js'` |
| `packages/shared/src/types/index.ts` | Add `export * from './rbac.js'` |
| `packages/shared/src/utils/index.ts` | Add `export * from './slug.js'` |
| `apps/api/src/types.ts` | Add `orgId`, `role`, `orgMember` to Variables interface |
| `apps/api/src/index.ts` | Mount organization routes, update imports for split route files |
| `apps/api/src/routes/instances.ts` | Replace with barrel: `export { instanceCrudRoutes } from './instances-crud.js'; export { instanceSkillRoutes } from './instances-skills.js'` |
| `apps/api/src/routes/security.ts` | Replace with barrel re-exporting split files |
| `apps/api/src/routes/incidents.ts` | Replace with barrel re-exporting split files |
| `apps/api/src/routes/alerts.ts` | Replace with barrel re-exporting split files |
| `apps/api/src/routes/policies.ts` | Add `requirePermission()` middleware calls |
| `apps/api/src/routes/vault.ts` | Add `requirePermission()` middleware calls |
| `apps/api/src/services/email.ts` | Add `sendInvitationEmail` method |
| `apps/web/src/app/dashboard/layout.tsx` | Add Team nav section (conditional) |
| `apps/web/src/lib/api.ts` | Add `X-Org-Id` header from localStorage |

### 9.3 Files to Split/Refactor

| Current File | Lines | Split Into | Lines Each |
|---|---|---|---|
| `packages/db/src/schema.ts` | 635 | `schema/users.ts`, `schema/instances.ts`, `schema/security.ts`, `schema/organizations.ts`, `schema/tokenforge.ts`, `schema/index.ts` | 35, 75, 190, 80, 100, 10 |
| `apps/api/src/routes/instances.ts` | 460 | `instances-crud.ts`, `instances-skills.ts` | 190, 80 |
| `apps/api/src/routes/security.ts` | 828 | `security-dashboard.ts`, `security-events.ts`, `security-vulns.ts`, `security-network.ts`, `security-threats.ts`, `security-gateway.ts` | 120, 60, 100, 120, 80, 200 |
| `apps/api/src/routes/incidents.ts` | 346 | `incidents-crud.ts`, `incidents-events.ts` | 180, 130 |
| `apps/api/src/routes/alerts.ts` | 318 | `alerts-rules.ts`, `alerts-triggered.ts`, `alerts-channels.ts` | 130, 80, 90 |
| `apps/api/src/routes/webhooks.ts` | 503 | `webhooks-clerk.ts`, `webhooks-lemonsqueezy.ts` | ~250 each (or further split) |

---

## 10. Testing Strategy

### 10.1 Test Pyramid

```
           /  E2E  \          5 tests: Org lifecycle, RBAC enforcement
          / -------- \
         / Integration\       15 tests: Multi-tenant isolation, invitation flow
        / ------------ \
       /    Component    \    18 tests: Team UI components
      / ---------------- \
     /       Unit          \  100+ tests: Permissions, middleware, handlers
    / ---------------------- \
```

### 10.2 Unit Tests -- Permission Matrix

**File**: `packages/shared/src/constants/permissions.test.ts`

Test every cell in the 5x34 permission matrix:

```typescript
import { describe, it, expect } from 'vitest';
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from './permissions.js';
import { ROLES } from './roles.js';
import type { Role } from './roles.js';
import type { Permission } from './permissions.js';

describe('Permission matrix', () => {
  // Owner has ALL permissions
  it('owner has all permissions', () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });

  // All roles have *.view permissions
  const viewPermissions: Permission[] = [
    'instance.view', 'skill.view', 'policy.view', 'incident.view',
    'alert_rule.view', 'member.view', 'audit.view',
  ];

  for (const role of Object.values(ROLES)) {
    for (const perm of viewPermissions) {
      it(`${role} has ${perm}`, () => {
        expect(hasPermission(role, perm)).toBe(true);
      });
    }
  }

  // Viewer denied writes
  const writePermissions: Permission[] = [
    'instance.create', 'instance.delete', 'policy.create',
    'member.invite', 'billing.manage', 'org.delete',
  ];

  for (const perm of writePermissions) {
    it(`viewer denied ${perm}`, () => {
      expect(hasPermission('viewer', perm)).toBe(false);
    });
  }

  // billing.manage is owner-only
  it('only owner has billing.manage', () => {
    expect(hasPermission('owner', 'billing.manage')).toBe(true);
    expect(hasPermission('admin', 'billing.manage')).toBe(false);
    expect(hasPermission('security', 'billing.manage')).toBe(false);
    expect(hasPermission('developer', 'billing.manage')).toBe(false);
    expect(hasPermission('viewer', 'billing.manage')).toBe(false);
  });

  // org.delete is owner-only
  it('only owner has org.delete', () => {
    expect(hasPermission('owner', 'org.delete')).toBe(true);
    expect(hasPermission('admin', 'org.delete')).toBe(false);
  });

  // developer cannot delete instances
  it('developer cannot instance.delete', () => {
    expect(hasPermission('developer', 'instance.delete')).toBe(false);
  });

  // developer can create instances
  it('developer can instance.create', () => {
    expect(hasPermission('developer', 'instance.create')).toBe(true);
  });

  // security cannot deploy
  it('security cannot instance.create', () => {
    expect(hasPermission('security', 'instance.create')).toBe(false);
  });

  // security can manage policies
  it('security can policy.create', () => {
    expect(hasPermission('security', 'policy.create')).toBe(true);
  });
});
```

### 10.3 Unit Tests -- RBAC Middleware

**File**: `apps/api/src/middleware/rbac.test.ts`

Tests:
1. No `X-Org-Id` header: passes through, sets null context
2. Valid `X-Org-Id` + active member with permission: passes through
3. Valid `X-Org-Id` + active member without permission: 403
4. Valid `X-Org-Id` + non-member user: 403
5. Valid `X-Org-Id` + pending member (not yet accepted): 403
6. Valid `X-Org-Id` + removed member: 403
7. Each role with specific permissions (parameterized tests)

### 10.4 Integration Tests -- Organization Lifecycle

**File**: `apps/api/src/routes/organizations.test.ts`

Test flow:
1. Create org -> verify creator is owner
2. List orgs -> verify creator sees their org
3. Get org detail -> verify member list includes creator
4. Invite member -> verify invitation created + email called
5. Accept invitation -> verify member added
6. Change role -> verify role updated
7. Remove member -> verify status = removed
8. Transfer ownership -> verify roles swapped
9. Delete org -> verify cascade

### 10.5 Security Tests

| Test | Description |
|---|---|
| Horizontal escalation | User A creates org A. User B attempts GET /api/organizations/orgA. Should get 403. |
| Vertical escalation | Viewer in orgA attempts POST /api/instances with X-Org-Id: orgA. Should get 403. |
| Role escalation | Admin attempts PATCH /members/:userId with role: owner. Should get 403. |
| Token brute force | Accept endpoint with invalid UUID token. Should get 404, not 500. |
| Owner protection | Attempt DELETE /members/:ownerId. Should get 403 or specific error. |
| Expired invitation | Create invitation, mock Date.now() to 8 days later, attempt accept. Should get 410. |

---

## 11. Security Design

### 11.1 Permission Enforcement Pattern

Every write endpoint must use `requirePermission()` middleware:

```typescript
// CORRECT: Permission checked before handler runs
instanceRoutes.post('/', requirePermission('instance.create'), async (c) => { ... });

// WRONG: Permission checked inside handler (too late, could bypass)
instanceRoutes.post('/', async (c) => {
  if (!hasPermission(c.get('role'), 'instance.create')) return c.json({...}, 403);
  ...
});
```

### 11.2 Role Hierarchy Enforcement

When inviting or changing roles:

```typescript
function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  // Owner can assign any role except owner (use transfer for that)
  if (actorRole === 'owner') return targetRole !== 'owner';
  // Others can only assign roles below them
  return isHigherRole(actorRole, targetRole);
}
```

### 11.3 Invitation Token Security

- Tokens are `crypto.randomUUID()` -- 128-bit entropy, cryptographically random
- Single-use: status transitions are one-way (pending -> accepted/expired/cancelled)
- Token NOT returned in any API response (only sent in email)
- Expiry enforced server-side: `expiresAt < new Date().toISOString()`
- Rate limiting on accept endpoint (existing public rate limit: 10 req/min)

### 11.4 Audit Logging

All state-changing RBAC operations logged:

```typescript
// Pattern for org audit events
async function logOrgAction(db: DrizzleD1Database, opts: {
  orgId: string;
  actorId: string;
  action: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    instanceId: opts.orgId, // Repurpose instanceId field or add new org audit table
    action: 'config_change' as const,
    details: JSON.stringify({
      orgAction: opts.action,
      actorId: opts.actorId,
      targetId: opts.targetId,
      ...opts.details,
    }),
    createdAt: new Date().toISOString(),
  });
}
```

Events to log:
- `org.created` -- actor created org
- `member.invited` -- actor invited email to role
- `invitation.accepted` -- user accepted invitation
- `member.role_changed` -- actor changed target's role from X to Y
- `member.removed` -- actor removed target
- `ownership.transferred` -- actor transferred ownership to target
- `org.updated` -- actor changed org name/slug
- `org.deleted` -- actor deleted org

---

## 12. Performance Design

### 12.1 RBAC Middleware Performance

The permission check is O(1): `Set.has()` on a pre-built static set. No DB query for the permission check itself.

The org membership lookup is one DB query per request:
```sql
SELECT * FROM org_members
WHERE org_id = ? AND user_id = ? AND status = 'active'
LIMIT 1
```

This query uses the covering index `idx_org_members_org_user_status` on (org_id, user_id, status) and executes in < 1ms on D1.

### 12.2 Instance Listing Performance

Org-scoped instance listing:
```sql
SELECT * FROM instances WHERE org_id = ? ORDER BY created_at DESC
```

Uses `idx_instances_org` index. Expected < 50ms for up to 100 instances.

### 12.3 Member Listing Performance

```sql
SELECT om.*, u.id, u.email, u.name
FROM org_members om
JOIN users u ON om.user_id = u.id
WHERE om.org_id = ? AND om.status = 'active'
```

Uses `idx_org_members_org` index. Expected < 10ms for up to 50 members.

### 12.4 Email Delivery

Invitation emails are sent non-blocking:

```typescript
// Send email in background, don't block the API response
try {
  await emailService.sendInvitationEmail({ ... });
} catch (err) {
  console.error('[Email] Failed to send invitation:', err);
  // Don't fail the invitation creation
}
```

---

## 13. Deployment Strategy

### 13.1 Deployment Order

```
Step 1: packages/db -- Run migration 0008 on D1
   |
   v
Step 2: packages/shared -- Deploy shared types/constants (no runtime impact)
   |
   v
Step 3: packages/db -- Deploy split schema (backward compatible re-exports)
   |
   v
Step 4: apps/api -- Deploy API with RBAC + org routes
   |    - Solo users: no X-Org-Id header = full access (unchanged)
   |    - Org users: X-Org-Id header = RBAC enforced
   |
   v
Step 5: apps/web -- Deploy web with team UI
        - New /dashboard/team pages
        - Updated sidebar (conditional Team section)
        - Updated apiClient (X-Org-Id header)
```

### 13.2 Pre-Deploy Checklist

```bash
# 1. Run migration on D1
cd packages/db
pnpm db:generate
pnpm db:migrate

# 2. Build and test all packages
pnpm typecheck
pnpm test
pnpm build

# 3. Deploy API
cd apps/api
pnpm deploy

# 4. Deploy Web
cd apps/web
find .open-next -delete 2>/dev/null  # Node v24 rm -rf bug
pnpm build
pnpm deploy
```

### 13.3 Rollback

If issues are detected post-deploy:

1. **API rollback**: Revert to previous worker version. RBAC middleware defaults to full access when no X-Org-Id header, so existing users are unaffected.
2. **Web rollback**: Revert to previous Pages deployment. New team pages simply become 404s.
3. **DB rollback**: New tables and columns are additive. If needed, drop tables and columns via a reverse migration. No existing data is at risk.

### 13.4 Feature Flag (Optional)

If a more gradual rollout is desired, the Team nav section can be gated behind a feature flag:

```typescript
const FEATURE_FLAGS = {
  enableTeams: process.env.NEXT_PUBLIC_ENABLE_TEAMS === 'true',
};
```

This hides the UI but the API endpoints remain available for testing.

---

## Appendix A: Design Decisions

| Decision | Chosen Approach | Alternatives Considered | Rationale |
|---|---|---|---|
| Org context delivery | `X-Org-Id` header | URL prefix (`/org/:orgId/...`), Cookie, Query param | Header keeps URLs clean; cookie limits server-side control; URL prefix requires rewriting all routes |
| Permission storage | In-memory static map | Database table, JSON config file | Zero latency; no cold-start penalty; compile-time type safety |
| Solo user behavior | null orgId = bypass RBAC | Force create personal org on signup | Simplest migration path; no data changes needed; existing tests pass |
| Schema split strategy | Domain-based files | One-table-per-file, layer-based | Domain grouping keeps related tables together; prevents excessive file count |
| Org audit logging | Reuse `audit_log` table with JSON details | New `org_audit_log` table | Avoids schema proliferation; all audit in one place; details field already supports JSON |
| Membership soft delete | `status: 'removed'` | Hard delete from org_members | Preserves audit trail; allows "removed" state checks |
| Invitation flow | Server-side accept via API call | Client-side token validation | Server-side is more secure; token never exposed to client JavaScript |

## Appendix B: Conventions and Standards

### Naming Conventions

- **Tables**: snake_case (D1/SQLite convention)
- **Drizzle columns**: camelCase in TypeScript, snake_case in SQL
- **Route files**: kebab-case (e.g., `organizations-invitations.ts`)
- **Component files**: PascalCase (e.g., `InviteMemberModal.tsx`)
- **Permission strings**: `resource.action` (e.g., `instance.create`)
- **Role strings**: lowercase (e.g., `owner`, `admin`)

### Error Response Format

All error responses follow the existing pattern:

```typescript
{ error: string; message: string }
```

Status codes:
- 400: Invalid request body (Zod validation failure)
- 401: Missing or invalid auth token
- 403: Insufficient permissions or not a member
- 404: Resource not found
- 409: Conflict (duplicate membership, already accepted)
- 410: Gone (expired invitation)
- 500: Internal server error

### API Response Format

Success responses follow the existing pattern:

```typescript
// Single resource
{ organization: { ... } }

// List
{ organizations: [...] }

// With metadata
{ organization: { ... }, membership: { ... } }
```

---

## Appendix C: Dependencies

### New Dependencies

None. The design uses only existing dependencies:
- `hono` (routing, middleware)
- `drizzle-orm` (database)
- `zod` (validation)
- `@clerk/nextjs` (auth)
- `lucide-react` (icons)

### Existing Services Used

- **Resend API**: One new email template (invitation)
- **Clerk**: Unchanged (JWT verification only)
- **D1**: One new migration (3 tables, 3 ALTER TABLEs)
- **KV**: No changes
