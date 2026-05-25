/**
 * Admin routes for beta testing management
 */
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { betaService, mcp, errorResponse } from "./shared";
import type { QueryParam } from "../types";

const app = new Hono();

app.post(
  "/admin/applications/:id/review",
  zValidator("json", z.object({
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().optional(),
  })),
  async (c) => {
    try {
      const applicationId = c.req.param("id");
      const { decision, notes } = c.req.valid("json");
      const result = await betaService.reviewApplication(c, applicationId, decision, notes);
      return c.json({ success: true, data: result });
    } catch (error: unknown) {
      const msg = errorResponse(error);
      return c.json({ success: false, error: msg }, msg.includes("Unauthorized") ? 403 : 400);
    }
  },
);

app.get("/admin/applications", async (c) => {
  const status = c.req.query("status") as "pending" | "approved" | "rejected" | "active" | "completed";
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  try {
    const offset = (page - 1) * limit;
    let query = "SELECT * FROM beta_users";
    const params: QueryParam[] = [];
    if (status) { query += " WHERE application_status = ?"; params.push(status); }
    query += " ORDER BY join_date DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const applications = await mcp.db.prepare(query).bind(...params).all();
    const totalCount = await mcp.db
      .prepare(`SELECT COUNT(*) as count FROM beta_users ${status ? "WHERE application_status = ?" : ""}`)
      .bind(...(status ? [status] : []))
      .first<{ count: number }>();
    return c.json({
      success: true,
      data: {
        applications: applications.results || [],
        pagination: { page, limit, total: totalCount?.count || 0, pages: Math.ceil((totalCount?.count || 0) / limit) },
      },
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

app.get("/admin/metrics", async (c) => {
  try {
    const metrics = await betaService.getBetaMetrics(c);
    return c.json({ success: true, data: metrics });
  } catch (error: unknown) {
    const msg = errorResponse(error);
    return c.json({ success: false, error: msg }, msg.includes("Unauthorized") ? 403 : 500);
  }
});

app.post(
  "/admin/reports",
  zValidator("json", z.object({
    reportType: z.enum(["weekly", "summary", "detailed"]),
    includeFeedback: z.boolean().default(true),
    includeUsers: z.boolean().default(true),
    includeScenarios: z.boolean().default(true),
  })),
  async (c) => {
    try {
      const reportConfig = c.req.valid("json");
      const report = await betaService.generateBetaReport(c, reportConfig.reportType);
      return c.json({ success: true, data: report });
    } catch (error: unknown) {
      const msg = errorResponse(error);
      return c.json({ success: false, error: msg }, msg.includes("Unauthorized") ? 403 : 500);
    }
  },
);

app.get("/admin/feedback", async (c) => {
  const status = c.req.query("status");
  const type = c.req.query("type");
  const category = c.req.query("category");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  try {
    const offset = (page - 1) * limit;
    let query = `SELECT f.*, u.name, u.email, u.company FROM beta_feedback f JOIN beta_users u ON f.user_id = u.user_id WHERE 1=1`;
    const params: QueryParam[] = [];
    if (status) { query += " AND f.status = ?"; params.push(status); }
    if (type) { query += " AND f.type = ?"; params.push(type); }
    if (category) { query += " AND f.category = ?"; params.push(category); }
    query += " ORDER BY f.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const feedback = await mcp.db.prepare(query).bind(...params).all();
    const totalCount = await mcp.db
      .prepare(`SELECT COUNT(*) as count FROM beta_feedback f WHERE 1=1 ${status ? "AND f.status = ?" : ""} ${type ? "AND f.type = ?" : ""} ${category ? "AND f.category = ?" : ""}`)
      .bind(...params.slice(0, -2))
      .first<{ count: number }>();
    return c.json({
      success: true,
      data: {
        feedback: feedback.results || [],
        pagination: { page, limit, total: totalCount?.count || 0, pages: Math.ceil((totalCount?.count || 0) / limit) },
      },
    });
  } catch (error: unknown) {
    return c.json({ success: false, error: errorResponse(error) }, 500);
  }
});

app.patch(
  "/admin/feedback/:id",
  zValidator("json", z.object({
    status: z.enum(["new", "triaged", "in-progress", "resolved", "closed", "deferred"]),
    priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
    assignedTo: z.string().optional(),
    response: z.string().optional(),
  })),
  async (c) => {
    try {
      const feedbackId = c.req.param("id");
      const updateData = c.req.valid("json");
      await mcp.db
        .prepare(`UPDATE beta_feedback SET status = ?, priority = COALESCE(?, priority), assigned_to = COALESCE(?, assigned_to), response = COALESCE(?, response), updated_at = CURRENT_TIMESTAMP, resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id = ?`)
        .bind(updateData.status, updateData.priority, updateData.assignedTo, updateData.response, updateData.status, feedbackId)
        .run();
      if (updateData.status === "resolved" && updateData.response) {
        const feedback = await mcp.db
          .prepare(`SELECT u.email, u.name, f.title FROM beta_feedback f JOIN beta_users u ON f.user_id = u.user_id WHERE f.id = ?`)
          .bind(feedbackId)
          .first();
        if (feedback) {
          await mcp.email.send({
            to: feedback.email,
            template: "beta-feedback-resolved",
            data: { name: feedback.name, feedbackTitle: feedback.title, response: updateData.response },
          });
        }
      }
      return c.json({ success: true, message: "Feedback updated successfully" });
    } catch (error: unknown) {
      return c.json({ success: false, error: errorResponse(error) }, 500);
    }
  },
);

export default app;
