# RBAC & Team Management - Quick Reference

## Files Created

### RBAC System (`backend/src/services/rbac/`)

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~80 | Permission, Role, AccessLevel type definitions |
| `PermissionEngine.ts` | ~250 | Core permission checking logic & role mappings |
| `RBACMiddleware.ts` | ~150 | Express middleware for protecting routes |
| `rbac.routes.ts` | ~150 | REST API endpoints for RBAC operations |
| `index.ts` | ~15 | Module exports |
| `RBAC_IMPLEMENTATION_GUIDE.md` | - | Detailed implementation documentation |

### Team/Organization (`backend/src/services/team/`)

| File | Lines | Purpose |
|------|-------|---------|
| `TeamService.ts` | ~200 | Team management logic |
| `OrganizationService.ts` | ~220 | Organization & invitation management |
| `team.routes.ts` | ~180 | Team REST API endpoints |
| `organization.routes.ts` | ~150 | Organization REST API endpoints |
| `index.ts` | ~15 | Module exports |
| `TEAM_IMPLEMENTATION_GUIDE.md` | - | Detailed team management documentation |

### Integration Documentation

| File | Purpose |
|------|---------|
| `RBAC_AND_TEAM_INTEGRATION.md` | Complete integration guide with examples |
| `RBAC_TEAM_QUICK_REFERENCE.md` | This file |

## Role Hierarchy

```
viewer (5 perms)
  ↓ read-only
tester (7 perms)
  ↓ can create/run tests
developer (12 perms)
  ↓ can manage projects
team_lead (17 perms)
  ↓ can manage teams
admin (18 perms)
  ↓ can manage billing
owner (23 perms)
  ↓ all permissions
```

## Core Permissions (23 Total)

**Project** (4): create, read, update, delete
**Test** (5): create, read, update, delete, run
**Analytics** (2): read, export
**Settings** (2): read, manage
**Team** (4): read, manage, invite, remove
**Billing** (2): read, manage
**Admin** (1): all

## Quick Start

### 1. Register Routes

```typescript
import { rbacRoutes } from './services/rbac/index.js';
import { teamRoutes, organizationRoutes } from './services/team/index.js';

app.use('/api/rbac', authenticateUser, rbacRoutes);
app.use('/api/teams', authenticateUser, teamRoutes);
app.use('/api/organizations', authenticateUser, organizationRoutes);
```

### 2. Protect Routes

```typescript
import { requirePermission, requireMinimumRole } from './services/rbac/index.js';

// Single permission
router.post('/projects', authenticateUser, requirePermission('project:create'), handler);

// Multiple permissions (any)
router.get('/analytics', authenticateUser, requirePermission('analytics:read', 'admin:all'), handler);

// Minimum role
router.delete('/project/:id', authenticateUser, requireMinimumRole('team_lead'), handler);
```

### 3. Check Permissions in Services

```typescript
import { permissionEngine } from './services/rbac/index.js';

const canCreate = await permissionEngine.hasPermission(userId, 'project:create');
if (!canCreate) throw new Error('Permission denied');
```

## API Endpoints

### RBAC
- `GET /api/rbac/permissions` - List user's permissions
- `GET /api/rbac/roles` - List all roles
- `POST /api/rbac/permissions/check` - Check specific permission
- `GET /api/rbac/users/:userId/role` - Get user's role
- `PUT /api/rbac/users/:userId/role` - Update user role (admin only)

### Teams
- `POST /api/teams` - Create team
- `GET /api/teams` - List user's teams
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team
- `GET /api/teams/:id/members` - List members
- `POST /api/teams/:id/members` - Add member
- `DELETE /api/teams/:id/members/:userId` - Remove member
- `PUT /api/teams/:id/members/:userId/role` - Update member role

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization
- `PUT /api/organizations/:id` - Update organization
- `GET /api/organizations/:id/members` - List members
- `POST /api/organizations/:id/invite` - Invite user
- `DELETE /api/organizations/:id/members/:userId` - Remove user
- `GET /api/organizations/:id/stats` - Get statistics
- `PUT /api/organizations/:id/plan` - Update plan

## Key Classes

### PermissionEngine
```typescript
hasPermission(userId, permission) → Promise<boolean>
hasAnyPermission(userId, permissions) → Promise<boolean>
hasAllPermissions(userId, permissions) → Promise<boolean>
getUserPermissions(userId) → Promise<Permission[]>
getRolePermissions(role) → Permission[]
getAllRoles() → RBACPolicy[]
getRoleHierarchy() → Role[]
isRoleSuperior(role1, role2) → boolean
checkPermission(userId, permission) → Promise<PermissionCheckResult>
```

### TeamService
```typescript
createTeam(orgId, name, ownerId, description?) → Promise<Team>
getTeam(teamId) → Promise<Team | null>
updateTeam(teamId, data) → Promise<Team>
deleteTeam(teamId, userId) → Promise<void>
addMember(teamId, userId, role?, invitedBy?) → Promise<void>
removeMember(teamId, userId) → Promise<void>
getTeamMembers(teamId) → Promise<TeamMember[]>
updateMemberRole(teamId, userId, newRole) → Promise<void>
getUserTeams(userId) → Promise<Team[]>
isTeamMember(teamId, userId) → Promise<boolean>
getMemberRole(teamId, userId) → Promise<string | null>
```

### OrganizationService
```typescript
createOrganization(name, ownerId) → Promise<Organization>
getOrganization(orgId) → Promise<Organization | null>
updateOrganization(orgId, data) → Promise<Organization>
inviteUser(orgId, email, role?) → Promise<Invitation>
getOrgStats(orgId) → Promise<OrgStats>
getOrgMembers(orgId) → Promise<Member[]>
removeUser(orgId, userId) → Promise<void>
updatePlan(orgId, plan, maxMembers) → Promise<Organization>
isOrgAdmin(orgId, userId) → Promise<boolean>
```

## Middleware Functions

```typescript
requirePermission(...permissions) - Any permission
requireAllPermissions(...permissions) - All permissions
requireRole(...roles) - Exact role match
requireMinimumRole(role) - Role or higher
requireProjectAccess(accessLevel) - Project-level access
requireTeamMembership(minRole?) - Team membership check
checkPermissionOptional(...permissions) - Doesn't fail
```

## Error Responses

### 401 Unauthorized
```json
{ "error": "Authentication required" }
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "required": ["project:delete"],
  "current": "tester"
}
```

### 404 Not Found
```json
{ "error": "Team not found" }
```

### 409 Conflict
```json
{ "error": "Team member limit reached" }
```

## Data Models

### User (extended)
- id: UUID
- email: string
- role: Role (viewer | tester | developer | team_lead | admin | owner)
- subscription: string (free | pro | enterprise)

### Team
- id: UUID
- name: string
- ownerId: UUID
- description?: string
- plan: string
- maxMembers: number

### TeamMember
- id: UUID
- teamId: UUID
- userId: UUID
- role: string (owner | admin | member)
- joinedAt: Date
- invitedBy?: UUID

### Organization
- id: UUID
- name: string
- ownerId: UUID
- plan: string
- maxMembers: number

## Common Operations

### Create Team and Invite Users
```typescript
const team = await teamService.createTeam(orgId, 'QA Team', userId);
await teamService.addMember(team.id, 'qa-user-id', 'member');
await organizationService.inviteUser(orgId, 'qa@example.com', 'member');
```

### Check Permission Before Action
```typescript
const canDelete = await permissionEngine.hasPermission(userId, 'test:delete');
if (!canDelete) throw new Error('Permission denied');
```

### List User's Resources
```typescript
const teams = await teamService.getUserTeams(userId);
const members = await teamService.getTeamMembers(teamId);
```

### Update Member Role
```typescript
await teamService.updateMemberRole(teamId, userId, 'admin');
```

### Get Organization Stats
```typescript
const stats = await organizationService.getOrgStats(orgId);
console.log(`Members: ${stats.membersUsed}/${stats.planLimit}`);
```

## Best Practices

1. ✓ Always authenticate before checking permissions
2. ✓ Use granular permissions over broad roles
3. ✓ Check permissions at multiple levels (middleware + service)
4. ✓ Log permission denials for security
5. ✓ Verify team/org membership before operations
6. ✓ Enforce member limits from subscription
7. ✓ Cascade deletes properly
8. ✓ Send notifications for team changes
9. ✓ Rate limit sensitive endpoints
10. ✓ Cache frequently accessed data

## Integration Checklist

- [ ] Routes registered in main app
- [ ] Existing routes protected with RBAC
- [ ] Error handlers configured
- [ ] Logging set up
- [ ] Tests written
- [ ] Documentation updated
- [ ] Deployment configs ready
- [ ] Rate limiting enabled
- [ ] Audit logging added
- [ ] Email notifications configured

## Troubleshooting

**"Permission denied" errors**
- Check user role with `GET /api/rbac/users/:userId/role`
- Verify permission with `POST /api/rbac/permissions/check`
- Check role hierarchy

**Team member limit errors**
- Get stats with `GET /api/organizations/:id/stats`
- Upgrade plan with `PUT /api/organizations/:id/plan`
- Remove unused members

**Team access denied**
- Verify membership with `teamService.isTeamMember()`
- List user teams with `GET /api/teams`
- Add user with `POST /api/teams/:id/members`

**Invitation not working**
- Check email in system
- Verify invitation permissions
- Check expiration dates
- Resend invitation

## File Structure

```
backend/src/
├── services/
│   ├── rbac/
│   │   ├── types.ts
│   │   ├── PermissionEngine.ts
│   │   ├── RBACMiddleware.ts
│   │   ├── rbac.routes.ts
│   │   ├── index.ts
│   │   └── RBAC_IMPLEMENTATION_GUIDE.md
│   └── team/
│       ├── TeamService.ts
│       ├── OrganizationService.ts
│       ├── team.routes.ts
│       ├── organization.routes.ts
│       ├── index.ts
│       └── TEAM_IMPLEMENTATION_GUIDE.md
└── docs/
    ├── RBAC_AND_TEAM_INTEGRATION.md
    └── RBAC_TEAM_QUICK_REFERENCE.md
```

## Next Steps

1. Copy files to your backend
2. Install dependencies (if needed)
3. Register routes in main app
4. Update existing routes with RBAC
5. Write tests for new endpoints
6. Configure logging
7. Test in development
8. Deploy to staging
9. Gradual rollout to production
10. Monitor permission denials

## Support

For detailed implementation:
- See `RBAC_IMPLEMENTATION_GUIDE.md` for RBAC details
- See `TEAM_IMPLEMENTATION_GUIDE.md` for team management
- See `RBAC_AND_TEAM_INTEGRATION.md` for complete integration examples
- Check inline code comments for specific functions
