import DatabaseService from './database.js';

export class SharedWorkspaceController {
  constructor(env) {
    this.db = new DatabaseService(env);
    this.vectorDB = env.VECTOR_DB; // Pinecone/Qdrant client
    this.cache = env.CACHE;
  }

  /**
   * Index team project codebase
   */
  async indexTeamProject(userId, teamId, projectData) {
    try {
      // Verify user has permission to index projects
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'create');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to index team projects',
          error_code: 'insufficient_permissions'
        };
      }

      // Validate project data
      if (!projectData.name || !projectData.repository_url) {
        return {
          success: false,
          error: 'Project name and repository URL are required',
          error_code: 'missing_project_data'
        };
      }

      // Check team member limits and storage
      const teamSettings = await this.db.getTeamSettings(teamId);
      const existingProjects = await this.db.getTeamProjects(teamId);

      if (existingProjects.length >= teamSettings.max_projects) {
        return {
          success: false,
          error: 'Project limit reached',
          error_code: 'project_limit_reached'
        };
      }

      // Create project record
      const project = await this.db.createTeamProject({
        team_id: teamId,
        name: projectData.name,
        description: projectData.description,
        repository_url: projectData.repository_url,
        language: projectData.language,
        settings: projectData.settings || {}
      });

      // Start indexing process (in real implementation, this would be a background job)
      await this.startIndexingProcess(project.id, projectData);

      // Log team activity
      await this.db.logTeamActivity({
        team_id: teamId,
        user_id: userId,
        action: 'project_indexed',
        target_id: project.id,
        details: JSON.stringify({
          project_name: projectData.name,
          repository_url: projectData.repository_url
        })
      });

      return {
        success: true,
        data: {
          project_id: project.id,
          name: project.name,
          status: 'indexing',
          message: 'Project indexing started'
        }
      };

    } catch (error) {
      console.error('Index team project error:', error);
      return {
        success: false,
        error: 'Failed to index team project',
        error_code: 'indexing_error'
      };
    }
  }

  /**
   * Get team projects
   */
  async getTeamProjects(userId, teamId) {
    try {
      // Verify user is team member
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'Access denied',
          error_code: 'access_denied'
        };
      }

      const projects = await this.db.getTeamProjects(teamId);

      // Add indexing status and statistics
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          const stats = await this.getProjectIndexingStats(project.id);
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            repository_url: project.repository_url,
            language: project.language,
            indexed_at: project.indexed_at,
            last_activity: project.last_activity,
            created_at: project.created_at,
            indexing_status: stats.status,
            files_count: stats.files_count,
            last_indexed: stats.last_indexed
          };
        })
      );

      return {
        success: true,
        data: projectsWithStats
      };

    } catch (error) {
      console.error('Get team projects error:', error);
      return {
        success: false,
        error: 'Failed to get team projects',
        error_code: 'get_projects_error'
      };
    }
  }

  /**
   * Collaborative RAG query with team context
   */
  async collaborativeRAGQuery(userId, teamId, query, options = {}) {
    try {
      // Verify user is team member
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'Access denied',
          error_code: 'access_denied'
        };
      }

      // Check team settings for RAG sharing
      const teamSettings = await this.db.getTeamSettings(teamId);
      if (!teamSettings.rag_sharing) {
        return {
          success: false,
          error: 'Team RAG sharing is disabled',
          error_code: 'rag_sharing_disabled'
        };
      }

      // Build team context
      const teamContext = await this.buildTeamContext(teamId, userId, options);

      // Search across team projects and knowledge base
      const searchResults = await this.searchTeamKnowledge(teamId, query, {
        includeProjects: options.includeProjects !== false,
        includeConversations: options.includeConversations !== false,
        includeSharedDocs: options.includeSharedDocs !== false,
        maxResults: options.maxResults || 10
      });

      // Generate response with team context
      const response = await this.generateTeamResponse(query, searchResults, teamContext);

      // Log query for analytics
      await this.logTeamQuery(teamId, userId, query, {
        results_count: searchResults.length,
        context_sources: searchResults.map(r => r.source),
        response_length: response.response?.length || 0
      });

      return {
        success: true,
        data: {
          response: response.response,
          sources: searchResults,
          context: {
            team_name: teamContext.team_name,
            projects_available: teamContext.projects.length,
            member_count: teamContext.member_count
          },
          query_id: response.query_id
        }
      };

    } catch (error) {
      console.error('Collaborative RAG query error:', error);
      return {
        success: false,
        error: 'Failed to process collaborative query',
        error_code: 'query_error'
      };
    }
  }

  /**
   * Get shared conversation history
   */
  async getSharedConversations(userId, teamId, options = {}) {
    try {
      // Verify user is team member
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'Access denied',
          error_code: 'access_denied'
        };
      }

      // Check team settings for conversation sharing
      const teamSettings = await this.db.getTeamSettings(teamId);
      if (!teamSettings.conversation_sharing && member.role !== 'owner' && member.role !== 'admin') {
        return {
          success: false,
          error: 'Conversation sharing is disabled',
          error_code: 'conversation_sharing_disabled'
        };
      }

      const conversations = await this.db.getTeamConversations(teamId, {
        limit: options.limit || 50,
        offset: options.offset || 0,
        search: options.search,
        date_range: options.date_range,
        member_id: options.member_id
      });

      // Add member information to conversations
      const conversationsWithMembers = await Promise.all(
        conversations.map(async (conv) => {
          const memberInfo = await this.db.getUserByUserId(conv.user_id);
          return {
            ...conv,
            member_email: memberInfo?.email,
            member_name: memberInfo?.user_id
          };
        })
      );

      return {
        success: true,
        data: {
          conversations: conversationsWithMembers,
          total_count: conversations.length,
          has_more: conversations.length === (options.limit || 50)
        }
      };

    } catch (error) {
      console.error('Get shared conversations error:', error);
      return {
        success: false,
        error: 'Failed to get shared conversations',
        error_code: 'get_conversations_error'
      };
    }
  }

  /**
   * Add team knowledge base entry
   */
  async addTeamKnowledge(userId, teamId, knowledgeData) {
    try {
      // Verify user has permission to add knowledge
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'create');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to add team knowledge',
          error_code: 'insufficient_permissions'
        };
      }

      // Validate knowledge data
      if (!knowledgeData.title || !knowledgeData.content) {
        return {
          success: false,
          error: 'Title and content are required',
          error_code: 'missing_knowledge_data'
        };
      }

      // Create knowledge entry
      const knowledge = await this.db.createTeamKnowledge({
        team_id: teamId,
        title: knowledgeData.title,
        content: knowledgeData.content,
        type: knowledgeData.type || 'document',
        tags: knowledgeData.tags || [],
        category: knowledgeData.category,
        created_by: userId
      });

      // Index in vector database for search
      await this.indexKnowledgeEntry(knowledge);

      // Log activity
      await this.db.logTeamActivity({
        team_id: teamId,
        user_id: userId,
        action: 'knowledge_added',
        target_id: knowledge.id,
        details: JSON.stringify({
          title: knowledgeData.title,
          type: knowledgeData.type
        })
      });

      return {
        success: true,
        data: {
          id: knowledge.id,
          title: knowledge.title,
          type: knowledge.type,
          indexed: true
        }
      };

    } catch (error) {
      console.error('Add team knowledge error:', error);
      return {
        success: false,
        error: 'Failed to add team knowledge',
        error_code: 'add_knowledge_error'
      };
    }
  }

  /**
   * Search team knowledge base
   */
  async searchTeamKnowledgeBase(userId, teamId, query, options = {}) {
    try {
      // Verify user is team member
      const member = await this.db.getTeamMember(teamId, userId);
      if (!member || member.status !== 'joined') {
        return {
          success: false,
          error: 'Access denied',
          error_code: 'access_denied'
        };
      }

      // Search across team knowledge base
      const searchResults = await this.performKnowledgeSearch(teamId, query, {
        type: options.type,
        category: options.category,
        tags: options.tags,
        max_results: options.max_results || 20,
        include_content: options.include_content !== false
      });

      return {
        success: true,
        data: {
          results: searchResults,
          query: query,
          total_found: searchResults.length
        }
      };

    } catch (error) {
      console.error('Search team knowledge error:', error);
      return {
        success: false,
        error: 'Failed to search team knowledge',
        error_code: 'search_knowledge_error'
      };
    }
  }

  /**
   * Cross-team search capabilities
   */
  async crossTeamSearch(userId, query, teamIds = []) {
    try {
      // Get user's teams if none specified
      if (teamIds.length === 0) {
        const userTeams = await this.db.getUserTeams(userId);
        teamIds = userTeams.map(team => team.id);
      }

      // Verify user has access to all specified teams
      const accessibleTeams = [];
      for (const teamId of teamIds) {
        const member = await this.db.getTeamMember(teamId, userId);
        if (member && member.status === 'joined') {
          accessibleTeams.push(teamId);
        }
      }

      if (accessibleTeams.length === 0) {
        return {
          success: false,
          error: 'No accessible teams found',
          error_code: 'no_accessible_teams'
        };
      }

      // Perform parallel search across teams
      const searchPromises = accessibleTeams.map(async (teamId) => {
        try {
          const results = await this.searchTeamKnowledge(teamId, query, {
            max_results: 5
          });
          return {
            team_id: teamId,
            team_name: results.team_name || 'Unknown Team',
            results: results.results || []
          };
        } catch (error) {
          console.error(`Search error for team ${teamId}:`, error);
          return {
            team_id: teamId,
            team_name: 'Error',
            results: [],
            error: error.message
          };
        }
      });

      const searchResults = await Promise.all(searchPromises);

      // Aggregate and rank results
      const aggregatedResults = this.aggregateSearchResults(searchResults, query);

      return {
        success: true,
        data: {
          query: query,
          teams_searched: accessibleTeams.length,
          total_results: aggregatedResults.length,
          results: aggregatedResults,
          team_breakdown: searchResults
        }
      };

    } catch (error) {
      console.error('Cross-team search error:', error);
      return {
        success: false,
        error: 'Failed to perform cross-team search',
        error_code: 'cross_search_error'
      };
    }
  }

  // Private helper methods

  async startIndexingProcess(projectId, projectData) {
    // In a real implementation, this would:
    // 1. Clone the repository
    // 2. Analyze code structure
    // 3. Extract documentation
    // 4. Create vector embeddings
    // 5. Store in vector database
    console.log(`Starting indexing for project ${projectId}`);

    // Simulate indexing completion
    setTimeout(async () => {
      await this.db.updateTeamProject(projectId, {
        indexed_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      });
    }, 5000);
  }

  async getProjectIndexingStats(projectId) {
    // Mock implementation - in real scenario, query vector database
    return {
      status: 'indexed',
      files_count: 150,
      last_indexed: new Date().toISOString()
    };
  }

  async buildTeamContext(teamId, userId, options) {
    const team = await this.db.getTeamById(teamId);
    const projects = await this.db.getTeamProjects(teamId);
    const members = await this.db.getTeamMembers(teamId);

    return {
      team_id: teamId,
      team_name: team.name,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        language: p.language
      })),
      member_count: members.length,
      user_role: members.find(m => m.user_id === userId)?.role
    };
  }

  async searchTeamKnowledge(teamId, query, options) {
    // Mock implementation - in real scenario, query vector database
    return [
      {
        id: 'result-1',
        content: 'Sample code from project...',
        source: 'project',
        project_id: 'proj-1',
        score: 0.95,
        metadata: { file: 'src/main.js', line: 42 }
      },
      {
        id: 'result-2',
        content: 'Team documentation entry...',
        source: 'knowledge',
        knowledge_id: 'know-1',
        score: 0.87,
        metadata: { type: 'documentation', category: 'api' }
      }
    ];
  }

  async generateTeamResponse(query, searchResults, teamContext) {
    // Mock implementation - in real scenario, use LLM
    return {
      response: `Based on your team's knowledge base, here's what I found for "${query}"...`,
      query_id: this.generateId(),
      context_used: teamContext.team_name
    };
  }

  async logTeamQuery(teamId, userId, query, metadata) {
    // Log query for analytics and audit trail
    await this.db.logTeamActivity({
      team_id: teamId,
      user_id: userId,
      action: 'rag_query',
      target_id: null,
      details: JSON.stringify({
        query: query.substring(0, 100), // Truncate for storage
        ...metadata
      })
    });
  }

  async indexKnowledgeEntry(knowledge) {
    // In real implementation, create embeddings and store in vector database
    console.log(`Indexing knowledge entry: ${knowledge.id}`);
  }

  async performKnowledgeSearch(teamId, query, options) {
    // Mock implementation
    return [
      {
        id: 'know-1',
        title: 'API Documentation',
        content: 'Comprehensive API documentation...',
        type: 'documentation',
        category: 'api',
        score: 0.92,
        created_at: '2025-01-01T00:00:00Z'
      }
    ];
  }

  aggregateSearchResults(searchResults, query) {
    // Aggregate and rank results from multiple teams
    const allResults = searchResults
      .filter(team => team.results.length > 0)
      .flatMap(team =>
        team.results.map(result => ({
          ...result,
          team_id: team.team_id,
          team_name: team.team_name
        }))
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Limit top results

    return allResults;
  }

  generateId() {
    return crypto.randomUUID();
  }
}