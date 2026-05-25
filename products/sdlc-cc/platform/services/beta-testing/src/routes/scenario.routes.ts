/**
 * Scenario and activity tracking routes
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { betaService, mcp, activityDataSchema, activityMetadataSchema, errorResponse } from "./shared";

const app = new Hono();

app.get("/scenarios", async (c) => {
  const phase = c.req.query("phase") as
    | "onboarding" | "core" | "advanced" | "load" | "integration";
  try {
    const scenarios = await betaService.getTestingScenarios(phase);
    return c.json({ success: true, data: scenarios });
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

app.post(
  "/scenarios/:id/complete",
  zValidator(
    "json",
    z.object({
      success: z.boolean(),
      timeSpent: z.number(),
      issues: z.array(z.string()).optional(),
      feedback: z.string().optional(),
      attachments: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    try {
      const scenarioId = c.req.param("id");
      const completionData = c.req.valid("json");
      const result = await betaService.completeScenario(c, scenarioId, completionData);
      return c.json({ success: true, data: result });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 400);
    }
  },
);

app.post(
  "/track",
  zValidator(
    "json",
    z.object({
      activity: z.string(),
      data: activityDataSchema.optional(),
      metadata: activityMetadataSchema.optional(),
    }),
  ),
  async (c) => {
    const userId = c.get("userId");
    const { activity, data, metadata } = c.req.valid("json");
    try {
      await mcp.db
        .prepare(`INSERT INTO beta_activities (user_id, activity_type, activity_data, metadata) VALUES (?, ?, ?, ?)`)
        .bind(userId, activity, JSON.stringify(data || {}), JSON.stringify(metadata || {}))
        .run();
      await mcp.db
        .prepare("UPDATE beta_users SET last_active_date = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(userId)
        .run();
      return c.json({ success: true, message: "Activity tracked" });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 500);
    }
  },
);

app.get("/community", async (c) => {
  try {
    const resources = {
      slackInvite: "https://slack.sdlc.cc/beta-invite",
      discordInvite: "https://discord.gg/sdlc-beta",
      communityForum: "https://community.sdlc.cc/beta",
      officeHours: {
        schedule: "Every Tuesday and Thursday at 2 PM EST",
        calendlyUrl: "https://calendly.com/sdlc-beta/office-hours",
      },
      documentation: {
        gettingStarted: "https://docs.sdlc.cc/beta/getting-started",
        testingGuide: "https://docs.sdlc.cc/beta/testing-guide",
        apiReference: "https://docs.sdlc.cc/api",
        sdkDocs: {
          python: "https://docs.sdlc.cc/sdk/python",
          typescript: "https://docs.sdlc.cc/sdk/typescript",
          go: "https://docs.sdlc.cc/sdk/go",
        },
      },
    };
    return c.json({ success: true, data: resources });
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

export default app;
