/**
 * Feedback and survey routes
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { betaService, mcp, surveyResponseValueSchema, errorResponse } from "./shared";
import type { QueryParam } from "../types";

const app = new Hono();

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
      return c.json({ success: true, data: result });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 400);
    }
  },
);

app.get("/feedback", async (c) => {
  const userId = c.get("userId");
  const status = c.req.query("status");
  const type = c.req.query("type");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");

  try {
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM beta_feedback WHERE user_id = ?";
    const params: QueryParam[] = [userId];
    if (status) { query += " AND status = ?"; params.push(status); }
    if (type) { query += " AND type = ?"; params.push(type); }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const feedback = await mcp.db.prepare(query).bind(...params).all();
    return c.json({
      success: true,
      data: {
        feedback: feedback.results || [],
        pagination: { page, limit, total: feedback.results?.length || 0 },
      },
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

app.post(
  "/survey",
  zValidator(
    "json",
    z.object({
      surveyId: z.string(),
      responses: z.record(surveyResponseValueSchema),
      rating: z.number().min(1).max(5),
      wouldRecommend: z.boolean(),
      comments: z.string().optional(),
    }),
  ),
  async (c) => {
    try {
      const surveyData = c.req.valid("json");
      const result = await betaService.submitSurveyResponse(c, surveyData);
      return c.json({ success: true, data: result });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 400);
    }
  },
);

export default app;
