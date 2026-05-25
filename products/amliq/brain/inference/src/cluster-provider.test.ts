import { describe, expect, it, vi } from "vitest";
import {
  ClusterInferenceProvider,
  type ClusterProviderConfig,
} from "./cluster-provider.js";
import { backoffMs, isRetryable } from "./http-internal.js";
import {
  type CompletionRequest,
  InferenceProviderError,
  InferenceTransportError,
  type JwtSigner,
} from "./types.js";

const TEST_URL = "https://cluster.test.invalid";

function makeSigner(token = "test.jwt.token"): JwtSigner & {
  calls: Array<Parameters<JwtSigner["sign"]>[0]>;
} {
  const calls: Array<Parameters<JwtSigner["sign"]>[0]> = [];
  return {
    calls,
    sign: (claims) => {
      calls.push(claims);
      return token;
    },
  };
}

function makeReq(overrides: Partial<CompletionRequest> = {}): CompletionRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "hi" }],
    tenantId: "tenant-hash-abc",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function happyBody(): Record<string, unknown> {
  return {
    id: "resp-1",
    model: "test-model",
    created: 1_700_000_000,
    choices: [
      { index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" },
    ],
    usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
  };
}

function baseCfg(extra: Partial<ClusterProviderConfig> = {}): ClusterProviderConfig {
  return {
    clusterUrl: TEST_URL,
    signer: makeSigner(),
    sleep: () => Promise.resolve(),
    jitter: () => 0,
    ...extra,
  };
}

describe("ClusterInferenceProvider — construction", () => {
  it("requires clusterUrl", () => {
    expect(() => new ClusterInferenceProvider({ ...baseCfg(), clusterUrl: "" })).toThrow(/clusterUrl/);
  });
  it("rejects out-of-range jwtTtlSeconds", () => {
    expect(() => new ClusterInferenceProvider({ ...baseCfg(), jwtTtlSeconds: 0 })).toThrow(/jwtTtlSeconds/);
    expect(() => new ClusterInferenceProvider({ ...baseCfg(), jwtTtlSeconds: 301 })).toThrow(/jwtTtlSeconds/);
  });
});

describe("ClusterInferenceProvider — happy path", () => {
  it("posts OpenAI body to /v1/chat/completions with bearer JWT", async () => {
    const signer = makeSigner("jwt-XYZ");
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse(happyBody()),
    ) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(baseCfg({ signer, fetchImpl }));

    const res = await p.complete(makeReq());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(calledUrl).toBe(`${TEST_URL}/v1/chat/completions`);
    expect((calledInit as RequestInit).method).toBe("POST");
    const headers = (calledInit as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer jwt-XYZ");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(signer.calls[0]).toMatchObject({
      sub: "tenant-hash-abc",
      aud: "cluster",
      scope: "inference:complete",
    });
    expect(res.providerId).toBe("cluster");
    expect(res.choices[0]?.message.content).toBe("hello");
    expect(res.usage.total_tokens).toBe(7);
  });

  it("rejects request without tenantId", async () => {
    const p = new ClusterInferenceProvider(baseCfg());
    await expect(
      p.complete({ ...makeReq(), tenantId: "" }),
    ).rejects.toBeInstanceOf(InferenceProviderError);
  });
});

describe("ClusterInferenceProvider — retry semantics", () => {
  it("retries 5xx then succeeds", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n < 3) return new Response("upstream blip", { status: 503 });
      return jsonResponse(happyBody());
    }) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(baseCfg({ fetchImpl }));
    const res = await p.complete(makeReq());
    expect(n).toBe(3);
    expect(res.id).toBe("resp-1");
  });

  it("does NOT retry 4xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(baseCfg({ fetchImpl }));
    await expect(p.complete(makeReq())).rejects.toBeInstanceOf(InferenceProviderError);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it.each([408, 429])("retries %i (transport-class)", async (status) => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response("slow", { status });
      return jsonResponse(happyBody());
    }) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(baseCfg({ fetchImpl }));
    await p.complete(makeReq());
    expect(n).toBe(2);
  });

  it("times out via AbortController → InferenceTransportError", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        }),
    ) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(
      baseCfg({ fetchImpl, defaultTimeoutMs: 5, maxAttempts: 1 }),
    );
    await expect(p.complete(makeReq())).rejects.toBeInstanceOf(InferenceTransportError);
  });

  it("exhausts retries and throws InferenceTransportError", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(baseCfg({ fetchImpl, maxAttempts: 2 }));
    await expect(p.complete(makeReq())).rejects.toBeInstanceOf(InferenceTransportError);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("wraps unknown rejections from fetch as transport errors", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("dns boom");
    }) as unknown as typeof fetch;
    const p = new ClusterInferenceProvider(baseCfg({ fetchImpl, maxAttempts: 1 }));
    await expect(p.complete(makeReq())).rejects.toBeInstanceOf(InferenceTransportError);
  });

  it("rejects maxAttempts < 1 at call time", async () => {
    const p = new ClusterInferenceProvider(baseCfg({ maxAttempts: 0 }));
    await expect(p.complete(makeReq())).rejects.toThrow(/maxAttempts/);
  });
});

describe("ClusterInferenceProvider — helpers", () => {
  it("isRetryable: provider error no, transport error yes, unknown yes", () => {
    expect(isRetryable(new InferenceProviderError("cluster", 400, "x"))).toBe(false);
    expect(isRetryable(new InferenceTransportError("cluster", "x"))).toBe(true);
    expect(isRetryable(new Error("???"))).toBe(true);
  });
  it("backoffMs clamps jitter and respects cap", () => {
    expect(backoffMs(1, 50, 100, () => -1)).toBe(50);
    expect(backoffMs(1, 50, 100, () => 2)).toBeGreaterThanOrEqual(50);
    expect(backoffMs(10, 50, 100, () => 1)).toBeLessThanOrEqual(100);
    expect(backoffMs(1, 50, 100, () => Number.NaN)).toBe(50);
  });
});
