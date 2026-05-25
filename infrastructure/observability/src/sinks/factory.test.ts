import { describe, it, expect, vi } from "vitest";

import { createSinkFromEnv } from "./factory.js";
import type { R2BucketLike } from "../types.js";

const makeBucket = (): R2BucketLike => ({
  put: vi.fn(async () => undefined),
});

describe("sink factory", () => {
  it("defaults to stdout when env is empty", () => {
    const { kind, sink, flush } = createSinkFromEnv({ env: {} });
    expect(kind).toBe("stdout");
    expect(typeof sink).toBe("function");
    expect(flush).toBeUndefined();
  });

  it("picks stdout when explicitly set", () => {
    const { kind } = createSinkFromEnv({
      env: { FINSAVVY_AUDIT_SINK: "stdout" },
    });
    expect(kind).toBe("stdout");
  });

  it("normalizes case (STDOUT → stdout)", () => {
    const { kind } = createSinkFromEnv({
      env: { FINSAVVY_AUDIT_SINK: "STDOUT" },
    });
    expect(kind).toBe("stdout");
  });

  it("picks r2 with bucket injected and bucket name set", () => {
    const { kind, sink, flush } = createSinkFromEnv({
      env: {
        FINSAVVY_AUDIT_SINK: "r2",
        FINSAVVY_AUDIT_R2_BUCKET: "finsavvy-audit",
      },
      r2Bucket: makeBucket(),
    });
    expect(kind).toBe("r2");
    expect(typeof sink).toBe("function");
    expect(typeof flush).toBe("function");
  });

  it("throws when r2 selected without bucket injection", () => {
    expect(() =>
      createSinkFromEnv({
        env: {
          FINSAVVY_AUDIT_SINK: "r2",
          FINSAVVY_AUDIT_R2_BUCKET: "finsavvy-audit",
        },
      }),
    ).toThrow(/options\.r2Bucket/);
  });

  it("throws when r2 selected without FINSAVVY_AUDIT_R2_BUCKET", () => {
    expect(() =>
      createSinkFromEnv({
        env: { FINSAVVY_AUDIT_SINK: "r2" },
        r2Bucket: makeBucket(),
      }),
    ).toThrow(/FINSAVVY_AUDIT_R2_BUCKET/);
  });

  it("picks datadog with API key", () => {
    const { kind, sink, flush } = createSinkFromEnv({
      env: {
        FINSAVVY_AUDIT_SINK: "datadog",
        FINSAVVY_AUDIT_DD_API_KEY: "k",
      },
    });
    expect(kind).toBe("datadog");
    expect(typeof sink).toBe("function");
    expect(typeof flush).toBe("function");
  });

  it("respects FINSAVVY_AUDIT_DD_SITE=eu", () => {
    const { kind } = createSinkFromEnv({
      env: {
        FINSAVVY_AUDIT_SINK: "datadog",
        FINSAVVY_AUDIT_DD_API_KEY: "k",
        FINSAVVY_AUDIT_DD_SITE: "eu",
      },
    });
    expect(kind).toBe("datadog");
  });

  it("throws on datadog without API key", () => {
    expect(() =>
      createSinkFromEnv({
        env: { FINSAVVY_AUDIT_SINK: "datadog" },
      }),
    ).toThrow(/FINSAVVY_AUDIT_DD_API_KEY/);
  });

  it("throws on invalid sink kind", () => {
    expect(() =>
      createSinkFromEnv({
        env: { FINSAVVY_AUDIT_SINK: "splunk" },
      }),
    ).toThrow(/FINSAVVY_AUDIT_SINK invalid/);
  });

  it("throws on invalid datadog site", () => {
    expect(() =>
      createSinkFromEnv({
        env: {
          FINSAVVY_AUDIT_SINK: "datadog",
          FINSAVVY_AUDIT_DD_API_KEY: "k",
          FINSAVVY_AUDIT_DD_SITE: "mars",
        },
      }),
    ).toThrow(/FINSAVVY_AUDIT_DD_SITE invalid/);
  });

  it("returns stdout when process is missing entirely (Workers-like env)", () => {
    const realProcess = (globalThis as { process?: unknown }).process;
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      get: () => undefined,
    });
    try {
      const { kind } = createSinkFromEnv();
      expect(kind).toBe("stdout");
    } finally {
      Object.defineProperty(globalThis, "process", {
        configurable: true,
        value: realProcess,
      });
    }
  });

  it("reads process.env when no env is passed", () => {
    const prev = process.env["FINSAVVY_AUDIT_SINK"];
    process.env["FINSAVVY_AUDIT_SINK"] = "stdout";
    try {
      const { kind } = createSinkFromEnv();
      expect(kind).toBe("stdout");
    } finally {
      if (prev === undefined) delete process.env["FINSAVVY_AUDIT_SINK"];
      else process.env["FINSAVVY_AUDIT_SINK"] = prev;
    }
  });
});
