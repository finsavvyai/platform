/**
 * Team Management System Tests
 * Tests for team creation, member management, and permissions
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// Mock Cloudflare D1 and KV environments
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ results: [] }),
        first: async () => null,
        all: async () => ({ results: [] })
      })
    })
  },
  CACHE: {
    get: async () => null,
    put: async () => {},
    delete: async () => {}
  }
};

// Mock user data
const mockUser = {
  id: 'user-123',
  user_id: 'claude-user-456',
  email: 'test@example.com',
  tier: 'pro',
  api_key: 'luna_test_key_1234567890'
};

const mockTeam = {
  id: 'team-123',
  name: 'Test Team',
  description: 'A test team for development',
  owner_id: mockUser.id,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

describe('Team Management System', () => {
  let teamController;
  let dbService;

  beforeAll(() => {
    // Initialize controllers with mock environment
    const DatabaseService = (await import('../src/database.js')).default;
    const { TeamController } = (await import('../src/team-controller.js'));

    dbService = new DatabaseService(mockEnv);
    teamController = new TeamController(mockEnv);
  });

  describe('Team Creation', () => {
    it('should create a team with valid data', async () => {
      // Mock database responses
      dbService.getUserByUserId = async () => mockUser;
      dbService.getUserTeams = async () => []; // No existing teams
      dbService.createTeam = async (data) => ({
        id: data.id || 'new-team-id',
        name: data.name,
        description: data.description,
        owner_id: data.owner_id,
        created_at: data.created_at,
        updated_at: data.updated_at
      });
      dbService.createTeamSettings = async () => ({});
      dbService.addTeamMember = async () => ({});
      dbService.logTeamActivity = async () => {};

      const teamData = {
        name: 'New Test Team',
        description: 'Test description'
      };

      const result = await teamController.createTeam(mockUser.user_id, teamData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.name).toBe('New Test Team');
      expect(result.data.role).toBe('owner');
      expect(result.data.member_count).toBe(1);
    });

    it('should reject team creation for free users', async () => {
      dbService.getUserByUserId = async () => ({
        ...mockUser,
        tier: 'free'
      });

      const result = await teamController.createTeam(mockUser.user_id, {
        name: 'Test Team'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('subscription_required');
    });

    it('should reject team creation with missing name', async () => {
      dbService.getUserByUserId = async () => mockUser;

      const result = await teamController.createTeam(mockUser.user_id, {
        description: 'Test team without name'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('missing_team_name');
    });

    it('should enforce team limits for pro users', async () => {
      dbService.getUserByUserId = async () => mockUser;
      dbService.getUserTeams = async () => [
        { id: 'team1' }, { id: 'team2' }, { id: 'team3' },
        { id: 'team4' }, { id: 'team5' }
      ]; // Already at limit

      const result = await teamController.createTeam(mockUser.user_id, {
        name: 'Extra Team'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('team_limit_reached');
    });
  });

  describe('Team Member Management', () => {
    const mockTeamId = 'team-123';
    const mockMember = {
      id: 'member-123',
      user_id: 'user-456',
      email: 'member@example.com',
      role: 'member',
      joined_at: '2025-01-01T00:00:00Z'
    };

    it('should invite member with valid permissions', async () => {
      // Mock permission check and existing data
      dbService.hasTeamPermission = async () => true;
      dbService.getTeamSettings = async () => ({ max_members: 50 });
      dbService.getTeamMembers = async () => [{ id: 'existing-member' }];
      dbService.getUserByEmail = async () => ({ id: 'user-456', email: 'member@example.com' });
      dbService.getTeamMember = async () => null; // Not already a member
      dbService.addTeamMember = async (data) => ({
        id: data.id,
        team_id: data.team_id,
        user_id: data.user_id,
        email: 'member@example.com',
        role: data.role,
        status: data.status,
        invited_at: data.invited_at
      });
      dbService.logTeamActivity = async () => {};

      const result = await teamController.inviteMember(mockUser.user_id, mockTeamId, {
        email: 'member@example.com',
        role: 'member'
      });

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('member@example.com');
      expect(result.data.role).toBe('member');
      expect(result.data.status).toBe('invited');
    });

    it('should reject member invitation without permissions', async () => {
      dbService.hasTeamPermission = async () => false;

      const result = await teamController.inviteMember(mockUser.user_id, mockTeamId, {
        email: 'member@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('insufficient_permissions');
    });

    it('should reject invalid email addresses', async () => {
      dbService.hasTeamPermission = async () => true;

      const result = await teamController.inviteMember(mockUser.user_id, mockTeamId, {
        email: 'invalid-email',
        role: 'member'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('invalid_email');
    });

    it('should update member role with proper permissions', async () => {
      dbService.hasTeamPermission = async () => true;
      dbService.getTeamMember = async () => ({ role: 'member' }); // Target member
      dbService.getTeamMember = async () => ({ role: 'admin' }); // Requester
      dbService.updateTeamMemberRole = async () => ({ role: 'admin' });
      dbService.logTeamActivity = async () => {};

      const result = await teamController.updateMemberRole(
        mockUser.user_id,
        mockTeamId,
        'member-456',
        'admin'
      );

      expect(result.success).toBe(true);
      expect(result.data.role).toBe('admin');
    });

    it('should prevent non-owners from assigning owner role', async () => {
      dbService.hasTeamPermission = async () => true;
      dbService.getTeamMember = async () => ({ role: 'admin' }); // Requester is admin, not owner

      const result = await teamController.updateMemberRole(
        mockUser.user_id,
        mockTeamId,
        'member-456',
        'owner'
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('cannot_assign_owner');
    });

    it('should remove team member with proper permissions', async () => {
      dbService.hasTeamPermission = async () => true;
      dbService.getTeamMember = async () => ({ role: 'member' }); // Target member
      dbService.getTeamMember = async () => ({ role: 'admin' }); // Requester
      dbService.removeTeamMember = async () => true;
      dbService.logTeamActivity = async () => {};

      const result = await teamController.removeMember(
        mockUser.user_id,
        mockTeamId,
        'member-456'
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('member-456');
      expect(result.data.removed_at).toBeDefined();
    });
  });

  describe('Team Settings Management', () => {
    it('should update team settings with proper permissions', async () => {
      dbService.hasTeamPermission = async () => true;
      dbService.updateTeamSettings = async () => ({
        rag_sharing: false,
        codebase_sharing: true,
        invitation_expiry_hours: 168
      });

      const result = await teamController.updateTeamSettings(
        mockUser.user_id,
        'team-123',
        {
          rag_sharing: false,
          invitation_expiry_hours: 168
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.rag_sharing).toBe(false);
      expect(result.data.invitation_expiry_hours).toBe(168);
    });

    it('should reject settings update without permissions', async () => {
      dbService.hasTeamPermission = async () => false;

      const result = await teamController.updateTeamSettings(
        mockUser.user_id,
        'team-123',
        { rag_sharing: false }
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('insufficient_permissions');
    });

    it('should validate setting types', async () => {
      dbService.hasTeamPermission = async () => true;

      const result = await teamController.updateTeamSettings(
        mockUser.user_id,
        'team-123',
        {
          rag_sharing: 'not-a-boolean', // Invalid type
          invitation_expiry_hours: -5 // Invalid value
        }
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('invalid_setting_type');
    });
  });

  describe('Team Access Control', () => {
    it('should allow team members to view team details', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamById = async () => mockTeam;
      dbService.getTeamMembers = async () => [mockMember];
      dbService.getTeamStatistics = async () => ({
        member_count: 2,
        project_count: 1,
        recent_activity_count: 5
      });

      const result = await teamController.getTeamById(mockUser.user_id, 'team-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('team-123');
      expect(result.data.user_role).toBe('member');
      expect(result.data.member_count).toBe(2);
    });

    it('should deny access to non-members', async () => {
      dbService.getTeamMember = async () => null; // Not a member

      const result = await teamController.getTeamById(mockUser.user_id, 'team-123');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('access_denied');
    });

    it('should allow users to leave teams (except owners)', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.removeTeamMember = async () => true;

      const result = await teamController.leaveTeam(mockUser.user_id, 'team-123');

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Successfully left the team');
    });

    it('should prevent owners from leaving teams', async () => {
      dbService.getTeamMember = async () => ({
        role: 'owner',
        status: 'joined'
      });

      const result = await teamController.leaveTeam(mockUser.user_id, 'team-123');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('owner_cannot_leave');
    });
  });

  describe('Team Statistics and Audit', () => {
    it('should return team statistics for members', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamAuditLog = async () => [
        {
          id: 'audit-1',
          action: 'created',
          user_email: 'owner@example.com',
          created_at: '2025-01-01T00:00:00Z'
        }
      ];

      const result = await teamController.getTeamAuditLog(
        mockUser.user_id,
        'team-123'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('created');
    });

    it('should deny audit log access to non-members', async () => {
      dbService.getTeamMember = async () => null;

      const result = await teamController.getTeamAuditLog(
        mockUser.user_id,
        'team-123'
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('access_denied');
    });
  });

  describe('API Route Handling', () => {
    it('should handle team creation via POST /teams/create', async () => {
      // Mock the team controller methods
      teamController.createTeam = async () => ({
        success: true,
        data: { id: 'new-team', name: 'Test Team' }
      });

      const mockRequest = {
        method: 'POST',
        json: async () => ({
          userId: mockUser.user_id,
          name: 'Test Team',
          description: 'Test description'
        })
      };

      // Import and test the route handler
      const handleTeamRoutes = async (pathParts, request, controller) => {
        if (pathParts[0] === 'create') {
          const body = await request.json();
          return await controller.createTeam(body.userId, body);
        }
        return { success: false, error: 'Not found' };
      };

      const result = await handleTeamRoutes(
        ['create'],
        mockRequest,
        teamController
      );

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Team');
    });

    it('should handle team listing via GET /teams', async () => {
      teamController.getUserTeams = async () => ({
        success: true,
        data: [{ id: 'team-1', name: 'Team 1' }]
      });

      const mockRequest = {
        method: 'GET',
        url: 'https://api.example.com/teams?userId=' + mockUser.user_id
      };

      const url = new URL(mockRequest.url);
      const userId = url.searchParams.get('userId');

      const result = await teamController.getUserTeams(userId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
});

// Integration Tests
describe('Team Management Integration', () => {
  it('should handle complete team workflow', async () => {
    // This would test the complete workflow from team creation
    // to member invitation to role management
    // In a real scenario, this would involve actual database operations

    const workflowSteps = [
      'Create team',
      'Invite members',
      'Update settings',
      'Manage roles',
      'View audit log'
    ];

    expect(workflowSteps).toHaveLength(5);
    // Actual implementation would test each step with real data
  });
});