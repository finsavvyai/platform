/**
 * Analytics API Routes
 * Provides comprehensive analytics and reporting endpoints
 */

import {
  AnalyticsService,
  ProjectAnalytics,
  UserAnalytics,
  SystemAnalytics,
} from "../services/analytics-service";
import { AuthAPI } from "./auth";

/**
 * Analytics API Handler
 */
export class AnalyticsAPI {
  private analyticsService: AnalyticsService;

  constructor(env: any) {
    this.analyticsService = new AnalyticsService(env);
  }

  /**
   * Get platform overview metrics
   */
  async getPlatformMetrics(request: Request, env: any): Promise<Response> {
    try {
      // This endpoint could be public or require minimal auth for dashboard
      const metrics = await this.analyticsService.getPlatformMetrics();

      return this.jsonResponse(
        {
          success: true,
          metrics: metrics,
          timestamp: new Date().toISOString(),
        },
        200,
      );
    } catch (error) {
      console.error("Get platform metrics error:", error);
      return this.errorResponse("Failed to get platform metrics", 500);
    }
  }

  /**
   * Get detailed project analytics
   */
  async getProjectAnalytics(
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
      const timeRange = url.searchParams.get("timeRange") || "30d";
      const includeDetailed = url.searchParams.get("detailed") === "true";

      const analytics: ProjectAnalytics =
        await this.analyticsService.getProjectAnalytics(
          projectId,
          authResult.user.id,
        );

      // Filter data based on time range if needed
      // This would typically be handled in the service layer

      return this.jsonResponse(
        {
          success: true,
          analytics: analytics,
          timeRange,
          timestamp: new Date().toISOString(),
        },
        200,
      );
    } catch (error) {
      console.error("Get project analytics error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to get project analytics", 500);
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const timeRange = url.searchParams.get("timeRange") || "30d";
      const includeSubscription =
        url.searchParams.get("subscription") === "true";

      const analytics: UserAnalytics =
        await this.analyticsService.getUserAnalytics(authResult.user.id);

      // Filter sensitive data if subscription details aren't requested
      if (!includeSubscription) {
        delete analytics.subscriptionLimits;
      }

      return this.jsonResponse(
        {
          success: true,
          analytics: analytics,
          timeRange,
          timestamp: new Date().toISOString(),
        },
        200,
      );
    } catch (error) {
      console.error("Get user analytics error:", error);
      return this.errorResponse("Failed to get user analytics", 500);
    }
  }

  /**
   * Get system-wide analytics (admin only)
   */
  async getSystemAnalytics(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request, ["admin"]);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const timeRange = url.searchParams.get("timeRange") || "7d";
      const includeDetailed = url.searchParams.get("detailed") === "true";

      const analytics: SystemAnalytics =
        await this.analyticsService.getSystemAnalytics();

      // Filter data based on detail level
      if (!includeDetailed) {
        // Remove sensitive or detailed information
        delete analytics.usage.apiCallsByUser;
      }

      return this.jsonResponse(
        {
          success: true,
          analytics: analytics,
          timeRange,
          timestamp: new Date().toISOString(),
        },
        200,
      );
    } catch (error) {
      console.error("Get system analytics error:", error);
      if (error.message === "Insufficient permissions") {
        return this.errorResponse("Admin access required", 403);
      }
      return this.errorResponse("Failed to get system analytics", 500);
    }
  }

  /**
   * Get test execution trends
   */
  async getTestTrends(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const projectId = url.searchParams.get("projectId");
      const timeRange = url.searchParams.get("timeRange") || "30d";
      const granularity = url.searchParams.get("granularity") || "daily"; // daily, weekly, monthly

      // If projectId is provided, verify ownership and get project-specific trends
      if (projectId) {
        const projectAnalytics =
          await this.analyticsService.getProjectAnalytics(
            projectId,
            authResult.user.id,
          );

        const trendData =
          granularity === "daily"
            ? projectAnalytics.metrics.trends.daily
            : granularity === "weekly"
              ? projectAnalytics.metrics.trends.weekly
              : projectAnalytics.metrics.trends.monthly;

        return this.jsonResponse(
          {
            success: true,
            trends: trendData,
            projectId,
            timeRange,
            granularity,
            timestamp: new Date().toISOString(),
          },
          200,
        );
      } else {
        // Get user-wide trends across all projects
        const userAnalytics = await this.analyticsService.getUserAnalytics(
          authResult.user.id,
        );

        return this.jsonResponse(
          {
            success: true,
            trends: userAnalytics.activity.dailyActivity, // Simplified for now
            timeRange,
            granularity,
            timestamp: new Date().toISOString(),
          },
          200,
        );
      }
    } catch (error) {
      console.error("Get test trends error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to get test trends", 500);
    }
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const projectId = url.searchParams.get("projectId");

      if (projectId) {
        // Get project-specific performance data
        const projectAnalytics =
          await this.analyticsService.getProjectAnalytics(
            projectId,
            authResult.user.id,
          );

        return this.jsonResponse(
          {
            success: true,
            performance: {
              slowestTests: projectAnalytics.performanceMetrics.slowestTests,
              fastestTests: projectAnalytics.performanceMetrics.fastestTests,
              averageDuration: projectAnalytics.metrics.averageDuration,
              totalDuration: projectAnalytics.metrics.totalDuration,
            },
            projectId,
            timestamp: new Date().toISOString(),
          },
          200,
        );
      } else {
        // Get user-wide performance summary
        const userAnalytics = await this.analyticsService.getUserAnalytics(
          authResult.user.id,
        );

        return this.jsonResponse(
          {
            success: true,
            performance: {
              averageDuration: userAnalytics.metrics.averageDuration,
              successRate: userAnalytics.metrics.successRate,
              totalRuns: userAnalytics.metrics.totalRuns,
            },
            timestamp: new Date().toISOString(),
          },
          200,
        );
      }
    } catch (error) {
      console.error("Get performance analytics error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to get performance analytics", 500);
    }
  }

  /**
   * Get error analytics and failure patterns
   */
  async getErrorAnalytics(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const projectId = url.searchParams.get("projectId");
      const timeRange = url.searchParams.get("timeRange") || "30d";

      if (projectId) {
        // Get project-specific error data
        const projectAnalytics =
          await this.analyticsService.getProjectAnalytics(
            projectId,
            authResult.user.id,
          );

        return this.jsonResponse(
          {
            success: true,
            errors: {
              topFailedTests: projectAnalytics.topFailedTests,
              errorRate: 100 - projectAnalytics.metrics.successRate,
              totalFailures: projectAnalytics.metrics.failedRuns,
            },
            projectId,
            timeRange,
            timestamp: new Date().toISOString(),
          },
          200,
        );
      } else {
        // Get user-wide error summary
        const userAnalytics = await this.analyticsService.getUserAnalytics(
          authResult.user.id,
        );

        return this.jsonResponse(
          {
            success: true,
            errors: {
              errorRate: 100 - userAnalytics.metrics.successRate,
              totalRuns: userAnalytics.metrics.totalRuns,
              failedRuns: Math.round(
                (userAnalytics.metrics.totalRuns *
                  (100 - userAnalytics.metrics.successRate)) /
                  100,
              ),
            },
            timeRange,
            timestamp: new Date().toISOString(),
          },
          200,
        );
      }
    } catch (error) {
      console.error("Get error analytics error:", error);
      if (error.message === "Project not found") {
        return this.errorResponse("Project not found", 404);
      }
      return this.errorResponse("Failed to get error analytics", 500);
    }
  }

  /**
   * Get usage statistics and subscription limits
   */
  async getUsageStats(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const userAnalytics = await this.analyticsService.getUserAnalytics(
        authResult.user.id,
      );

      return this.jsonResponse(
        {
          success: true,
          usage: {
            apiCalls: userAnalytics.metrics.apiUsage,
            storageUsed: userAnalytics.metrics.storageUsed,
            bandwidthUsed: userAnalytics.metrics.bandwidthUsed,
            projects: userAnalytics.metrics.totalProjects,
            runs: userAnalytics.metrics.totalRuns,
          },
          limits: userAnalytics.subscriptionLimits.limits,
          remaining: userAnalytics.subscriptionLimits.remaining,
          plan: userAnalytics.subscriptionLimits.plan,
          resetDate: this.getNextBillingDate(), // Mock reset date
          timestamp: new Date().toISOString(),
        },
        200,
      );
    } catch (error) {
      console.error("Get usage stats error:", error);
      return this.errorResponse("Failed to get usage statistics", 500);
    }
  }

  /**
   * Export analytics data (CSV, JSON, etc.)
   */
  async exportAnalytics(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const type = url.searchParams.get("type") || "project"; // project, user, system
      const format = url.searchParams.get("format") || "json"; // json, csv
      const projectId = url.searchParams.get("projectId");

      let data: any;
      let filename: string;

      switch (type) {
        case "project":
          if (!projectId) {
            return this.errorResponse(
              "Project ID is required for project export",
              400,
            );
          }
          data = await this.analyticsService.getProjectAnalytics(
            projectId,
            authResult.user.id,
          );
          filename = `project-analytics-${projectId}-${new Date().toISOString().split("T")[0]}`;
          break;

        case "user":
          data = await this.analyticsService.getUserAnalytics(
            authResult.user.id,
          );
          filename = `user-analytics-${authResult.user.id}-${new Date().toISOString().split("T")[0]}`;
          break;

        case "system":
          // Require admin access for system export
          const adminCheck = await new AuthAPI(env).requireAuth(request, [
            "admin",
          ]);
          if (!adminCheck.user) {
            return adminCheck.response;
          }
          data = await this.analyticsService.getSystemAnalytics();
          filename = `system-analytics-${new Date().toISOString().split("T")[0]}`;
          break;

        default:
          return this.errorResponse("Invalid export type", 400);
      }

      if (format === "csv") {
        const csvData = this.convertToCSV(data);
        return new Response(csvData, {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${filename}.csv"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        return new Response(JSON.stringify(data, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}.json"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } catch (error) {
      console.error("Export analytics error:", error);
      return this.errorResponse("Failed to export analytics", 500);
    }
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await new AuthAPI(env).requireAuth(request);
      if (!authResult.user) {
        return authResult.response;
      }

      const url = new URL(request.url);
      const includeSystem = url.searchParams.get("system") === "true";
      const isAdmin = authResult.user.role === "admin";

      // Get user analytics
      const userAnalytics = await this.analyticsService.getUserAnalytics(
        authResult.user.id,
      );

      // Get platform metrics
      const platformMetrics = await this.analyticsService.getPlatformMetrics();

      const dashboardData: any = {
        user: {
          projects: userAnalytics.metrics.totalProjects,
          runs: userAnalytics.metrics.totalRuns,
          successRate: userAnalytics.metrics.successRate,
          recentActivity: userAnalytics.activity.dailyActivity.slice(0, 7),
          usageStats: userAnalytics.subscriptionLimits,
        },
        platform: {
          totalProjects: platformMetrics.totalProjects,
          totalRuns: platformMetrics.totalTestRuns,
          platformSuccessRate: platformMetrics.successRate,
          activeUsers: platformMetrics.activeUsers,
        },
        timestamp: new Date().toISOString(),
      };

      // Include system data for admins
      if (includeSystem && isAdmin) {
        const systemAnalytics =
          await this.analyticsService.getSystemAnalytics();
        dashboardData.system = {
          overview: systemAnalytics.overview,
          performance: systemAnalytics.performance,
          storage: systemAnalytics.storage,
        };
      }

      return this.jsonResponse(
        {
          success: true,
          dashboard: dashboardData,
        },
        200,
      );
    } catch (error) {
      console.error("Get dashboard data error:", error);
      return this.errorResponse("Failed to get dashboard data", 500);
    }
  }

  /**
   * Convert analytics data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simplified CSV conversion - in production, you'd want more sophisticated handling
    if (data.metrics) {
      const headers = ["Metric", "Value"];
      const rows = Object.entries(data.metrics).map(([key, value]) => [
        key,
        value.toString(),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      return csvContent;
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Get next billing date (mock implementation)
   */
  private getNextBillingDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString().split("T")[0];
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

export default AnalyticsAPI;
