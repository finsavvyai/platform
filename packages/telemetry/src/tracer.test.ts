import { describe, expect, it } from "vitest";
import { InMemoryTracer } from "./tracer.js";

describe("InMemoryTracer", () => {
  it("starts spans with trace identifiers and defaults", () => {
    const tracer = new InMemoryTracer();
    const span = tracer.start("billing.webhook");

    expect(span.name).toBe("billing.webhook");
    expect(span.kind).toBe("internal");
    expect(span.status).toBe("unset");
    expect(span.traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(span.spanId).toMatch(/^[a-f0-9]{16}$/);
    expect(span.startNs).toBeGreaterThan(0);
  });

  it("records completed spans with status and attributes", () => {
    const tracer = new InMemoryTracer();
    const span = tracer.start("ai.call", "client", { provider: "openai" });
    const completed = tracer.end(span, "error");

    expect(completed.endNs).toBeGreaterThanOrEqual(completed.startNs);
    expect(completed.status).toBe("error");
    expect(completed.attributes).toEqual({ provider: "openai" });
    expect(tracer.spans).toEqual([completed]);
  });
});
