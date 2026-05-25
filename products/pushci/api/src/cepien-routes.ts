// Cepien AI integration routes — mounted at /api/integrations/cepien.
//
// SPECULATIVE — see cepien-integration.ts header for the assumed payload
// shape. /webhook is HMAC-gated (not requireAuth — Cepien calls it); the
// other routes are guarded by requireAuth in api/src/index.ts.
//
// License: Apache-2.0

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "./types";
import {
  type CepienWebhookPayload,
  type CepienCallbackBody,
  validatePayload,
  verifySignature,
  maskRecommendationId,
  postCallback,
} from "./cepien-integration";
import {
  type StoredWorkspace,
  getUserSub,
  redact,
  connKey,
  loadWorkspace,
  loadAllByWorkspaceId,
  listWorkspaces,
  saveWorkspace,
  deleteWorkspace,
} from "./cepien-storage";
import {
  validateCallbackUrl,
  parseCallbackBody,
  isRunnerAuthorized,
} from "./cepien-callback-guard";
import { auditConnect, auditDisconnect, callerIp } from "./audit-connect";

type Bindings = Env;
type CepCtx = Context<{ Bindings: Bindings }>;
export const cepienRoutes = new Hono<{ Bindings: Bindings }>();

const PIPELINE_PREFIX = "cepien:pipeline:";

async function enqueuePipeline(
  env: Env, payload: CepienWebhookPayload, ownerSub: string
): Promise<string> {
  const pipelineId = `pl_${crypto.randomUUID()}`;
  const record = {
    pipeline_id: pipelineId,
    recommendation_id: payload.recommendation_id,
    workspace_id: payload.cepien_workspace_id,
    owner_sub: ownerSub, // C-001 fix: pin callback to authenticated tenant
    pr: payload.pr,
    callback_url: payload.callback_url,
    status: "queued" as const,
    created_at: new Date().toISOString(),
  };
  await env.RUNNERS.put(
    `${PIPELINE_PREFIX}${pipelineId}`,
    JSON.stringify(record),
    { expirationTtl: 86400 * 7 }
  );
  return pipelineId;
}

// --- POST /webhook — called by Cepien (HMAC-gated, no requireAuth) ---
cepienRoutes.post("/webhook", async (c: CepCtx) => {
  const raw = await c.req.text();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const badField = validatePayload(parsed);
  if (badField) return c.json({ error: badField }, 400);
  const payload = parsed as CepienWebhookPayload;

  // C-001 fix: multiple tenants may have registered the same
  // `cepien_workspace_id`. Disambiguate by HMAC — try each candidate's
  // `sharedSecret`; first match is the authentic tenant. No match = 401.
  const candidates = await loadAllByWorkspaceId(c.env, payload.cepien_workspace_id);
  if (candidates.length === 0) return c.json({ error: "workspace not connected" }, 404);

  const sig = c.req.header("x-cepien-signature") ?? c.req.header("X-Cepien-Signature");
  let workspace: StoredWorkspace | null = null;
  for (const cand of candidates) {
    if (await verifySignature(raw, sig, cand.sharedSecret)) {
      workspace = cand;
      break;
    }
  }
  if (!workspace) return c.json({ error: "invalid signature" }, 401);

  const pipelineId = await enqueuePipeline(c.env, payload, workspace.user_sub);
  console.log(
    `[cepien] accepted rec=${maskRecommendationId(payload.recommendation_id)} ` +
    `ws=${payload.cepien_workspace_id} pr=${payload.pr.owner}/${payload.pr.repo}#${payload.pr.number}`
  );
  return c.json({ pipeline_id: pipelineId, accepted: true }, 202);
});

// --- POST /callback — internal: runner posts run finish to bounce to Cepien ---
// H-001 hardening (v1.6.6 audit):
//   - Runner-only Bearer auth via PUSHCI_RUNNER_CALLBACK_SECRET
//   - SSRF-proof allowlist (HTTPS + host *.cepien.ai, no private IPs)
//   - Strict payload shape (no extra fields), no run_url echo from runner
//   - No secrets ever logged
cepienRoutes.post("/callback", async (c: CepCtx) => {
  const auth = c.req.header("authorization") ?? c.req.header("Authorization");
  if (!isRunnerAuthorized(auth, c.env.PUSHCI_RUNNER_CALLBACK_SECRET)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let parsedBody: unknown;
  try { parsedBody = await c.req.json(); } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const checked = parseCallbackBody(parsedBody);
  if (typeof checked === "string") return c.json({ error: checked }, 400);

  const raw = await c.env.RUNNERS.get(`${PIPELINE_PREFIX}${checked.pipeline_id}`);
  if (!raw) return c.json({ error: "pipeline not found" }, 404);
  const record = JSON.parse(raw) as {
    callback_url: string;
    workspace_id: string;
    owner_sub?: string;
    recommendation_id: string;
  };
  // H-001 fix: allowlist the callback URL before any fetch.
  const safeUrl = validateCallbackUrl(record.callback_url);
  if (!safeUrl) {
    console.log(
      `[cepien] blocked callback for pipeline=${checked.pipeline_id} ` +
      `rec=${maskRecommendationId(record.recommendation_id)} — invalid callback host`
    );
    return c.json({ error: "callback_url rejected" }, 400);
  }

  // C-001 fix: use owner_sub captured on the HMAC-verified webhook.
  // Falls back to single-candidate lookup for legacy pipeline records
  // created before v1.6.7; null token if ambiguous (multiple candidates).
  let callbackToken: string | undefined;
  if (record.owner_sub) {
    const w = await loadWorkspace(c.env, record.owner_sub, record.workspace_id);
    callbackToken = w?.callbackToken;
  } else {
    const cands = await loadAllByWorkspaceId(c.env, record.workspace_id);
    if (cands.length === 1) callbackToken = cands[0].callbackToken;
  }

  // Synthesize the public run URL inside the worker — never trust the runner.
  const runUrl = `${c.env.APP_URL}/runs/${encodeURIComponent(checked.pipeline_id)}`;
  const mappedStatus: CepienCallbackBody["status"] =
    checked.status === "stopped" ? "cancelled" : checked.status;
  const out: CepienCallbackBody = {
    status: mappedStatus,
    passed: checked.status === "passed",
    run_url: runUrl,
    duration_ms: checked.duration_ms,
    recommendation_id: record.recommendation_id,
  };
  try {
    const res = await postCallback(safeUrl.toString(), callbackToken, out);
    return c.json({ delivered: res.ok, upstream_status: res.status }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "callback failed";
    return c.json({ error: msg }, 502);
  }
});

// --- POST /connect — store Cepien workspace credentials ---
cepienRoutes.post("/connect", async (c: CepCtx) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{
    workspaceId?: string; sharedSecret?: string;
    callbackToken?: string; label?: string;
  }>();
  if (!body.workspaceId || !body.sharedSecret) {
    return c.json({ error: "workspaceId and sharedSecret are required" }, 400);
  }
  const now = new Date().toISOString();
  const stored: StoredWorkspace = {
    id: crypto.randomUUID(),
    user_sub: sub,
    workspaceId: body.workspaceId,
    label: body.label ?? body.workspaceId,
    sharedSecret: body.sharedSecret,
    callbackToken: body.callbackToken,
    created_at: now, updated_at: now,
  };
  await saveWorkspace(c.env, stored);
  await auditConnect(c.env, {
    sub,
    provider: "cepien",
    label: stored.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: { workspaceId: stored.workspaceId },
  });
  return c.json({ workspace: redact(stored) }, 201);
});

// --- GET /connections — list the caller's connected workspaces ---
cepienRoutes.get("/connections", async (c: CepCtx) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const workspaces = await listWorkspaces(c.env, sub);
  return c.json({ workspaces: workspaces.map(redact) });
});

// --- DELETE /connections/:id — revoke a workspace (:id = workspaceId) ---
cepienRoutes.delete("/connections/:id", async (c: CepCtx) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const workspaceId = c.req.param("id");
  if (!workspaceId) return c.json({ error: "workspace id required" }, 400);
  const existing = await loadWorkspace(c.env, sub, workspaceId);
  if (!existing) return c.json({ error: "not found" }, 404);
  await deleteWorkspace(c.env, sub, workspaceId);
  await auditDisconnect(c.env, {
    sub,
    provider: "cepien",
    label: existing.label,
    ip: callerIp((k) => c.req.header(k) ?? undefined),
    meta: { workspaceId: existing.workspaceId },
  });
  void connKey; // key helper re-exported for tests
  return c.json({ ok: true });
});
