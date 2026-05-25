# Sprint 8: Enterprise RBAC, Teams & Organizations -- Requirements Document

**Sprint**: 8 of 10
**Duration**: 2 weeks (10 working days)
**Dependencies**: Sprints 1-5 complete (working MVP)
**Date**: 2026-02-28
**Reviewer**: Luna Requirements Agent

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Gap Analysis: Current State vs Target State](#2-gap-analysis)
3. [User Stories by Role](#3-user-stories-by-role)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Constraints and Dependencies](#6-technical-constraints-and-dependencies)
7. [Migration Strategy](#7-migration-strategy)
8. [Test Strategy](#8-test-strategy)

---

## 1. Executive Summary

Sprint 8 transforms OpenSyber from a single-user product into a multi-user, organization-based platform with role-based access control. A CTO can invite their team, assign granular roles (owner, admin, security, developer, viewer), and control who can deploy agents, manage policies, or view audit logs. This unlocks the Team plan ($399/mo, 5 instances) which currently has no supporting data model.

### Key Deliverables

- D1 database schema for organizations, org_members, org_invitations
- orgId columns added to instances, security_policies, incidents
- 5-role RBAC system with 20+ granular permissions
- RBAC middleware enforced on every API route
- Organization CRUD API (create, read, update, delete)
- Invitation flow with email via Resend
- Multi-tenancy updates to all existing routes
- Team Dashboard UI (member list, invite, role management, settings)
- Migration path for existing single-user data

---

## 2. Gap Analysis

### 2.1 Database Schema

| Area | Current State | Target State | Gap |
|---|---|---|---|
| Organizations table | Does not exist | `organizations` table with id, name, slug, ownerId, plan, timestamps | New table required |
| Org Members table | Does not exist | `org_members` table with orgId, userId, role, status, invitedBy | New table required |
| Org Invitations table | Does not exist | `org_invitations` table with orgId, email, role, token, expiresAt | New table required |
| instances.orgId | Not present | Nullable `orgId` column referencing organizations | ALTER TABLE migration |
| security_policies.orgId | Not present; scoped to instanceId only | Nullable `orgId` column | ALTER TABLE migration |
| incidents.orgId | Not present; scoped to instanceId only | Nullable `orgId` column | ALTER TABLE migration |
| credentials.orgId | Not present; scoped to userId + instanceId | Consider orgId for org-level secrets | Evaluate need |
| notification_channels.orgId | Scoped to userId only | Consider orgId for org-level channels | Evaluate need |

**Current schema file**: `/Users/shaharsolomon/dev/projects/opensyber/packages/db/src/schema.ts` (635 lines -- exceeds 200-line limit, will need splitting as part of this sprint)

**Current migrations**: 7 existing migrations (`0001_initial.sql` through `0007_tokenforge_saas.sql`). Next migration will be `0008_organizations_rbac.sql`.

### 2.2 Authentication & Authorization

| Area | Current State | Target State | Gap |
|---|---|---|---|
| Auth middleware | `authMiddleware` in `/Users/shaharsolomon/dev/projects/opensyber/apps/api/src/middleware/auth.ts` extracts `userId` from Clerk JWT. Sets `c.set('userId', session.sub)` | Same auth + RBAC layer that resolves org membership and checks permissions | New `rbac.ts` middleware |
| RBAC middleware | Does not exist | `requirePermission(permission)` middleware that checks role-permission mapping | Completely new |
| Hono context variables | `Variables` interface has `db` and `userId` only (`/Users/shaharsolomon/dev/projects/opensyber/apps/api/src/types.ts`) | Add `orgId`, `role`, `orgMember` to Variables | Update types.ts |
| Resource scoping | All routes use `WHERE userId = :currentUser` pattern | Org members see org resources; solo users see personal resources | Update every route |

### 2.3 API Routes

| Route File | Current Auth Pattern | Multi-Tenancy Gap |
|---|---|---|
| `instances.ts` (460 lines) | `eq(instances.userId, userId)` on every query | Must scope to orgId when user is in org; check `instance.create/delete` permissions; enforce org-level instance limits |
| `security.ts` (828 lines) | `verifyInstance(db, instanceId, userId)` helper checks `instances.userId` | Must verify instance belongs to org, check `audit.view` permission |
| `policies.ts` (204 lines) | `eq(instances.userId, userId)` ownership check | Check `policy.create/update/delete` permissions |
| `incidents.ts` (346 lines) | `eq(instances.userId, userId)` ownership check | Check `incident.create/update` permissions; assignee must be org member |
| `alerts.ts` (318 lines) | `eq(instances.userId, userId)` ownership check | Check `alert_rule.create/update/delete` permissions |
| `vault.ts` (115 lines) | `eq(instances.userId, userId)` ownership check | Check `vault.read/write/delete` permissions |
| `user.ts` (206 lines) | Personal user data only | Add org context to user profile response |
| `webhooks.ts` (503 lines) | Clerk + LemonSqueezy webhooks | Subscription changes may need to update org plan |
| `skills.ts` | Instance ownership check | Check `skill.install/uninstall` permissions |

**Note**: `instances.ts` (460 lines), `security.ts` (828 lines), `webhooks.ts` (503 lines), and `incidents.ts` (346 lines) exceed the 200-line file size limit and must be refactored during this sprint.

### 2.4 Shared Package

| Area | Current State | Target State | Gap |
|---|---|---|---|
| Role constants | Do not exist | `packages/shared/src/constants/roles.ts` | New file |
| Permission constants | Do not exist | `packages/shared/src/constants/permissions.ts` with role-permission matrix | New file |
| RBAC types | Do not exist | `packages/shared/src/types/rbac.ts` with Role, Permission, OrgMember, OrgInvitation types | New file |
| Plan config | `PLAN_INSTANCE_LIMITS` is per-user in `instance.ts` | Needs org-level limit enforcement for Team plan | Update logic |

### 2.5 Web App (Frontend)

| Area | Current State | Target State | Gap |
|---|---|---|---|
| Team page | Does not exist | `/dashboard/team/page.tsx` with member list, invite, role management | New page |
| Team settings | Does not exist | `/dashboard/team/settings/page.tsx` with org name, slug, danger zone | New page |
| Invitation accept | Does not exist | `/invitations/[token]/accept/page.tsx` public page | New page |
| Dashboard sidebar | No "Team" section (`/Users/shaharsolomon/dev/projects/opensyber/apps/web/src/app/dashboard/layout.tsx`) | Add "Team" nav section between main items and security section | Update layout |
| Proxy routes | 25 existing proxy routes in `/Users/shaharsolomon/dev/projects/opensyber/apps/web/src/app/api/proxy/` | Add proxy routes for all organization, invitation, and member endpoints | New proxy routes |

### 2.6 Email Service

| Area | Current State | Target State | Gap |
|---|---|---|---|
| Email service | 6 email methods in `/Users/shaharsolomon/dev/projects/opensyber/apps/api/src/services/email.ts` (Resend API) | Add `sendInvitationEmail` method | New method |
| Email templates | Plain HTML templates with OpenSyber branding | Invitation template with org name, inviter name, role, accept CTA, 7-day expiry | New template |

---

## 3. User Stories by Role

### 3.1 Owner

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-O1 | As an owner, I can create an organization so my team can collaborate | POST /api/organizations returns 201 with org data; creator becomes owner |
| US-O2 | As an owner, I can invite team members by email | POST /api/organizations/:orgId/invitations sends Resend email; invitation stored with 7-day expiry |
| US-O3 | As an owner, I can change any member's role | PATCH /api/organizations/:orgId/members/:userId with new role returns 200 |
| US-O4 | As an owner, I can remove any member | DELETE /api/organizations/:orgId/members/:userId returns 200; cannot remove self |
| US-O5 | As an owner, I can transfer ownership to another member | POST /api/organizations/:orgId/members/:userId/transfer demotes current owner to admin, promotes target to owner |
| US-O6 | As an owner, I can delete the organization | DELETE /api/organizations/:orgId requires confirmation; cascades cleanup |
| US-O7 | As an owner, I can manage billing | Only owner can access billing.manage permission |
| US-O8 | As an owner, I see all org instances in my dashboard | GET /api/instances returns all instances where orgId matches |

### 3.2 Admin

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-A1 | As an admin, I can invite new members | member.invite permission granted; can send invitations |
| US-A2 | As an admin, I can remove members (except owner) | member.remove permission granted; 403 if target is owner |
| US-A3 | As an admin, I can manage all instances | instance.create, instance.delete, instance.restart permissions granted |
| US-A4 | As an admin, I can view and export audit logs | audit.view and audit.export permissions granted |
| US-A5 | As an admin, I cannot manage billing | billing.manage returns 403 |
| US-A6 | As an admin, I cannot transfer ownership | transfer endpoint returns 403 for non-owners |

### 3.3 Security

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-S1 | As a security analyst, I can view the security dashboard | *.view permission granted for all resources |
| US-S2 | As a security analyst, I can create and manage policies | policy.create, policy.update, policy.delete permissions granted |
| US-S3 | As a security analyst, I can create and manage incidents | incident.create, incident.update permissions granted |
| US-S4 | As a security analyst, I can export audit logs | audit.export permission granted |
| US-S5 | As a security analyst, I cannot deploy or delete instances | instance.create and instance.delete return 403 |
| US-S6 | As a security analyst, I cannot manage members | member.invite and member.remove return 403 |

### 3.4 Developer

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-D1 | As a developer, I can deploy new agent instances | instance.create permission granted |
| US-D2 | As a developer, I can install and uninstall skills | skill.install, skill.uninstall permissions granted |
| US-D3 | As a developer, I can restart instances | instance.restart permission granted |
| US-D4 | As a developer, I can store vault secrets | vault.write permission granted |
| US-D5 | As a developer, I cannot delete instances | instance.delete returns 403 |
| US-D6 | As a developer, I cannot manage security policies | policy.create, policy.update, policy.delete return 403 |
| US-D7 | As a developer, I cannot manage members | member.invite returns 403 |

### 3.5 Viewer

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-V1 | As a viewer, I can see all org resources in read-only mode | *.view permission granted for all resources |
| US-V2 | As a viewer, I cannot create, update, or delete any resource | All write operations return 403 |
| US-V3 | As a viewer, I can see the team member list | GET /api/organizations/:orgId returns member list |

### 3.6 Invitee (Non-Member)

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-I1 | As an invitee, I receive an email with a join link | Resend email sent with accept URL |
| US-I2 | As an existing user invitee, I can accept and join the org immediately | POST /api/invitations/:token/accept adds user to org_members with accepted status |
| US-I3 | As a new user invitee, I am redirected to sign up then auto-joined | Accept page detects no auth, redirects to /sign-up?redirect_url=/invitations/:token/accept |
| US-I4 | As an invitee, my invitation expires after 7 days | Accept endpoint returns 410 Gone if expiresAt < now |

---

## 4. Functional Requirements

### 4.1 Task 8.1 -- Database Schema (1 day)

**Migration file**: `packages/db/migrations/0008_organizations_rbac.sql`

#### FR-8.1.1: organizations table

```sql
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
```

**Acceptance criteria**:
- [x] Table created with all columns
- [ ] slug is unique, URL-safe (lowercase alphanumeric + hyphens)
- [ ] plan enum matches user plan values: free, personal, pro, team
- [ ] max_instances defaults based on plan (free=1, personal=1, pro=1, team=5)
- [ ] Indexes on owner_id and slug

#### FR-8.1.2: org_members table

```sql
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
```

**Acceptance criteria**:
- [ ] Role values: owner, admin, security, developer, viewer
- [ ] Status values: pending, active, removed
- [ ] Unique constraint on (org_id, user_id) prevents duplicate memberships
- [ ] ON DELETE CASCADE from organizations removes all memberships
- [ ] Indexes on org_id and user_id for lookup performance

#### FR-8.1.3: org_invitations table

```sql
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
```

**Acceptance criteria**:
- [ ] Token is cryptographically random (crypto.randomUUID or similar)
- [ ] expires_at is set to 7 days from creation
- [ ] Status values: pending, accepted, cancelled, expired
- [ ] Index on token for fast accept lookups
- [ ] ON DELETE CASCADE from organizations removes all invitations

#### FR-8.1.4: orgId on existing tables

```sql
ALTER TABLE instances ADD COLUMN org_id TEXT REFERENCES organizations(id);
CREATE INDEX idx_instances_org ON instances(org_id);

ALTER TABLE security_policies ADD COLUMN org_id TEXT REFERENCES organizations(id);
ALTER TABLE incidents ADD COLUMN org_id TEXT REFERENCES organizations(id);
```

**Acceptance criteria**:
- [ ] org_id is nullable (backward compatible with existing single-user data)
- [ ] Index on instances.org_id for org-scoped queries
- [ ] Existing rows retain NULL org_id until migration script runs

#### FR-8.1.5: Drizzle schema update

**Acceptance criteria**:
- [ ] Split schema.ts (currently 635 lines) into separate files: `schema/users.ts`, `schema/instances.ts`, `schema/security.ts`, `schema/organizations.ts`, `schema/tokenforge.ts`
- [ ] Each file under 200 lines
- [ ] Barrel export from `schema/index.ts`
- [ ] All existing imports (`import { ... } from '@opensyber/db'`) continue to work
- [ ] New tables defined with proper Drizzle relations

### 4.2 Task 8.2 -- Role Definitions (1 day)

#### FR-8.2.1: Role constants

**File**: `packages/shared/src/constants/roles.ts`

```typescript
export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  security: 'security',
  developer: 'developer',
  viewer: 'viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

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
```

**Acceptance criteria**:
- [ ] All 5 roles defined as const
- [ ] Role type exported as string literal union
- [ ] Role hierarchy for comparison (can admin change security user's role?)
- [ ] Role labels for UI display

#### FR-8.2.2: Permission constants

**File**: `packages/shared/src/constants/permissions.ts`

Full permission matrix matching the sprint doc:

| Permission | Owner | Admin | Security | Developer | Viewer |
|---|---|---|---|---|---|
| instance.create | Y | Y | - | Y | - |
| instance.delete | Y | Y | - | - | - |
| instance.restart | Y | Y | - | Y | - |
| instance.view | Y | Y | Y | Y | Y |
| skill.install | Y | Y | - | Y | - |
| skill.uninstall | Y | Y | - | Y | - |
| skill.view | Y | Y | Y | Y | Y |
| policy.create | Y | Y | Y | - | - |
| policy.update | Y | Y | Y | - | - |
| policy.delete | Y | Y | Y | - | - |
| policy.view | Y | Y | Y | Y | Y |
| incident.create | Y | Y | Y | - | - |
| incident.update | Y | Y | Y | - | - |
| incident.assign | Y | Y | Y | - | - |
| incident.view | Y | Y | Y | Y | Y |
| alert_rule.create | Y | Y | Y | - | - |
| alert_rule.update | Y | Y | Y | - | - |
| alert_rule.delete | Y | Y | Y | - | - |
| alert_rule.view | Y | Y | Y | Y | Y |
| vault.read | Y | Y | - | Y | Y |
| vault.write | Y | Y | - | Y | - |
| vault.delete | Y | Y | - | - | - |
| member.invite | Y | Y | - | - | - |
| member.remove | Y | Y | - | - | - |
| member.change_role | Y | Y | - | - | - |
| member.view | Y | Y | Y | Y | Y |
| billing.view | Y | Y | - | - | - |
| billing.manage | Y | - | - | - | - |
| audit.view | Y | Y | Y | Y | Y |
| audit.export | Y | Y | Y | - | - |
| org.update | Y | Y | - | - | - |
| org.delete | Y | - | - | - | - |

**Acceptance criteria**:
- [ ] All permissions defined as string literal constants
- [ ] `ROLE_PERMISSIONS` map: `Record<Role, Set<Permission>>`
- [ ] `hasPermission(role: Role, permission: Permission): boolean` function
- [ ] All *.view permissions granted to all roles
- [ ] owner has all permissions
- [ ] Tests verify every cell in the permission matrix

#### FR-8.2.3: RBAC types

**File**: `packages/shared/src/types/rbac.ts`

```typescript
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
  status: 'pending' | 'active' | 'removed';
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
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
}

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

**Acceptance criteria**:
- [ ] Types match database schema exactly
- [ ] Exported from packages/shared barrel
- [ ] Used by both API and web app

### 4.3 Task 8.3 -- RBAC Middleware (1 day)

#### FR-8.3.1: requirePermission middleware

**File**: `apps/api/src/middleware/rbac.ts` (must be under 200 lines)

**Behavior**:
1. Reads `userId` from Clerk auth context (already set by `authMiddleware`)
2. Reads `orgId` from request header `X-Org-Id` or query parameter `orgId`
3. If no orgId provided:
   - User operates in "personal" mode (solo user, no org)
   - All permissions granted (backward compatible)
   - Sets `c.set('orgId', null)` and `c.set('role', null)`
4. If orgId provided:
   - Looks up `org_members` for (orgId, userId) with status = 'active'
   - If not found: return 403 `{ error: "Forbidden", message: "Not a member of this organization" }`
   - If found: check `hasPermission(member.role, requestedPermission)`
   - If denied: return 403 `{ error: "Forbidden", message: "Insufficient permissions: {permission} required" }`
   - If allowed: set `c.set('orgId', orgId)`, `c.set('role', member.role)`, `c.set('orgMember', member)`

**Acceptance criteria**:
- [ ] Middleware function signature: `requirePermission(permission: Permission)`
- [ ] Returns Hono middleware compatible with existing route structure
- [ ] Solo users (no orgId) retain full access (backward compatible)
- [ ] Org members checked against role-permission matrix
- [ ] 403 response with clear error message on denial
- [ ] Sets orgId, role, orgMember on Hono context
- [ ] Under 200 lines

#### FR-8.3.2: Updated Variables interface

**File**: `apps/api/src/types.ts`

```typescript
export interface Variables {
  db: DrizzleD1Database<typeof schema>;
  userId: string;
  orgId: string | null;
  role: Role | null;
  orgMember: OrgMember | null;
}
```

**Acceptance criteria**:
- [ ] orgId, role, orgMember added as nullable
- [ ] All existing route handlers compile without changes (null is acceptable)

#### FR-8.3.3: RBAC middleware tests

**File**: `apps/api/src/middleware/rbac.test.ts`

**Acceptance criteria**:
- [ ] Test each role with each permission (5 roles x 30+ permissions)
- [ ] Test non-member access returns 403
- [ ] Test pending invitation member returns 403
- [ ] Test owner bypass (all permissions granted)
- [ ] Test solo user (no orgId) gets full access
- [ ] Test invalid orgId returns 403
- [ ] Coverage >= 90%

### 4.4 Task 8.4 -- Organization API (2 days)

#### FR-8.4.1: Organization CRUD

**File**: `apps/api/src/routes/organizations.ts` (under 200 lines; split into `organizations-invitations.ts` and `organizations-members.ts` if needed)

**POST /api/organizations** -- Create organization
- Request: `{ name: string, slug?: string }`
- Slug auto-generated from name if not provided (lowercase, hyphens, no special chars)
- Validates slug uniqueness
- Creator becomes owner (inserts into org_members with role=owner, status=active)
- Returns 201 with organization data and membership

**GET /api/organizations** -- List user's organizations
- Returns all orgs where user is an active member
- Includes member count and user's role in each org

**GET /api/organizations/:orgId** -- Organization detail
- Returns org details + full member list with roles
- Requires member.view permission (all roles)

**PATCH /api/organizations/:orgId** -- Update organization
- Request: `{ name?: string, slug?: string }`
- Requires org.update permission (owner, admin)
- Validates slug uniqueness if changed

**DELETE /api/organizations/:orgId** -- Delete organization
- Requires org.delete permission (owner only)
- Request: `{ confirm: true }` (safety check)
- Cascades: removes all members, invitations
- Sets org_id = NULL on all related instances (does not delete instances)

**Acceptance criteria**:
- [ ] All 5 CRUD endpoints implemented
- [ ] Slug validation: lowercase, alphanumeric + hyphens, 3-50 chars
- [ ] Creator auto-added as owner
- [ ] Delete requires confirmation body
- [ ] All endpoints require auth middleware
- [ ] Zod validation on request bodies

#### FR-8.4.2: Invitation endpoints

**POST /api/organizations/:orgId/invitations** -- Send invitation
- Request: `{ email: string, role: Role }`
- Requires member.invite permission
- Cannot invite existing active members
- Cannot invite with role higher than inviter's role (admin cannot invite as owner)
- Generates secure token (crypto.randomUUID)
- Sets expiresAt to 7 days from now
- Sends invitation email via Resend
- Returns 201 with invitation data (token not included in response)

**GET /api/organizations/:orgId/invitations** -- List pending invitations
- Requires member.invite permission
- Returns only pending/unexpired invitations

**DELETE /api/organizations/:orgId/invitations/:id** -- Cancel invitation
- Requires member.invite permission
- Sets status to 'cancelled'

**POST /api/invitations/:token/accept** -- Accept invitation (public-ish)
- Requires auth (user must be logged in)
- Validates token exists, status is pending, not expired
- If expired: return 410 Gone
- If already accepted: return 409 Conflict
- Creates org_members record with status=active
- Updates invitation status to accepted
- Returns 200 with org details

**Acceptance criteria**:
- [ ] Email validation with Zod
- [ ] Role hierarchy enforcement (cannot invite above your own role)
- [ ] 7-day token expiration
- [ ] Idempotent accept (second accept returns 409, not error)
- [ ] Expired invitations return 410 Gone
- [ ] Email sent via Resend on invite creation

#### FR-8.4.3: Member management endpoints

**PATCH /api/organizations/:orgId/members/:userId** -- Change role
- Request: `{ role: Role }`
- Requires member.change_role permission
- Cannot change owner's role (use transfer instead)
- Cannot set role higher than your own (admin cannot promote to owner)
- Returns 200 with updated member

**DELETE /api/organizations/:orgId/members/:userId** -- Remove member
- Requires member.remove permission
- Cannot remove the owner
- Cannot remove yourself if you are the owner
- Sets member status to 'removed'
- Returns 200

**POST /api/organizations/:orgId/members/:userId/transfer** -- Transfer ownership
- Owner only
- Promotes target user to owner
- Demotes current owner to admin
- Returns 200

**Acceptance criteria**:
- [ ] Role hierarchy enforced on role changes
- [ ] Owner cannot be removed
- [ ] Transfer is atomic (both role changes in single transaction)
- [ ] Removed members lose access immediately

#### FR-8.4.4: Web proxy routes

All organization API endpoints must have corresponding Next.js proxy routes under `apps/web/src/app/api/proxy/organizations/`.

**Acceptance criteria**:
- [ ] Proxy routes for all organization CRUD endpoints
- [ ] Proxy routes for all invitation endpoints
- [ ] Proxy routes for all member management endpoints
- [ ] All proxies forward Clerk JWT

### 4.5 Task 8.5 -- Multi-Tenancy Updates (2 days)

#### FR-8.5.1: Instance routes multi-tenancy

**File**: `apps/api/src/routes/instances.ts` (refactor to under 200 lines)

**Changes**:
- GET /api/instances:
  - If orgId in context: `WHERE orgId = :orgId`
  - If no orgId: `WHERE userId = :userId` (backward compatible)
- POST /api/instances:
  - Requires `instance.create` permission (via RBAC middleware)
  - If orgId: set orgId on new instance; check org-level instance limit (not user-level)
  - Org limit: `SELECT COUNT(*) FROM instances WHERE orgId = :orgId` vs `org.maxInstances`
- GET /api/instances/:id:
  - If orgId: verify instance.orgId matches
  - If no orgId: verify instance.userId matches
- POST /api/instances/:id/restart:
  - Requires `instance.restart` permission
- DELETE /api/instances/:id:
  - Requires `instance.delete` permission
- PATCH /api/instances/:id:
  - Requires `instance.create` permission (instance settings)
- Skill install/uninstall:
  - Requires `skill.install` / `skill.uninstall` permissions

**Acceptance criteria**:
- [ ] All instance queries scoped to orgId when present
- [ ] Plan limits checked at org level for org members
- [ ] Solo users retain user-level plan limits
- [ ] RBAC permissions checked before mutations
- [ ] File refactored to under 200 lines

#### FR-8.5.2: Security routes multi-tenancy

**File**: `apps/api/src/routes/security.ts` (refactor -- currently 828 lines)

**Changes**:
- `verifyInstance` helper: check orgId membership instead of userId when orgId is set
- All GET endpoints: require `*.view` permission (granted to all roles, but enforced)
- Audit log: require `audit.view` permission
- Audit export: require `audit.export` permission
- Vulnerability management: require appropriate permissions

**Acceptance criteria**:
- [ ] File split into multiple files under 200 lines each (e.g., security-dashboard.ts, security-events.ts, security-vulns.ts, security-network.ts, security-gateway.ts)
- [ ] Instance ownership verification updated for org context
- [ ] All read endpoints enforce *.view permission

#### FR-8.5.3: Policy routes multi-tenancy

**Changes**:
- Create policy: requires `policy.create` permission
- Update policy: requires `policy.update` permission
- Delete policy: requires `policy.delete` permission
- List/get: requires `policy.view` permission

**Acceptance criteria**:
- [ ] RBAC middleware applied to each endpoint
- [ ] Instance ownership check updated for org context

#### FR-8.5.4: Incident routes multi-tenancy

**Changes**:
- Create incident: requires `incident.create` permission
- Update incident: requires `incident.update` permission
- Assign incident: requires `incident.assign` permission; assignee must be org member
- List/get/timeline: requires `incident.view` permission

**Acceptance criteria**:
- [ ] Assignee validated against org_members when in org context
- [ ] RBAC middleware applied to each endpoint

#### FR-8.5.5: Alert routes multi-tenancy

**Changes**:
- Create alert rule: requires `alert_rule.create` permission
- Update alert rule: requires `alert_rule.update` permission
- Delete alert rule: requires `alert_rule.delete` permission
- Alert notification: send to all org members with appropriate notification channels (not just instance owner)

**Acceptance criteria**:
- [ ] RBAC middleware applied to each endpoint
- [ ] Notification routing updated for org context

#### FR-8.5.6: Vault routes multi-tenancy

**Changes**:
- List secrets: requires `vault.read` permission
- Store secret: requires `vault.write` permission
- Delete secret: requires `vault.delete` permission

**Acceptance criteria**:
- [ ] RBAC middleware applied to each endpoint
- [ ] Instance ownership check updated for org context

### 4.6 Task 8.6 -- Team Dashboard UI (2 days)

#### FR-8.6.1: Team overview page

**File**: `apps/web/src/app/dashboard/team/page.tsx`

**Layout**:
- Page title: "Team"
- Org name and member count subtitle
- Member list table:
  - Columns: Name, Email, Role, Status, Joined, Actions
  - Role displayed as badge (color-coded by role)
  - Actions: Change Role dropdown (admin+), Remove button (admin+)
- "Invite Member" button (top right, admin+ only)
- Instance allocation section showing instances per member

**Acceptance criteria**:
- [ ] Server Component fetching data with Clerk auth
- [ ] Member list with all columns
- [ ] Role badges color-coded
- [ ] Conditional action buttons based on current user's role
- [ ] Empty state if user has no org
- [ ] Loading skeleton
- [ ] Error boundary

#### FR-8.6.2: Invite Member Modal

**File**: `apps/web/src/components/dashboard/team/InviteMemberModal.tsx`

**Layout**:
- Modal overlay (matches existing modal pattern: fixed inset-0 z-50)
- Email input field with validation
- Role select dropdown (viewer, developer, security, admin -- not owner)
- Send Invite button
- Loading state during API call
- Success/error feedback

**Acceptance criteria**:
- [ ] Client Component with 'use client'
- [ ] Email validation before submit
- [ ] Role dropdown excludes 'owner'
- [ ] API call to POST /api/proxy/organizations/:orgId/invitations
- [ ] Success: close modal, refresh page
- [ ] Error: display error message inline
- [ ] Under 200 lines

#### FR-8.6.3: Member Role Select

**File**: `apps/web/src/components/dashboard/team/MemberRoleSelect.tsx`

**Acceptance criteria**:
- [ ] Dropdown with role options (filtered by current user's hierarchy)
- [ ] API call to PATCH /api/proxy/organizations/:orgId/members/:userId
- [ ] Optimistic UI update
- [ ] Disabled for owner role (cannot change via dropdown)
- [ ] Under 200 lines

#### FR-8.6.4: Remove Member Button

**File**: `apps/web/src/components/dashboard/team/RemoveMemberButton.tsx`

**Acceptance criteria**:
- [ ] Confirmation dialog before removal
- [ ] Cannot remove owner (button hidden)
- [ ] API call to DELETE endpoint
- [ ] Refresh page after removal

#### FR-8.6.5: Team Settings Page

**File**: `apps/web/src/app/dashboard/team/settings/page.tsx`

**Layout**:
- Org name field (editable, admin+)
- Org slug field (editable, admin+)
- Plan info (read-only display)
- Instance limit info
- Danger zone: Delete Organization button (owner only)

**Acceptance criteria**:
- [ ] Form fields with save button
- [ ] Danger zone with red styling
- [ ] Delete requires typing org name to confirm
- [ ] Under 200 lines

#### FR-8.6.6: Dashboard sidebar update

**File**: Update `apps/web/src/app/dashboard/layout.tsx`

Add "Team" navigation section between main items and security section:
- Team Overview (/dashboard/team) - Users icon
- Team Settings (/dashboard/team/settings) - Settings icon

Only visible when user is in an org (conditionally rendered).

**Acceptance criteria**:
- [ ] Team nav section appears when user has an org
- [ ] Hidden for solo users
- [ ] Consistent styling with existing nav items

### 4.7 Task 8.7 -- Invitation Email Flow (1 day)

#### FR-8.7.1: Invitation email template

**Method to add to**: `apps/api/src/services/email.ts`

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

**Email content**:
- From: `OpenSyber <noreply@opensyber.cloud>`
- Subject: `You've been invited to {orgName} on OpenSyber`
- Body:
  - Greeting
  - "{inviterName} has invited you to join {orgName} as a {role}."
  - Accept Invitation button linking to `acceptUrl`
  - "This invitation expires in 7 days."
  - OpenSyber branding footer

**Acceptance criteria**:
- [ ] Email sent via Resend API
- [ ] All dynamic fields populated
- [ ] Accept URL points to `https://opensyber.cloud/invitations/{token}/accept`
- [ ] HTML template matches existing email style
- [ ] Error handling (log but don't fail invitation creation)

#### FR-8.7.2: Accept flow pages

**File**: `apps/web/src/app/invitations/[token]/accept/page.tsx`

**Behavior**:
1. Page loads, checks if user is authenticated (Clerk)
2. If not authenticated: redirect to `/sign-up?redirect_url=/invitations/${token}/accept`
3. If authenticated: call POST `/api/proxy/invitations/${token}/accept`
4. On success: redirect to `/dashboard/team` with success message
5. On 410 Gone: show "Invitation expired" message with link to contact org admin
6. On 409 Conflict: show "Already a member" message with link to dashboard

**Acceptance criteria**:
- [ ] Handles unauthenticated users (redirect to sign-up)
- [ ] Handles expired invitations (410)
- [ ] Handles already-accepted invitations (409)
- [ ] Success redirects to team dashboard
- [ ] Loading state while processing

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target | Measurement |
|---|---|---|
| RBAC middleware latency | < 5ms for permission check (in-memory map lookup) | Permission check uses pre-built Set, no DB query |
| Org membership lookup | < 10ms per request | Single DB query with indexed (org_id, user_id) |
| Instance list (org-scoped) | < 50ms for up to 100 instances | Indexed query on org_id |
| Member list | < 50ms for up to 50 members | Indexed query on org_id |
| Invitation email delivery | < 3 seconds end-to-end | Resend API non-blocking (fire and don't block response) |

### 5.2 Security

| Requirement | Details |
|---|---|
| Permission enforcement | Every write endpoint must call `requirePermission` before any DB operation |
| Invitation tokens | Cryptographically random (crypto.randomUUID), single-use |
| Token expiry | Enforced server-side; expired tokens rejected with 410 |
| Role escalation prevention | Cannot invite/promote to a role higher than your own |
| Owner protection | Owner cannot be removed; only transferred |
| Audit trail | All role changes, member additions/removals logged to audit_log |
| CORS | No new origins required; same opensyber.cloud domain |
| Input validation | Zod schemas on all request bodies |
| SQL injection | Drizzle ORM parameterized queries (existing pattern) |

### 5.3 Backward Compatibility

| Requirement | Details |
|---|---|
| Solo user experience | Users without an org must retain full access to all features unchanged |
| Existing data | All existing instances, policies, incidents continue to work with NULL orgId |
| API contract | No breaking changes to existing request/response shapes |
| Web app | Dashboard must work identically for non-org users |
| Gateway auth | Agent-facing endpoints (gateway token auth) are unaffected by RBAC |

### 5.4 Reliability

| Requirement | Details |
|---|---|
| Migration safety | New columns are nullable; no data loss if migration fails partway |
| Invitation idempotency | Accepting an already-accepted invitation returns 409, not a crash |
| Org deletion safety | Requires explicit confirmation; does not delete user instances (only unlinks) |

---

## 6. Technical Constraints and Dependencies

### 6.1 Infrastructure Dependencies

| Dependency | Current State | Sprint 8 Impact |
|---|---|---|
| Cloudflare D1 | SQLite; 7 existing migrations | Add migration 0008; D1 supports ALTER TABLE ADD COLUMN |
| Clerk JWT | Token contains `sub` (userId) only | No changes needed; org membership resolved via DB lookup |
| Resend API | 6 email templates implemented | Add 1 new template (invitation) |
| Cloudflare KV (CACHE) | Rate limiting, health metrics | No changes |
| Cloudflare KV (CREDENTIAL_VAULT) | Gateway tokens, secrets | No changes |

### 6.2 Code Size Constraints

Per CLAUDE.md rules, max 200 lines per source file. Files requiring refactoring:

| File | Current Lines | Action |
|---|---|---|
| `packages/db/src/schema.ts` | 635 | Split into `schema/users.ts`, `schema/instances.ts`, `schema/security.ts`, `schema/organizations.ts`, `schema/tokenforge.ts`, `schema/index.ts` |
| `apps/api/src/routes/instances.ts` | 460 | Split into `instances-crud.ts`, `instances-skills.ts` |
| `apps/api/src/routes/security.ts` | 828 | Split into `security-dashboard.ts`, `security-events.ts`, `security-vulns.ts`, `security-network.ts`, `security-files.ts`, `security-gateway.ts` |
| `apps/api/src/routes/webhooks.ts` | 503 | Split into `webhooks-clerk.ts`, `webhooks-lemonsqueezy.ts`, `webhooks-agent.ts` |
| `apps/api/src/routes/incidents.ts` | 346 | Split into `incidents-crud.ts`, `incidents-events.ts` |
| `apps/api/src/routes/alerts.ts` | 318 | Split into `alerts-rules.ts`, `alerts-triggered.ts`, `alerts-channels.ts` |

### 6.3 TypeScript Constraints

- Strict mode everywhere
- No `any` types -- use `unknown` + type guards
- Interfaces in separate `types.ts` when shared across 2+ files
- Exported functions must have explicit return types
- Zod for all API request body validation

### 6.4 Testing Constraints

- Every new file must have a corresponding test file
- Minimum coverage: 80% lines, 80% branches
- Test framework: vitest (already configured)
- Mock external services (Clerk, Resend)
- Test error paths, not just happy paths
- Test permission boundaries for every role

---

## 7. Migration Strategy

### 7.1 Database Migration

**Phase 1**: Schema migration (non-destructive)
1. Run `0008_organizations_rbac.sql` to create new tables and add nullable columns
2. No data modification -- all existing rows retain NULL orgId
3. Application code handles NULL orgId as "personal mode"

**Phase 2**: Data backfill (optional, can be deferred)
1. Script to create "Personal" organizations for each existing user
2. Update instances, policies, incidents to set orgId
3. This is optional for Sprint 8 -- personal mode without org works fine

### 7.2 Rollback Plan

1. New tables can be dropped without affecting existing data
2. New nullable columns can be ignored by existing queries
3. RBAC middleware falls through to full access when no orgId is present
4. No existing API contracts are broken

### 7.3 Deployment Order

1. Deploy database migration first (schema only)
2. Deploy packages/shared (roles, permissions, types) -- no runtime impact
3. Deploy API with RBAC middleware + org routes -- backward compatible
4. Deploy web app with team UI -- new pages only, existing pages unchanged

---

## 8. Test Strategy

### 8.1 Unit Tests

| Test Area | File | Coverage Target |
|---|---|---|
| Role-permission mapping | `packages/shared/src/constants/permissions.test.ts` | 100% (critical path) |
| hasPermission function | `packages/shared/src/constants/permissions.test.ts` | 100% (critical path) |
| Slug generation | `packages/shared/src/utils/slug.test.ts` | 90% |
| RBAC middleware | `apps/api/src/middleware/rbac.test.ts` | 100% (critical path) |
| Organization handlers | `apps/api/src/routes/organizations.test.ts` | 90% |
| Invitation handlers | `apps/api/src/routes/organizations-invitations.test.ts` | 90% |
| Member handlers | `apps/api/src/routes/organizations-members.test.ts` | 90% |
| Updated instance handlers | `apps/api/src/routes/instances.test.ts` | 90% |
| Invitation email | `apps/api/src/services/email.test.ts` | 80% |

### 8.2 Integration Tests

| Test Area | Description |
|---|---|
| Org lifecycle | Create org -> Invite -> Accept -> Change role -> Remove -> Delete org |
| RBAC enforcement | For each role: attempt every permission, verify allow/deny |
| Multi-tenant isolation | User A in org A cannot see user B's org B instances |
| Solo user regression | Verify all existing endpoints work without orgId |
| Invitation expiry | Create invitation, advance time past 7 days, attempt accept |

### 8.3 Component Tests

| Component | Test File |
|---|---|
| InviteMemberModal | `InviteMemberModal.test.tsx` |
| MemberRoleSelect | `MemberRoleSelect.test.tsx` |
| RemoveMemberButton | `RemoveMemberButton.test.tsx` |
| Team page | `team/page.test.tsx` |
| Team settings page | `team/settings/page.test.tsx` |
| Invitation accept page | `invitations/[token]/accept/page.test.tsx` |

### 8.4 Security Tests

| Test | Description |
|---|---|
| Horizontal privilege escalation | User A cannot access User B's org by guessing orgId |
| Vertical privilege escalation | Viewer cannot perform admin actions by crafting requests |
| Invitation token brute force | Rate limit on accept endpoint; tokens are UUIDs (128-bit entropy) |
| Role escalation | Admin cannot promote self to owner |
| Owner removal protection | API rejects DELETE /members/:ownerId |

---

## Appendix A: File Inventory (New and Modified)

### New Files

| File | Purpose | Max Lines |
|---|---|---|
| `packages/db/migrations/0008_organizations_rbac.sql` | Database migration | N/A (SQL) |
| `packages/db/src/schema/organizations.ts` | Drizzle schema for org tables | 80 |
| `packages/db/src/schema/index.ts` | Barrel export | 20 |
| `packages/shared/src/constants/roles.ts` | Role constants | 40 |
| `packages/shared/src/constants/permissions.ts` | Permission matrix | 150 |
| `packages/shared/src/constants/permissions.test.ts` | Permission tests | 200 |
| `packages/shared/src/types/rbac.ts` | RBAC types | 60 |
| `apps/api/src/middleware/rbac.ts` | RBAC middleware | 100 |
| `apps/api/src/middleware/rbac.test.ts` | RBAC middleware tests | 200 |
| `apps/api/src/routes/organizations.ts` | Org CRUD routes | 180 |
| `apps/api/src/routes/organizations-invitations.ts` | Invitation routes | 150 |
| `apps/api/src/routes/organizations-members.ts` | Member management routes | 150 |
| `apps/api/src/routes/organizations.test.ts` | Org route tests | 200 |
| `apps/web/src/app/dashboard/team/page.tsx` | Team overview page | 180 |
| `apps/web/src/app/dashboard/team/settings/page.tsx` | Team settings page | 150 |
| `apps/web/src/app/invitations/[token]/accept/page.tsx` | Invitation accept page | 100 |
| `apps/web/src/components/dashboard/team/InviteMemberModal.tsx` | Invite modal | 150 |
| `apps/web/src/components/dashboard/team/MemberRoleSelect.tsx` | Role dropdown | 80 |
| `apps/web/src/components/dashboard/team/RemoveMemberButton.tsx` | Remove button | 80 |
| `apps/web/src/app/api/proxy/organizations/...` | 8-10 proxy route files | 40 each |

### Modified Files

| File | Changes |
|---|---|
| `packages/db/src/schema.ts` | Split into schema/ directory |
| `packages/shared/src/constants/index.ts` | Add roles and permissions exports |
| `packages/shared/src/types/index.ts` | Add rbac export |
| `apps/api/src/types.ts` | Add orgId, role, orgMember to Variables |
| `apps/api/src/index.ts` | Mount organization routes |
| `apps/api/src/routes/instances.ts` | Multi-tenancy + refactor to under 200 lines |
| `apps/api/src/routes/security.ts` | Multi-tenancy + refactor to under 200 lines |
| `apps/api/src/routes/policies.ts` | Add RBAC middleware |
| `apps/api/src/routes/incidents.ts` | Add RBAC middleware + refactor |
| `apps/api/src/routes/alerts.ts` | Add RBAC middleware + refactor |
| `apps/api/src/routes/vault.ts` | Add RBAC middleware |
| `apps/api/src/services/email.ts` | Add sendInvitationEmail method |
| `apps/web/src/app/dashboard/layout.tsx` | Add Team nav section |

---

## Appendix B: Estimated Task Breakdown

| Task | Days | Risk | Blockers |
|---|---|---|---|
| 8.1 Database schema + migration | 1 | Low | None |
| 8.2 Role definitions + types | 1 | Low | None |
| 8.3 RBAC middleware | 1 | Medium | Depends on 8.1, 8.2 |
| 8.4 Organization API | 2 | Medium | Depends on 8.1, 8.2, 8.3 |
| 8.5 Update existing routes | 2 | High | Depends on 8.3; touches many files with refactoring |
| 8.6 Team Dashboard UI | 2 | Medium | Depends on 8.4 |
| 8.7 Invitation email flow | 1 | Low | Depends on 8.4 |
| **Total** | **10 days** | | |

**Critical path**: 8.1 -> 8.2 -> 8.3 -> 8.4 -> 8.5 (all sequential)
**Parallel track**: 8.6 and 8.7 can start once 8.4 API is complete

---

## Appendix C: Definition of Done Checklist

- [ ] User can create an organization
- [ ] Owner can invite members by email
- [ ] Invitees receive email, can accept and join
- [ ] 5 roles with granular permissions enforced on every API route
- [ ] Dashboard shows team page with member management
- [ ] Existing single-user data works unchanged (backward compatible)
- [ ] All new code has tests (>= 80% coverage)
- [ ] RBAC middleware tests cover every role-permission combination
- [ ] Schema file split to under 200 lines per file
- [ ] All route files under 200 lines per file
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] No `any` types in new code
- [ ] Zod validation on all new API request bodies
