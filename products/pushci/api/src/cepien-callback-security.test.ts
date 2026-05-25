// H-001 regression tests — POST /api/integrations/cepien/callback.
// Verifies: runner-only Bearer auth, SSRF-proof URL allowlist, strict
// payload shape, no-secret-in-logs. Uses the exported Hono app via
// `cepienRoutes.fetch(req, env)` with an in-memory KV stub and mocked
// global fetch.
//
// License: Apache-2.0

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cepienRoutes } from "./cepien-routes";
import { validateCallbackUrl } from "./cepien-callback-guard";
import type { Env } from "./types";

const RUNNER_SECRET = "runner_shared_secret_abc123";
const PIPELINE_ID = "pl_test_1234";
const CALLBACK_TOKEN = "ceph_cb_tok_very_long_secret_token";
const SHARED_SECRET = "ceph_hmac_shared_secret_very_long";

function makeKv(initial: Record<string, string> = {}): {
  get: (k: string) => Promise<string | null>;
  put: (k: string, v: string) => Promise<void>;
  delete: (k: string) => Promise<void>;
  list: (opts: { prefix: string }) => Promise<{ keys: { name: string }[] }>;
  _store: Map<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
    }),
    _store: store,
  };
}

type Kv = ReturnType<typeof makeKv>;

function seedPipeline(kv: Kv, callbackUrl: string): void {
  kv._store.set(
    `cepien:pipeline:${PIPELINE_ID}`,
    JSON.stringify({
      pipeline_id: PIPELINE_ID,
      recommendation_id: "rec_abc123def456",
      workspace_id: "ws_seed",
      pr: { url: "https://github.com/o/r/pull/1", owner: "o", repo: "r", number: 1, branch: "b", head_sha: "sha" },
      callback_url: callbackUrl,
      status: "queued",
      created_at: new Date().toISOString(),
    })
  );
  kv._store.set("cepien:lookup:ws_seed", "cepien:workspace:sub_test:ws_seed");
  kv._store.set(
    "cepien:workspace:sub_test:ws_seed",
    JSON.stringify({
      id: "internal_1", user_sub: "sub_test", workspaceId: "ws_seed", label: "seed",
      sharedSecret: SHARED_SECRET, callbackToken: CALLBACK_TOKEN,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    })
  );
}

function makeEnv(kv: Kv): Env {
  return {
    RUNNERS: kv as unknown as KVNamespace,
    APP_URL: "https://app.pushci.dev",
    PUSHCI_RUNNER_CALLBACK_SECRET: RUNNER_SECRET,
  } as unknown as Env;
}

function postCallback(body: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader !== undefined) headers.authorization = authHeader;
  return new Request("https://api.local/callback", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID_BODY = { pipeline_id: PIPELINE_ID, status: "passed", duration_ms: 12345 };

describe("POST /callback — H-001 security", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    logSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("1. legit runner POST with Cepien URL → 202 + upstream called once", async () => {
    const kv = makeKv();
    seedPipeline(kv, "https://api.cepien.ai/webhooks/status/rec_abc");
    const res = await cepienRoutes.fetch(
      postCallback(VALID_BODY, `Bearer ${RUNNER_SECRET}`), makeEnv(kv)
    );
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[url, init]] = fetchMock.mock.calls;
    expect(String(url)).toBe("https://api.cepien.ai/webhooks/status/rec_abc");
    const h = (init as RequestInit).headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${CALLBACK_TOKEN}`);
  });

  it("2. no Bearer → 401", async () => {
    const kv = makeKv(); seedPipeline(kv, "https://api.cepien.ai/x");
    const res = await cepienRoutes.fetch(postCallback(VALID_BODY), makeEnv(kv));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("3. wrong Bearer → 401", async () => {
    const kv = makeKv(); seedPipeline(kv, "https://api.cepien.ai/x");
    const res = await cepienRoutes.fetch(
      postCallback(VALID_BODY, "Bearer wrong_secret"), makeEnv(kv)
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["4. IMDS", "http://169.254.169.254/meta-data/"],
    ["5. localhost", "http://localhost/"],
    ["6. non-allowlisted host", "https://attacker.com/"],
    ["7. suffix trick", "https://api.cepien.ai.attacker.com/"],
    ["8. http scheme on cepien", "http://api.cepien.ai/"],
    ["9. not-a-url", "not-a-url"],
    ["12. 10.x private", "https://10.0.0.5/"],
    ["13. 192.168 private", "https://192.168.1.1/"],
    ["14. 172.16 private", "https://172.16.0.1/"],
    ["15. IPv6 loopback", "https://[::1]/"],
    ["16. IPv6 ULA", "https://[fc00::1]/"],
  ])("%s → 400, no fetch", async (_label, url) => {
    const kv = makeKv(); seedPipeline(kv, url);
    const res = await cepienRoutes.fetch(
      postCallback(VALID_BODY, `Bearer ${RUNNER_SECRET}`), makeEnv(kv)
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("10. eu.cepien.ai subdomain → 202 (allowed)", async () => {
    const kv = makeKv(); seedPipeline(kv, "https://eu.cepien.ai/cb/1");
    const res = await cepienRoutes.fetch(
      postCallback(VALID_BODY, `Bearer ${RUNNER_SECRET}`), makeEnv(kv)
    );
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("11. never logs callbackToken or sharedSecret substring", async () => {
    const kv = makeKv(); seedPipeline(kv, "http://169.254.169.254/");
    await cepienRoutes.fetch(
      postCallback(VALID_BODY, `Bearer ${RUNNER_SECRET}`), makeEnv(kv)
    );
    const logged = logSpy.mock.calls
      .map((args: unknown[]) => args.map((a) => String(a)).join(" "))
      .join("\n");
    expect(logged).not.toContain(CALLBACK_TOKEN);
    expect(logged).not.toContain(SHARED_SECRET);
    expect(logged).not.toContain(RUNNER_SECRET);
  });

  it("rejects extra fields (strict payload)", async () => {
    const kv = makeKv(); seedPipeline(kv, "https://api.cepien.ai/x");
    const body = { ...VALID_BODY, run_url: "https://attacker.com/x" };
    const res = await cepienRoutes.fetch(
      postCallback(body, `Bearer ${RUNNER_SECRET}`), makeEnv(kv)
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid status enum", async () => {
    const kv = makeKv(); seedPipeline(kv, "https://api.cepien.ai/x");
    const res = await cepienRoutes.fetch(
      postCallback({ ...VALID_BODY, status: "cancelled" }, `Bearer ${RUNNER_SECRET}`), makeEnv(kv)
    );
    expect(res.status).toBe(400);
  });
});

describe("validateCallbackUrl — unit", () => {
  it("accepts cepien.ai hosts, rejects everything else", () => {
    expect(validateCallbackUrl("https://api.cepien.ai/cb")?.hostname).toBe("api.cepien.ai");
    expect(validateCallbackUrl("https://cepien.ai/x")?.hostname).toBe("cepien.ai");
    expect(validateCallbackUrl("https://u:p@api.cepien.ai/")).toBeNull();
    expect(validateCallbackUrl("https://cepien.ai.attacker.com/")).toBeNull();
    expect(validateCallbackUrl("")).toBeNull();
    expect(validateCallbackUrl("javascript:alert(1)")).toBeNull();
  });
});
