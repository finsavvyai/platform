import { describe, expect, it, vi } from "vitest";
import {
  ScreenClient,
  ScreenClientError,
  ScreenTimeoutError,
} from "./client.js";
import { jsonResponse, validResponse } from "./testFixtures.js";

describe("ScreenClient constructor", () => {
  it("rejects empty baseUrl", () => {
    expect(() => new ScreenClient({ baseUrl: "" })).toThrow(ScreenClientError);
  });

  it("strips trailing slashes from baseUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validResponse()));
    const c = new ScreenClient({ baseUrl: "http://x.test///", fetch: fetchMock });
    await c.screen({ name: "Vladimir Putin" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://x.test/api/v1/screen/public-demo",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("ScreenClient.screen happy path", () => {
  it("decodes a full valid response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validResponse()));
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
    const r = await c.screen({ name: "Vladimir Putin", lists: ["ofac"], pep: true, threshold: 0.5 });
    expect(r.riskLevel).toBe("high");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]?.layers).toHaveLength(5);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ name: "Vladimir Putin", lists: ["ofac"], pep: true, threshold: 0.5 });
  });

  it("works for every RiskLevel branch (clear, low, medium, high)", async () => {
    for (const level of ["clear", "low", "medium", "high"] as const) {
      const body = { ...validResponse(), riskLevel: level };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
      const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
      const r = await c.screen({ name: "x" });
      expect(r.riskLevel).toBe(level);
    }
  });
});

describe("ScreenClient network + HTTP errors", () => {
  it("network failure throws ScreenClientError with cause", async () => {
    const cause = new Error("ECONNREFUSED");
    const fetchMock = vi.fn().mockRejectedValue(cause);
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
    await expect(c.screen({ name: "x" })).rejects.toMatchObject({
      name: "ScreenClientError",
      cause,
    });
  });

  it("non-2xx throws with status + body excerpt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream offline", { status: 503 }),
    );
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
    try {
      await c.screen({ name: "x" });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ScreenClientError);
      const err = e as ScreenClientError;
      expect(err.status).toBe(503);
      expect(err.bodyExcerpt).toBe("upstream offline");
    }
  });

  it("non-2xx with unreadable body still throws with empty excerpt", async () => {
    const res = new Response("ok", { status: 500 });
    Object.defineProperty(res, "text", {
      value: () => Promise.reject(new Error("read fail")),
    });
    const fetchMock = vi.fn().mockResolvedValue(res);
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
    try {
      await c.screen({ name: "x" });
      throw new Error("expected throw");
    } catch (e) {
      const err = e as ScreenClientError;
      expect(err.status).toBe(500);
      expect(err.bodyExcerpt).toBe("");
    }
  });

  it("malformed JSON body throws ScreenClientError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock });
    await expect(c.screen({ name: "x" })).rejects.toThrow(/not valid JSON/);
  });
});

describe("ScreenClient timeout", () => {
  it("aborts when timeoutMs elapses and throws ScreenTimeoutError", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock, timeoutMs: 5 });
    await expect(c.screen({ name: "x" })).rejects.toBeInstanceOf(ScreenTimeoutError);
  });

  it("non-abort error with timeoutMs set still throws ScreenClientError (not Timeout)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("dns fail"));
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock, timeoutMs: 1000 });
    try {
      await c.screen({ name: "x" });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ScreenClientError);
      expect(e).not.toBeInstanceOf(ScreenTimeoutError);
    }
  });

  it("clears timer on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validResponse()));
    const c = new ScreenClient({ baseUrl: "http://x.test", fetch: fetchMock, timeoutMs: 1000 });
    await c.screen({ name: "x" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
