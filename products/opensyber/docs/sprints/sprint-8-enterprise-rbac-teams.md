> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 8: Enterprise — RBAC, Teams & Organizations (2 weeks)

## Goal
OpenSyber supports multi-user organizations with role-based access
control. A CTO can invite their team, assign roles, and control
who can deploy agents, manage policies, or view audit logs.

## Dependencies
- Sprints 1-5 complete (working MVP)

## What's Missing Today
- No `teams` or `organizations` table
- No `roles` or `permissions` concept
- Every resource check is flat: `WHERE userId = :currentUser`
- The Team plan ($399/mo, 5 instances) has no data model
- `inviteTeamMember` is tracked as a boolean in onboarding JSON blob
- No invitation flow, no team settings page

## Tasks

### 8.1 Database Schema — Teams & Roles
- [ ] Create D1 migration adding tables:
  ```sql
  CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ownerId TEXT NOT NULL REFERENCES users(id),
    plan TEXT NOT NULL DEFAULT 'free',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE org_members (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL REFERENCES organizations(id),
    userId TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member',
    invitedBy TEXT REFERENCES users(id),
    invitedAt TEXT NOT NULL,
    acceptedAt TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    UNIQUE(orgId, userId)
  );

  CREATE TABLE org_invitations (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL REFERENCES organizations(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invitedBy TEXT NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
    acceptedAt TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
  );
  ```
- [ ] Add `orgId` column to `instances` table (nullable, for migration)
- [ ] Add `orgId` column to `security_policies` table
- [ ] Add `orgId` column to `incidents` table
- [ ] Update Drizzle schema in `packages/db/src/schema.ts`
- [ ] Write migration tests

### 8.2 Role Definitions
- [ ] Create `packages/shared/src/constants/roles.ts`:
  ```typescript
  export const ROLES = {
    owner: 'owner',       // Full access, billing, delete org
    admin: 'admin',       // Manage members, all instances
    security: 'security', // Security dashboard, policies, incidents
    developer: 'developer', // Deploy agents, install skills
    viewer: 'viewer',     // Read-only access to everything
  } as const;
  ```
- [ ] Create `packages/shared/src/constants/permissions.ts`:
  - Define granular permissions per resource:
    - `instance.create`, `instance.delete`, `instance.restart`
    - `skill.install`, `skill.uninstall`
    - `policy.create`, `policy.update`, `policy.delete`
    - `incident.create`, `incident.update`, `incident.assign`
    - `alert_rule.create`, `alert_rule.update`, `alert_rule.delete`
    - `vault.read`, `vault.write`, `vault.delete`
    - `member.invite`, `member.remove`, `member.change_role`
    - `billing.view`, `billing.manage`
    - `audit.view`, `audit.export`
  - Map each role → set of permissions
- [ ] Create `packages/shared/src/types/rbac.ts`:
  - `Role`, `Permission`, `OrgMember`, `OrgInvitation` types
- [ ] Write tests for role-permission mapping

### 8.3 RBAC Middleware
- [ ] Create `apps/api/src/middleware/rbac.ts` (< 200 lines):
  - `requirePermission(permission)` → Hono middleware
  - Reads `userId` from Clerk auth context
  - Looks up user's org membership and role
  - Checks permission against role→permissions map
  - Returns 403 with clear error if denied
  - Sets `c.set('orgId', ...)` and `c.set('role', ...)` on context
- [ ] Create `apps/api/src/middleware/rbac.test.ts`:
  - Test each role with each permission
  - Test non-member access (403)
  - Test pending invitation (403)
  - Test owner bypass (all permissions)
- [ ] Apply middleware to all protected routes

### 8.4 Organization API
- [ ] Create `apps/api/src/routes/organizations.ts`:
  - `POST /api/organizations` — create org (user becomes owner)
  - `GET /api/organizations` — list user's orgs
  - `GET /api/organizations/:orgId` — org details + member list
  - `PATCH /api/organizations/:orgId` — update name/settings
  - `DELETE /api/organizations/:orgId` — delete (owner only, confirm)
- [ ] Invitation endpoints:
  - `POST /api/organizations/:orgId/invitations` — send invite email
  - `GET /api/organizations/:orgId/invitations` — list pending
  - `DELETE /api/organizations/:orgId/invitations/:id` — cancel
  - `POST /api/invitations/:token/accept` — accept invite (public)
- [ ] Member management:
  - `PATCH /api/organizations/:orgId/members/:userId` — change role
  - `DELETE /api/organizations/:orgId/members/:userId` — remove member
  - `POST /api/organizations/:orgId/members/:userId/transfer` — transfer ownership
- [ ] Create proxy routes in web app for all endpoints
- [ ] Write tests for all organization endpoints

### 8.5 Update Existing Routes for Multi-Tenancy
- [ ] Update `routes/instances.ts`:
  - If user is in an org, scope instances to orgId
  - Check `instance.create` permission before deploying
  - Check `instance.delete` permission before deleting
  - Org-level instance limits (Team: 5, based on org plan)
- [ ] Update `routes/security.ts`:
  - Scope all queries to org's instances
  - Check `audit.view` permission for audit log
- [ ] Update `routes/policies.ts`:
  - Check `policy.create/update/delete` permissions
- [ ] Update `routes/incidents.ts`:
  - Check `incident.create/update` permissions
  - Allow assigning to org members only
- [ ] Update `routes/alerts.ts`:
  - Check `alert_rule.create/update/delete` permissions
- [ ] Write migration tests (existing users → personal org)

### 8.6 Team Dashboard UI
- [ ] Create `app/dashboard/team/page.tsx` — team overview:
  - Member list with roles and status
  - Invite button
  - Instance allocation per member
- [ ] Create `components/dashboard/team/InviteMemberModal.tsx`:
  - Email input + role select + Send
- [ ] Create `components/dashboard/team/MemberRoleSelect.tsx`:
  - Dropdown to change member role (admin+ only)
- [ ] Create `components/dashboard/team/RemoveMemberButton.tsx`:
  - Confirm dialog, cannot remove self if owner
- [ ] Create `app/dashboard/team/settings/page.tsx`:
  - Org name, slug, plan info
  - Danger zone: delete organization
- [ ] Add "Team" nav section to dashboard sidebar
- [ ] Write component tests for all team UI

### 8.7 Invitation Email Flow
- [ ] Create invitation email template (Resend):
  - "You've been invited to {orgName} on OpenSyber"
  - Inviter name, role being granted
  - Accept button → `/invitations/{token}/accept`
  - Expires in 7 days
- [ ] Handle accept flow:
  - If user exists → add to org
  - If user doesn't exist → redirect to sign-up, then accept
- [ ] Write tests for invitation email and accept flow

## Role Permission Matrix

| Permission | Owner | Admin | Security | Developer | Viewer |
|---|---|---|---|---|---|
| instance.create | Y | Y | - | Y | - |
| instance.delete | Y | Y | - | - | - |
| instance.restart | Y | Y | - | Y | - |
| skill.install | Y | Y | - | Y | - |
| policy.create | Y | Y | Y | - | - |
| incident.create | Y | Y | Y | - | - |
| vault.write | Y | Y | - | Y | - |
| member.invite | Y | Y | - | - | - |
| member.remove | Y | Y | - | - | - |
| billing.manage | Y | - | - | - | - |
| audit.export | Y | Y | Y | - | - |
| *.view | Y | Y | Y | Y | Y |

## Definition of Done
- [ ] User can create an organization
- [ ] Owner can invite members by email
- [ ] Invitees receive email, can accept and join
- [ ] 5 roles with granular permissions enforced on every API route
- [ ] Dashboard shows team page with member management
- [ ] Existing single-user data migrated to personal orgs
- [ ] All new code has tests (>80% coverage)
- [ ] `pnpm build` and `pnpm test` pass

## Estimated Effort
| Task | Days |
|---|---|
| 8.1 Database schema | 1 |
| 8.2 Role definitions | 1 |
| 8.3 RBAC middleware | 1 |
| 8.4 Organization API | 2 |
| 8.5 Update existing routes | 2 |
| 8.6 Team dashboard UI | 2 |
| 8.7 Invitation email flow | 1 |
| **Total** | **10 days** |
