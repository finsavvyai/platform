// Regression tests for C-001 (cross-tenant Cepien workspace hijack).
// v1.6.6 stored a single `cepien:lookup:${workspaceId}` pointer that any
// later registration overwrote; webhooks then routed to the attacker's
// credentials. Fix = list of candidates + per-candidate HMAC verification.
//
// These tests drive the real `cepienRoutes` Hono app against an in-memory
// KV mock, so they cover the full webhook request lifecycle end-to-end.

import { describe, it, expect, beforeEach } from "vitest";
import { cepienRoutes } from "./cepien-routes";
import { saveWorkspace, type StoredWorkspace } from "./cepien-storage";
import {
  legacyLookupKey, wsListKey,
} from "./cepien-workspace-list";
import { hmacSha256Hex, type CepienWebhookPayload } from "./cepien-integration";
import type { Env } from "./types";

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
    async list({ prefix }: { prefix?: string } = {}) {
      const keys = [...store.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cursor: "" };
    },
  } as unknown as KVNamespace;
}

function makeEnv(kv: KVNamespace): Env {
  return { RUNNERS: kv } as unknown as Env;
}

function buildPayload(workspaceId: string): CepienWebhookPayload {
  return {
    event: "recommendation.code_generated",
    recommendation_id: "rec_abcdef123456",
    title: "Fix: cross-tenant hijack test",
    pr: {
      url: "https://github.com/org/repo/pull/1",
      owner: "org", repo: "repo", number: 1,
      branch: "cepien/test", head_sha: "deadbeef",
    },
    source: { generator: "claude-code", model: "claude-opus-4-7" },
    cepien_workspace_id: workspaceId,
    callback_url: "https://api.cepien.ai/cb/1",
  };
}

function makeWorkspace(
  sub: string, workspaceId: string, secret: string, id: string,
): StoredWorkspace {
  const now = "2026-04-17T00:00:00Z";
  return {
    id, user_sub: sub, workspaceId, label: sub,
    sharedSecret: secret, callbackToken: `tok_${sub}`,
    created_at: now, updated_at: now,
  };
}

async function postWebhook(
  env: Env, payload: CepienWebhookPayload, secret: string | null,
): Promise<Response> {
  const raw = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) {
    headers["x-cepien-signature"] = `sha256=${await hmacSha256Hex(secret, raw)}`;
  }
  const req = new Request("http://local/webhook", { method: "POST", headers, body: raw });
  return cepienRoutes.fetch(req, env);
}

const WS_ID = "ws_shared";
const SUB_A = "user:alice";
const SUB_B = "user:bob";
const SECRET_A = "secret-alice-01234567890123456789";
const SECRET_B = "secret-bob-98765432109876543210";

describe("cepien C-001 hijack regression", () => {
  let kv: KVNamespace;
  let env: Env;
  beforeEach(() => { kv = makeKv(); env = makeEnv(kv); });

  it("single tenant: webhook routes correctly (v1.6.6 parity)", async () => {
    await saveWorkspace(env, makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1"));
    const res = await postWebhook(env, buildPayload(WS_ID), SECRET_A);
    expect(res.status).toBe(202);
    const json = (await res.json()) as { accepted: boolean };
    expect(json.accepted).toBe(true);
  });

  it("two tenants same workspaceId: S_A routes to A, S_B routes to B", async () => {
    await saveWorkspace(env, makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1"));
    await saveWorkspace(env, makeWorkspace(SUB_B, WS_ID, SECRET_B, "c2"));

    const resA = await postWebhook(env, buildPayload(WS_ID), SECRET_A);
    expect(resA.status).toBe(202);
    const resB = await postWebhook(env, buildPayload(WS_ID), SECRET_B);
    expect(resB.status).toBe(202);

    // Attacker with neither secret cannot hijack.
    const resX = await postWebhook(env, buildPayload(WS_ID), "totally-wrong-secret");
    expect(resX.status).toBe(401);
  });

  it("pipeline records pin to owner_sub so callbacks use the right token", async () => {
    await saveWorkspace(env, makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1"));
    await saveWorkspace(env, makeWorkspace(SUB_B, WS_ID, SECRET_B, "c2"));

    const resA = await postWebhook(env, buildPayload(WS_ID), SECRET_A);
    const { pipeline_id: plA } = (await resA.json()) as { pipeline_id: string };
    const rawA = await kv.get(`cepien:pipeline:${plA}`);
    expect(rawA).not.toBeNull();
    const recA = JSON.parse(rawA as string) as { owner_sub: string };
    expect(recA.owner_sub).toBe(SUB_A);
  });

  it("unknown workspaceId returns 404", async () => {
    const res = await postWebhook(env, buildPayload("ws_ghost"), "anything");
    expect(res.status).toBe(404);
  });

  it("all candidates HMAC-mismatch → 401", async () => {
    await saveWorkspace(env, makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1"));
    await saveWorkspace(env, makeWorkspace(SUB_B, WS_ID, SECRET_B, "c2"));
    const res = await postWebhook(env, buildPayload(WS_ID), "neither-matches");
    expect(res.status).toBe(401);
  });

  it("missing signature header → 401", async () => {
    await saveWorkspace(env, makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1"));
    const res = await postWebhook(env, buildPayload(WS_ID), null);
    expect(res.status).toBe(401);
  });

  it("migrates legacy lookup pointer on first webhook read", async () => {
    // Simulate a v1.6.6 deployment: primary record exists + legacy pointer,
    // but no workspace_connections list yet.
    const w = makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1");
    await kv.put(`cepien:workspace:${SUB_A}:${WS_ID}`, JSON.stringify(w));
    await kv.put(legacyLookupKey(WS_ID), `cepien:workspace:${SUB_A}:${WS_ID}`);
    expect(await kv.get(wsListKey(WS_ID))).toBeNull();

    const res = await postWebhook(env, buildPayload(WS_ID), SECRET_A);
    expect(res.status).toBe(202);

    // Legacy pointer removed; new candidate list populated.
    expect(await kv.get(legacyLookupKey(WS_ID))).toBeNull();
    const listRaw = await kv.get(wsListKey(WS_ID));
    expect(listRaw).not.toBeNull();
  });

  it("coexistence: both tenants can be listed independently", async () => {
    await saveWorkspace(env, makeWorkspace(SUB_A, WS_ID, SECRET_A, "c1"));
    await saveWorkspace(env, makeWorkspace(SUB_B, WS_ID, SECRET_B, "c2"));
    // Both primary records still present — no cross-tenant overwrite.
    const keyA = `cepien:workspace:${SUB_A}:${WS_ID}`;
    const keyB = `cepien:workspace:${SUB_B}:${WS_ID}`;
    expect(await kv.get(keyA)).not.toBeNull();
    expect(await kv.get(keyB)).not.toBeNull();
  });
});
