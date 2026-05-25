import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngineClient } from "./engine-client.js";
import type {
  DecisionRequest,
  EngineEndpointConfig,
  JwtSigner,
} from "./types.js";

const config: EngineEndpointConfig = {
  engine: "quantumbeam",
  url: "https://example.invalid/engine",
  timeoutMs: 50,
};

const signer: JwtSigner = {
  sign: async (p) => `jwt:${JSON.stringify(p)}`,
};

const sampleRequest: DecisionRequest = {
  subject: { subject_id: "s", subject_hash: "h" },
  transaction: {
    transaction_id: "t",
    amount_minor: 1000,
    currency: "USD",
    channel: "card",
  },
  tenant_id: "tenant_A",
};

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

describe("engine-client.createEngineClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("happy path: returns risk_score + explanations + latency, attaches Bearer JWT", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.init = init;
      return jsonResponse({
        risk_score: 42,
        explanations: ["rule_A"],
      });
    });

    const client = createEngineClient({ config, signer, fetchImpl });
    const parent = new AbortController();
    const result = await client.score(sampleRequest, parent.signal);

    expect(result.engine).toBe("quantumbeam");
    expect(result.risk_score).toBe(42);
    expect(result.explanations).toEqual(["rule_A"]);
    expect(result.error).toBeUndefined();
    expect(captured.url).toBe("https://example.invalid/engine/v1/score");
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers.authorization).toMatch(/^Bearer jwt:/);
    expect(headers["content-type"]).toBe("application/json");
  });

  it("4xx response → error result, no throw, no retry", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("nope", { status: 400 }),
    );
    const client = createEngineClient({ config, signer, fetchImpl });
    const result = await client.score(sampleRequest, new AbortController().signal);
    expect(result.error).toBe("http_400");
    expect(result.risk_score).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("5xx response → error result, caller decides on retry", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("boom", { status: 503 }),
    );
    const client = createEngineClient({ config, signer, fetchImpl });
    const result = await client.score(sampleRequest, new AbortController().signal);
    expect(result.error).toBe("http_503");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("network error → error result with 'network' code", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const client = createEngineClient({ config, signer, fetchImpl });
    const result = await client.score(sampleRequest, new AbortController().signal);
    expect(result.error).toBe("network");
  });

  it("timeout via AbortController → error result with 'timeout' code", async () => {
    // fetch never resolves; aborting yields AbortError.
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    );
    const client = createEngineClient({
      config: { ...config, timeoutMs: 10 },
      signer,
      fetchImpl,
    });
    const p = client.score(sampleRequest, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(20);
    const result = await p;
    expect(result.error).toBe("timeout");
  });

  it("parent-signal abort propagates → timeout-coded result", async () => {
    vi.useRealTimers(); // this case needs the real microtask scheduler
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    );
    const client = createEngineClient({
      config: { ...config, timeoutMs: 10_000 },
      signer,
      fetchImpl,
    });
    const parent = new AbortController();
    const p = client.score(sampleRequest, parent.signal);
    // give the signer + fetchImpl microtasks a turn before aborting
    await new Promise((r) => setImmediate(r));
    parent.abort();
    const result = await p;
    expect(result.error).toBe("timeout");
  });

  it("malformed JSON body → explanations[] + score=0, no throw", async () => {
    const fetchImpl = vi.fn(
      async () => jsonResponse({ risk_score: "not a number" }),
    );
    const client = createEngineClient({ config, signer, fetchImpl });
    const result = await client.score(sampleRequest, new AbortController().signal);
    expect(result.risk_score).toBe(0);
    expect(result.explanations).toEqual([]);
    expect(result.error).toBeUndefined();
  });
});
