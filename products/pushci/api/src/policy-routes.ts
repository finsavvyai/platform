// PushCI policy routes — CRUD for policies + evaluation endpoint.
//
// Policies are stored per-tenant in KV under `policy:${sub}:${policyId}`.
// OPA remote config is stored under `policy:opa:${sub}` with the bearer
// token encrypted via AES-256-GCM using a key derived from JWT_SECRET.
//
// Mounted at /api/policy; callers are authenticated by requireAuth in
// api/src/index.ts so we can trust c.req.header("authorization").
//
// License: Apache-2.0

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";
import { validatePolicy, evaluate, type Policy } from "./policy-engine";
import { evaluateRemote } from "./policy-opa-remote";

type Bindings = Env;
export const policyRoutes = new Hono<{ Bindings: Bindings }>();

const POLICY_PREFIX = "policy:";
const OPA_PREFIX = "policy:opa:";

interface StoredPolicy extends Policy {
  id: string;
  created_at: string;
  updated_at: string;
}

interface StoredOpaConfig {
  opaUrl: string;
  tokenCiphertext: string | null; // base64(iv|ciphertext|tag)
  dataPath?: string;
  updated_at: string;
}

async function getUserSub(c: any): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload ? payload.sub : null;
}

function policyKey(sub: string, id: string): string {
  return `${POLICY_PREFIX}${sub}:${id}`;
}

function opaKey(sub: string): string {
  return `${OPA_PREFIX}${sub}`;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptToken(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return b64encode(combined);
}

async function decryptToken(ciphertext: string, secret: string): Promise<string | null> {
  try {
    const key = await deriveKey(secret);
    const buf = b64decode(ciphertext);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

function maskToken(t: string): string {
  if (!t) return "";
  return t.length <= 8 ? "***" : `${t.slice(0, 4)}…${t.slice(-4)}`;
}

async function parsePolicyBody(c: any): Promise<{ policy?: Policy; error?: string }> {
  let body: unknown;
  try { body = await c.req.json(); } catch { return { error: "invalid json" }; }
  try { return { policy: validatePolicy(body) }; } catch (err) {
    return { error: err instanceof Error ? err.message : "invalid policy" };
  }
}

async function loadPolicy(env: Env, sub: string, id: string): Promise<StoredPolicy | null> {
  const raw = await env.RUNNERS.get(policyKey(sub, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPolicy;
  } catch {
    return null;
  }
}

async function listPolicies(env: Env, sub: string): Promise<StoredPolicy[]> {
  const prefix = `${POLICY_PREFIX}${sub}:`;
  const list = await env.RUNNERS.list({ prefix });
  const out: StoredPolicy[] = [];
  for (const k of list.keys) {
    const raw = await env.RUNNERS.get(k.name);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as StoredPolicy);
    } catch {
      // skip
    }
  }
  return out;
}

// --- POST /policies — create a new policy ---
policyRoutes.post("/policies", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const { policy, error } = await parsePolicyBody(c);
  if (error || !policy) return c.json({ error: error ?? "invalid policy" }, 400);
  const now = new Date().toISOString();
  const id = policy.id ?? crypto.randomUUID();
  const stored: StoredPolicy = { ...policy, id, created_at: now, updated_at: now };
  await c.env.RUNNERS.put(policyKey(sub, id), JSON.stringify(stored));
  return c.json({ policy: stored }, 201);
});

// --- GET /policies — list all policies for the tenant ---
policyRoutes.get("/policies", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const policies = await listPolicies(c.env, sub);
  return c.json({ policies, count: policies.length });
});

// --- GET /policies/:id — fetch one ---
policyRoutes.get("/policies/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const p = await loadPolicy(c.env, sub, id);
  if (!p) return c.json({ error: "not found" }, 404);
  return c.json({ policy: p });
});

// --- PUT /policies/:id — update ---
policyRoutes.put("/policies/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const existing = await loadPolicy(c.env, sub, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const { policy, error } = await parsePolicyBody(c);
  if (error || !policy) return c.json({ error: error ?? "invalid policy" }, 400);
  const updated: StoredPolicy = {
    ...policy, id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };
  await c.env.RUNNERS.put(policyKey(sub, id), JSON.stringify(updated));
  return c.json({ policy: updated });
});

// --- DELETE /policies/:id ---
policyRoutes.delete("/policies/:id", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const existing = await loadPolicy(c.env, sub, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  await c.env.RUNNERS.delete(policyKey(sub, id));
  return c.json({ ok: true, deleted: id });
});

// --- POST /evaluate — run the policies against an input document ---
policyRoutes.post("/evaluate", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  let body: { input?: unknown; mode?: "local" | "remote"; opaUrl?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const mode = body.mode === "remote" ? "remote" : "local";
  const input = body.input ?? {};

  if (mode === "remote") {
    let opaUrl = body.opaUrl;
    let token: string | undefined;
    let dataPath: string | undefined;
    if (!opaUrl) {
      const cfgRaw = await c.env.RUNNERS.get(opaKey(sub));
      if (!cfgRaw) return c.json({ error: "no OPA config; set /opa/config or pass opaUrl" }, 400);
      try {
        const cfg = JSON.parse(cfgRaw) as StoredOpaConfig;
        opaUrl = cfg.opaUrl;
        dataPath = cfg.dataPath;
        if (cfg.tokenCiphertext) {
          const pt = await decryptToken(cfg.tokenCiphertext, c.env.JWT_SECRET);
          token = pt ?? undefined;
        }
      } catch {
        return c.json({ error: "corrupt OPA config" }, 500);
      }
    }
    const result = await evaluateRemote(input, { opaUrl: opaUrl!, token, dataPath });
    return c.json({ mode: "remote", ...result });
  }

  const policies = await listPolicies(c.env, sub);
  const result = evaluate(policies, input);
  return c.json({ mode: "local", evaluated: policies.length, ...result });
});

// --- POST /opa/config — set the remote OPA URL + token ---
policyRoutes.post("/opa/config", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  let body: { opaUrl?: string; token?: string; dataPath?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (!body.opaUrl || typeof body.opaUrl !== "string") {
    return c.json({ error: "opaUrl is required" }, 400);
  }

  let tokenCiphertext: string | null = null;
  if (body.token && typeof body.token === "string") {
    tokenCiphertext = await encryptToken(body.token, c.env.JWT_SECRET);
  }

  const cfg: StoredOpaConfig = {
    opaUrl: body.opaUrl.replace(/\/+$/, ""),
    tokenCiphertext,
    dataPath: body.dataPath,
    updated_at: new Date().toISOString(),
  };
  await c.env.RUNNERS.put(opaKey(sub), JSON.stringify(cfg));
  return c.json({
    ok: true,
    opaUrl: cfg.opaUrl,
    dataPath: cfg.dataPath ?? "pushci/allow",
    tokenMask: body.token ? maskToken(body.token) : null,
    updated_at: cfg.updated_at,
  });
});

// --- GET /opa/config — read the config with masked token ---
policyRoutes.get("/opa/config", async (c) => {
  const sub = await getUserSub(c);
  if (!sub) return c.json({ error: "unauthorized" }, 401);

  const raw = await c.env.RUNNERS.get(opaKey(sub));
  if (!raw) return c.json({ configured: false });

  try {
    const cfg = JSON.parse(raw) as StoredOpaConfig;
    let tokenMask: string | null = null;
    if (cfg.tokenCiphertext) {
      const pt = await decryptToken(cfg.tokenCiphertext, c.env.JWT_SECRET);
      tokenMask = pt ? maskToken(pt) : "***";
    }
    return c.json({
      configured: true,
      opaUrl: cfg.opaUrl,
      dataPath: cfg.dataPath ?? "pushci/allow",
      tokenMask,
      updated_at: cfg.updated_at,
    });
  } catch {
    return c.json({ error: "corrupt config" }, 500);
  }
});
