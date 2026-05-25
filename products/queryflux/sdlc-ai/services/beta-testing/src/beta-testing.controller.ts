/**
 * Beta Testing API Controller
 * Handles all beta testing related endpoints
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import BetaTestingService from "./beta-testing.service";
import { createMcpClient } from "@sdlc/mcp-sdk";

const app = new Hono();
const mcp = createMcpClient();

// Initialize beta testing service
const betaService = new BetaTestingService(
  mcp.db,
  mcp.kv,
  mcp.email,
  mcp.monitoring,
);

// Apply for beta testing program
app.post(
  "/apply",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      name: z.string().min(2),
      company: z.string().optional(),
      role: z.string().optional(),
      experience: z.enum(["beginner", "intermediate", "expert"]),
      useCase: z.string().min(10),
      motivation: z.string().min(20),
      technicalBackground: z.string().min(20),
      agreeToTerms: z
        .boolean()
        .refine((v) => v === true, "Must agree to terms"),
    }),
  ),
  async (c) => {
    try {
      const application = c.req.valid("json");
      const result = await betaService.applyForBeta(c, application);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        400,
      );
    }
  },
);

// Get beta application status
app.get("/application/status", async (c) => {
  const userId = c.get("userId");

  try {
    const application = await mcp.db
      .prepare(
        `
        SELECT * FROM beta_users
        WHERE user_id = ? OR email = (SELECT email FROM users WHERE id = ?)
      `,
      )
      .bind(userId, userId)
      .first();

    return c.json({
      success: true,
      data: {
        status: application?.application_status || "not_applied",
        application: application || null,
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Admin: Review beta application
app.post(
  "/admin/applications/:id/review",
  zValidator(
    "json",
    z.object({
      decision: z.enum(["approved", "rejected"]),
      notes: z.string().optional(),
    }),
  ),
  async (c) => {
    try {
      const applicationId = c.req.param("id");
      const { decision, notes } = c.req.valid("json");

      const result = await betaService.reviewApplication(
        c,
        applicationId,
        decision,
        notes,
      );

      return c.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        error.message.includes("Unauthorized") ? 403 : 400,
      );
    }
  },
);

// Admin: List all beta applications
app.get("/admin/applications", async (c) => {
  const status = c.req.query("status") as
    | "pending"
    | "approved"
    | "rejected"
    | "active"
    | "completed";
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");

  try {
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM beta_users";
    const params: any[] = [];

    if (status) {
      query += " WHERE application_status = ?";
      params.push(status);
    }

    query += " ORDER BY join_date DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const applications = await mcp.db
      .prepare(query)
      .bind(...params)
      .all();

    const totalCount = await mcp.db
      .prepare(
        `SELECT COUNT(*) as count FROM beta_users ${status ? "WHERE application_status = ?" : ""}`,
      )
      .bind(...(status ? [status] : []))
      .first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        applications: applications.results || [],
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          pages: Math.ceil((totalCount?.count || 0) / limit),
        },
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Complete beta onboarding
app.post(
  "/onboarding/complete",
  zValidator(
    "json",
    z.object({
      sdkUsed: z.enum(["python", "typescript", "go"]),
      firstApiCall: z.object({
        endpoint: z.string(),
        success: z.boolean(),
        responseTime: z.number(),
      }),
      setupExperience: z.object({
        ease: z.number().min(1).max(5),
        issues: z.string().optional(),
        comments: z.string().optional(),
      }),
    }),
  ),
  async (c) => {
    try {
      const onboardingData = c.req.valid("json");
      const result = await betaService.completeOnboarding(c, onboardingData);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        400,
      );
    }
  },
);

// Get testing scenarios
app.get("/scenarios", async (c) => {
  const phase = c.req.query("phase") as
    | "onboarding"
    | "core"
    | "advanced"
    | "load"
    | "integration";

  try {
    const scenarios = await betaService.getTestingScenarios(phase);

    return c.json({
      success: true,
      data: scenarios,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Complete testing scenario
app.post(
  "/scenarios/:id/complete",
  zValidator(
    "json",
    z.object({
      success: z.boolean(),
      timeSpent: z.number(), // in minutes
      issues: z.array(z.string()).optional(),
      feedback: z.string().optional(),
      attachments: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    try {
      const scenarioId = c.req.param("id");
      const completionData = c.req.valid("json");

      const result = await betaService.completeScenario(
        c,
        scenarioId,
        completionData,
      );

      return c.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        400,
      );
    }
  },
);

// Submit feedback
app.post(
  "/feedback",
  zValidator(
    "json",
    z.object({
      type: z.enum(["bug", "feature", "usability", "performance", "general"]),
      title: z.string().min(5),
      description: z.string().min(10),
      context: z
        .object({
          feature: z.string().optional(),
          endpoint: z.string().optional(),
          sdk: z.string().optional(),
          environment: z.string().optional(),
          reproductionSteps: z.array(z.string()).optional(),
        })
        .optional(),
      attachments: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    try {
      const feedbackData = c.req.valid("json");
      const result = await betaService.submitFeedback(c, feedbackData);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        400,
      );
    }
  },
);

// Get user's feedback history
app.get("/feedback", async (c) => {
  const userId = c.get("userId");
  const status = c.req.query("status");
  const type = c.req.query("type");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");

  try {
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM beta_feedback WHERE user_id = ?";
    const params: any[] = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const feedback = await mcp.db
      .prepare(query)
      .bind(...params)
      .all();

    return c.json({
      success: true,
      data: {
        feedback: feedback.results || [],
        pagination: {
          page,
          limit,
          total: feedback.results?.length || 0,
        },
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Submit survey response
app.post(
  "/survey",
  zValidator(
    "json",
    z.object({
      surveyId: z.string(),
      responses: z.record(z.any()),
      rating: z.number().min(1).max(5),
      wouldRecommend: z.boolean(),
      comments: z.string().optional(),
    }),
  ),
  async (c) => {
    try {
      const surveyData = c.req.valid("json");
      const result = await betaService.submitSurveyResponse(c, surveyData);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        400,
      );
    }
  },
);

// Get beta user dashboard data
app.get("/dashboard", async (c) => {
  const userId = c.get("userId");

  try {
    // Get user info
    const user = await mcp.db
      .prepare(
        'SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"',
      )
      .bind(userId)
      .first();

    if (!user) {
      return c.json(
        {
          success: false,
          error: "Not an active beta user",
        },
        403,
      );
    }

    // Get current scenarios
    const scenarios = await betaService.getTestingScenarios();

    // Get recent feedback
    const recentFeedback = await mcp.db
      .prepare(
        "SELECT * FROM beta_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
      )
      .bind(userId)
      .all();

    // Get activity summary
    const activity = await mcp.db
      .prepare(
        `
        SELECT
          activity_type,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM beta_activities
        WHERE user_id = ? AND created_at > DATE('now', '-7 days')
        GROUP BY activity_type
      `,
      )
      .bind(userId)
      .all();

    // Get rewards summary
    const rewards = await mcp.db
      .prepare(
        `
        SELECT
          reward_type,
          SUM(reward_amount) as total,
          COUNT(*) as count
        FROM beta_rewards
        WHERE user_id = ?
        GROUP BY reward_type
      `,
      )
      .bind(userId)
      .all();

    return c.json({
      success: true,
      data: {
        user,
        scenarios,
        recentFeedback: recentFeedback.results || [],
        activity: activity.results || [],
        rewards: rewards.results || [],
        summary: {
          engagementScore: user.engagement_score,
          totalCredits: user.reward_credits,
          feedbackSubmitted: user.feedback_count,
          bugsReported: user.bugs_reported,
          currentPhase: user.testing_phase,
          daysInBeta: Math.floor(
            (Date.now() - new Date(user.join_date).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        },
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Admin: Get beta metrics
app.get("/admin/metrics", async (c) => {
  const period = c.req.query("period") || "all";

  try {
    const metrics = await betaService.getBetaMetrics(c);

    return c.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      error.message.includes("Unauthorized") ? 403 : 500,
    );
  }
});

// Admin: Generate beta report
app.post(
  "/admin/reports",
  zValidator(
    "json",
    z.object({
      reportType: z.enum(["weekly", "summary", "detailed"]),
      includeFeedback: z.boolean().default(true),
      includeUsers: z.boolean().default(true),
      includeScenarios: z.boolean().default(true),
    }),
  ),
  async (c) => {
    try {
      const reportConfig = c.req.valid("json");
      const report = await betaService.generateBetaReport(
        c,
        reportConfig.reportType,
      );

      return c.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        error.message.includes("Unauthorized") ? 403 : 500,
      );
    }
  },
);

// Admin: Get feedback list
app.get("/admin/feedback", async (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");
  const category = c.req.query("category");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");

  try {
    const offset = (page - 1) * limit;

    let query = `
      SELECT f.*, u.name, u.email, u.company
      FROM beta_feedback f
      JOIN beta_users u ON f.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += " AND f.status = ?";
      params.push(status);
    }

    if (type) {
      query += " AND f.type = ?";
      params.push(type);
    }

    if (category) {
      query += " AND f.category = ?";
      params.push(category);
    }

    query += " ORDER BY f.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const feedback = await mcp.db
      .prepare(query)
      .bind(...params)
      .all();

    const totalCount = await mcp.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM beta_feedback f
        WHERE 1=1
        ${status ? "AND f.status = ?" : ""}
        ${type ? "AND f.type = ?" : ""}
        ${category ? "AND f.category = ?" : ""}
      `,
      )
      .bind(...params.slice(0, -2))
      .first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        feedback: feedback.results || [],
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          pages: Math.ceil((totalCount?.count || 0) / limit),
        },
      },
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Admin: Update feedback status
app.patch(
  "/admin/feedback/:id",
  zValidator(
    "json",
    z.object({
      status: z.enum([
        "new",
        "triaged",
        "in-progress",
        "resolved",
        "closed",
        "deferred",
      ]),
      priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
      assignedTo: z.string().optional(),
      response: z.string().optional(),
    }),
  ),
  async (c) => {
    try {
      const feedbackId = c.req.param("id");
      const updateData = c.req.valid("json");

      await mcp.db
        .prepare(
          `
        UPDATE beta_feedback
        SET status = ?, priority = COALESCE(?, priority),
            assigned_to = COALESCE(?, assigned_to),
            response = COALESCE(?, response),
            updated_at = CURRENT_TIMESTAMP,
            resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
        WHERE id = ?
      `,
        )
        .bind(
          updateData.status,
          updateData.priority,
          updateData.assignedTo,
          updateData.response,
          updateData.status,
          feedbackId,
        )
        .run();

      // Send email notification to user if resolved
      if (updateData.status === "resolved" && updateData.response) {
        const feedback = await mcp.db
          .prepare(
            `
          SELECT u.email, u.name, f.title
          FROM beta_feedback f
          JOIN beta_users u ON f.user_id = u.user_id
          WHERE f.id = ?
        `,
          )
          .bind(feedbackId)
          .first();

        if (feedback) {
          await mcp.email.send({
            to: feedback.email,
            template: "beta-feedback-resolved",
            data: {
              name: feedback.name,
              feedbackTitle: feedback.title,
              response: updateData.response,
            },
          });
        }
      }

      return c.json({
        success: true,
        message: "Feedback updated successfully",
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        500,
      );
    }
  },
);

// Track user activity
app.post(
  "/track",
  zValidator(
    "json",
    z.object({
      activity: z.string(),
      data: z.record(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { activity, data, metadata } = c.req.valid("json");

    try {
      await mcp.db
        .prepare(
          `
        INSERT INTO beta_activities (user_id, activity_type, activity_data, metadata)
        VALUES (?, ?, ?, ?)
      `,
        )
        .bind(
          userId,
          activity,
          JSON.stringify(data || {}),
          JSON.stringify(metadata || {}),
        )
        .run();

      // Update last active date
      await mcp.db
        .prepare(
          "UPDATE beta_users SET last_active_date = CURRENT_TIMESTAMP WHERE user_id = ?",
        )
        .bind(userId)
        .run();

      return c.json({
        success: true,
        message: "Activity tracked",
      });
    } catch (error: any) {
      return c.json(
        {
          success: false,
          error: error.message,
        },
        500,
      );
    }
  },
);

// Get community resources
app.get("/community", async (c) => {
  try {
    const resources = {
      slackInvite: "https://slack.sdlc.ai/beta-invite",
      discordInvite: "https://discord.gg/sdlc-beta",
      communityForum: "https://community.sdlc.ai/beta",
      officeHours: {
        schedule: "Every Tuesday and Thursday at 2 PM EST",
        calendlyUrl: "https://calendly.com/sdlc-beta/office-hours",
      },
      documentation: {
        gettingStarted: "https://docs.sdlc.ai/beta/getting-started",
        testingGuide: "https://docs.sdlc.ai/beta/testing-guide",
        apiReference: "https://docs.sdlc.ai/api",
        sdkDocs: {
          python: "https://docs.sdlc.ai/sdk/python",
          typescript: "https://docs.sdlc.ai/sdk/typescript",
          go: "https://docs.sdlc.ai/sdk/go",
        },
      },
      upcomingEvents: [
        {
          title: "Beta User Showcase",
          date: "2025-11-18T14:00:00Z",
          description: "Share your experience and learn from other beta users",
        },
        {
          title: "Product Roadmap Review",
          date: "2025-11-25T14:00:00Z",
          description: "Get a sneak peek at upcoming features",
        },
      ],
    };

    return c.json({
      success: true,
      data: resources,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500,
    );
  }
});

// Export the app
export default app;
