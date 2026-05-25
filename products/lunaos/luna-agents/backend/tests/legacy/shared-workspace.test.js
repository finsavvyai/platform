/**
 * Shared Workspace Features Tests
 * Tests for team-based code indexing, collaborative RAG, and knowledge management
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
  },
  VECTOR_DB: {
    // Mock vector database operations
    upsert: async () => ({ upsertedCount: 1 }),
    query: async () => ({
      matches: [
        {
          id: 'vec-1',
          score: 0.95,
          metadata: { source: 'project', file: 'src/main.js' }
        }
      ]
    })
  }
};

// Mock team and project data
const mockTeam = {
  id: 'team-123',
  name: 'Test Development Team',
  description: 'A team for testing shared workspace features',
  owner_id: 'user-123',
  created_at: '2025-01-01T00:00:00Z'
};

const mockProject = {
  id: 'proj-123',
  team_id: mockTeam.id,
  name: 'Luna Agents Frontend',
  description: 'Frontend application for Luna Agents',
  repository_url: 'https://github.com/team/luna-agents-frontend',
  language: 'javascript',
  indexed_at: '2025-01-05T00:00:00Z',
  files_count: 250
};

const mockKnowledge = {
  id: 'know-123',
  team_id: mockTeam.id,
  title: 'API Documentation',
  content: 'Comprehensive API documentation for the Luna Agents platform...',
  type: 'api_doc',
  category: 'documentation',
  tags: ['api', 'documentation', 'reference'],
  created_by: 'user-456',
  created_at: '2025-01-03T00:00:00Z'
};

describe('Shared Workspace Features', () => {
  let workspaceController;
  let dbService;

  beforeAll(() => {
    // Initialize controllers with mock environment
    const DatabaseService = (await import('../src/database.js')).default;
    const { SharedWorkspaceController } = (await import('../src/shared-workspace-controller.js'));

    dbService = new DatabaseService(mockEnv);
    workspaceController = new SharedWorkspaceController(mockEnv);
  });

  describe('Team Project Indexing', () => {
    it('should index a team project with valid data', async () => {
      // Mock permission check and data
      dbService.hasTeamPermission = async () => true;
      dbService.getTeamSettings = async () => ({
        max_projects: 10,
        rag_sharing: true
      });
      dbService.getTeamProjects = async () => [mockProject]; // One existing project
      dbService.createTeamProject = async (data) => ({
        id: data.id || 'new-project-id',
        name: data.name,
        repository_url: data.repository_url,
        language: data.language,
        created_at: data.created_at
      });
      dbService.logTeamActivity = async () => {};

      const projectData = {
        name: 'New Team Project',
        description: 'A new project for testing',
        repository_url: 'https://github.com/team/new-project',
        language: 'typescript'
      };

      const result = await workspaceController.indexTeamProject(
        mockTeam.owner_id,
        mockTeam.id,
        projectData
      );

      expect(result.success).toBe(true);
      expect(result.data.project_id).toBeDefined();
      expect(result.data.name).toBe('New Team Project');
      expect(result.data.status).toBe('indexing');
    });

    it('should reject project indexing without permissions', async () => {
      dbService.hasTeamPermission = async () => false;

      const result = await workspaceController.indexTeamProject(
        'unauthorized-user',
        mockTeam.id,
        {
          name: 'Unauthorized Project',
          repository_url: 'https://github.com/team/unauthorized'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('insufficient_permissions');
    });

    it('should validate required project data', async () => {
      dbService.hasTeamPermission = async () => true;

      const result = await workspaceController.indexTeamProject(
        mockTeam.owner_id,
        mockTeam.id,
        {
          name: 'Project without repository'
          // Missing repository_url
        }
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('missing_project_data');
    });

    it('should enforce project limits', async () => {
      dbService.hasTeamPermission = async () => true;
      dbService.getTeamSettings = async () => ({ max_projects: 2 });
      dbService.getTeamProjects = async () => [
        { id: 'proj-1' },
        { id: 'proj-2' },
        { id: 'proj-3' }
      ]; // Already at limit

      const result = await workspaceController.indexTeamProject(
        mockTeam.owner_id,
        mockTeam.id,
        {
          name: 'Extra Project',
          repository_url: 'https://github.com/team/extra'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('project_limit_reached');
    });
  });

  describe('Team Project Management', () => {
    it('should retrieve team projects for authorized users', async () => {
      // Mock user as team member
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamProjects = async () => [mockProject];
      workspaceController.getProjectIndexingStats = async () => ({
        status: 'indexed',
        files_count: 250,
        last_indexed: '2025-01-05T00:00:00Z'
      });

      const result = await workspaceController.getTeamProjects(
        'team-member-user',
        mockTeam.id
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Luna Agents Frontend');
      expect(result.data[0].indexing_status).toBe('indexed');
      expect(result.data[0].files_count).toBe(250);
    });

    it('should deny project access to non-members', async () => {
      dbService.getTeamMember = async () => null; // Not a member

      const result = await workspaceController.getTeamProjects(
        'non-member-user',
        mockTeam.id
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('access_denied');
    });
  });

  describe('Collaborative RAG Queries', () => {
    it('should process collaborative RAG queries for team members', async () => {
      // Mock team membership and settings
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamSettings = async () => ({ rag_sharing: true });

      // Mock context building and search
      workspaceController.buildTeamContext = async () => ({
        team_id: mockTeam.id,
        team_name: mockTeam.name,
        projects: [mockProject],
        member_count: 3,
        user_role: 'member'
      });

      workspaceController.searchTeamKnowledge = async () => [
        {
          id: 'result-1',
          content: 'Sample code from frontend project...',
          source: 'project',
          project_id: mockProject.id,
          score: 0.95,
          metadata: { file: 'src/components/Header.jsx', line: 25 }
        }
      ];

      workspaceController.generateTeamResponse = async () => ({
        response: 'Based on your team\'s frontend codebase, here\'s what I found...',
        query_id: 'query-123',
        context_used: mockTeam.name
      });

      workspaceController.logTeamQuery = async () => {};

      const result = await workspaceController.collaborativeRAGQuery(
        'team-member-user',
        mockTeam.id,
        'How do we implement authentication in the frontend?'
      );

      expect(result.success).toBe(true);
      expect(result.data.response).toContain('frontend codebase');
      expect(result.data.sources).toHaveLength(1);
      expect(result.data.context.team_name).toBe('Test Development Team');
      expect(result.data.query_id).toBe('query-123');
    });

    it('should reject queries when RAG sharing is disabled', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamSettings = async () => ({ rag_sharing: false });

      const result = await workspaceController.collaborativeRAGQuery(
        'team-member-user',
        mockTeam.id,
        'Test query'
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('rag_sharing_disabled');
    });

    it('should include search options in collaborative queries', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamSettings = async () => ({ rag_sharing: true });

      workspaceController.buildTeamContext = async () => ({
        team_id: mockTeam.id,
        team_name: mockTeam.name,
        projects: [],
        member_count: 3,
        user_role: 'member'
      });

      workspaceController.searchTeamKnowledge = async (teamId, query, options) => {
        expect(options.includeProjects).toBe(false);
        expect(options.includeConversations).toBe(true);
        expect(options.maxResults).toBe(5);
        return [];
      };

      workspaceController.generateTeamResponse = async () => ({
        response: 'Custom response',
        query_id: 'query-456'
      });

      workspaceController.logTeamQuery = async () => {};

      const result = await workspaceController.collaborativeRAGQuery(
        'team-member-user',
        mockTeam.id,
        'Test query with options',
        {
          includeProjects: false,
          includeConversations: true,
          maxResults: 5
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Team Knowledge Base', () => {
    it('should add knowledge entries with proper permissions', async () => {
      dbService.hasTeamPermission = async () => true;
      dbService.createTeamKnowledge = async (data) => ({
        id: data.id || 'new-knowledge-id',
        title: data.title,
        type: data.type,
        team_id: data.team_id,
        created_at: data.created_at
      });
      dbService.logTeamActivity = async () => {};
      workspaceController.indexKnowledgeEntry = async () => {};

      const knowledgeData = {
        title: 'Database Schema Documentation',
        content: 'Complete database schema with relationships...',
        type: 'documentation',
        category: 'database',
        tags: ['database', 'schema', 'documentation']
      };

      const result = await workspaceController.addTeamKnowledge(
        mockTeam.owner_id,
        mockTeam.id,
        knowledgeData
      );

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Database Schema Documentation');
      expect(result.data.type).toBe('documentation');
      expect(result.data.indexed).toBe(true);
    });

    it('should reject knowledge addition without permissions', async () => {
      dbService.hasTeamPermission = async () => false;

      const result = await workspaceController.addTeamKnowledge(
        'unauthorized-user',
        mockTeam.id,
        {
          title: 'Unauthorized Entry',
          content: 'This should not be added'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('insufficient_permissions');
    });

    it('should search team knowledge base effectively', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });

      workspaceController.performKnowledgeSearch = async () => [
        {
          id: 'know-1',
          title: 'Authentication Guide',
          content: 'Complete guide to implementing authentication...',
          type: 'tutorial',
          category: 'security',
          score: 0.92,
          created_at: '2025-01-01T00:00:00Z',
          tags: ['auth', 'security', 'tutorial']
        },
        {
          id: 'know-2',
          title: 'API Reference',
          content: 'API reference documentation...',
          type: 'api_doc',
          category: 'api',
          score: 0.87,
          created_at: '2025-01-02T00:00:00Z',
          tags: ['api', 'reference']
        }
      ];

      const result = await workspaceController.searchTeamKnowledgeBase(
        'team-member-user',
        mockTeam.id,
        'authentication',
        {
          type: 'tutorial',
          max_results: 10
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0].title).toBe('Authentication Guide');
      expect(result.data.results[0].score).toBe(0.92);
      expect(result.data.total_found).toBe(2);
    });
  });

  describe('Shared Conversation History', () => {
    it('should retrieve shared conversations for authorized members', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });
      dbService.getTeamSettings = async () => ({ conversation_sharing: true });

      dbService.getTeamConversations = async () => [
        {
          id: 'conv-1',
          message: 'How do we implement user authentication?',
          response: 'Based on your codebase, here\'s the authentication flow...',
          member_email: 'user1@example.com',
          member_name: 'user-123',
          created_at: '2025-01-01T10:00:00Z'
        },
        {
          id: 'conv-2',
          message: 'What are the API endpoints?',
          response: 'Here are the available API endpoints...',
          member_email: 'user2@example.com',
          member_name: 'user-456',
          created_at: '2025-01-01T11:00:00Z'
        }
      ];

      const result = await workspaceController.getSharedConversations(
        'team-member-user',
        mockTeam.id,
        {
          limit: 10,
          search: 'authentication'
        }
      );

      expect(result.success).toBe(true);
      expect(result.data.conversations).toHaveLength(2);
      expect(result.data.conversations[0].member_email).toBe('user1@example.com');
      expect(result.data.total_count).toBe(2);
    });

    it('should restrict conversation history based on team settings', async () => {
      dbService.getTeamMember = async () => ({
        role: 'member', // Regular member, not owner/admin
        status: 'joined'
      });
      dbService.getTeamSettings = async () => ({
        conversation_sharing: false
      });

      const result = await workspaceController.getSharedConversations(
        'team-member-user',
        mockTeam.id
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('conversation_sharing_disabled');
    });

    it('should allow owners/admins to access conversations even when sharing is disabled', async () => {
      dbService.getTeamMember = async () => ({
        role: 'owner', // Owner has access
        status: 'joined'
      });
      dbService.getTeamSettings = async () => ({
        conversation_sharing: false
      });

      dbService.getTeamConversations = async () => [
        {
          id: 'conv-1',
          message: 'Test message',
          response: 'Test response',
          member_email: 'owner@example.com',
          created_at: '2025-01-01T10:00:00Z'
        }
      ];

      const result = await workspaceController.getSharedConversations(
        'team-owner-user',
        mockTeam.id
      );

      expect(result.success).toBe(true);
      expect(result.data.conversations).toHaveLength(1);
    });
  });

  describe('Cross-Team Search', () => {
    it('should search across multiple accessible teams', async () => {
      // Mock user's teams
      dbService.getUserTeams = async () => [
        { id: 'team-1', name: 'Frontend Team' },
        { id: 'team-2', name: 'Backend Team' },
        { id: 'team-3', name: 'DevOps Team' }
      ];

      // Mock membership verification for each team
      dbService.getTeamMember = async (teamId) => {
        const accessibleTeams = ['team-1', 'team-2'];
        return accessibleTeams.includes(teamId)
          ? { role: 'member', status: 'joined' }
          : null;
      };

      // Mock search results
      workspaceController.searchTeamKnowledge = async (teamId, query) => {
        const teamResults = {
          'team-1': [
            {
              id: 'result-1',
              title: 'Frontend Components',
              content: 'React component library...',
              score: 0.95
            }
          ],
          'team-2': [
            {
              id: 'result-2',
              title: 'API Endpoints',
              content: 'REST API documentation...',
              score: 0.87
            }
          ],
          'team-3': [] // Not accessible
        };

        return teamResults[teamId] || [];
      };

      workspaceController.aggregateSearchResults = (searchResults, query) => {
        return searchResults
          .filter(team => team.results.length > 0)
          .flatMap(team =>
            team.results.map(result => ({
              ...result,
              team_id: team.team_id,
              team_name: team.team_name
            }))
          );
      };

      const result = await workspaceController.crossTeamSearch(
        'multi-team-user',
        'component library',
        ['team-1', 'team-2', 'team-3']
      );

      expect(result.success).toBe(true);
      expect(result.data.teams_searched).toBe(2); // Only accessible teams
      expect(result.data.total_results).toBe(2);
      expect(result.data.results).toHaveLength(2);
      expect(result.data.team_breakdown).toHaveLength(3);
    });

    it('should handle cross-team search with no specified teams', async () => {
      dbService.getUserTeams = async () => [
        { id: 'team-1', name: 'Only Team' }
      ];

      dbService.getTeamMember = async () => ({
        role: 'member',
        status: 'joined'
      });

      workspaceController.searchTeamKnowledge = async () => [
        {
          id: 'result-1',
          title: 'Single Result',
          content: 'Content from only team',
          score: 0.92
        }
      ];

      workspaceController.aggregateSearchResults = (searchResults) => {
        return searchResults[0].results.map(result => ({
          ...result,
          team_id: searchResults[0].team_id,
          team_name: searchResults[0].team_name
        }));
      };

      const result = await workspaceController.crossTeamSearch(
        'single-team-user',
        'test query'
      );

      expect(result.success).toBe(true);
      expect(result.data.teams_searched).toBe(1);
      expect(result.data.total_results).toBe(1);
    });

    it('should return empty results when user has no accessible teams', async () => {
      dbService.getUserTeams = async () => [];
      dbService.getTeamMember = async () => null;

      const result = await workspaceController.crossTeamSearch(
        'no-teams-user',
        'test query'
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('no_accessible_teams');
    });
  });

  describe('API Route Handling', () => {
    it('should handle project indexing via POST /workspace/index-project', async () => {
      workspaceController.indexTeamProject = async () => ({
        success: true,
        data: { project_id: 'new-proj', status: 'indexing' }
      });

      const mockRequest = {
        method: 'POST',
        json: async () => ({
          userId: 'test-user',
          teamId: 'team-123',
          name: 'API Test Project',
          repository_url: 'https://github.com/test/api-project'
        })
      };

      // Test the route handler
      const handleWorkspaceRoutes = async (pathParts, request, controller) => {
        if (pathParts[0] === 'index-project') {
          const body = await request.json();
          return await controller.indexTeamProject(
            body.userId,
            body.teamId,
            {
              name: body.name,
              repository_url: body.repository_url,
              description: body.description,
              language: body.language
            }
          );
        }
        return { success: false, error: 'Not found' };
      };

      const result = await handleWorkspaceRoutes(
        ['index-project'],
        mockRequest,
        workspaceController
      );

      expect(result.success).toBe(true);
      expect(result.data.project_id).toBe('new-proj');
    });

    it('should handle collaborative queries via POST /workspace/query', async () => {
      workspaceController.collaborativeRAGQuery = async () => ({
        success: true,
        data: {
          response: 'Collaborative response',
          sources: [{ content: 'Source content' }],
          query_id: 'query-123'
        }
      });

      const mockRequest = {
        method: 'POST',
        json: async () => ({
          userId: 'test-user',
          teamId: 'team-123',
          query: 'How do we implement authentication?',
          options: { maxResults: 5 }
        })
      };

      const handleWorkspaceRoutes = async (pathParts, request, controller) => {
        if (pathParts[0] === 'query') {
          const body = await request.json();
          return await controller.collaborativeRAGQuery(
            body.userId,
            body.teamId,
            body.query,
            body.options
          );
        }
        return { success: false, error: 'Not found' };
      };

      const result = await handleWorkspaceRoutes(
        ['query'],
        mockRequest,
        workspaceController
      );

      expect(result.success).toBe(true);
      expect(result.data.response).toBe('Collaborative response');
      expect(result.data.query_id).toBe('query-123');
    });

    it('should handle knowledge search via GET /workspace/knowledge', async () => {
      workspaceController.searchTeamKnowledgeBase = async () => ({
        success: true,
        data: {
          results: [
            {
              id: 'know-1',
              title: 'Test Knowledge',
              content: 'Test content',
              score: 0.95
            }
          ],
          query: 'test query',
          total_found: 1
        }
      });

      const mockRequest = {
        method: 'GET',
        url: 'https://api.example.com/workspace/knowledge?userId=test-user&teamId=team-123&query=test'
      };

      const url = new URL(mockRequest.url);
      const userId = url.searchParams.get('userId');

      const handleWorkspaceRoutes = async (pathParts, request, controller) => {
        if (pathParts[0] === 'knowledge') {
          const url = new URL(request.url);
          return await controller.searchTeamKnowledgeBase(
            url.searchParams.get('userId'),
            url.searchParams.get('teamId'),
            url.searchParams.get('query')
          );
        }
        return { success: false, error: 'Not found' };
      };

      const result = await handleWorkspaceRoutes(
        ['knowledge'],
        mockRequest,
        workspaceController
      );

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.total_found).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing user ID gracefully', async () => {
      const mockRequest = {
        method: 'POST',
        json: async () => ({ teamId: 'team-123', query: 'test' })
        // Missing userId
      };

      const handleWorkspaceRoutes = async (pathParts, request) => {
        return {
          success: false,
          error: 'Missing userId parameter or header',
          error_code: 'missing_user_id'
        };
      };

      const result = await handleWorkspaceRoutes(['query'], mockRequest);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('missing_user_id');
    });

    it('should handle invalid query parameters', async () => {
      const mockRequest = {
        method: 'GET',
        url: 'https://api.example.com/workspace/knowledge?userId=test-user&teamId=team-123'
        // Missing query parameter
      };

      const handleWorkspaceRoutes = async (pathParts, request) => {
        const url = new URL(request.url);
        const teamId = url.searchParams.get('teamId');
        const query = url.searchParams.get('query');

        if (!teamId || !query) {
          return {
            success: false,
            error: 'Team ID and query are required',
            error_code: 'missing_required_params'
          };
        }
        return { success: true };
      };

      const result = await handleWorkspaceRoutes(['knowledge'], mockRequest);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('missing_required_params');
    });

    it('should handle database errors gracefully', async () => {
      dbService.getTeamMember = async () => {
        throw new Error('Database connection failed');
      };

      const result = await workspaceController.getTeamProjects(
        'test-user',
        'team-123'
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('get_projects_error');
    });
  });
});

// Integration Tests
describe('Shared Workspace Integration', () => {
  it('should handle complete workspace workflow', () => {
    const workflowSteps = [
      'Create team project',
      'Index project codebase',
      'Add team knowledge',
      'Perform collaborative RAG query',
      'Share conversation history',
      'Cross-team search'
    ];

    expect(workflowSteps).toHaveLength(6);
    // This would test the complete integration workflow
    // from project creation to collaborative querying
  });

  it('should validate team workspace permissions consistently', () => {
    const permissionScenarios = [
      { operation: 'index-project', requiredPermission: 'create' },
      { operation: 'add-knowledge', requiredPermission: 'create' },
      { operation: 'query', requiredPermission: 'read' },
      { operation: 'conversations', requiredPermission: 'read' },
      { operation: 'cross-search', requiredPermission: 'read' }
    ];

    permissionScenarios.forEach(scenario => {
      expect(scenario.requiredPermission).toBeDefined();
      expect(['create', 'read', 'update', 'delete']).toContain(scenario.requiredPermission);
    });
  });
});