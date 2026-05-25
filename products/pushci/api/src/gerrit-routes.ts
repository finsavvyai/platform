// Gerrit admin CRUD routes — /api/gerrit/*
//
// Stores Gerrit project registrations in KV:
//   gerrit:project:${id}          -> GerritProjectRecord (JSON)
//   gerrit:user:${sub}:projects   -> string[] of project ids owned by the user
//   gerrit:by-repo:${repoKey}     -> project id (lookup for webhook ingress)
//
// Credentials are stored in KV scoped to the user. If a `GERRIT_ENC_KEY` env
// var is present we wrap the httpPassword with AES-GCM WebCrypto; otherwise
// we store as-is (explicit warning in the code below).

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";
import { getServerVersion } from "./gerrit";

export interface GerritProjectRecord {
  id: string;
  ownerSub: string;
  host: string;         // Gerrit base URL, e.g. https://gerrit.example.com
  project: string;      // Gerrit project name, e.g. norlys/metering
  httpUser: string;
  httpPassword: string; // plaintext or base64(iv|ciphertext) — see encrypt()
  httpPasswordEnc: boolean;
  webhookSecret: string;
  createdAt: string;
  pollEnabled?: boolean;     // Stream M: opt-in for scheduled polling
  pollIntervalSec?: number;  // Stream M: desired min interval (advisory)
}

function kvKey(id: string): string {
  return `gerrit:project:${id}`;
}
function userIndexKey(sub: string): string {
  return `gerrit:user:${sub}:projects`;
}
function repoIndexKey(repoKey: string): string {
  return `gerrit:by-repo:${repoKey}`;
}

function getAuthUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : Promise.resolve(null);
}

// -------- optional credential encryption ------------------------------------

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptIfPossible(
  env: Env,
  plaintext: string
): Promise<{ value: string; encrypted: boolean }> {
  const secret = (env as unknown as { GERRIT_ENC_KEY?: string }).GERRIT_ENC_KEY;
  if (!secret) return { value: plaintext, encrypted: false };
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return { value: b64encode(combined), encrypted: true };
}

async function decryptIfNeeded(env: Env, record: GerritProjectRecord): Promise<string> {
  if (!record.httpPasswordEnc) return record.httpPassword;
  const secret = (env as unknown as { GERRIT_ENC_KEY?: string }).GERRIT_ENC_KEY;
  if (!secret) throw new Error("GERRIT_ENC_KEY missing for decryption");
  const key = await deriveKey(secret);
  const combined = b64decode(record.httpPassword);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(pt);
}

// -------- public helpers (used by gerrit-webhook.ts) ------------------------

export async function getGerritProjectById(
  env: Env,
  id: string
): Promise<GerritProjectRecord | null> {
  const raw = await env.RUNNERS.get(kvKey(id));
  return raw ? (JSON.parse(raw) as GerritProjectRecord) : null;
}

export async function findGerritProjectByRepoKey(
  env: Env,
  repoKey: string
): Promise<GerritProjectRecord | null> {
  const id = await env.RUNNERS.get(repoIndexKey(repoKey));
  if (!id) return null;
  return getGerritProjectById(env, id);
}

// -------- router ------------------------------------------------------------

export const gerritRoutes = new Hono<{ Bindings: Env }>();

function redact(p: GerritProjectRecord) {
  const { httpPassword: _pw, ...rest } = p;
  return { ...rest, httpPasswordSet: Boolean(p.httpPassword) };
}

gerritRoutes.post("/projects", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{
    host: string; project: string; httpUser: string;
    httpPassword: string; webhookSecret: string;
    pollEnabled?: boolean; pollIntervalSec?: number;
  }>();
  if (!body.host || !body.project || !body.httpUser || !body.httpPassword || !body.webhookSecret) {
    return c.json({ error: "host, project, httpUser, httpPassword, webhookSecret required" }, 400);
  }
  const id = crypto.randomUUID();
  const enc = await encryptIfPossible(c.env, body.httpPassword);
  const record: GerritProjectRecord = {
    id,
    ownerSub: user.sub,
    host: body.host,
    project: body.project,
    httpUser: body.httpUser,
    httpPassword: enc.value,
    httpPasswordEnc: enc.encrypted,
    webhookSecret: body.webhookSecret,
    createdAt: new Date().toISOString(),
    pollEnabled: Boolean(body.pollEnabled),
    pollIntervalSec: body.pollIntervalSec,
  };
  await c.env.RUNNERS.put(kvKey(id), JSON.stringify(record));
  await c.env.RUNNERS.put(repoIndexKey(`gerrit/${body.project}`), id);
  const existingIdx = await c.env.RUNNERS.get(userIndexKey(user.sub));
  const idList: string[] = existingIdx ? JSON.parse(existingIdx) : [];
  idList.push(id);
  await c.env.RUNNERS.put(userIndexKey(user.sub), JSON.stringify(idList));
  return c.json({ project: redact(record) }, 201);
});

gerritRoutes.get("/projects", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const raw = await c.env.RUNNERS.get(userIndexKey(user.sub));
  const ids: string[] = raw ? JSON.parse(raw) : [];
  const records: GerritProjectRecord[] = [];
  for (const id of ids) {
    const rec = await getGerritProjectById(c.env, id);
    if (rec && rec.ownerSub === user.sub) records.push(rec);
  }
  return c.json({ projects: records.map(redact) });
});

gerritRoutes.delete("/projects/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const rec = await getGerritProjectById(c.env, id);
  if (!rec) return c.json({ error: "not found" }, 404);
  if (rec.ownerSub !== user.sub) return c.json({ error: "forbidden" }, 403);
  await c.env.RUNNERS.delete(kvKey(id));
  await c.env.RUNNERS.delete(repoIndexKey(`gerrit/${rec.project}`));
  const raw = await c.env.RUNNERS.get(userIndexKey(user.sub));
  const ids: string[] = raw ? JSON.parse(raw) : [];
  await c.env.RUNNERS.put(
    userIndexKey(user.sub),
    JSON.stringify(ids.filter((x) => x !== id))
  );
  return c.json({ ok: true });
});

gerritRoutes.post("/projects/:id/test", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const rec = await getGerritProjectById(c.env, c.req.param("id"));
  if (!rec) return c.json({ error: "not found" }, 404);
  if (rec.ownerSub !== user.sub) return c.json({ error: "forbidden" }, 403);
  try {
    const password = await decryptIfNeeded(c.env, rec);
    const version = await getServerVersion({
      baseUrl: rec.host,
      httpUser: rec.httpUser,
      httpPassword: password,
    });
    return c.json({ ok: true, version });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "connect failed" }, 502);
  }
});
