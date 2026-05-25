import { Hono } from "hono";
import { verifyJwt, createJwt } from "./auth";
import type { Env } from "./types";
import { upsertUser } from "./usage";

type SSOEnv = Env;

export const ssoRoutes = new Hono<{ Bindings: SSOEnv }>();

interface SSOConfig {
  id: string;
  project_id: string;
  provider: string;
  entity_id: string;
  sso_url: string;
  certificate: string;
  allow_idp_initiated: number;
  auto_provision: number;
  default_role: string;
  enabled: number;
}

// GET /config — retrieve SSO config for a project
ssoRoutes.get("/config/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const config = await c.env.DB.prepare(
    "SELECT id, project_id, provider, entity_id, sso_url, allow_idp_initiated, auto_provision, default_role, enabled FROM sso_configs WHERE project_id = ?"
  ).bind(c.req.param("projectId")).first<SSOConfig>();

  if (!config) return c.json({ configured: false });
  return c.json({ configured: true, config });
});

// PUT /config/:projectId — create or update SSO config
ssoRoutes.put("/config/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    entity_id: string;
    sso_url: string;
    certificate: string;
    allow_idp_initiated?: boolean;
    auto_provision?: boolean;
    default_role?: string;
  }>();

  if (!body.entity_id || !body.sso_url || !body.certificate) {
    return c.json({ error: "entity_id, sso_url, and certificate are required" }, 400);
  }

  await c.env.DB.prepare(`
    INSERT INTO sso_configs (project_id, entity_id, sso_url, certificate, allow_idp_initiated, auto_provision, default_role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      entity_id = excluded.entity_id,
      sso_url = excluded.sso_url,
      certificate = excluded.certificate,
      allow_idp_initiated = excluded.allow_idp_initiated,
      auto_provision = excluded.auto_provision,
      default_role = excluded.default_role,
      updated_at = datetime('now')
  `).bind(
    c.req.param("projectId"),
    body.entity_id,
    body.sso_url,
    body.certificate,
    body.allow_idp_initiated ? 1 : 0,
    body.auto_provision !== false ? 1 : 0,
    body.default_role || "developer",
  ).run();

  return c.json({ ok: true });
});

// POST /saml/callback — handle SAML assertion (simplified)
ssoRoutes.post("/saml/callback", async (c) => {
  let body: FormData;
  try { body = await c.req.formData(); } catch { return c.json({ error: "invalid form data" }, 400); }
  const samlResponse = body.get("SAMLResponse") as string;
  if (!samlResponse) return c.json({ error: "missing SAMLResponse" }, 400);

  // Decode base64 SAML response
  const xml = atob(samlResponse);

  // Extract basic fields from SAML assertion (simplified parsing)
  const nameId = extractXmlValue(xml, "NameID");
  const email = extractXmlValue(xml, "mail") || extractXmlValue(xml, "emailaddress") || nameId;
  const displayName = extractXmlValue(xml, "displayname") || extractXmlValue(xml, "givenname") || email;

  if (!email) return c.json({ error: "no email in SAML assertion" }, 400);

  // Find which project this SSO is for (from RelayState or Issuer)
  const relayState = body.get("RelayState") as string;
  if (!relayState) return c.json({ error: "missing RelayState" }, 400);

  const config = await c.env.DB.prepare(
    "SELECT * FROM sso_configs WHERE project_id = ? AND enabled = 1"
  ).bind(relayState).first<SSOConfig>();

  if (!config) return c.json({ error: "SSO not configured" }, 404);

  // Auto-provision user if enabled
  const sub = `saml:${email}`;
  await upsertUser(c.env.DB, sub, email.split("@")[0], "saml" as any);

  // Auto-add to project if auto_provision is on
  if (config.auto_provision) {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
      VALUES (?, ?, ?, 'saml', ?, '[]')
    `).bind(config.project_id, sub, email.split("@")[0], config.default_role).run();
  }

  // Issue JWT
  const now = Math.floor(Date.now() / 1000);
  const jwt = await createJwt(
    { sub, login: email.split("@")[0], provider: "saml" as any, iat: now, exp: now + 86400 },
    c.env.JWT_SECRET,
  );

  // Redirect to dashboard with token
  const appUrl = c.env.APP_URL || "https://app.pushci.dev";
  return c.redirect(`${appUrl}/auth/callback?token=${jwt}&provider=saml`);
});

// DELETE /config/:projectId — remove SSO config
ssoRoutes.delete("/config/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  await c.env.DB.prepare("DELETE FROM sso_configs WHERE project_id = ?")
    .bind(c.req.param("projectId")).run();
  return c.json({ ok: true });
});

function extractXmlValue(xml: string, tag: string): string | null {
  const patterns = [
    new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<`, "i"),
    new RegExp(`Name="${tag}"[^>]*><[^>]*>([^<]+)<`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1].trim();
  }
  return null;
}
