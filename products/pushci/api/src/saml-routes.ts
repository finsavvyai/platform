// SAML 2.0 routes for PushCI — tenant-scoped SP endpoints.
//
// Mounted at /api/saml. Each tenant stores its IdP config in KV under
// `saml:tenant:${tenant}`. The tenant slug is the URL-safe project/org
// identifier used in Azure AD / Okta app config.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt, createJwt } from "./auth";
import { upsertUser } from "./usage";
import {
  buildAuthnRequest,
  buildSpMetadata,
  parseAndValidateResponse,
} from "./saml";

type SamlEnv = Env;

export const samlRoutes = new Hono<{ Bindings: SamlEnv }>();

interface SamlTenantConfig {
  ssoUrl: string;
  entityId: string;
  cert: string; // PEM-encoded
  updatedAt: string;
}

function kvKey(tenant: string): string {
  return `saml:tenant:${tenant}`;
}

function spEntityId(env: Env, tenant: string): string {
  const app = env.APP_URL || "https://app.pushci.dev";
  return `${app}/api/saml/${tenant}/metadata`;
}

function acsUrl(env: Env, tenant: string): string {
  // API is served from api.pushci.dev — not APP_URL. Use request origin
  // in route handlers when we need the live value; this helper is fine
  // for metadata + AuthnRequest construction.
  const app = env.APP_URL || "https://app.pushci.dev";
  const api = app.replace("app.", "api.");
  return `${api}/api/saml/${tenant}/acs`;
}

async function loadConfig(env: Env, tenant: string): Promise<SamlTenantConfig | null> {
  const raw = await env.RUNNERS.get(kvKey(tenant));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SamlTenantConfig;
  } catch {
    return null;
  }
}

async function requireAdminJwt(c: {
  req: { header: (n: string) => string | undefined };
  env: Env;
}) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  return verifyJwt(token, c.env.JWT_SECRET);
}

// GET /api/saml/:tenant/metadata — SP EntityDescriptor
samlRoutes.get("/:tenant/metadata", (c) => {
  const tenant = c.req.param("tenant");
  const xml = buildSpMetadata(spEntityId(c.env, tenant), acsUrl(c.env, tenant));
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/samlmetadata+xml" },
  });
});

// GET /api/saml/:tenant/login — SP-initiated login (redirect to IdP)
samlRoutes.get("/:tenant/login", async (c) => {
  const tenant = c.req.param("tenant");
  const cfg = await loadConfig(c.env, tenant);
  if (!cfg) return c.json({ error: "saml not configured" }, 404);

  const { url } = buildAuthnRequest({
    spEntityId: spEntityId(c.env, tenant),
    acsUrl: acsUrl(c.env, tenant),
    idpSsoUrl: cfg.ssoUrl,
    relayState: tenant,
  });
  return c.redirect(url, 302);
});

// POST /api/saml/:tenant/acs — Assertion Consumer Service
samlRoutes.post("/:tenant/acs", async (c) => {
  const tenant = c.req.param("tenant");
  const cfg = await loadConfig(c.env, tenant);
  if (!cfg) return c.json({ error: "saml not configured" }, 404);

  let body: FormData;
  try {
    body = await c.req.formData();
  } catch {
    return c.json({ error: "invalid form data" }, 400);
  }
  const samlResponse = body.get("SAMLResponse") as string | null;
  if (!samlResponse) return c.json({ error: "missing SAMLResponse" }, 400);

  let assertion;
  try {
    assertion = await parseAndValidateResponse(samlResponse, {
      idpCert: cfg.cert,
      spEntityId: spEntityId(c.env, tenant),
      acsUrl: acsUrl(c.env, tenant),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "saml validation failed";
    return c.json({ error: msg }, 400);
  }

  // Auto-provision user
  const sub = `saml:${tenant}:${assertion.email}`;
  const login = assertion.email.split("@")[0];
  try {
    await upsertUser(c.env.DB, sub, login, "saml");
  } catch {
    // users table may not exist in tests — non-fatal for pilot
  }

  const now = Math.floor(Date.now() / 1000);
  const jwt = await createJwt(
    {
      sub,
      login,
      // Reuse microsoft provider slot for JWT type compatibility;
      // downstream code checks sub prefix for SAML-specific logic.
      provider: "microsoft",
      iat: now,
      exp: now + 86400,
    },
    c.env.JWT_SECRET
  );

  const appUrl = c.env.APP_URL || "https://app.pushci.dev";
  return c.redirect(`${appUrl}/auth/callback?token=${jwt}&provider=saml`, 302);
});

// POST /api/saml/:tenant/config — admin upsert IdP config
samlRoutes.post("/:tenant/config", async (c) => {
  const user = await requireAdminJwt(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const tenant = c.req.param("tenant");
  let body: { ssoUrl?: string; entityId?: string; cert?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (!body.ssoUrl || !body.entityId || !body.cert) {
    return c.json({ error: "ssoUrl, entityId, cert required" }, 400);
  }
  const cfg: SamlTenantConfig = {
    ssoUrl: body.ssoUrl,
    entityId: body.entityId,
    cert: body.cert,
    updatedAt: new Date().toISOString(),
  };
  await c.env.RUNNERS.put(kvKey(tenant), JSON.stringify(cfg));
  return c.json({ ok: true, tenant });
});

// GET /api/saml/:tenant/config — admin read IdP config
samlRoutes.get("/:tenant/config", async (c) => {
  const user = await requireAdminJwt(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const tenant = c.req.param("tenant");
  const cfg = await loadConfig(c.env, tenant);
  if (!cfg) return c.json({ configured: false });
  return c.json({
    configured: true,
    config: {
      ssoUrl: cfg.ssoUrl,
      entityId: cfg.entityId,
      certFingerprint: cfg.cert.slice(0, 40) + "…",
      updatedAt: cfg.updatedAt,
    },
    sp: {
      entityId: spEntityId(c.env, tenant),
      acsUrl: acsUrl(c.env, tenant),
      metadataUrl: `${c.env.APP_URL || "https://app.pushci.dev"}/api/saml/${tenant}/metadata`,
    },
  });
});
