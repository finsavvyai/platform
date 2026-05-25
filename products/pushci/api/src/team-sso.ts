// SSO directory import: GitHub Org, Microsoft 365, Google Workspace, Okta.

import { Hono } from "hono";
import { getAuthUser } from "./team-auth";
import type { Env } from "./types";

type Bindings = Env;
export const teamSsoRoutes = new Hono<{ Bindings: Bindings }>();

// POST /import/github — import org members from GitHub
teamSsoRoutes.post("/import/github", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ org: string; project_id: string; role?: string }>();
  if (!body.org || !body.project_id) return c.json({ error: "org and project_id required" }, 400);

  const userRow = await c.env.DB.prepare(
    "SELECT github_token FROM users WHERE sub = ?"
  ).bind(user.sub).first<{ github_token: string | null }>();
  if (!userRow?.github_token) return c.json({ error: "GitHub token not found — re-login" }, 400);

  const ghRes = await fetch(`https://api.github.com/orgs/${body.org}/members?per_page=100`, {
    headers: { Authorization: `token ${userRow.github_token}`, "User-Agent": "PushCI/1.0" },
  });
  if (!ghRes.ok) return c.json({ error: `GitHub API error: ${ghRes.status}` }, 502);

  const members = await ghRes.json() as Array<{ login: string; id: number }>;
  const role = body.role || "developer";
  let imported = 0;
  for (const m of members.slice(0, 25)) {
    await c.env.DB.prepare(`
      INSERT INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
      VALUES (?, ?, ?, 'github', ?, '[]') ON CONFLICT(project_id, user_sub) DO NOTHING
    `).bind(body.project_id, `github:${m.id}`, m.login, role).run();
    imported++;
  }
  return c.json({ ok: true, imported, org: body.org, members: members.slice(0, 25).map(m => m.login) });
});

// POST /import/microsoft — import from Microsoft 365 / Entra ID
teamSsoRoutes.post("/import/microsoft", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ access_token: string; project_id: string; role?: string }>();
  if (!body.access_token || !body.project_id) return c.json({ error: "access_token and project_id required" }, 400);

  const graphRes = await fetch(
    "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=50",
    { headers: { Authorization: `Bearer ${body.access_token}` } },
  );
  if (!graphRes.ok) return c.json({ error: `Microsoft Graph error: ${graphRes.status}` }, 502);

  const data = await graphRes.json() as { value: Array<{ id: string; displayName: string; mail: string; userPrincipalName: string }> };
  const role = body.role || "developer";
  let imported = 0;
  for (const m of data.value.slice(0, 25)) {
    const email = m.mail || m.userPrincipalName;
    await c.env.DB.prepare(`
      INSERT INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
      VALUES (?, ?, ?, 'microsoft', ?, '[]') ON CONFLICT(project_id, user_sub) DO NOTHING
    `).bind(body.project_id, `microsoft:${m.id}`, email.split("@")[0], role).run();
    imported++;
  }
  return c.json({ ok: true, imported, members: data.value.slice(0, 25).map(m => ({ name: m.displayName, email: m.mail || m.userPrincipalName })) });
});

// POST /import/google — import from Google Workspace
teamSsoRoutes.post("/import/google", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ access_token: string; domain: string; project_id: string; role?: string }>();
  if (!body.access_token || !body.domain || !body.project_id) return c.json({ error: "access_token, domain, project_id required" }, 400);

  const gRes = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users?domain=${encodeURIComponent(body.domain)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${body.access_token}` } },
  );
  if (!gRes.ok) return c.json({ error: `Google Directory error: ${gRes.status}` }, 502);

  const data = await gRes.json() as { users: Array<{ id: string; name: { fullName: string }; primaryEmail: string }> };
  const role = body.role || "developer";
  let imported = 0;
  for (const m of (data.users || []).slice(0, 25)) {
    await c.env.DB.prepare(`
      INSERT INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
      VALUES (?, ?, ?, 'google', ?, '[]') ON CONFLICT(project_id, user_sub) DO NOTHING
    `).bind(body.project_id, `google:${m.id}`, m.primaryEmail.split("@")[0], role).run();
    imported++;
  }
  return c.json({ ok: true, imported, members: (data.users || []).slice(0, 25).map(m => ({ name: m.name.fullName, email: m.primaryEmail })) });
});

// POST /import/okta — import from Okta
teamSsoRoutes.post("/import/okta", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ okta_domain: string; api_token: string; project_id: string; role?: string }>();
  if (!body.okta_domain || !body.api_token || !body.project_id) return c.json({ error: "okta_domain, api_token, project_id required" }, 400);

  const oktaRes = await fetch(`https://${body.okta_domain}/api/v1/users?limit=50`, {
    headers: { Authorization: `SSWS ${body.api_token}`, Accept: "application/json" },
  });
  if (!oktaRes.ok) return c.json({ error: `Okta API error: ${oktaRes.status}` }, 502);

  const users = await oktaRes.json() as Array<{ id: string; profile: { login: string; firstName: string; lastName: string; email: string } }>;
  const role = body.role || "developer";
  let imported = 0;
  for (const m of users.slice(0, 25)) {
    await c.env.DB.prepare(`
      INSERT INTO project_memberships (project_id, user_sub, login, provider, role, environments_json)
      VALUES (?, ?, ?, 'okta', ?, '[]') ON CONFLICT(project_id, user_sub) DO NOTHING
    `).bind(body.project_id, `okta:${m.id}`, m.profile.email.split("@")[0], role).run();
    imported++;
  }
  return c.json({ ok: true, imported, members: users.slice(0, 25).map(m => ({ name: `${m.profile.firstName} ${m.profile.lastName}`, email: m.profile.email })) });
});
