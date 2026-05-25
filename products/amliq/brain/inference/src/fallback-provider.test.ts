import { describe, expect, it, vi } from "vitest";
import { FallbackInferenceProvider } from "./fallback-provider.js";
import {
  type CompletionRequest,
  type CompletionResponse,
  InferenceError,
  InferenceExhaustedError,
  type InferenceProvider,
  InferenceTransportError,
} from "./types.js";

function makeReq(): CompletionRequest {
  return {
    model: "m",
    messages: [{ role: "user", content: "hi" }],
    tenantId: "t",
  };
}

function fakeResponse(providerId: string, text: string): CompletionResponse {
  return {
    id: `id-${providerId}`,
    model: "m",
    created: 1,
    choices: [
      { index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    providerId,
  };
}

function okProvider(id: string, text = "hi"): InferenceProvider {
  return { id, complete: vi.fn(async () => fakeResponse(id, text)) };
}

function failProvider(id: string, err?: Error): InferenceProvider {
  const e = err ?? new InferenceTransportError(id, "down");
  return {
    id,
    complete: vi.fn(async () => {
      throw e;
    }),
  };
}

describe("FallbackInferenceProvider — construction", () => {
  it("requires at least one provider", () => {
    expect(() => new FallbackInferenceProvider({ providers: [] })).toThrow(
      /at least one/,
    );
  });
  it("defaults providerId to 'fallback'", () => {
    const f = new FallbackInferenceProvider({ providers: [okProvider("a")] });
    expect(f.id).toBe("fallback");
  });
  it("respects providerId override", () => {
    const f = new FallbackInferenceProvider({
      providers: [okProvider("a")],
      providerId: "primary-or-cloud",
    });
    expect(f.id).toBe("primary-or-cloud");
  });
});

describe("FallbackInferenceProvider — happy paths", () => {
  it("first provider succeeds → returns its response, does not call later providers", async () => {
    const a = okProvider("a", "from-a");
    const b = okProvider("b", "from-b");
    const f = new FallbackInferenceProvider({ providers: [a, b] });
    const res = await f.complete(makeReq());
    expect(res.providerId).toBe("a");
    expect(res.choices[0]?.message.content).toBe("from-a");
    expect((b.complete as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("first fails, second succeeds → returns second, notifies observer once", async () => {
    const observer = vi.fn();
    const a = failProvider("a");
    const b = okProvider("b", "from-b");
    const f = new FallbackInferenceProvider({
      providers: [a, b],
      onAttemptError: observer,
    });
    const res = await f.complete(makeReq());
    expect(res.providerId).toBe("b");
    expect(observer).toHaveBeenCalledTimes(1);
    const firstCall = observer.mock.calls[0]!;
    const err = firstCall[0] as InferenceError;
    expect(err).toBeInstanceOf(InferenceError);
    expect(err.providerId).toBe("a");
  });
});

describe("FallbackInferenceProvider — exhaustion", () => {
  it("all fail → throws InferenceExhaustedError with all failures", async () => {
    const a = failProvider("a", new InferenceTransportError("a", "down-a"));
    const b = failProvider("b", new InferenceTransportError("b", "down-b"));
    const c = failProvider("c", new InferenceTransportError("c", "down-c"));
    const f = new FallbackInferenceProvider({ providers: [a, b, c] });
    let caught: unknown;
    try {
      await f.complete(makeReq());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InferenceExhaustedError);
    const ex = caught as InferenceExhaustedError;
    expect(ex.failures.length).toBe(3);
    expect(ex.failures.map((x) => x.providerId)).toEqual(["a", "b", "c"]);
  });

  it("wraps non-InferenceError throwables", async () => {
    const a: InferenceProvider = {
      id: "a",
      complete: async () => {
        throw new Error("random");
      },
    };
    const f = new FallbackInferenceProvider({ providers: [a] });
    let caught: unknown;
    try {
      await f.complete(makeReq());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InferenceExhaustedError);
    const ex = caught as InferenceExhaustedError;
    expect(ex.failures[0]).toBeInstanceOf(InferenceError);
    expect(ex.failures[0]?.message).toBe("random");
  });

  it("wraps non-Error throwables (string)", async () => {
    const a: InferenceProvider = {
      id: "a",
      complete: async () => {
        throw "weird";
      },
    };
    const f = new FallbackInferenceProvider({ providers: [a] });
    await expect(f.complete(makeReq())).rejects.toBeInstanceOf(
      InferenceExhaustedError,
    );
  });

  it("observer errors are swallowed and do not break the chain", async () => {
    const observer = vi.fn(() => {
      throw new Error("telemetry boom");
    });
    const a = failProvider("a");
    const b = okProvider("b", "ok");
    const f = new FallbackInferenceProvider({
      providers: [a, b],
      onAttemptError: observer,
    });
    const res = await f.complete(makeReq());
    expect(res.providerId).toBe("b");
    expect(observer).toHaveBeenCalledTimes(1);
  });
});
