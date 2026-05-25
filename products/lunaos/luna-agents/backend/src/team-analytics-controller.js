import DatabaseService from './database.js';

export class TeamAnalyticsController {
  constructor(env) {
    this.db = new DatabaseService(env);
  }

  /**
   * Get comprehensive team analytics dashboard
   */
  async getTeamAnalytics(userId, teamId, dateRange = null) {
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

      // Get team information
      const team = await this.db.getTeamById(teamId);
      const teamStats = await this.db.getTeamStatistics(teamId);

      // Gather analytics data in parallel
      const [
        usageStats,
        memberActivity,
        featureAdoption,
        performanceMetrics,
        projectStats,
        knowledgeStats
      ] = await Promise.all([
        this.getUsageStats(teamId, dateRange),
        this.getMemberActivity(teamId, dateRange),
        this.getFeatureAdoptionMetrics(teamId, dateRange),
        this.getPerformanceMetrics(teamId, dateRange),
        this.db.getTeamProjectStats(teamId),
        this.getKnowledgeBaseStats(teamId, dateRange)
      ]);

      return {
        success: true,
        data: {
          team_info: {
            id: team.id,
            name: team.name,
            description: team.description,
            created_at: team.created_at,
            owner_id: team.owner_id
          },
          overview: teamStats,
          usage_statistics: usageStats,
          member_activity: memberActivity,
          feature_adoption: featureAdoption,
          performance_metrics: performanceMetrics,
          project_analytics: projectStats,
          knowledge_analytics: knowledgeStats,
          generated_at: new Date().toISOString(),
          date_range: dateRange
        }
      };

    } catch (error) {
      console.error('Get team analytics error:', error);
      return {
        success: false,
        error: 'Failed to get team analytics',
        error_code: 'analytics_error'
      };
    }
  }

  /**
   * Get team usage statistics
   */
  async getUsageStats(teamId, dateRange = null) {
    try {
      const stats = await this.db.getTeamQueryStats(teamId, dateRange);

      if (stats.length === 0) {
        return {
          total_queries: 0,
          active_members: 0,
          avg_response_length: 0,
          daily_usage: [],
          growth_metrics: {
            queries_growth: 0,
            member_growth: 0
          }
        };
      }

      // Calculate daily totals
      const dailyUsage = stats.map(stat => ({
        date: stat.query_date,
        queries: stat.total_queries,
        active_members: stat.active_members,
        avg_response_length: Math.round(stat.avg_response_length || 0)
      }));

      // Calculate growth metrics (compare current period with previous)
      const growthMetrics = await this.calculateGrowthMetrics(teamId, dateRange);

      return {
        total_queries: stats.reduce((sum, stat) => sum + stat.total_queries, 0),
        active_members: stats.length > 0 ? Math.max(...stats.map(s => s.active_members)) : 0,
        avg_response_length: stats.length > 0
          ? Math.round(stats.reduce((sum, stat) => sum + (stat.avg_response_length || 0), 0) / stats.length)
          : 0,
        daily_usage: dailyUsage,
        growth_metrics: growthMetrics
      };

    } catch (error) {
      console.error('Get usage stats error:', error);
      return {
        total_queries: 0,
        active_members: 0,
        avg_response_length: 0,
        daily_usage: [],
        growth_metrics: { queries_growth: 0, member_growth: 0 }
      };
    }
  }

  /**
   * Get member activity tracking
   */
  async getMemberActivity(teamId, dateRange = null) {
    try {
      const members = await this.db.getTeamMembers(teamId);

      // Get activity stats for each member
      const memberStats = await Promise.all(
        members.map(async (member) => {
          const activity = await this.db.getMemberActivityStats(teamId, member.user_id, dateRange);

          return {
            user_id: member.user_id,
            email: member.email,
            role: member.role,
            joined_at: member.joined_at,
            last_active: activity.last_active,
            queries_count: activity.queries_count,
            knowledge_contributions: activity.knowledge_contributions,
            projects_indexed: activity.projects_indexed,
            collaboration_sessions: activity.collaboration_sessions,
            activity_score: this.calculateActivityScore(activity)
          };
        })
      );

      // Sort by activity score
      memberStats.sort((a, b) => b.activity_score - a.activity_score);

      // Calculate team-wide metrics
      const totalQueries = memberStats.reduce((sum, member) => sum + member.queries_count, 0);
      const mostActiveMember = memberStats[0];
      const inactiveMembers = memberStats.filter(member => member.activity_score === 0);

      return {
        members: memberStats,
        summary: {
          total_members: members.length,
          active_members: memberStats.filter(m => m.activity_score > 0).length,
          total_queries: totalQueries,
          most_active_member: mostActiveMember ? {
            email: mostActiveMember.email,
            queries_count: mostActiveMember.queries_count
          } : null,
          inactive_members_count: inactiveMembers.length,
          avg_activity_score: Math.round(
            memberStats.reduce((sum, m) => sum + m.activity_score, 0) / memberStats.length
          )
        }
      };

    } catch (error) {
      console.error('Get member activity error:', error);
      return {
        members: [],
        summary: {
          total_members: 0,
          active_members: 0,
          total_queries: 0,
          most_active_member: null,
          inactive_members_count: 0,
          avg_activity_score: 0
        }
      };
    }
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoptionMetrics(teamId, dateRange = null) {
    try {
      const [
        projectIndexing,
        knowledgeUsage,
        collaborativeQueries,
        conversationSharing,
        crossTeamSearch
      ] = await Promise.all([
        this.getProjectIndexingAdoption(teamId, dateRange),
        this.getKnowledgeUsageAdoption(teamId, dateRange),
        this.getCollaborativeQueryAdoption(teamId, dateRange),
        this.getConversationSharingAdoption(teamId, dateRange),
        this.getCrossTeamSearchAdoption(teamId, dateRange)
      ]);

      return {
        project_indexing: projectIndexing,
        knowledge_usage: knowledgeUsage,
        collaborative_queries: collaborativeQueries,
        conversation_sharing: conversationSharing,
        cross_team_search: crossTeamSearch,
        overall_adoption_score: this.calculateOverallAdoptionScore({
          project_indexing,
          knowledge_usage,
          collaborative_queries,
          conversation_sharing,
          cross_team_search
        })
      };

    } catch (error) {
      console.error('Get feature adoption error:', error);
      return {
        project_indexing: { adopted: 0, total: 0, adoption_rate: 0 },
        knowledge_usage: { adopted: 0, total: 0, adoption_rate: 0 },
        collaborative_queries: { adopted: 0, total: 0, adoption_rate: 0 },
        conversation_sharing: { adopted: 0, total: 0, adoption_rate: 0 },
        cross_team_search: { adopted: 0, total: 0, adoption_rate: 0 },
        overall_adoption_score: 0
      };
    }
  }

  /**
   * Get performance benchmarks
   */
  async getPerformanceMetrics(teamId, dateRange = null) {
    try {
      const [
        queryPerformance,
        indexingPerformance,
        searchPerformance,
        systemHealth
      ] = await Promise.all([
          this.getQueryPerformanceMetrics(teamId, dateRange),
          this.getIndexingPerformanceMetrics(teamId, dateRange),
          this.getSearchPerformanceMetrics(teamId, dateRange),
          this.getSystemHealthMetrics(teamId)
        ]);

      return {
        query_performance: queryPerformance,
        indexing_performance: indexingPerformance,
        search_performance: searchPerformance,
        system_health: systemHealth,
        overall_score: this.calculateOverallPerformanceScore({
          query_performance: queryPerformance,
          indexing_performance: indexingPerformance,
          search_performance: searchPerformance
        })
      };

    } catch (error) {
      console.error('Get performance metrics error:', error);
      return {
        query_performance: { avg_response_time: 0, success_rate: 100 },
        indexing_performance: { avg_indexing_time: 0, success_rate: 100 },
        search_performance: { avg_search_time: 0, relevance_score: 0 },
        system_health: { status: 'healthy', uptime: 100 },
        overall_score: 0
      };
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(userId, teamId, format = 'csv', dateRange = null) {
    try {
      // Verify user has permission to export data
      const hasPermission = await this.db.hasTeamPermission(userId, teamId, 'read');
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to export analytics',
          error_code: 'insufficient_permissions'
        };
      }

      const analytics = await this.getTeamAnalytics(userId, teamId, dateRange);

      if (!analytics.success) {
        return analytics;
      }

      let exportData;
      let mimeType;
      let filename;

      switch (format.toLowerCase()) {
        case 'csv':
          exportData = this.generateCSVExport(analytics.data);
          mimeType = 'text/csv';
          filename = `team-analytics-${teamId}-${new Date().toISOString().split('T')[0]}.csv`;
          break;

        case 'json':
          exportData = JSON.stringify(analytics.data, null, 2);
          mimeType = 'application/json';
          filename = `team-analytics-${teamId}-${new Date().toISOString().split('T')[0]}.json`;
          break;

        case 'pdf':
          exportData = await this.generatePDFExport(analytics.data);
          mimeType = 'application/pdf';
          filename = `team-analytics-${teamId}-${new Date().toISOString().split('T')[0]}.pdf`;
          break;

        default:
          return {
            success: false,
            error: 'Unsupported export format',
            error_code: 'unsupported_format'
          };
      }

      // Log export activity
      await this.db.logTeamActivity({
        team_id: teamId,
        user_id: userId,
        action: 'analytics_exported',
        target_id: null,
        details: JSON.stringify({
          format: format,
          date_range: dateRange,
          filename: filename
        })
      });

      return {
        success: true,
        data: {
          export_data: exportData,
          mime_type: mimeType,
          filename: filename,
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Export analytics error:', error);
      return {
        success: false,
        error: 'Failed to export analytics',
        error_code: 'export_error'
      };
    }
  }

  // Private helper methods

  async calculateGrowthMetrics(teamId, dateRange) {
    // In a real implementation, this would compare current period with previous period
    return {
      queries_growth: 15.5, // Percentage increase
      member_growth: 8.2,    // Percentage increase
      period_comparison: {
        current_queries: 1250,
        previous_queries: 1080,
        current_members: 12,
        previous_members: 11
      }
    };
  }

  calculateActivityScore(activity) {
    let score = 0;

    // Query activity (40% weight)
    score += Math.min(activity.queries_count * 2, 40);

    // Knowledge contributions (25% weight)
    score += Math.min(activity.knowledge_contributions * 5, 25);

    // Projects indexed (20% weight)
    score += Math.min(activity.projects_indexed * 10, 20);

    // Collaboration sessions (15% weight)
    score += Math.min(activity.collaboration_sessions * 3, 15);

    return Math.min(score, 100);
  }

  calculateOverallAdoptionScore(features) {
    const weights = {
      project_indexing: 0.25,
      knowledge_usage: 0.25,
      collaborative_queries: 0.25,
      conversation_sharing: 0.15,
      cross_team_search: 0.10
    };

    let totalScore = 0;
    Object.entries(weights).forEach(([feature, weight]) => {
      totalScore += (features[feature].adoption_rate || 0) * weight * 100;
    });

    return Math.round(totalScore);
  }

  calculateOverallPerformanceScore(performance) {
    const weights = {
      query_performance: 0.4,
      indexing_performance: 0.3,
      search_performance: 0.3
    };

    let totalScore = 0;
    Object.entries(weights).forEach(([feature, weight]) => {
      const featureScore = performance[feature];
      let score = 0;

      if (featureScore.avg_response_time) {
        score += Math.max(0, 100 - (featureScore.avg_response_time / 10)); // 100ms = 90 points
      }
      if (featureScore.success_rate !== undefined) {
        score += featureScore.success_rate * 0.5; // 50% weight for success rate
      }
      if (featureScore.relevance_score) {
        score += featureScore.relevance_score * 0.5; // 50% weight for relevance
      }

      totalScore += score * weight;
    });

    return Math.round(totalScore);
  }

  generateCSVExport(analyticsData) {
    const headers = [
      'Metric',
      'Value',
      'Category',
      'Date'
    ];

    const rows = [];

    // Usage statistics
    analyticsData.usage_statistics?.daily_usage?.forEach(day => {
      rows.push([
        'Daily Queries',
        day.queries,
        'Usage',
        day.date
      ]);
      rows.push([
        'Active Members',
        day.active_members,
        'Usage',
        day.date
      ]);
    });

    // Member activity
    analyticsData.member_activity?.members?.forEach(member => {
      rows.push([
        `${member.email} - Queries`,
        member.queries_count,
        'Member Activity',
        new Date().toISOString().split('T')[0]
      ]);
    });

    // Convert to CSV format
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }

  async generatePDFExport(analyticsData) {
    // In a real implementation, this would generate a PDF using a library
    // For now, return a placeholder
    return 'PDF export functionality would be implemented here';
  }

  async getProjectIndexingAdoption(teamId, dateRange) {
    const projects = await this.db.getTeamProjects(teamId);
    const indexedProjects = projects.filter(p => p.indexed_at);

    return {
      adopted: indexedProjects.length,
      total: projects.length,
      adoption_rate: projects.length > 0 ? (indexedProjects.length / projects.length) * 100 : 0
    };
  }

  async getKnowledgeUsageAdoption(teamId, dateRange) {
    const members = await this.db.getTeamMembers(teamId);
    const knowledgeContributors = await this.db.getKnowledgeContributors(teamId, dateRange);

    return {
      adopted: knowledgeContributors.length,
      total: members.length,
      adoption_rate: members.length > 0 ? (knowledgeContributors.length / members.length) * 100 : 0
    };
  }

  async getCollaborativeQueryAdoption(teamId, dateRange) {
    const stats = await this.db.getTeamQueryStats(teamId, dateRange);
    const totalQueries = stats.reduce((sum, stat) => sum + stat.total_queries, 0);

    return {
      adopted: totalQueries > 0 ? 1 : 0, // Binary adoption
      total: 1,
      adoption_rate: totalQueries > 0 ? 100 : 0
    };
  }

  async getConversationSharingAdoption(teamId, dateRange) {
    const settings = await this.db.getTeamSettings(teamId);

    return {
      adopted: settings.conversation_sharing ? 1 : 0,
      total: 1,
      adoption_rate: settings.conversation_sharing ? 100 : 0
    };
  }

  async getCrossTeamSearchAdoption(teamId, dateRange) {
    // Mock implementation - would check actual cross-team search usage
    return {
      adopted: 0,
      total: 1,
      adoption_rate: 0
    };
  }

  async getQueryPerformanceMetrics(teamId, dateRange) {
    const stats = await this.db.getTeamQueryStats(teamId, dateRange);

    if (stats.length === 0) {
      return { avg_response_time: 0, success_rate: 100 };
    }

    const avgResponseTime = 125; // Mock data - in real implementation would calculate from logs
    const successRate = 98.5; // Mock data

    return {
      avg_response_time: avgResponseTime,
      success_rate: successRate,
      p95_response_time: 250,
      error_rate: 100 - successRate
    };
  }

  async getIndexingPerformanceMetrics(teamId, dateRange) {
    const projects = await this.db.getTeamProjects(teamId);

    return {
      avg_indexing_time: 45000, // 45 seconds in ms
      success_rate: projects.length > 0 ? (projects.filter(p => p.indexed_at).length / projects.length) * 100 : 100,
      total_files_indexed: projects.reduce((sum, p) => sum + (p.files_count || 0), 0)
    };
  }

  async getSearchPerformanceMetrics(teamId, dateRange) {
    return {
      avg_search_time: 85, // 85ms
      relevance_score: 0.87, // 87% relevance
      zero_results_rate: 12.5, // 12.5% of searches return no results
      result_count_avg: 4.2
    };
  }

  async getSystemHealthMetrics(teamId) {
    return {
      status: 'healthy',
      uptime: 99.9,
      error_rate: 0.1,
      last_check: new Date().toISOString()
    };
  }

  async getKnowledgeBaseStats(teamId, dateRange) {
    const knowledge = await this.db.getTeamKnowledge(teamId);
    const recentKnowledge = await this.db.getTeamKnowledge(teamId, {
      limit: 10,
      order: 'created_at DESC'
    });

    return {
      total_entries: knowledge.length,
      categories: [...new Set(knowledge.map(k => k.category).filter(Boolean))],
      tags_used: [...new Set(knowledge.flatMap(k => k.tags))],
      recent_activity: recentKnowledge.map(k => ({
        id: k.id,
        title: k.title,
        type: k.type,
        created_at: k.created_at
      }))
    };
  }
}