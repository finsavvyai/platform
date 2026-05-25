/**
 * Beta user dashboard route
 */
import { Hono } from "hono";
import { betaService, mcp, errorResponse } from "./shared";

const app = new Hono();

app.get("/dashboard", async (c) => {
  const userId = c.get("userId");
  try {
    const user = await mcp.db
      .prepare('SELECT * FROM beta_users WHERE user_id = ? AND application_status = "active"')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ success: false, error: "Not an active beta user" }, 403);
    }

    const scenarios = await betaService.getTestingScenarios();

    const recentFeedback = await mcp.db
      .prepare("SELECT * FROM beta_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 5")
      .bind(userId)
      .all();

    const activity = await mcp.db
      .prepare(`
        SELECT activity_type, COUNT(*) as count, MAX(created_at) as last_occurrence
        FROM beta_activities
        WHERE user_id = ? AND created_at > DATE('now', '-7 days')
        GROUP BY activity_type
      `)
      .bind(userId)
      .all();

    const rewards = await mcp.db
      .prepare(`
        SELECT reward_type, SUM(reward_amount) as total, COUNT(*) as count
        FROM beta_rewards WHERE user_id = ?
        GROUP BY reward_type
      `)
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
            (Date.now() - new Date(user.join_date).getTime()) / (1000 * 60 * 60 * 24),
          ),
        },
      },
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

export default app;
