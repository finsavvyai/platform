/**
 * Beta application and onboarding routes
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { betaService, mcp, errorResponse } from "./shared";
import type { QueryParam } from "../types";

const app = new Hono();

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
      agreeToTerms: z.boolean().refine((v) => v === true, "Must agree to terms"),
    }),
  ),
  async (c) => {
    try {
      const application = c.req.valid("json");
      const result = await betaService.applyForBeta(c, application);
      return c.json({ success: true, data: result });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 400);
    }
  },
);

app.get("/application/status", async (c) => {
  const userId = c.get("userId");
  try {
    const application = await mcp.db
      .prepare(
        `SELECT * FROM beta_users WHERE user_id = ? OR email = (SELECT email FROM users WHERE id = ?)`,
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
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

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
      return c.json({ success: true, data: result });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 400);
    }
  },
);

export default app;
