// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GatewayError, redact } from "./api";
import { DEFAULT_SETTINGS } from "./types";

describe("api.redact", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs JSON to /v1/redact and returns parsed response", async () => {
    const stub = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ redacted: "hi <EMAIL>", detections: [], blocked: false }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = stub as unknown as typeof fetch;

    const res = await redact(
      { ...DEFAULT_SETTINGS, gatewayUrl: "http://gw/" },
      { text: "hi you@x.com" },
    );

    expect(res.redacted).toBe("hi <EMAIL>");
    const call = stub.mock.calls[0]!;
    expect(call[0]).toBe("http://gw/v1/redact");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: "hi you@x.com",
      presets: ["pii_default", "secrets"],
    });
  });

  it("throws GatewayError with status on non-2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("nope", { status: 503 }),
    ) as unknown as typeof fetch;

    await expect(
      redact(DEFAULT_SETTINGS, { text: "hi" }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      redact(DEFAULT_SETTINGS, { text: "hi" }),
    ).rejects.toBeInstanceOf(GatewayError);
  });

  it("adds Authorization header when apiKey is set", async () => {
    const stub = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ redacted: "x", detections: [], blocked: false }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = stub as unknown as typeof fetch;

    await redact({ ...DEFAULT_SETTINGS, apiKey: "tok" }, { text: "x" });

    const init = stub.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok");
  });
});
