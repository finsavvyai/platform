# Team & Organization Management Implementation Guide

## Overview

The Team and Organization services provide complete team and organization management for Qestro:

- **Team Management**: Create, update, delete teams and manage members
- **Organization Services**: Organization settings, member invitations, and statistics
- **Member Roles**: Owner, admin, and member roles with hierarchical permissions
- **Invitation System**: Invite users by email with role assignment
- **Usage Tracking**: Monitor member count and plan limits

## Data Model

### Team
```typescript
interface Team {
  id: string;           // UUID
  name: string;         // Team name
  ownerId: string;      // Owner's user ID
  description?: string; // Optional description
  plan: string;         // free, starter, pro, enterprise
  maxMembers: number;   // Member limit for plan
  createdAt: Date;
  updatedAt: Date;
}
```

### Team Member
```typescript
interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;        // owner, admin, member
  joinedAt: Date;
  invitedBy?: string;  // Inviter's user ID
  user?: {             // Populated from users table
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}
```

### Organization
```typescript
interface Organization {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Invitation
```typescript
interface Invitation {
  email: string;
  role: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  expiresAt: Date;  // 7 days from creation
}
```

## Team Management

### Create Team

```typescript
import { teamService } from './services/team/index.js';

const team = await teamService.createTeam(
  orgId,           // Organization ID
  'My Team',       // Team name
  userId,          // Owner user ID
  'Team description' // Optional
);

// Returns: Team object with owner as first member
```

**API Endpoint:**
```
POST /api/teams
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "name": "QA Team",
  "description": "Quality assurance team",
  "orgId": "optional-org-id"
}

Response:
{
  "id": "...",
  "name": "QA Team",
  "ownerId": "...",
  "plan": "free",
  "maxMembers": 5,
  "createdAt": "2026-04-07T...",
  "updatedAt": "2026-04-07T..."
}
```

### Get Team

```typescript
const team = await teamService.getTeam(teamId);

if (team) {
  console.log(team.name, team.maxMembers);
}
```

**API Endpoint:**
```
GET /api/teams/:id
Authorization: Bearer <token>

Response: Team object
```

### Update Team

```typescript
const updated = await teamService.updateTeam(teamId, {
  name: 'New Team Name',
  description: 'Updated description'
});
```

**API Endpoint:**
```
PUT /api/teams/:id
Authorization: Bearer <token> (owner or admin only)
Content-Type: application/json

Body:
{
  "name": "Updated Team Name",
  "description": "Updated description"
}

Response: Updated Team object
```

### Delete Team

```typescript
await teamService.deleteTeam(teamId, userId);
// userId must be owner of team
```

**API Endpoint:**
```
DELETE /api/teams/:id
Authorization: Bearer <token> (owner only)

Response:
{
  "message": "Team deleted"
}
```

### Get User's Teams

```typescript
const teams = await teamService.getUserTeams(userId);
// Returns array of teams user is member of
```

**API Endpoint:**
```
GET /api/teams
Authorization: Bearer <token>

Response:
[
  { Team objects... }
]
```

## Team Member Management

### Add Member

```typescript
await teamService.addMember(
  teamId,
  userId,
  'member',      // owner, admin, or member
  inviterUserId  // Optional: who invited them
);

// Throws if:
// - User already a member
// - Team member limit reached
// - Team not found
```

**API Endpoint:**
```
POST /api/teams/:id/members
Authorization: Bearer <token>
Content-Type: application/json
Required Permission: team:invite

Body:
{
  "userId": "user-to-add",
  "role": "member"
}

Response:
{
  "message": "Member added"
}
```

### Remove Member

```typescript
await teamService.removeMember(teamId, userId);

// Throws if:
// - Member not found
// - Member is owner (cannot remove)
```

**API Endpoint:**
```
DELETE /api/teams/:id/members/:userId
Authorization: Bearer <token>
Required Permission: team:remove

Response:
{
  "message": "Member removed"
}
```

### Get Team Members

```typescript
const members = await teamService.getTeamMembers(teamId);

// Returns array of TeamMember objects with user details:
// [
//   {
//     id: '...',
//     teamId: '...',
//     userId: '...',
//     role: 'owner',
//     joinedAt: Date,
//     user: {
//       id: '...',
//       email: 'user@example.com',
//       firstName: 'John',
//       lastName: 'Doe'
//     }
//   },
//   ...
// ]
```

**API Endpoint:**
```
GET /api/teams/:id/members
Authorization: Bearer <token>
Member access required

Response:
[
  { TeamMember objects with user details... }
]
```

### Update Member Role

```typescript
await teamService.updateMemberRole(teamId, userId, 'admin');

// Throws if:
// - Member not found
// - Trying to change owner role
```

**API Endpoint:**
```
PUT /api/teams/:id/members/:userId/role
Authorization: Bearer <token>
Required Permission: team:manage

Body:
{
  "role": "admin"
}

Response:
{
  "message": "Member role updated"
}
```

### Check Team Membership

```typescript
const isMember = await teamService.isTeamMember(teamId, userId);
// true or false

const role = await teamService.getMemberRole(teamId, userId);
// 'owner', 'admin', 'member', or null
```

## Organization Management

### Create Organization

```typescript
import { organizationService } from './services/team/index.js';

const org = await organizationService.createOrganization(
  'ACME Corp',
  userId  // Owner user ID
);

// Creates organization with default team
```

**API Endpoint:**
```
POST /api/organizations
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "name": "My Organization"
}

Response:
{
  "id": "...",
  "name": "My Organization",
  "ownerId": "...",
  "plan": "free",
  "maxMembers": 5,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Get Organization

```typescript
const org = await organizationService.getOrganization(orgId);
```

**API Endpoint:**
```
GET /api/organizations/:id
Authorization: Bearer <token>
Admin access required

Response: Organization object
```

### Update Organization

```typescript
const updated = await organizationService.updateOrganization(orgId, {
  name: 'New Name'
});
```

**API Endpoint:**
```
PUT /api/organizations/:id
Authorization: Bearer <token> (owner or admin only)
Content-Type: application/json

Body:
{
  "name": "Updated Organization Name"
}

Response: Updated Organization object
```

### Invite User to Organization

```typescript
const invitation = await organizationService.inviteUser(
  orgId,
  'newuser@example.com',
  'member'  // owner, admin, or member
);

// Returns:
// - For existing user: { status: 'accepted', ... }
// - For new user: { status: 'pending', expiresAt: Date, ... }
```

**API Endpoint:**
```
POST /api/organizations/:id/invite
Authorization: Bearer <token>
Required Permission: team:invite

Body:
{
  "email": "user@example.com",
  "role": "member"
}

Response:
{
  "message": "User invited",
  "invitation": {
    "email": "user@example.com",
    "role": "member",
    "status": "accepted|pending",
    "createdAt": "...",
    "expiresAt": "..."
  }
}
```

### Get Organization Members

```typescript
const members = await organizationService.getOrgMembers(orgId);

// Returns array of members with details:
// [
//   {
//     id: '...',
//     userId: '...',
//     role: 'member',
//     joinedAt: Date,
//     email: 'user@example.com',
//     firstName: '...',
//     lastName: '...'
//   },
//   ...
// ]
```

**API Endpoint:**
```
GET /api/organizations/:id/members
Authorization: Bearer <token>
Admin access required

Response:
[
  { Member objects... }
]
```

### Remove User from Organization

```typescript
await organizationService.removeUser(orgId, userId);
```

**API Endpoint:**
```
DELETE /api/organizations/:id/members/:userId
Authorization: Bearer <token>
Required Permission: team:remove

Response:
{
  "message": "User removed"
}
```

### Get Organization Statistics

```typescript
const stats = await organizationService.getOrgStats(orgId);

// Returns:
// {
//   teamCount: 1,
//   memberCount: 5,
//   totalProjects: 10,
//   totalTests: 50,
//   planLimit: 5,
//   membersUsed: 5
// }
```

**API Endpoint:**
```
GET /api/organizations/:id/stats
Authorization: Bearer <token>
Admin access required

Response:
{
  "teamCount": 1,
  "memberCount": 5,
  "totalProjects": 10,
  "totalTests": 50,
  "planLimit": 5,
  "membersUsed": 5
}
```

### Update Organization Plan

```typescript
const updated = await organizationService.updatePlan(
  orgId,
  'pro',  // free, starter, pro, enterprise
  50      // maxMembers
);
```

**API Endpoint:**
```
PUT /api/organizations/:id/plan
Authorization: Bearer <token>
Required Permission: billing:manage

Body:
{
  "plan": "pro",
  "maxMembers": 50
}

Response: Updated Organization object
```

## Integration Examples

### 1. Register Routes in Main App

```typescript
import { Router } from 'express';
import { teamRoutes, organizationRoutes } from './services/team/index.js';
import { rbacRoutes } from './services/rbac/index.js';

const router = Router();

router.use('/teams', teamRoutes);
router.use('/organizations', organizationRoutes);
router.use('/rbac', rbacRoutes);

export default router;
```

### 2. Invite User Flow

```typescript
// 1. User fills invitation form with email
// 2. Send invitation
const invitation = await organizationService.inviteUser(
  orgId,
  email,
  'member'
);

if (invitation.status === 'pending') {
  // Send email with registration link
  await sendInvitationEmail(email, orgId);
}

// 3. New user registers with invitation link
// 4. User automatically joins organization with role

// 5. Existing user is immediately added
```

### 3. Enforce Team Membership

```typescript
import { requireTeamMembership } from './rbac/index.js';

router.post(
  '/teams/:id/projects',
  authenticateUser,
  requireTeamMembership(),
  requirePermission('project:create'),
  async (req, res) => {
    // User is authenticated, team member, and has permission
  }
);
```

### 4. Check Permissions Before Action

```typescript
async function removeTeamMember(teamId, userId, requesterId) {
  // Check requester permissions
  const isOwner = await teamService.getMemberRole(teamId, requesterId) === 'owner';
  const isAdmin = await permissionEngine.hasPermission(requesterId, 'team:remove');

  if (!isOwner && !isAdmin) {
    throw new Error('Insufficient permissions');
  }

  // Remove member
  await teamService.removeMember(teamId, userId);
}
```

## Error Handling

### Team Member Limit Reached
```json
HTTP 409
{
  "error": "Team member limit reached"
}
```

### User Already Member
```json
HTTP 400
{
  "error": "User is already a team member"
}
```

### Cannot Remove Owner
```json
HTTP 400
{
  "error": "Cannot remove team owner"
}
```

### Insufficient Permissions
```json
HTTP 403
{
  "error": "Insufficient permissions"
}
```

## Best Practices

1. **Always check ownership/admin status** before allowing modifications
2. **Validate team membership** before performing team operations
3. **Enforce member limits** based on subscription plan
4. **Log member changes** for audit trail
5. **Send notifications** when users are added/removed
6. **Use invitation tokens** for secure invite links
7. **Set invitation expiry** to prevent stale invites
8. **Cascade deletes** properly (delete members before team)
9. **Cache team info** for frequently accessed data
10. **Rate limit** invitation endpoints to prevent spam

## Database Schema

The system uses existing tables:

- `teams` - Team records
- `teamMembers` - Team membership records
- `users` - User accounts

**Key relationships:**
```
users (ownerId) → teams
users (userId) ← teamMembers → teams (teamId)
```

## Role-Based Team Permissions

| Permission | Owner | Admin | Member | Description |
|-----------|-------|-------|--------|-------------|
| team:read | ✓ | ✓ | ✓ | View team info |
| team:manage | ✓ | ✓ | ✗ | Edit team settings |
| team:invite | ✓ | ✓ | ✗ | Invite members |
| team:remove | ✓ | ✓ | ✗ | Remove members |

## Testing

Example test cases:

```typescript
describe('TeamService', () => {
  it('should create team with owner', async () => {
    const team = await teamService.createTeam(orgId, 'Test Team', userId);
    expect(team.ownerId).toBe(userId);
  });

  it('should prevent duplicate membership', async () => {
    await expect(
      teamService.addMember(teamId, userId)
    ).rejects.toThrow('already a team member');
  });

  it('should enforce member limit', async () => {
    const team = await teamService.getTeam(teamId);
    for (let i = 0; i < team.maxMembers; i++) {
      await teamService.addMember(teamId, `user${i}`);
    }
    await expect(
      teamService.addMember(teamId, 'newuser')
    ).rejects.toThrow('member limit reached');
  });
});
```

## Customization

### Add Custom Team Fields

Update the `Team` interface and schema if you need additional fields like:
- `logoUrl` - Team logo
- `website` - Team website
- `metadata` - Custom JSON data
- `settings` - Team-specific settings

### Extend Invitation System

Add features like:
- Invitation tokens
- Expiry enforcement
- Resend invitations
- Invitation tracking
- Bulk invitations
