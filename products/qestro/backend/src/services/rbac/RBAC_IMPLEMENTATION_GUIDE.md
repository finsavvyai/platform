# RBAC (Role-Based Access Control) Implementation Guide

## Overview

The RBAC system provides comprehensive role-based and permission-based access control for Qestro. It includes:

- **Role Hierarchy**: 6 levels of access (viewer → tester → developer → team_lead → admin → owner)
- **Permission System**: 23 granular permissions for different operations
- **Resource Access**: Support for project-level and team-level permissions
- **Express Middleware**: Easy-to-use middleware for route protection
- **Permission Engine**: Centralized permission checking logic

## Role Hierarchy

```
viewer (5 permissions)
  ↓
tester (7 permissions)
  ↓
developer (12 permissions)
  ↓
team_lead (17 permissions)
  ↓
admin (18 permissions)
  ↓
owner (23 permissions - all permissions)
```

## Available Permissions

### Project Permissions
- `project:create` - Create new projects
- `project:read` - View projects
- `project:update` - Modify project settings
- `project:delete` - Delete projects

### Test Permissions
- `test:create` - Create new tests
- `test:read` - View tests
- `test:update` - Modify tests
- `test:delete` - Delete tests
- `test:run` - Execute tests

### Analytics Permissions
- `analytics:read` - View analytics and reports
- `analytics:export` - Export analytics data

### Settings Permissions
- `settings:read` - View settings
- `settings:manage` - Modify settings

### Team Permissions
- `team:read` - View team information
- `team:manage` - Manage team settings
- `team:invite` - Invite team members
- `team:remove` - Remove team members

### Billing Permissions
- `billing:read` - View billing information
- `billing:manage` - Manage billing and plans

### Admin Permissions
- `admin:all` - All administrative privileges

## Role Descriptions

### Viewer
Read-only access. Perfect for stakeholders who need to monitor progress.
- Can view projects, tests, analytics, and team info
- Cannot modify anything

### Tester
Can run tests and create new test cases. Ideal for QA engineers.
- Everything viewer can do, plus:
- Create, update, and run tests
- Export analytics

### Developer
Full test management and project creation. For development teams.
- Everything tester can do, plus:
- Create, update, delete projects
- Delete tests
- Manage settings (read-only)

### Team Lead
Manages team and projects. For team managers.
- Everything developer can do, plus:
- Manage team members (invite/remove)
- Manage team and billing (read)

### Admin
Organization-level administration.
- Everything team lead can do, plus:
- Manage billing

### Owner
Full system access.
- All permissions including admin:all

## Usage in Express Routes

### Basic Permission Check

```typescript
import { requirePermission } from './rbac/index.js';

router.post(
  '/projects',
  authenticateUser,
  requirePermission('project:create'),
  async (req, res) => {
    // Only users with project:create permission reach here
  }
);
```

### Multiple Permissions (Any Match)

```typescript
router.get(
  '/analytics',
  authenticateUser,
  requirePermission('analytics:read', 'admin:all'),
  async (req, res) => {
    // User needs either analytics:read or admin:all
  }
);
```

### All Permissions Required

```typescript
import { requireAllPermissions } from './rbac/index.js';

router.delete(
  '/tests/:id',
  authenticateUser,
  requireAllPermissions('test:delete', 'project:update'),
  async (req, res) => {
    // User must have both permissions
  }
);
```

### Role-Based Check

```typescript
import { requireRole, requireMinimumRole } from './rbac/index.js';

// Exact role match
router.post(
  '/settings',
  authenticateUser,
  requireRole('admin', 'owner'),
  async (req, res) => {
    // Only admin or owner
  }
);

// Minimum role
router.delete(
  '/organization/:id',
  authenticateUser,
  requireMinimumRole('team_lead'),
  async (req, res) => {
    // team_lead, admin, or owner
  }
);
```

### Team Membership Check

```typescript
import { requireTeamMembership } from './rbac/index.js';

router.post(
  '/teams/:id/invite',
  authenticateUser,
  requireTeamMembership(),
  requirePermission('team:invite'),
  async (req, res) => {
    // User must be team member and have team:invite permission
  }
);
```

## Usage in Services

### Check Single Permission

```typescript
import { permissionEngine } from './rbac/index.js';

const canCreate = await permissionEngine.hasPermission(
  userId,
  'project:create'
);

if (!canCreate) {
  throw new Error('Permission denied');
}
```

### Check Multiple Permissions

```typescript
// Any permission matches (OR)
const canAccess = await permissionEngine.hasAnyPermission(
  userId,
  ['project:read', 'admin:all']
);

// All permissions required (AND)
const canManage = await permissionEngine.hasAllPermissions(
  userId,
  ['project:update', 'team:manage']
);
```

### Get User Permissions

```typescript
const permissions = await permissionEngine.getUserPermissions(userId);
console.log(permissions); // ['project:read', 'test:create', ...]
```

### Detailed Permission Check

```typescript
const result = await permissionEngine.checkPermission(
  userId,
  'project:delete'
);

if (!result.allowed) {
  console.log(result.reason);
  console.log(result.requiredRole); // Minimum role needed
}
```

### Get Role Information

```typescript
// All roles and their permissions
const roles = permissionEngine.getAllRoles();

// Specific role permissions
const adminPerms = permissionEngine.getRolePermissions('admin');

// Role hierarchy
const hierarchy = permissionEngine.getRoleHierarchy();
// ['viewer', 'tester', 'developer', 'team_lead', 'admin', 'owner']

// Check role superiority
const isAdmin = permissionEngine.isRoleSuperior('admin', 'tester');
// true
```

## API Endpoints

### RBAC Routes

#### Get User Permissions
```
GET /api/rbac/permissions
Authorization: Bearer <token>

Response:
{
  "userId": "...",
  "role": "developer",
  "permissions": [
    "project:create",
    "project:read",
    ...
  ]
}
```

#### Get All Roles
```
GET /api/rbac/roles
Authorization: Bearer <token>

Response:
{
  "roles": [
    {
      "role": "viewer",
      "permissions": [...],
      "description": "Read-only access..."
    },
    ...
  ],
  "hierarchy": ["viewer", "tester", ...]
}
```

#### Check Permissions
```
POST /api/rbac/permissions/check
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "permission": "project:create"
  // OR
  "permissions": ["project:create", "test:run"]
}

Response:
{
  "allowed": true,
  "reason": null
  // OR for denied:
  {
    "allowed": false,
    "reason": "Permission 'project:delete' not available for role 'tester'",
    "requiredRole": "developer"
  }
}
```

#### Update User Role
```
PUT /api/rbac/users/:userId/role
Authorization: Bearer <token> (admin/owner only)
Content-Type: application/json

Body:
{
  "role": "developer"
}

Response:
{
  "message": "User role updated",
  "user": {
    "id": "...",
    "email": "...",
    "role": "developer"
  }
}
```

#### Get User Role
```
GET /api/rbac/users/:userId/role
Authorization: Bearer <token>

Response:
{
  "user": {
    "id": "...",
    "email": "...",
    "role": "developer"
  },
  "permissions": [...]
}
```

## Integration with Main App

### 1. Register Routes

In your main Express app:

```typescript
import { rbacRoutes } from './services/rbac/index.js';
import { teamRoutes, organizationRoutes } from './services/team/index.js';

app.use('/api/rbac', rbacRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/organizations', organizationRoutes);
```

### 2. Protect Existing Routes

Update your current routes to use RBAC middleware:

```typescript
// Before
router.post('/projects', authenticateUser, createProject);

// After
import { requirePermission } from './services/rbac/index.js';

router.post(
  '/projects',
  authenticateUser,
  requirePermission('project:create'),
  createProject
);
```

### 3. Check Permissions in Controllers

```typescript
import { permissionEngine } from './services/rbac/index.js';

async function createProject(req, res) {
  const canCreate = await permissionEngine.hasPermission(
    req.user.userId,
    'project:create'
  );

  if (!canCreate) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  // Create project...
}
```

## Best Practices

1. **Always authenticate first**: Use `authenticateUser` middleware before RBAC checks
2. **Use specific permissions**: Prefer granular permissions over roles
3. **Check at multiple levels**: Combine middleware checks with service-level checks
4. **Log access denials**: Track when permissions are denied for security
5. **Cache permissions**: Use PermissionEngine methods for caching
6. **Fail securely**: Default to denying access if unsure
7. **Resource-level checks**: Implement project/team-specific access checks in services
8. **Admin bypass**: Always allow admins for critical operations

## Error Handling

### Permission Denied
```json
HTTP 403
{
  "error": "Insufficient permissions",
  "required": ["project:delete"],
  "current": "developer"
}
```

### Insufficient Role
```json
HTTP 403
{
  "error": "Insufficient role",
  "required": ["admin", "owner"],
  "current": "tester"
}
```

### Authentication Required
```json
HTTP 401
{
  "error": "Authentication required"
}
```

## Testing

Example test cases:

```typescript
describe('Permission Engine', () => {
  it('should grant viewer read-only permissions', async () => {
    const perms = permissionEngine.getRolePermissions('viewer');
    expect(perms).toContain('project:read');
    expect(perms).not.toContain('project:delete');
  });

  it('should allow admin all permissions', async () => {
    const perms = permissionEngine.getRolePermissions('admin');
    expect(perms).toContain('admin:all');
  });

  it('should deny tester project deletion', async () => {
    const hasPermission = await permissionEngine.hasPermission(
      testUserId,
      'project:delete'
    );
    expect(hasPermission).toBe(false);
  });
});
```

## Customization

### Adding New Permissions

1. Add to `Permission` type in `types.ts`
2. Add to appropriate role(s) in `ROLE_PERMISSION_MAP` in `PermissionEngine.ts`
3. Use in routes/middleware as needed

### Changing Role Permissions

Edit `ROLE_PERMISSION_MAP` in `PermissionEngine.ts`:

```typescript
const ROLE_PERMISSION_MAP: Record<Role, RBACPolicy> = {
  developer: {
    role: 'developer',
    description: 'Updated description',
    permissions: [
      'project:create',
      'project:read',
      'project:update',
      // Add new permissions here
    ],
  },
  // ...
};
```

### Adding New Roles

1. Add to `Role` type in `types.ts`
2. Add to `ROLE_HIERARCHY` array in `PermissionEngine.ts`
3. Add to `ROLE_PERMISSION_MAP` in `PermissionEngine.ts`
4. Update role validation in routes

## Security Considerations

- Permissions are checked at middleware level before reaching handlers
- User role is stored in JWT and verified on each request
- Permission checks happen in database for current data
- Failed permission checks are logged
- Admin role cannot be self-downgraded
- Owner role is protected from downgrade by non-owners
