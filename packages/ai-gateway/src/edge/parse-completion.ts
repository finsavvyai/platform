import { EdgeBadRequestError } from "./errors.js";
import type { GatewayRequest, ModelTier } from "../types.js";

/**
 * Parse + validate a JSON body into a `GatewayRequest`. Strict: any unknown
 * field is tolerated, but required fields must be present and well-typed.
 * Tenant id comes from the verified JWT claims (caller-supplied), not the
 * body — the body cannot override tenancy.
 */
export function parseCompletionBody(
  raw: unknown,
  authedTenantId: string,
): GatewayRequest {
  if (typeof raw !== "object" || raw === null) {
    throw new EdgeBadRequestError("body must be a JSON object");
  }
  const o = raw as Record<string, unknown>;

  const prompt = o["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new EdgeBadRequestError("prompt must be a non-empty string");
  }
  if (prompt.length > 100_000) {
    throw new EdgeBadRequestError("prompt exceeds 100k chars");
  }

  const tier = o["tier"];
  if (!isTier(tier)) {
    throw new EdgeBadRequestError(`tier must be one of fast|balanced|frontier`);
  }

  const maxTokens = o["maxTokens"];
  if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens)) {
    throw new EdgeBadRequestError("maxTokens must be an integer");
  }
  if (maxTokens < 1 || maxTokens > 64_000) {
    throw new EdgeBadRequestError("maxTokens out of range [1, 64000]");
  }

  const model = optionalString(o["model"], "model");
  const cacheKey = optionalString(o["cacheKey"], "cacheKey");
  const idempotencyKey = optionalString(o["idempotencyKey"], "idempotencyKey");

  return {
    tenantId: authedTenantId,
    prompt,
    tier,
    maxTokens,
    ...(model ? { model } : {}),
    ...(cacheKey ? { cacheKey } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

function isTier(v: unknown): v is ModelTier {
  return v === "fast" || v === "balanced" || v === "frontier";
}

function optionalString(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") {
    throw new EdgeBadRequestError(`${field} must be a string`);
  }
  if (v.length === 0) return undefined;
  if (v.length > 1024) {
    throw new EdgeBadRequestError(`${field} too long`);
  }
  return v;
}
