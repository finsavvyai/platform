// AWS CodePipeline bridge routes. Mounted at /api/aws.
// Stores per-user credentials in KV under aws:creds:${userSub}.
// Storage primitives (encrypt, decrypt, redact, runtime conversion)
// live in aws-creds-store.ts — this file is just the HTTP surface.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import { type CodePipelineCreds } from "./aws-codepipeline";
import { mountPipelineRoutes } from "./aws-pipeline-routes";
import { resolveExternalId } from "./aws-externalid";
import {
  type StoredCreds,
  deleteCreds,
  loadCreds,
  redact,
  staticCredsAllowed,
  toRuntimeCreds,
  writeCreds,
} from "./aws-creds-store";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;
export const awsRoutes = new Hono<{ Bindings: Bindings }>();

async function getUserSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

// POST /credentials — store or update AWS credentials for the user.
//
// Role-mode security: externalId is enforced (auto-generated if the
// caller omits it) to prevent the AWS confused-deputy attack where
// another principal who learns the role ARN could assume it without
// knowing the per-tenant ExternalId pinned in the trust policy.
//
// Static-mode gate: rejected unless PUSHCI_ALLOW_STATIC_CREDS is set —
// long-lived AWS access keys are a higher-value target than role-mode
// base keys + per-tenant ExternalId.
awsRoutes.post("/credentials", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    region?: string;
    roleArn?: string;
    externalId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }>();

  if (!body.region) return c.json({ error: "region is required" }, 400);

  const hasStatic = body.accessKeyId && body.secretAccessKey;
  const hasRole = body.roleArn;
  if (!hasStatic && !hasRole) {
    return c.json(
      { error: "either (accessKeyId+secretAccessKey) or roleArn is required" },
      400
    );
  }

  const mode: StoredCreds["mode"] = hasRole && !hasStatic ? "role" : "static";
  if (mode === "static" && !staticCredsAllowed(c.env)) {
    return c.json(
      {
        error:
          "static AWS access keys are disabled — use role mode (sts:AssumeRole + externalId). " +
          "Set PUSHCI_ALLOW_STATIC_CREDS=1 to opt in.",
      },
      400
    );
  }
  if (!c.env.PUSHCI_CRED_ENCRYPTION_KEY) {
    return c.json(
      { error: "credential encryption key not configured (PUSHCI_CRED_ENCRYPTION_KEY)" },
      500
    );
  }
  const resolved = resolveExternalId(mode, body.externalId);
  if (!resolved.ok) return c.json({ error: resolved.error }, 400);

  const now = new Date().toISOString();
  const existing = await loadCreds(c.env, sub);
  const stored: StoredCreds = {
    region: body.region,
    mode,
    roleArn: body.roleArn,
    externalId: resolved.externalId,
    accessKeyId: body.accessKeyId,
    secretAccessKey: body.secretAccessKey,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeCreds(c.env, sub, stored);
  await auditConnect(c.env, {
    sub,
    provider: "aws",
    label: `${stored.region}:${stored.mode}`,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: {
      region: stored.region,
      mode: stored.mode,
      ...(stored.roleArn ? { roleArn: stored.roleArn } : {}),
    },
  });

  const warnings: string[] = [];
  if (hasStatic) {
    warnings.push(
      "Long-lived AWS access keys stored. Role-based access (sts:AssumeRole with externalId) is strongly preferred for production."
    );
  }
  if (resolved.generated) {
    warnings.push(
      "externalId auto-generated. Add this value to your role's trust policy under sts:ExternalId before the next AssumeRole call — https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html"
    );
  }
  return c.json({
    ok: true,
    credentials: redact(stored),
    warnings,
    ...(resolved.generated ? { generatedExternalId: resolved.generated } : {}),
  });
});

// DELETE /credentials — clear stored credentials.
awsRoutes.delete("/credentials", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const existing = await loadCreds(c.env, sub);
  await deleteCreds(c.env, sub);
  if (existing) {
    await auditDisconnect(c.env, {
      sub,
      provider: "aws",
      label: `${existing.region}:${existing.mode}`,
      ip: callerIp((k) => c.req.header(k) ?? undefined),
      meta: { region: existing.region, mode: existing.mode },
    });
  }
  return c.json({ ok: true });
});

// GET /credentials — show redacted credentials.
awsRoutes.get("/credentials", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const stored = await loadCreds(c.env, sub);
  if (!stored) return c.json({ configured: false });
  return c.json({ configured: true, credentials: redact(stored) });
});

async function resolveCreds(c: any, sub: string): Promise<CodePipelineCreds | Response> {
  const stored = await loadCreds(c.env, sub);
  if (!stored) return c.json({ error: "aws credentials not configured" }, 400);
  const runtime = await toRuntimeCreds(stored, c.env);
  if (!runtime) {
    return c.json(
      {
        error: stored.mode === "role"
          ? "sts:AssumeRole failed — check role trust policy allows the PushCI account + external ID"
          : "aws credentials misconfigured",
      },
      502
    );
  }
  return runtime;
}

mountPipelineRoutes(awsRoutes, resolveCreds, getUserSub);
