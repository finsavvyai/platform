/**
 * Shared helpers for handler.* test files. Not a test file itself — exported
 * for consumption by sibling `.test.ts` modules. Excluded from coverage by
 * filename pattern (test-* helpers aren't shipped).
 */
import { AiGateway } from "../gateway.js";
import { mockAdapter, fastRef, noWait } from "../test-fixtures.js";
import type { ProviderAdapter } from "../types.js";
import { createEdgeHandler, type EdgeHandlerConfig } from "./handler.js";
import { InMemoryKvStore } from "./kv-memory.js";
import { signHs256 } from "./jwt.js";

export const SECRET = "edge-test-secret";

export async function freshToken(
  extras: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signHs256(
    {
      sub: "user-1",
      tenantId: "t-1",
      role: "user",
      iat: now,
      exp: now + 300,
      ...extras,
    },
    SECRET,
  );
}

export function buildGateway(
  adapters: ProviderAdapter[] = [mockAdapter(fastRef)],
): AiGateway {
  return new AiGateway({ adapters, retry: noWait });
}

export function buildHandler(
  overrides: Partial<EdgeHandlerConfig> = {},
): ReturnType<typeof createEdgeHandler> {
  return createEdgeHandler({
    gateway: buildGateway(),
    jwtSecret: SECRET,
    kv: new InMemoryKvStore(),
    rateLimit: { windowMs: 60_000, maxRequests: 100 },
    ...overrides,
  });
}

export function postCompletion(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request("https://x.io/v1/complete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
