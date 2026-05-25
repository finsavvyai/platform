/**
 * Projects Service
 * Manages test projects, configurations, and metadata
 */

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  teamId?: string;
  type: 'mobile' | 'web' | 'api';
  status: 'active' | 'archived' | 'deleted';
  settings: {
    framework?: string;
    platform?: string;
    environment?: string;
    tags?: string[];
    customConfig?: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  totalRuns: number;
  successRate: number;
  averageDuration: number;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  tests: TestCase[];
  settings: {
    parallel?: boolean;
    retries?: number;
    timeout?: number;
    environment?: Record<string, string>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  type: 'ui' | 'api' | 'performance' | 'security';
  status: 'active' | 'disabled' | 'deprecated';
  steps: TestStep[];
  expectedResults: string[];
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestStep {
  id: string;
  action: string;
  target?: string;
  value?: string;
  expected?: string;
  timeout?: number;
  screenshot?: boolean;
  waitAfter?: number;
}

export interface TestRun {
  id: string;
  projectId: string;
  suiteId?: string;
  testId?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';
  environment: string;
  config: {
    device?: string;
    browser?: string;
    resolution?: string;
    parallel?: boolean;
  };
  results: {
    duration: number;
    passed: number;
    failed: number;
    skipped: number;
    errors?: string[];
    screenshots?: string[];
    logs?: string[];
  };
  triggeredBy: string;
  triggeredAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts?: string[];
}

/**
 * Projects Service implementation for Cloudflare Workers
 */
export class ProjectsService {
  constructor(private env: any) {}

  /**
   * Create a new project
   */
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'totalRuns' | 'successRate' | 'averageDuration'>): Promise<Project> {
    const project: Project = {
      ...projectData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalRuns: 0,
      successRate: 0,
      averageDuration: 0
    };

    // Store in D1 database
    try {
      await this.env.DB.prepare(`
        INSERT INTO projects (
          id, name, description, user_id, team_id, type, status,
          settings, created_at, updated_at, total_runs, success_rate, average_duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        project.id,
        project.name,
        project.description || null,
        project.userId,
        project.teamId || null,
        project.type,
        project.status,
        JSON.stringify(project.settings),
        project.createdAt,
        project.updatedAt,
        project.totalRuns,
        project.successRate,
        project.averageDuration
      ).run();

      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw new Error('Failed to create project');
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string, userId?: string): Promise<Project | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM projects WHERE id = ? ${userId ? 'AND user_id = ?' : ''}
      `).bind(...(userId ? [projectId, userId] : [projectId])).first();

      if (!result) return null;

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        userId: result.user_id,
        teamId: result.team_id,
        type: result.type,
        status: result.status,
        settings: JSON.parse(result.settings || '{}'),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        lastRunAt: result.last_run_at,
        totalRuns: result.total_runs,
        successRate: result.success_rate,
        averageDuration: result.average_duration
      };
    } catch (error) {
      console.error('Failed to get project:', error);
      throw new Error('Failed to get project');
    }
  }

  /**
   * List projects for a user
   */
  async listProjects(userId: string, filters: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<{ projects: Project[]; total: number }> {
    try {
      let query = `
        SELECT * FROM projects
        WHERE user_id = ?
        AND status != 'deleted'
      `;
      const params: any[] = [userId];

      if (filters.type) {
        query += ` AND type = ?`;
        params.push(filters.type);
      }

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.env.DB.prepare(countQuery).bind(...params).first();
      const total = countResult?.total || 0;

      // Add ordering and pagination
      query += ` ORDER BY updated_at DESC`;
      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
        if (filters.offset) {
          query += ` OFFSET ?`;
          params.push(filters.offset);
        }
      }

      const results = await this.env.DB.prepare(query).bind(...params).all();

      const projects = (results.results || []).map((result: any) => ({
        id: result.id,
        name: result.name,
        description: result.description,
        userId: result.user_id,
        teamId: result.team_id,
        type: result.type,
        status: result.status,
        settings: JSON.parse(result.settings || '{}'),
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        lastRunAt: result.last_run_at,
        totalRuns: result.total_runs,
        successRate: result.success_rate,
        averageDuration: result.average_duration
      }));

      return { projects, total };
    } catch (error) {
      console.error('Failed to list projects:', error);
      throw new Error('Failed to list projects');
    }
  }

  /**
   * Update project
   */
  async updateProject(projectId: string, userId: string, updates: Partial<Project>): Promise<Project> {
    try {
      const existingProject = await this.getProject(projectId, userId);
      if (!existingProject) {
        throw new Error('Project not found');
      }

      const updatedProject = {
        ...existingProject,
        ...updates,
        id: projectId, // Ensure ID doesn't change
        userId, // Ensure userId doesn't change
        updatedAt: new Date().toISOString()
      };

      await this.env.DB.prepare(`
        UPDATE projects SET
          name = ?, description = ?, status = ?, settings = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        updatedProject.name,
        updatedProject.description || null,
        updatedProject.status,
        JSON.stringify(updatedProject.settings),
        updatedProject.updatedAt,
        projectId,
        userId
      ).run();

      return updatedProject;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw new Error('Failed to update project');
    }
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    try {
      await this.env.DB.prepare(`
        UPDATE projects SET status = 'deleted', updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        new Date().toISOString(),
        projectId,
        userId
      ).run();
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Create test suite
   */
  async createTestSuite(suiteData: Omit<TestSuite, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestSuite> {
    const suite: TestSuite = {
      ...suiteData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await this.env.DB.prepare(`
        INSERT INTO test_suites (
          id, project_id, name, description, tests, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        suite.id,
        suite.projectId,
        suite.name,
        suite.description || null,
        JSON.stringify(suite.tests),
        JSON.stringify(suite.settings),
        suite.createdAt,
        suite.updatedAt
      ).run();

      return suite;
    } catch (error) {
      console.error('Failed to create test suite:', error);
      throw new Error('Failed to create test suite');
    }
  }

  /**
   * Get test suites for a project
   */
  async getTestSuites(projectId: string, userId: string): Promise<TestSuite[]> {
    try {
      // Verify project ownership
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error('Project not found');
      }

      const results = await this.env.DB.prepare(`
        SELECT * FROM test_suites WHERE project_id = ? ORDER BY updated_at DESC
      `).bind(projectId).all();

      return (results.results || []).map((result: any) => ({
        id: result.id,
        projectId: result.project_id,
        name: result.name,
        description: result.description,
        tests: JSON.parse(result.tests || '[]'),
        settings: JSON.parse(result.settings || '{}'),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }));
    } catch (error) {
      console.error('Failed to get test suites:', error);
      throw new Error('Failed to get test suites');
    }
  }

  /**
   * Create test run
   */
  async createTestRun(runData: Omit<TestRun, 'id' | 'triggeredAt'>): Promise<TestRun> {
    const run: TestRun = {
      ...runData,
      id: crypto.randomUUID(),
      triggeredAt: new Date().toISOString()
    };

    try {
      await this.env.DB.prepare(`
        INSERT INTO test_runs (
          id, project_id, suite_id, test_id, status, environment, config,
          results, triggered_by, triggered_at, started_at, completed_at, artifacts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        run.id,
        run.projectId,
        run.suiteId || null,
        run.testId || null,
        run.status,
        run.environment,
        JSON.stringify(run.config),
        JSON.stringify(run.results),
        run.triggeredBy,
        run.triggeredAt,
        run.startedAt || null,
        run.completedAt || null,
        JSON.stringify(run.artifacts || [])
      ).run();

      return run;
    } catch (error) {
      console.error('Failed to create test run:', error);
      throw new Error('Failed to create test run');
    }
  }

  /**
   * Get test runs for a project
   */
  async getTestRuns(projectId: string, userId: string, filters: {
    limit?: number;
    offset?: number;
    status?: string;
    environment?: string;
  } = {}): Promise<{ runs: TestRun[]; total: number }> {
    try {
      // Verify project ownership
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error('Project not found');
      }

      let query = `SELECT * FROM test_runs WHERE project_id = ?`;
      const params: any[] = [projectId];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.environment) {
        query += ` AND environment = ?`;
        params.push(filters.environment);
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.env.DB.prepare(countQuery).bind(...params).first();
      const total = countResult?.total || 0;

      // Add ordering and pagination
      query += ` ORDER BY triggered_at DESC`;
      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
        if (filters.offset) {
          query += ` OFFSET ?`;
          params.push(filters.offset);
        }
      }

      const results = await this.env.DB.prepare(query).bind(...params).all();

      const runs = (results.results || []).map((result: any) => ({
        id: result.id,
        projectId: result.project_id,
        suiteId: result.suite_id,
        testId: result.test_id,
        status: result.status,
        environment: result.environment,
        config: JSON.parse(result.config || '{}'),
        results: JSON.parse(result.results || '{}'),
        triggeredBy: result.triggered_by,
        triggeredAt: result.triggered_at,
        startedAt: result.started_at,
        completedAt: result.completed_at,
        artifacts: JSON.parse(result.artifacts || '[]')
      }));

      return { runs, total };
    } catch (error) {
      console.error('Failed to get test runs:', error);
      throw new Error('Failed to get test runs');
    }
  }

  /**
   * Update project statistics
   */
  async updateProjectStats(projectId: string): Promise<void> {
    try {
      // Calculate recent statistics
      const recentRuns = await this.env.DB.prepare(`
        SELECT status, duration FROM test_runs
        WHERE project_id = ? AND completed_at IS NOT NULL
        ORDER BY completed_at DESC LIMIT 100
      `).bind(projectId).all();

      const totalRuns = recentRuns.results?.length || 0;
      const passedRuns = recentRuns.results?.filter((run: any) => run.status === 'passed').length || 0;
      const successRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

      const totalDuration = recentRuns.results?.reduce((sum: number, run: any) => sum + (run.duration || 0), 0) || 0;
      const averageDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

      await this.env.DB.prepare(`
        UPDATE projects SET
          total_runs = ?, success_rate = ?, average_duration = ?, last_run_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        totalRuns,
        successRate,
        averageDuration,
        new Date().toISOString(),
        new Date().toISOString(),
        projectId
      ).run();
    } catch (error) {
      console.error('Failed to update project stats:', error);
      // Don't throw - this is a background operation
    }
  }
}

export default ProjectsService;
