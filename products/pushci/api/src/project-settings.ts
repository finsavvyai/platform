// Project Settings API — deploy targets, channel connections.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";

export const settingsRoutes = new Hono<{ Bindings: Env }>();

const DEPLOY_TARGETS = [
  { id: "cloudflare-pages", name: "Cloudflare Pages", icon: "cf" },
  { id: "cloudflare-workers", name: "Cloudflare Workers", icon: "cf" },
  { id: "vercel", name: "Vercel", icon: "vercel" },
  { id: "netlify", name: "Netlify", icon: "netlify" },
  { id: "aws-ecs", name: "AWS ECS", icon: "aws" },
  { id: "aws-lambda", name: "AWS Lambda", icon: "aws" },
  { id: "aws-s3", name: "AWS S3", icon: "aws" },
  { id: "gcp-cloud-run", name: "GCP Cloud Run", icon: "gcp" },
  { id: "azure-app-service", name: "Azure App Service", icon: "azure" },
  { id: "fly", name: "Fly.io", icon: "fly" },
  { id: "railway", name: "Railway", icon: "railway" },
  { id: "docker", name: "Docker", icon: "docker" },
  { id: "kubernetes", name: "Kubernetes", icon: "k8s" },
  { id: "ssh", name: "SSH", icon: "ssh" },
];

// List available deploy targets
settingsRoutes.get("/settings/deploy-targets", (c) => {
  return c.json({ targets: DEPLOY_TARGETS });
});

// Set deploy target for a project
settingsRoutes.put("/settings/:projectId/deploy-target", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first();
  if (!membership) return c.json({ error: "forbidden" }, 403);

  const { target } = await c.req.json<{ target: string }>();
  await c.env.DB.prepare("UPDATE projects SET deploy_target = ? WHERE id = ?")
    .bind(target, projectId).run();
  return c.json({ ok: true, deploy_target: target });
});

// Connect a notification channel to a project
settingsRoutes.put("/settings/:projectId/channel", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const chMembership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first();
  if (!chMembership) return c.json({ error: "forbidden" }, 403);

  const { channel_id } = await c.req.json<{ channel_id: string | null }>();
  await c.env.DB.prepare("UPDATE projects SET channel_id = ? WHERE id = ?")
    .bind(channel_id, projectId).run();
  return c.json({ ok: true, channel_id });
});

// Get project settings — requires membership
settingsRoutes.get("/settings/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const getMembership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first();
  if (!getMembership) return c.json({ error: "forbidden" }, 403);

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId).first();
  if (!project) return c.json({ error: "not found" }, 404);

  // Only show channels belonging to this user
  const channels = await c.env.DB.prepare("SELECT id, channel_type as platform, label as name FROM channel_connections WHERE user_id = ?")
    .all<{ id: string; platform: string; name: string }>();

  return c.json({
    deploy_target: project.deploy_target || null,
    channel_id: project.channel_id || null,
    available_targets: DEPLOY_TARGETS,
    available_channels: channels.results || [],
    webhook_url: `https://api.pushci.dev/webhook/${project.platform}`,
    webhook_secret: project.webhook_secret,
  });
});

// Disconnect a project — removes project, memberships, runners, runs
settingsRoutes.delete("/settings/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const project = await c.env.DB.prepare("SELECT repo FROM projects WHERE id = ?")
    .bind(projectId).first<{ repo: string }>();
  if (!project) return c.json({ error: "not found" }, 404);

  // Verify user is maintainer
  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?"
  ).bind(projectId, user.sub).first<{ role: string }>();
  if (!membership || membership.role !== "maintainer") {
    return c.json({ error: "only maintainers can disconnect" }, 403);
  }

  // Delete in order: runners, memberships, runs, project
  await c.env.DB.prepare("DELETE FROM runners WHERE project_id = ?").bind(projectId).run();
  await c.env.DB.prepare("DELETE FROM project_memberships WHERE project_id = ?").bind(projectId).run();
  await c.env.DB.prepare("DELETE FROM deployment_policies WHERE project_id = ?").bind(projectId).run();
  await c.env.DB.prepare("DELETE FROM runs WHERE repo = ?").bind(project.repo).run();
  await c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();

  return c.json({ ok: true, disconnected: project.repo });
});
