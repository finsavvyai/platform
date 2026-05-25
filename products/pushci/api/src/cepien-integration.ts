// SPECULATIVE INTEGRATION — Cepien AI public webhook API not yet published.
// Payload shape below based on their PH launch (2026-04-18); update when
// confirmed with Cepien team. Safe to ship: rejects unknown payloads with
// 400, verifies HMAC before any side effect.
//
// Cepien (https://cepien.ai) dispatches `recommendation.code_generated`
// events when its agentic workforce opens a PR via Cursor/Claude/Gemini.
// PushCI receives the event, kicks a pipeline, and calls back to Cepien's
// `callback_url` with run results so product teams see end-to-end status.
//
// License: Apache-2.0

import { timingSafeEqual as sharedTimingSafeEqual } from "./crypto-utils";

export type CepienGenerator = "claude-code" | "cursor" | "gemini";

export interface CepienPrRef {
  url: string;
  owner: string;
  repo: string;
  number: number;
  branch: string;
  head_sha: string;
}

export interface CepienSource {
  generator: CepienGenerator;
  model: string;
}

export interface CepienWebhookPayload {
  event: "recommendation.code_generated";
  recommendation_id: string;
  title: string;
  pr: CepienPrRef;
  source: CepienSource;
  cepien_workspace_id: string;
  callback_url: string;
}

export interface CepienCallbackBody {
  status: "passed" | "failed" | "cancelled";
  passed: boolean;
  run_url: string;
  duration_ms: number;
  recommendation_id: string;
}

const enc = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/** HMAC-SHA256 hex digest of `body` with `secret`. */
export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return bufToHex(sig);
}

/** Constant-time string comparison. Re-exported from shared crypto-utils. */
export const timingSafeEqual = sharedTimingSafeEqual;

/** Verify `X-Cepien-Signature` against the raw body with workspace secret. */
export async function verifySignature(
  rawBody: string,
  headerSig: string | undefined,
  secret: string
): Promise<boolean> {
  if (!headerSig || !secret) return false;
  const clean = headerSig.replace(/^sha256=/, "").trim();
  if (!/^[0-9a-f]+$/i.test(clean)) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return timingSafeEqual(expected.toLowerCase(), clean.toLowerCase());
}

/** Mask an id, exposing only the last 6 chars — for log lines. */
export function maskRecommendationId(id: string): string {
  if (!id) return "<empty>";
  if (id.length <= 6) return "***";
  return `***${id.slice(-6)}`;
}

/** Validate the webhook payload shape. Returns an error string or null. */
export function validatePayload(v: unknown): string | null {
  if (!v || typeof v !== "object") return "payload must be an object";
  const p = v as Partial<CepienWebhookPayload>;
  if (p.event !== "recommendation.code_generated") return "unsupported event";
  if (typeof p.recommendation_id !== "string" || !p.recommendation_id) return "missing recommendation_id";
  if (typeof p.title !== "string") return "missing title";
  if (typeof p.cepien_workspace_id !== "string" || !p.cepien_workspace_id) return "missing cepien_workspace_id";
  if (typeof p.callback_url !== "string" || !/^https:\/\//.test(p.callback_url)) return "callback_url must be https";
  const pr = p.pr;
  if (!pr || typeof pr !== "object") return "missing pr";
  if (typeof pr.url !== "string" || !pr.url) return "missing pr.url";
  if (typeof pr.owner !== "string" || !pr.owner) return "missing pr.owner";
  if (typeof pr.repo !== "string" || !pr.repo) return "missing pr.repo";
  if (typeof pr.number !== "number") return "missing pr.number";
  if (typeof pr.branch !== "string" || !pr.branch) return "missing pr.branch";
  if (typeof pr.head_sha !== "string" || !pr.head_sha) return "missing pr.head_sha";
  const src = p.source;
  if (!src || typeof src !== "object") return "missing source";
  const generators: CepienGenerator[] = ["claude-code", "cursor", "gemini"];
  if (!generators.includes(src.generator as CepienGenerator)) return "invalid source.generator";
  if (typeof src.model !== "string" || !src.model) return "missing source.model";
  return null;
}

/** POST the run result back to Cepien's callback URL. */
export async function postCallback(
  callbackUrl: string,
  token: string | undefined,
  body: CepienCallbackBody
): Promise<{ ok: boolean; status: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(callbackUrl, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}
