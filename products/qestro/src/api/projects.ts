/**
 * Projects API Routes
 * Handles project management, test suites, and test runs
 */

import {
  ProjectsService,
  Project,
  TestSuite,
  TestRun,
} from "../services/projects-service";
import { AuthAPI } from "./auth";

export interface CreateProjectRequest {
  name: string;
  description?: string;
  type: "mobile" | "web" | "api";
  settings?: {
    framework?: string;
    platform?: string;
    environment?: string;
    tags?: string[];
    customConfig?: Record<string, any>;
  };
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: "active" | "archived";
  settings?: Record<string, any>;
}

export interface CreateTestSuiteRequest {
  projectId: string;
  name: string;
  description?: string;
  tests?: any[];
  settings?: {
    parallel?: boolean;
    retries?: number;
    timeout?: number;
    environment?: Record<string, string>;
  };
}

export interface CreateTestRunRequest {
  projectId: string;
  suiteId?: string;
  testId?: string;
  environment: string;
  config?: {
    device?: string;
    browser?: string;
    resolution?: string;
    parallel?: boolean;
  };
}

/**
 * Projects API Handler
 */
export class ProjectsAPI {
  private projectsService: ProjectsService;

  constructor(env: any) {
    this.projectsService = new ProjectsService(env);
  }

  /**
   * Create a new project
   */
  async createProject(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const body: CreateProjectRequest = await request.json();

      if (!body.name || !body.type) {
        return this.errorResponse("Name and type are required", 400);
      }

      const validTypes = ["mobile", "web", "api"];
      if (!validTypes.includes(body.type)) {
        return this.errorResponse("Invalid project type", 400);
      }

      const project = await this.projectsService.createProject({
        name: body.name,
        description: body.description,
        userId: authResult.user.id,
        type: body.type,
        status: "active",
        settings: body.settings || {},
      });

      return this.jsonResponse(
        {
          success: true,
          project: project,
        },
        201,
      );
    } catch (error) {
      console.error("Create project error:", error);
      return this.errorResponse("Failed to create project", 500);
    }
  }

  /**
   * Get project by ID
   */
  async getProject(
    request: Request,
    env: any,
    projectId: string,
  ): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const project = await this.projectsService.getProject(
        projectId,
        authResult.user.id,
      );

      if (!project) {
        return this.errorResponse("Project not found", 404);
      }

      return this.jsonResponse(
        {
          success: true,
          project: project,
        },
        200,
      );
    } catch (error) {
      console.error("Get project error:", error);
      return this.errorResponse("Failed to get project", 500);
    }
  }

  /**
   * List projects for the authenticated user
   */
  async listProjects(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const filters = {
        type: url.searchParams.get("type") || undefined,
        status: url.searchParams.get("status") || undefined,
        limit: url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!)
          : undefined,
        offset: url.searchParams.get("offset")
          ? parseInt(url.searchParams.get("offset")!)
          : undefined,
        search: url.searchParams.get("search") || undefined,
      };

      const result = await this.projectsService.listProjects(
        authResult.user.id,
        filters,
      );

      return this.jsonResponse(
        {
          success: true,
          projects: result.projects,
          pagination: {
            total: result.total,
            limit: filters.limit,
            offset: filters.offset,
          },
        },
        200,
      );
    } catch (error) {
      console.error("List projects error:", error);
      return this.errorResponse("Failed to list projects", 500);
    }
  }

  /**
   * Update a project
   */
  async updateProject(
    request: Request,
    env: any,
    projectId: string,
  ): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const body: UpdateProjectRequest = await request.json();

      const project = await this.projectsService.updateProject(
        projectId,
        authResult.user.id,
        body,
      );

      return this.jsonResponse(
        {
          success: true,
          project: project,
        },
        200,
      );
    } catch (error) {
      console.error("Update project error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to update project", 500);
    }
  }

  /**
   * Delete a project (soft delete)
   */
  async deleteProject(
    request: Request,
    env: any,
    projectId: string,
  ): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      await this.projectsService.deleteProject(projectId, authResult.user.id);

      return this.jsonResponse(
        {
          success: true,
          message: "Project deleted successfully",
        },
        200,
      );
    } catch (error) {
      console.error("Delete project error:", error);
      return this.errorResponse("Failed to delete project", 500);
    }
  }

  /**
   * Create a test suite
   */
  async createTestSuite(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const body: CreateTestSuiteRequest = await request.json();

      if (!body.projectId || !body.name) {
        return this.errorResponse("Project ID and name are required", 400);
      }

      // Verify project ownership
      const project = await this.projectsService.getProject(
        body.projectId,
        authResult.user.id,
      );
      if (!project) {
        return this.errorResponse("Project not found", 404);
      }

      const testSuite = await this.projectsService.createTestSuite({
        projectId: body.projectId,
        name: body.name,
        description: body.description,
        tests: body.tests || [],
        settings: body.settings || {},
      });

      return this.jsonResponse(
        {
          success: true,
          testSuite: testSuite,
        },
        201,
      );
    } catch (error) {
      console.error("Create test suite error:", error);
      return this.errorResponse("Failed to create test suite", 500);
    }
  }

  /**
   * Get test suites for a project
   */
  async getTestSuites(
    request: Request,
    env: any,
    projectId: string,
  ): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const testSuites = await this.projectsService.getTestSuites(
        projectId,
        authResult.user.id,
      );

      return this.jsonResponse(
        {
          success: true,
          testSuites: testSuites,
        },
        200,
      );
    } catch (error) {
      console.error("Get test suites error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to get test suites", 500);
    }
  }

  /**
   * Create and start a test run
   */
  async createTestRun(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const body: CreateTestRunRequest = await request.json();

      if (!body.projectId || !body.environment) {
        return this.errorResponse(
          "Project ID and environment are required",
          400,
        );
      }

      // Verify project ownership
      const project = await this.projectsService.getProject(
        body.projectId,
        authResult.user.id,
      );
      if (!project) {
        return this.errorResponse("Project not found", 404);
      }

      const testRun = await this.projectsService.createTestRun({
        projectId: body.projectId,
        suiteId: body.suiteId,
        testId: body.testId,
        status: "pending",
        environment: body.environment,
        config: body.config || {},
        results: {
          duration: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          errors: [],
          screenshots: [],
          logs: [],
        },
        triggeredBy: authResult.user.id,
        artifacts: [],
      });

      // TODO: Trigger actual test execution in background
      // This would integrate with the test execution engine

      return this.jsonResponse(
        {
          success: true,
          testRun: testRun,
          message: "Test run created successfully",
        },
        201,
      );
    } catch (error) {
      console.error("Create test run error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to create test run", 500);
    }
  }

  /**
   * Get test runs for a project
   */
  async getTestRuns(
    request: Request,
    env: any,
    projectId: string,
  ): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const filters = {
        limit: url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!)
          : undefined,
        offset: url.searchParams.get("offset")
          ? parseInt(url.searchParams.get("offset")!)
          : undefined,
        status: url.searchParams.get("status") || undefined,
        environment: url.searchParams.get("environment") || undefined,
      };

      const result = await this.projectsService.getTestRuns(
        projectId,
        authResult.user.id,
        filters,
      );

      return this.jsonResponse(
        {
          success: true,
          testRuns: result.runs,
          pagination: {
            total: result.total,
            limit: filters.limit,
            offset: filters.offset,
          },
        },
        200,
      );
    } catch (error) {
      console.error("Get test runs error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to get test runs", 500);
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(
    request: Request,
    env: any,
    projectId: string,
  ): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const project = await this.projectsService.getProject(
        projectId,
        authResult.user.id,
      );
      if (!project) {
        return this.errorResponse("Project not found", 404);
      }

      const runs = await this.projectsService.getTestRuns(
        projectId,
        authResult.user.id,
        { limit: 100 },
      );

      const totalRuns = runs.runs.length;
      const passedRuns = runs.runs.filter(
        (run) => run.status === "passed",
      ).length;
      const failedRuns = runs.runs.filter(
        (run) => run.status === "failed",
      ).length;
      const successRate = totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0;

      const totalDuration = runs.runs.reduce(
        (sum, run) => sum + run.results.duration,
        0,
      );
      const averageDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

      return this.jsonResponse(
        {
          success: true,
          stats: {
            totalRuns,
            passedRuns,
            failedRuns,
            successRate: Math.round(successRate * 100) / 100,
            averageDuration: Math.round(averageDuration * 100) / 100,
            totalDuration,
            lastRunAt: runs.runs[0]?.triggeredAt || null,
          },
        },
        200,
      );
    } catch (error) {
      console.error("Get project stats error:", error);
      return this.errorResponse("Failed to get project statistics", 500);
    }
  }

  /**
   * Utility method to create JSON responses
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  /**
   * Utility method to create error responses
   */
  private errorResponse(message: string, status: number = 400): Response {
    return this.jsonResponse(
      {
        success: false,
        error: message,
      },
      status,
    );
  }
}

export default ProjectsAPI;
