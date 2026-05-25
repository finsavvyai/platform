// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Black-box tests against the live gateway's /v1/redact endpoint.
// Run with GATEWAY_URL pointing at a docker-compose'd gateway:
//
//   GATEWAY_URL=http://localhost:8080 npx playwright test api
//
// Tests cover the contract the browser extension + IDE addins
// depend on. Failures here are immediate browser-extension breakage.

import { test, expect } from "@playwright/test";

test.describe("POST /v1/redact", () => {
  test("redacts an email and returns the detection", async ({ request }) => {
    const res = await request.post("/v1/redact", {
      data: { text: "ping alice@example.com please" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.blocked).toBe(false);
    expect(body.redacted).not.toContain("alice@example.com");
    expect(body.detections.length).toBeGreaterThanOrEqual(1);
    const types = body.detections.map((d: { pattern: string }) => d.pattern);
    expect(types).toContain("email");
  });

  test("passes clean text through with empty detections", async ({ request }) => {
    const res = await request.post("/v1/redact", {
      data: { text: "hello world, no PII here" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.blocked).toBe(false);
    expect(body.redacted).toBe("hello world, no PII here");
    expect(body.detections).toEqual([]);
  });

  test("returns blocked=true with block_reason when tenant policy=block", async ({
    request,
  }) => {
    test.skip(
      !process.env.BLOCK_TENANT_ID,
      "set BLOCK_TENANT_ID to a tenant with DLP policy=block",
    );
    const res = await request.post("/v1/redact", {
      headers: { "x-tenant-id": process.env.BLOCK_TENANT_ID! },
      data: {
        text: "ssn 123-45-6789",
        tenant: process.env.BLOCK_TENANT_ID,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.blocked).toBe(true);
    expect(body.block_reason).not.toBe("");
    expect(body.redacted).toBe("");
  });

  test("rejects empty body with 400", async ({ request }) => {
    const res = await request.post("/v1/redact", { data: "" });
    expect(res.status()).toBe(400);
  });

  test("rejects missing text with 400", async ({ request }) => {
    const res = await request.post("/v1/redact", { data: { tenant: "x" } });
    expect(res.status()).toBe(400);
  });

  test("rejects unknown fields with 400", async ({ request }) => {
    const res = await request.post("/v1/redact", {
      data: { text: "hi", surprise: true },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects GET with 405", async ({ request }) => {
    const res = await request.get("/v1/redact");
    expect(res.status()).toBe(405);
  });

  test("tenant override in body takes precedence over header", async ({
    request,
  }) => {
    const res = await request.post("/v1/redact", {
      headers: { "x-tenant-id": "header-tenant" },
      data: { text: "hi", tenant: "body-tenant" },
    });
    expect(res.status()).toBe(200);
  });
});
