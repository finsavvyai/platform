import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type ArtifactEnv = Env & { ARTIFACTS_BUCKET?: R2Bucket };

export const artifactRoutes = new Hono<{ Bindings: ArtifactEnv }>();

interface ArtifactRecord {
  id: string;
  project_id: string;
  name: string;
  version: string;
  type: string;
  size_bytes: number;
  sha256: string | null;
  r2_key: string;
  uploaded_by: string;
  created_at: string;
}

// List artifacts for a project
artifactRoutes.get("/projects/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

  const { results } = await c.env.DB.prepare(
    "SELECT id, project_id, name, version, type, size_bytes, sha256, uploaded_by, created_at FROM artifacts WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).bind(c.req.param("projectId"), limit, offset).all<ArtifactRecord>();

  return c.json({ artifacts: results });
});

// Upload an artifact
artifactRoutes.put("/projects/:projectId/:name/:version", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  if (!c.env.ARTIFACTS_BUCKET) {
    return c.json({ error: "artifact storage not configured" }, 501);
  }

  const projectId = c.req.param("projectId");
  const name = c.req.param("name");
  const version = c.req.param("version");
  const type = c.req.query("type") || "generic";

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: "empty body" }, 400);
  if (body.byteLength > 100 * 1024 * 1024) return c.json({ error: "max 100MB" }, 413);

  // Hash the content
  const hashBuffer = await crypto.subtle.digest("SHA-256", body);
  const sha256 = [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");

  // Store in R2
  const r2Key = `${projectId}/${name}/${version}`;
  await c.env.ARTIFACTS_BUCKET.put(r2Key, body, {
    customMetadata: { project: projectId, name, version, type, uploader: user.sub },
  });

  // Record in DB
  await c.env.DB.prepare(`
    INSERT INTO artifacts (project_id, name, version, type, size_bytes, sha256, r2_key, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, name, version) DO UPDATE SET
      size_bytes = excluded.size_bytes,
      sha256 = excluded.sha256,
      r2_key = excluded.r2_key,
      uploaded_by = excluded.uploaded_by,
      created_at = datetime('now')
  `).bind(projectId, name, version, type, body.byteLength, sha256, r2Key, user.sub).run();

  return c.json({
    id: r2Key,
    name, version, type,
    size_bytes: body.byteLength,
    sha256,
  }, 201);
});

// Download an artifact
artifactRoutes.get("/projects/:projectId/:name/:version/download", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  if (!c.env.ARTIFACTS_BUCKET) {
    return c.json({ error: "artifact storage not configured" }, 501);
  }

  const r2Key = `${c.req.param("projectId")}/${c.req.param("name")}/${c.req.param("version")}`;
  const object = await c.env.ARTIFACTS_BUCKET.get(r2Key);
  if (!object) return c.json({ error: "not found" }, 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${c.req.param("name")}-${c.req.param("version")}"`,
    },
  });
});

// Delete an artifact
artifactRoutes.delete("/projects/:projectId/:name/:version", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  if (!c.env.ARTIFACTS_BUCKET) {
    return c.json({ error: "artifact storage not configured" }, 501);
  }

  const projectId = c.req.param("projectId");
  const name = c.req.param("name");
  const version = c.req.param("version");
  const r2Key = `${projectId}/${name}/${version}`;

  await c.env.ARTIFACTS_BUCKET.delete(r2Key);
  await c.env.DB.prepare(
    "DELETE FROM artifacts WHERE project_id = ? AND name = ? AND version = ?"
  ).bind(projectId, name, version).run();

  return c.json({ ok: true });
});
