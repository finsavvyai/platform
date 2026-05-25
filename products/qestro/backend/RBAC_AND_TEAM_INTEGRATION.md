# RBAC & Team Management Integration Guide

## Quick Start

### 1. Import and Register Routes

```typescript
// src/index.ts or src/routes/index.ts

import { Router } from 'express';
import { authenticateUser } from './middleware/auth.js';
import { rbacRoutes } from './services/rbac/index.js';
import { teamRoutes, organizationRoutes } from './services/team/index.js';

const router = Router();

// Protect all RBAC and team routes with authentication
router.use('/rbac', authenticateUser, rbacRoutes);
router.use('/teams', authenticateUser, teamRoutes);
router.use('/organizations', authenticateUser, organizationRoutes);

export default router;

// Then in your main app:
app.use('/api', router);
```

### 2. Update Existing Routes with RBAC

```typescript
// Before
router.post('/projects', authenticateUser, createProject);
router.delete('/tests/:id', authenticateUser, deleteTest);

// After
import { requirePermission, requireMinimumRole } from './services/rbac/index.js';

router.post(
  '/projects',
  authenticateUser,
  requirePermission('project:create'),
  createProject
);

router.delete(
  '/tests/:id',
  authenticateUser,
  requirePermission('test:delete'),
  deleteTest
);
```

## Complete Route Example

```typescript
// src/routes/projects.ts

import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import {
  requirePermission,
  requireMinimumRole,
} from '../services/rbac/index.js';
import { permissionEngine } from '../services/rbac/index.js';
import { teamService } from '../services/team/index.js';

const router = Router();

/**
 * POST /api/projects
 * Create a new project
 * Requires: authentication + project:create permission + team membership
 */
router.post(
  '/',
  authenticateUser,
  requirePermission('project:create'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name, teamId } = req.body;

      // Verify user is member of team
      const isMember = await teamService.isTeamMember(teamId, req.user.userId);
      if (!isMember && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Team access denied' });
      }

      // Create project...
      res.status(201).json({ id: '...', name });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create project' });
    }
  },
);

/**
 * GET /api/projects
 * List user's projects
 * Requires: authentication
 */
router.get(
  '/',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get projects for user's teams
      const userTeams = await teamService.getUserTeams(req.user.userId);
      const teamIds = userTeams.map(t => t.id);

      // Fetch projects in these teams
      // ... your project query logic

      res.json([]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  },
);

/**
 * DELETE /api/projects/:id
 * Delete project
 * Requires: authentication + project:delete permission + team_lead role
 */
router.delete(
  '/:id',
  authenticateUser,
  requireMinimumRole('team_lead'),
  requirePermission('project:delete'),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Delete project...
      res.json({ message: 'Project deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  },
);

export default router;
```

## Service Integration Example

```typescript
// src/services/ProjectService.ts

import { db } from '../lib/db.js';
import { permissionEngine } from './rbac/PermissionEngine.js';
import { teamService } from './team/TeamService.js';
import { logger } from '../utils/logger.js';

export class ProjectService {
  /**
   * Create project with permission checks
   */
  async createProject(
    userId: string,
    teamId: string,
    name: string,
    description?: string,
  ): Promise<any> {
    // 1. Check user has permission
    const canCreate = await permissionEngine.hasPermission(
      userId,
      'project:create',
    );
    if (!canCreate) {
      throw new Error('Permission denied: project:create required');
    }

    // 2. Check user is team member
    const isMember = await teamService.isTeamMember(teamId, userId);
    if (!isMember) {
      throw new Error('Team access denied');
    }

    // 3. Create project
    const project = {
      id: '...',
      userId,
      teamId,
      name,
      description,
    };

    logger.info(`Project ${project.id} created by ${userId}`);
    return project;
  }

  /**
   * Delete project with audit trail
   */
  async deleteProject(
    userId: string,
    projectId: string,
  ): Promise<void> {
    // 1. Check permission
    const canDelete = await permissionEngine.hasPermission(
      userId,
      'project:delete',
    );
    if (!canDelete) {
      throw new Error('Permission denied: project:delete required');
    }

    // 2. Get project (verify ownership/team membership)
    // const project = await getProject(projectId);
    // const isMember = await teamService.isTeamMember(project.teamId, userId);
    // if (!isMember) throw new Error('Team access denied');

    // 3. Delete project and audit log
    logger.info(`Project ${projectId} deleted by ${userId}`);
  }
}
```

## Permission Levels by Operation

### Project Operations

| Operation | Required Permission | Minimum Role | Notes |
|-----------|-------------------|--------------|-------|
| Create | project:create | developer | |
| View | project:read | viewer | All users can view |
| Update | project:update | developer | Owner/team lead only |
| Delete | project:delete | team_lead | Owner/admin only |

### Test Operations

| Operation | Required Permission | Minimum Role | Notes |
|-----------|-------------------|--------------|-------|
| Create | test:create | tester | |
| View | test:read | viewer | All users can view |
| Update | test:update | tester | Creator/admin only |
| Delete | test:delete | developer | Creator/team lead only |
| Run | test:run | tester | |

### Team Operations

| Operation | Required Permission | Minimum Role | Notes |
|-----------|-------------------|--------------|-------|
| View | team:read | viewer | Members only |
| Manage | team:manage | team_lead | Owner/admin only |
| Invite | team:invite | team_lead | Owner/admin only |
| Remove | team:remove | team_lead | Owner/admin only |

## Complete User Flow Example

### 1. User Registration

```typescript
// 1. User signs up → Create user with role 'tester'
// 2. Create default organization (one-to-one with first team)
// 3. Add user to organization as owner

const newUser = await db.insert(users).values({
  email: 'user@example.com',
  role: 'tester', // Default role
});

const org = await organizationService.createOrganization(
  'My Organization',
  newUser.id,
);
```

### 2. Create Team and Invite Members

```typescript
// User creates a team
const team = await teamService.createTeam(
  orgId,
  'QA Team',
  userId, // User becomes owner
  'Quality Assurance',
);

// User invites another user
const invitation = await organizationService.inviteUser(
  orgId,
  'qa-engineer@example.com',
  'member',
);
```

### 3. Invited User Joins

```typescript
// New user registers with invitation code
const newUser = await createUser('qa-engineer@example.com', 'password');

// System automatically adds them to organization
// with role specified in invitation (member)
```

### 4. User Creates Project

```typescript
// User (with tester role) tries to create project
// Issue: tester cannot create projects (needs developer role)
// Team lead updates user role to developer

await permissionEngine.updateUserRole(userId, 'developer');

// Now user can create projects
```

### 5. Team Operations

```typescript
// Team lead manages team members
const members = await teamService.getTeamMembers(teamId);

// Update member role
await teamService.updateMemberRole(teamId, memberId, 'admin');

// Remove member
await teamService.removeMember(teamId, memberId);
```

## Middleware Combinations

### Authentication Only
```typescript
router.get('/public-data', authenticateUser, handler);
```

### Authentication + One Permission
```typescript
router.post(
  '/projects',
  authenticateUser,
  requirePermission('project:create'),
  handler,
);
```

### Authentication + Multiple Permissions (Any)
```typescript
router.get(
  '/analytics',
  authenticateUser,
  requirePermission('analytics:read', 'analytics:export'),
  handler,
);
```

### Authentication + Multiple Permissions (All)
```typescript
import { requireAllPermissions } from './services/rbac/index.js';

router.delete(
  '/project/:id',
  authenticateUser,
  requireAllPermissions('project:delete', 'project:update'),
  handler,
);
```

### Authentication + Role Check
```typescript
router.post(
  '/admin-settings',
  authenticateUser,
  requireMinimumRole('admin'),
  handler,
);
```

### Authentication + Team Membership
```typescript
import { requireTeamMembership } from './services/rbac/index.js';

router.post(
  '/teams/:id/projects',
  authenticateUser,
  requireTeamMembership(),
  handler,
);
```

## Error Handling Strategy

```typescript
// Centralized error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const { message, statusCode } = err;

  if (message.includes('Permission denied')) {
    return res.status(403).json({ error: message });
  }

  if (message.includes('Team access denied')) {
    return res.status(403).json({ error: message });
  }

  if (message.includes('not found')) {
    return res.status(404).json({ error: message });
  }

  logger.error('Unhandled error:', err);
  res.status(statusCode || 500).json({ error: message || 'Server error' });
});
```

## Testing Integration

```typescript
describe('Projects with RBAC', () => {
  let userId: string;
  let teamId: string;

  beforeAll(async () => {
    // Create user
    userId = await createTestUser('tester');

    // Create team
    const team = await teamService.createTeam('orgId', 'Test Team', userId);
    teamId = team.id;
  });

  it('tester cannot create project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project', teamId });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Permission');
  });

  it('developer can create project', async () => {
    // Promote user to developer
    await db.update(users).set({ role: 'developer' });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project', teamId });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('team member cannot create project for other team', async () => {
    const otherTeamId = (await teamService.createTeam(
      'orgId',
      'Other Team',
      'other-user',
    )).id;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project', teamId: otherTeamId });

    expect(res.status).toBe(403);
  });
});
```

## Deployment Checklist

- [ ] All routes protected with `authenticateUser`
- [ ] Sensitive operations require appropriate permissions
- [ ] Admin operations require admin/owner role
- [ ] Team operations verify team membership
- [ ] Error messages don't leak sensitive info
- [ ] Permission checks logged for audit trail
- [ ] Rate limiting enabled on sensitive endpoints
- [ ] CORS configured appropriately
- [ ] HTTPS enforced in production
- [ ] JWT_SECRET configured in environment
- [ ] Database migrations run successfully
- [ ] Tests pass with RBAC enabled

## Performance Considerations

1. **Cache role permissions**: Role permissions don't change often
2. **Batch permission checks**: Check multiple at once
3. **Index team memberships**: Frequently queried
4. **Lazy load user data**: Only fetch when needed
5. **Cache user roles**: Include in JWT for fast checks

## Security Checklist

- [ ] No hardcoded secrets
- [ ] Secrets in environment variables
- [ ] JWT signature verified on every request
- [ ] Owner role protected from downgrade
- [ ] Admin users can be locked down
- [ ] Sensitive operations logged
- [ ] Failed auth attempts logged
- [ ] Rate limiting on auth endpoints
- [ ] CSRF protection enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS prevention on responses

## Migration from No RBAC

If migrating existing code:

1. **Default all users to 'tester' role**
   ```sql
   UPDATE users SET role = 'tester' WHERE role IS NULL;
   ```

2. **Add role selectively**
   - Admins → 'admin'
   - Project creators → 'developer'
   - Others stay 'tester'

3. **Add permission checks gradually**
   - Start with logging (don't enforce)
   - Monitor permission denials
   - Adjust role assignments
   - Enable enforcement

4. **Create default teams**
   ```sql
   INSERT INTO teams (id, name, owner_id, plan, max_members)
   SELECT uuid(), 'My Team', id, 'free', 5 FROM users;
   ```

## Next Steps

1. Register routes in main Express app
2. Update existing routes with permissions
3. Write unit tests for permission checks
4. Set up audit logging
5. Create admin dashboard for user management
6. Implement invitation email system
7. Add SSO/SAML integration
8. Set up rate limiting
9. Deploy to staging
10. Test with real users
