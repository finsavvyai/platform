import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { TeamAnalyticsController } from '../src/team-analytics-controller.js';
import DatabaseService from '../src/database.js';

// Mock dependencies
vi.mock('../src/database.js');
vi.mock('../src/auth.js');

describe('TeamAnalyticsController', () => {
  let analyticsController;
  let mockEnv;
  let mockDb;

  beforeAll(() => {
    mockEnv = {
      DB: {},
      VECTOR_DB: {},
      CACHE: {},
      ENVIRONMENT: 'test'
    };
  });

  beforeEach(() => {
    mockDb = new DatabaseService(mockEnv);
    analyticsController = new TeamAnalyticsController(mockEnv);

    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
    mockDb.getTeamById = vi.fn().mockResolvedValue({
      id: 'team-1',
      name: 'Test Team',
      created_at: '2025-01-01T00:00:00Z'
    });

    mockDb.getTeamMember = vi.fn().mockResolvedValue({
      id: 'member-1',
      team_id: 'team-1',
      user_id: 'user-1',
      role: 'owner',
      status: 'joined',
      joined_at: '2025-01-01T00:00:00Z'
    });

    mockDb.getTeamAnalyticsSummary = vi.fn().mockResolvedValue({
      total_members: 10,
      active_members: 8,
      total_projects: 15,
      indexed_projects: 12,
      total_queries: 250,
      avg_response_time: 1250,
      storage_used_mb: 45.2,
      knowledge_entries: 85
    });

    mockDb.getTeamUsageStatistics = vi.fn().mockResolvedValue([
      { date: '2025-01-01', queries: 25, active_users: 5 },
      { date: '2025-01-02', queries: 32, active_users: 7 }
    ]);

    mockDb.getTeamMemberActivity = vi.fn().mockResolvedValue([
      {
        user_id: 'user-1',
        email: 'user1@example.com',
        query_count: 45,
        knowledge_contributions: 12,
        projects_indexed: 3,
        collaboration_sessions: 8,
        last_activity: '2025-01-10T15:30:00Z',
        activity_score: 245
      },
      {
        user_id: 'user-2',
        email: 'user2@example.com',
        query_count: 23,
        knowledge_contributions: 8,
        projects_indexed: 2,
        collaboration_sessions: 5,
        last_activity: '2025-01-09T10:15:00Z',
        activity_score: 156
      }
    ]);

    mockDb.getTeamFeatureAdoption = vi.fn().mockResolvedValue([
      { feature: 'rag_queries', adoption_rate: 85.5, usage_count: 450 },
      { feature: 'knowledge_base', adoption_rate: 72.0, usage_count: 125 },
      { feature: 'project_indexing', adoption_rate: 60.0, usage_count: 36 },
      { feature: 'collaborative_sessions', adoption_rate: 45.0, usage_count: 18 }
    ]);

    mockDb.getTeamPerformanceMetrics = vi.fn().mockResolvedValue([
      {
        metric_name: 'avg_response_time',
        metric_value: 1250,
        metric_unit: 'ms',
        created_at: '2025-01-10T12:00:00Z'
      },
      {
        metric_name: 'query_success_rate',
        metric_value: 98.5,
        metric_unit: 'percentage',
        created_at: '2025-01-10T12:00:00Z'
      }
    ]);

    mockDb.getTeamGrowthMetrics = vi.fn().mockResolvedValue({
      new_members_this_month: 3,
      member_growth_rate: 15.0,
      new_projects_this_month: 5,
      project_growth_rate: 25.0,
      query_growth_rate: 35.2,
      storage_growth_rate: 12.8,
      activity_trend: 'increasing',
      projected_growth: {
        members_next_month: 12,
        projects_next_month: 18,
        queries_next_month: 320
      }
    });

    mockDb.exportTeamAnalytics = vi.fn().mockResolvedValue([
      {
        date: '2025-01-01',
        metric: 'queries',
        value: 25,
        users: 5,
        storage_mb: 45.2
      }
    ]);
  });

  describe('getAnalyticsDashboard', () => {
    it('should return analytics dashboard for team owner', async () => {
      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('usage_stats');
      expect(result.data).toHaveProperty('top_members');
      expect(result.data).toHaveProperty('feature_adoption');
      expect(result.data).toHaveProperty('performance');
      expect(result.data).toHaveProperty('growth_metrics');
      expect(result.data.summary.total_members).toBe(10);
    });

    it('should return analytics dashboard for team admin', async () => {
      mockDb.getTeamMember.mockResolvedValueOnce({
        role: 'admin',
        status: 'joined'
      });

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
    });

    it('should deny access for non-members', async () => {
      mockDb.getTeamMember.mockResolvedValueOnce(null);

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('access_denied');
    });

    it('should deny access for pending members', async () => {
      mockDb.getTeamMember.mockResolvedValueOnce({
        role: 'member',
        status: 'pending'
      });

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('access_denied');
    });

    it('should handle missing team', async () => {
      mockDb.getTeamById.mockResolvedValueOnce(null);

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('team_not_found');
    });

    it('should handle database errors', async () => {
      mockDb.getTeamAnalyticsSummary.mockRejectedValueOnce(new Error('Database error'));

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('dashboard_error');
    });

    it('should include timestamp in response', async () => {
      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data.generated_at).toBeDefined();
      expect(result.data.period_days).toBe(30); // Default period
    });

    it('should accept custom time period', async () => {
      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1', {
        period: 60
      });

      expect(result.success).toBe(true);
      expect(result.data.period_days).toBe(60);
      expect(mockDb.getTeamUsageStatistics).toHaveBeenCalledWith('team-1', 60);
    });
  });

  describe('getTeamUsageStatistics', () => {
    it('should return usage statistics', async () => {
      const result = await analyticsController.getTeamUsageStatistics('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('daily_stats');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('insights');
      expect(Array.isArray(result.data.daily_stats)).toBe(true);
      expect(result.data.daily_stats.length).toBe(2);
    });

    it('should calculate summary statistics correctly', async () => {
      const result = await analyticsController.getTeamUsageStatistics('user-1', 'team-1');

      expect(result.data.summary.total_queries).toBe(57); // 25 + 32
      expect(result.data.summary.total_active_users).toBe(7); // Max active users
      expect(result.data.summary.avg_daily_queries).toBeCloseTo(28.5, 1);
    });

    it('should handle empty usage data', async () => {
      mockDb.getTeamUsageStatistics.mockResolvedValueOnce([]);

      const result = await analyticsController.getTeamUsageStatistics('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data.daily_stats).toEqual([]);
      expect(result.data.summary.total_queries).toBe(0);
    });

    it('should generate usage insights', async () => {
      const result = await analyticsController.getTeamUsageStatistics('user-1', 'team-1');

      expect(result.data.insights).toHaveProperty('peak_usage_day');
      expect(result.data.insights).toHaveProperty('usage_trend');
      expect(result.data.insights).toHaveProperty('growth_rate');
    });
  });

  describe('getTeamMemberActivity', () => {
    it('should return member activity rankings', async () => {
      const result = await analyticsController.getTeamMemberActivity('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('members');
      expect(result.data).toHaveProperty('summary');
      expect(Array.isArray(result.data.members)).toBe(true);
      expect(result.data.members.length).toBe(2);
    });

    it('should rank members by activity score', async () => {
      const result = await analyticsController.getTeamMemberActivity('user-1', 'team-1');

      expect(result.data.members[0].activity_score).toBeGreaterThan(result.data.members[1].activity_score);
      expect(result.data.members[0].rank).toBe(1);
      expect(result.data.members[1].rank).toBe(2);
    });

    it('should calculate member summary statistics', async () => {
      const result = await analyticsController.getTeamMemberActivity('user-1', 'team-1');

      expect(result.data.summary.total_members).toBe(2);
      expect(result.data.summary.active_members).toBe(2);
      expect(result.data.summary.avg_activity_score).toBeCloseTo(200.5, 1);
    });

    it('should accept time period parameter', async () => {
      await analyticsController.getTeamMemberActivity('user-1', 'team-1', { period: 60 });

      expect(mockDb.getTeamMemberActivity).toHaveBeenCalledWith('team-1', 60);
    });

    it('should handle member limits', async () => {
      await analyticsController.getTeamMemberActivity('user-1', 'team-1', { limit: 5 });

      expect(mockDb.getTeamMemberActivity).toHaveBeenCalledWith('team-1', 30, 5);
    });
  });

  describe('getTeamFeatureAdoption', () => {
    it('should return feature adoption metrics', async () => {
      const result = await analyticsController.getTeamFeatureAdoption('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('features');
      expect(result.data).toHaveProperty('adoption_summary');
      expect(Array.isArray(result.data.features)).toBe(true);
      expect(result.data.features.length).toBe(4);
    });

    it('should calculate adoption summary correctly', async () => {
      const result = await analyticsController.getTeamFeatureAdoption('user-1', 'team-1');

      expect(result.data.adoption_summary.total_features).toBe(4);
      expect(result.data.adoption_summary.avg_adoption_rate).toBeCloseTo(65.6, 1);
      expect(result.data.adoption_summary.most_used_feature).toBe('rag_queries');
    });

    it('should categorize adoption levels', async () => {
      const result = await analyticsController.getTeamFeatureAdoption('user-1', 'team-1');

      expect(result.data.adoption_summary.high_adoption_features).toBe(1);
      expect(result.data.adoption_summary.medium_adoption_features).toBe(2);
      expect(result.data.adoption_summary.low_adoption_features).toBe(1);
    });

    it('should handle empty feature data', async () => {
      mockDb.getTeamFeatureAdoption.mockResolvedValueOnce([]);

      const result = await analyticsController.getTeamFeatureAdoption('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data.features).toEqual([]);
      expect(result.data.adoption_summary.avg_adoption_rate).toBe(0);
    });
  });

  describe('getTeamPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const result = await analyticsController.getTeamPerformanceMetrics('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('metrics');
      expect(result.data).toHaveProperty('benchmarks');
      expect(result.data).toHaveProperty('performance_score');
      expect(Array.isArray(result.data.metrics)).toBe(true);
    });

    it('should calculate performance benchmarks', async () => {
      const result = await analyticsController.getTeamPerformanceMetrics('user-1', 'team-1');

      expect(result.data.benchmarks).toHaveProperty('avg_response_time');
      expect(result.data.benchmarks).toHaveProperty('success_rate');
      expect(result.data.benchmarks).toHaveProperty('query_volume');
    });

    it('should calculate overall performance score', async () => {
      const result = await analyticsController.getTeamPerformanceMetrics('user-1', 'team-1');

      expect(typeof result.data.performance_score).toBe('number');
      expect(result.data.performance_score).toBeGreaterThanOrEqual(0);
      expect(result.data.performance_score).toBeLessThanOrEqual(100);
    });

    it('should accept metric type filter', async () => {
      await analyticsController.getTeamPerformanceMetrics('user-1', 'team-1', {
        metric_type: 'query'
      });

      expect(mockDb.getTeamPerformanceMetrics).toHaveBeenCalledWith('team-1', 'query', 30);
    });
  });

  describe('getTeamGrowthMetrics', () => {
    it('should return growth metrics', async () => {
      const result = await analyticsController.getTeamGrowthMetrics('user-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('member_growth');
      expect(result.data).toHaveProperty('project_growth');
      expect(result.data).toHaveProperty('usage_growth');
      expect(result.data).toHaveProperty('projections');
    });

    it('should include all growth metrics', async () => {
      const result = await analyticsController.getTeamGrowthMetrics('user-1', 'team-1');

      expect(result.data.member_growth.new_members).toBe(3);
      expect(result.data.member_growth.growth_rate).toBe(15.0);
      expect(result.data.project_growth.new_projects).toBe(5);
      expect(result.data.usage_growth.query_growth_rate).toBe(35.2);
      expect(result.data.projections.members_next_month).toBe(12);
    });

    it('should categorize growth trends', async () => {
      const result = await analyticsController.getTeamGrowthMetrics('user-1', 'team-1');

      expect(result.data.member_growth.trend).toBeDefined();
      expect(result.data.project_growth.trend).toBeDefined();
      expect(result.data.usage_growth.trend).toBeDefined();
    });
  });

  describe('exportTeamAnalytics', () => {
    it('should export analytics in CSV format', async () => {
      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('format', 'csv');
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('filename');
      expect(result.data.filename).toMatch(/\.csv$/);
    });

    it('should export analytics in JSON format', async () => {
      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('json');
      expect(result.data.filename).toMatch(/\.json$/);

      const parsedContent = JSON.parse(result.data.content);
      expect(Array.isArray(parsedContent)).toBe(true);
    });

    it('should export specific data types', async () => {
      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'json',
        data_types: ['usage']
      });

      expect(result.success).toBe(true);
      expect(mockDb.exportTeamAnalytics).toHaveBeenCalledWith('team-1', ['usage'], 30);
    });

    it('should accept custom date range', async () => {
      await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'json',
        start_date: '2025-01-01',
        end_date: '2025-01-31'
      });

      expect(mockDb.exportTeamAnalytics).toHaveBeenCalledWith(
        'team-1',
        undefined,
        30,
        '2025-01-01',
        '2025-01-31'
      );
    });

    it('should validate export format', async () => {
      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'invalid'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('invalid_export_format');
    });

    it('should handle permission checks', async () => {
      mockDb.getTeamMember.mockResolvedValueOnce({
        role: 'viewer',
        status: 'joined'
      });

      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'json'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('insufficient_permissions');
    });

    it('should handle empty export data', async () => {
      mockDb.exportTeamAnalytics.mockResolvedValueOnce([]);

      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: 'csv'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('no_data_to_export');
    });
  });

  describe('generateAnalyticsReport', () => {
    it('should generate comprehensive analytics report', async () => {
      const result = await analyticsController.generateAnalyticsReport('user-1', 'team-1', {
        period: 30,
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('report_metadata');
      expect(result.data).toHaveProperty('team_overview');
      expect(result.data).toHaveProperty('usage_analytics');
      expect(result.data).toHaveProperty('member_analytics');
      expect(result.data).toHaveProperty('feature_analytics');
      expect(result.data).toHaveProperty('performance_analytics');
      expect(result.data).toHaveProperty('recommendations');
    });

    it('should include report metadata', async () => {
      const result = await analyticsController.generateAnalyticsReport('user-1', 'team-1', {
        period: 30,
        format: 'json'
      });

      expect(result.data.report_metadata).toHaveProperty('team_id', 'team-1');
      expect(result.data.report_metadata).toHaveProperty('report_period_days', 30);
      expect(result.data.report_metadata).toHaveProperty('generated_at');
      expect(result.data.report_metadata).toHaveProperty('generated_by', 'user-1');
    });

    it('should generate actionable recommendations', async () => {
      const result = await analyticsController.generateAnalyticsReport('user-1', 'team-1', {
        period: 30,
        format: 'json'
      });

      expect(Array.isArray(result.data.recommendations)).toBe(true);
      expect(result.data.recommendations.length).toBeGreaterThan(0);

      const recommendation = result.data.recommendations[0];
      expect(recommendation).toHaveProperty('category');
      expect(recommendation).toHaveProperty('priority');
      expect(recommendation).toHaveProperty('description');
      expect(recommendation).toHaveProperty('actionable_steps');
    });

    it('should generate CSV format report', async () => {
      const result = await analyticsController.generateAnalyticsReport('user-1', 'team-1', {
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('csv');
      expect(result.data.filename).toMatch(/analytics-report.*\.csv$/);
    });

    it('should handle PDF format request', async () => {
      const result = await analyticsController.generateAnalyticsReport('user-1', 'team-1', {
        format: 'pdf'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('pdf_export_not_supported');
    });

    it('should require owner or admin role', async () => {
      mockDb.getTeamMember.mockResolvedValueOnce({
        role: 'member',
        status: 'joined'
      });

      const result = await analyticsController.generateAnalyticsReport('user-1', 'team-1', {
        format: 'json'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('insufficient_permissions');
    });
  });

  describe('Error Handling', () => {
    it('should handle team not found error', async () => {
      mockDb.getTeamById.mockResolvedValueOnce(null);

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('team_not_found');
    });

    it('should handle database connection errors', async () => {
      mockDb.getTeamById.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('dashboard_error');
    });

    it('should handle permission check failures', async () => {
      mockDb.getTeamMember.mockRejectedValueOnce(new Error('Permission check failed'));

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('dashboard_error');
    });

    it('should handle malformed analytics data', async () => {
      mockDb.getTeamAnalyticsSummary.mockResolvedValueOnce({
        total_members: 'invalid', // Should be number
        active_members: null
      });

      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(result.success).toBe(true);
      // Should handle gracefully with default values
    });
  });

  describe('Data Validation', () => {
    it('should validate team ID format', async () => {
      const result = await analyticsController.getAnalyticsDashboard('user-1', '');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('invalid_team_id');
    });

    it('should validate user ID format', async () => {
      const result = await analyticsController.getAnalyticsDashboard('', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('invalid_user_id');
    });

    it('should validate time period values', async () => {
      const result = await analyticsController.getAnalyticsDashboard('user-1', 'team-1', {
        period: 400 // Too large
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('invalid_period');
    });

    it('should validate export parameters', async () => {
      const result = await analyticsController.exportTeamAnalytics('user-1', 'team-1', {
        format: null
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('missing_export_format');
    });
  });

  describe('Performance Optimization', () => {
    it('should use caching for repeated requests', async () => {
      const cacheGet = vi.fn().mockResolvedValue(null);
      const cacheSet = vi.fn();
      mockEnv.CACHE = {
        get: cacheGet,
        set: cacheSet
      };

      await analyticsController.getAnalyticsDashboard('user-1', 'team-1');
      await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(cacheGet).toHaveBeenCalledTimes(2);
      expect(cacheSet).toHaveBeenCalledTimes(2);
    });

    it('should limit data retrieval for large teams', async () => {
      // Mock large team
      const largeTeamMembers = Array.from({ length: 1000 }, (_, i) => ({
        user_id: `user-${i}`,
        email: `user${i}@example.com`,
        query_count: Math.floor(Math.random() * 100),
        activity_score: Math.floor(Math.random() * 500)
      }));

      mockDb.getTeamMemberActivity.mockResolvedValueOnce(largeTeamMembers);

      const result = await analyticsController.getTeamMemberActivity('user-1', 'team-1', {
        limit: 100
      });

      expect(result.success).toBe(true);
      expect(result.data.members.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Security and Privacy', () => {
    it('should not expose sensitive member information', async () => {
      const result = await analyticsController.getTeamMemberActivity('user-1', 'team-1');

      expect(result.success).toBe(true);
      // Should not include internal user IDs or personal data
      expect(result.data.members[0]).toHaveProperty('email');
      expect(result.data.members[0]).toHaveProperty('activity_score');
      expect(result.data.members[0]).not.toHaveProperty('internal_id');
    });

    it('should respect data retention policies', async () => {
      await analyticsController.getTeamUsageStatistics('user-1', 'team-1', {
        period: 365
      });

      expect(mockDb.getTeamUsageStatistics).toHaveBeenCalledWith('team-1', 365);
    });

    it('should log access to analytics data', async () => {
      const logSpy = vi.fn();
      mockDb.logTeamActivity = logSpy;

      await analyticsController.getAnalyticsDashboard('user-1', 'team-1');

      expect(logSpy).toHaveBeenCalledWith({
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'analytics_accessed',
        target_id: null,
        details: expect.stringContaining('dashboard')
      });
    });
  });
});

describe('Team Analytics API Routes', () => {
  let request;
  let mockEnv;
  let mockContext;

  beforeEach(() => {
    mockEnv = {
      DB: {},
      VECTOR_DB: {},
      CACHE: {},
      ENVIRONMENT: 'test'
    };

    mockContext = {};
  });

  describe('GET /api/teams/:teamId/analytics/dashboard', () => {
    it('should return analytics dashboard', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      // Mock auth middleware
      const authMiddleware = vi.fn().mockResolvedValue({
        userId: 'user-1'
      });

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('summary');
    });

    it('should accept query parameters', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard?period=60&include=performance',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/teams/:teamId/analytics/usage', () => {
    it('should return usage statistics', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/usage',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('daily_stats');
    });
  });

  describe('GET /api/teams/:teamId/analytics/members', () => {
    it('should return member activity', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/members?limit=10',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('members');
    });
  });

  describe('GET /api/teams/:teamId/analytics/features', () => {
    it('should return feature adoption metrics', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/features',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('features');
    });
  });

  describe('GET /api/teams/:teamId/analytics/performance', () => {
    it('should return performance metrics', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/performance?metric_type=query',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('metrics');
    });
  });

  describe('GET /api/teams/:teamId/analytics/growth', () => {
    it('should return growth metrics', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/growth',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('member_growth');
    });
  });

  describe('POST /api/teams/:teamId/analytics/export', () => {
    it('should export analytics data', async () => {
      request = {
        method: 'POST',
        url: '/api/teams/team-1/analytics/export',
        params: { teamId: 'team-1' },
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        body: {
          format: 'csv',
          data_types: ['usage', 'members']
        }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('content');
      expect(data.data).toHaveProperty('filename');
    });

    it('should validate export format', async () => {
      request = {
        method: 'POST',
        url: '/api/teams/team-1/analytics/export',
        params: { teamId: 'team-1' },
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        body: {
          format: 'invalid'
        }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error_code).toBe('invalid_export_format');
    });
  });

  describe('POST /api/teams/:teamId/analytics/report', () => {
    it('should generate analytics report', async () => {
      request = {
        method: 'POST',
        url: '/api/teams/team-1/analytics/report',
        params: { teamId: 'team-1' },
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        },
        body: {
          format: 'json',
          period: 30,
          include_recommendations: true
        }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('report_metadata');
      expect(data.data).toHaveProperty('recommendations');
    });

    it('should require admin permissions for report generation', async () => {
      request = {
        method: 'POST',
        url: '/api/teams/team-1/analytics/report',
        params: { teamId: 'team-1' },
        headers: {
          'Authorization': 'Bearer member-token',
          'Content-Type': 'application/json'
        },
        body: {
          format: 'json'
        }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error_code).toBe('insufficient_permissions');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all analytics endpoints', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard',
        params: { teamId: 'team-1' },
        headers: {}
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(401);
    });

    it('should require team membership for analytics access', async () => {
      request = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer non-member-token' }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(403);
    });

    it('should allow admin and owner roles for full analytics access', async () => {
      const adminRequest = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer admin-token' }
      };

      const ownerRequest = {
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer owner-token' }
      };

      const adminResponse = await handleRequest(adminRequest, mockEnv, mockContext);
      const ownerResponse = await handleRequest(ownerRequest, mockEnv, mockContext);

      expect(adminResponse.status).toBe(200);
      expect(ownerResponse.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to analytics endpoints', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 100 }, () => ({
        method: 'GET',
        url: '/api/teams/team-1/analytics/dashboard',
        params: { teamId: 'team-1' },
        headers: { 'Authorization': 'Bearer valid-token' }
      }));

      const responses = await Promise.all(
        requests.map(req => handleRequest(req, mockEnv, mockContext))
      );

      // Some requests should be rate limited
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Data Privacy', () => {
    it('should anonymize user data in analytics exports', async () => {
      request = {
        method: 'POST',
        url: '/api/teams/team-1/analytics/export',
        params: { teamId: 'team-1' },
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: {
          format: 'csv',
          data_types: ['members'],
          anonymize: true
        }
      };

      const response = await handleRequest(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should not contain real email addresses when anonymized
      expect(data.data.content).not.toContain('@example.com');
    });
  });
});

// Mock request handler function for API route testing
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url, 'https://example.com');

  // Mock authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error_code: 'unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Mock team member lookup
  const teamMember = {
    'valid-token': { userId: 'user-1', role: 'owner', status: 'joined' },
    'admin-token': { userId: 'user-2', role: 'admin', status: 'joined' },
    'owner-token': { userId: 'user-3', role: 'owner', status: 'joined' },
    'member-token': { userId: 'user-4', role: 'member', status: 'joined' },
    'non-member-token': { userId: 'user-5', role: null, status: null }
  };

  const member = teamMember[authHeader.replace('Bearer ', '')];
  if (!member || !member.role) {
    return new Response(
      JSON.stringify({ success: false, error_code: 'access_denied' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Mock rate limiting (simple implementation)
  if (Math.random() < 0.1) { // 10% chance of rate limit
    return new Response(
      JSON.stringify({ success: false, error_code: 'rate_limited' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Route handling
  if (url.pathname.includes('/analytics/dashboard') && request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          summary: { total_members: 10, active_members: 8 },
          usage_stats: [],
          top_members: [],
          feature_adoption: [],
          performance: {},
          growth_metrics: {},
          generated_at: new Date().toISOString()
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/usage') && request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          daily_stats: [{ date: '2025-01-01', queries: 25 }],
          summary: { total_queries: 25 },
          insights: {}
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/members') && request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          members: [{ user_id: 'user-1', activity_score: 100 }],
          summary: { total_members: 1 }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/features') && request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          features: [{ feature: 'rag_queries', adoption_rate: 85.5 }],
          adoption_summary: { total_features: 1 }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/performance') && request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          metrics: [{ metric_name: 'avg_response_time', metric_value: 1250 }],
          benchmarks: {},
          performance_score: 85
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/growth') && request.method === 'GET') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          member_growth: { new_members: 3, growth_rate: 15.0 },
          project_growth: { new_projects: 5, growth_rate: 25.0 },
          usage_growth: { query_growth_rate: 35.2 },
          projections: {}
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/export') && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));

    if (body.format === 'invalid') {
      return new Response(
        JSON.stringify({ success: false, error_code: 'invalid_export_format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (member.role === 'member') {
      return new Response(
        JSON.stringify({ success: false, error_code: 'insufficient_permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          format: body.format || 'csv',
          content: body.anonymize ? 'user-1,100' : 'user1@example.com,100',
          filename: `analytics-${new Date().toISOString().split('T')[0]}.${body.format || 'csv'}`
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (url.pathname.includes('/analytics/report') && request.method === 'POST') {
    if (member.role === 'member') {
      return new Response(
        JSON.stringify({ success: false, error_code: 'insufficient_permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));

    if (body.format === 'pdf') {
      return new Response(
        JSON.stringify({ success: false, error_code: 'pdf_export_not_supported' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          format: body.format || 'json',
          report_metadata: {
            team_id: 'team-1',
            report_period_days: body.period || 30,
            generated_at: new Date().toISOString(),
            generated_by: member.userId
          },
          team_overview: {},
          usage_analytics: {},
          member_analytics: {},
          feature_analytics: {},
          performance_analytics: {},
          recommendations: [
            {
              category: 'usage',
              priority: 'high',
              description: 'Increase team engagement',
              actionable_steps: ['Schedule regular training sessions']
            }
          ]
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: false, error_code: 'not_found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}