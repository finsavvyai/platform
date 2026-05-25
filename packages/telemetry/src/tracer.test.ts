import { describe, expect, it } from "vitest";
import { InMemoryTracer } from "./tracer.js";

describe("InMemoryTracer", () => {
  it("creates a root span with a fresh traceId and no parent", () => {
    const t = new InMemoryTracer();
    const s = t.start("root");
    expect(s.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(s.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(s.parentSpanId).toBeUndefined();
    t.end(s);
  });

  it("links child spans to the active parent via traceId + parentSpanId", () => {
    const t = new InMemoryTracer();
    const parent = t.start("parent");
    const child = t.start("child");
    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
    t.end(child);
    t.end(parent);
  });

  it("end() records the span and sets endNs >= startNs", () => {
    const t = new InMemoryTracer();
    const s = t.start("op");
    const done = t.end(s);
    expect(done.endNs).toBeDefined();
    expect(done.endNs!).toBeGreaterThanOrEqual(s.startNs);
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0].status).toBe("ok");
  });

  it("withSpan ends span on success", () => {
    const t = new InMemoryTracer();
    const result = t.withSpan("op", () => 42);
    expect(result).toBe(42);
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0].status).toBe("ok");
    expect(t.activeSpan()).toBeUndefined();
  });

  it("withSpan ends span and marks error on throw, then rethrows", () => {
    const t = new InMemoryTracer();
    expect(() =>
      t.withSpan("op", () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0].status).toBe("error");
    expect(t.activeSpan()).toBeUndefined();
  });

  it("withSpanAsync ends span on success", async () => {
    const t = new InMemoryTracer();
    const v = await t.withSpanAsync("op", async () => "ok");
    expect(v).toBe("ok");
    expect(t.spans[0].status).toBe("ok");
  });

  it("withSpanAsync ends span on rejection", async () => {
    const t = new InMemoryTracer();
    await expect(
      t.withSpanAsync("op", async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
    expect(t.spans[0].status).toBe("error");
    expect(t.activeSpan()).toBeUndefined();
  });

  it("nested withSpan: child inherits trace and parent linkage", () => {
    const t = new InMemoryTracer();
    let captured: { trace: string; parentId: string | undefined } | undefined;
    t.withSpan("parent", (parent) => {
      t.withSpan("child", (child) => {
        captured = { trace: child.traceId, parentId: child.parentSpanId };
        expect(child.traceId).toBe(parent.traceId);
        expect(child.parentSpanId).toBe(parent.spanId);
      });
    });
    expect(captured).toBeDefined();
    // Spans recorded in close order: child first, then parent
    expect(t.spans.map((s) => s.name)).toEqual(["child", "parent"]);
  });

  it("activeSpan reflects current stack", () => {
    const t = new InMemoryTracer();
    expect(t.activeSpan()).toBeUndefined();
    const a = t.start("a");
    expect(t.activeSpan()).toBe(a);
    const b = t.start("b");
    expect(t.activeSpan()).toBe(b);
    t.end(b);
    expect(t.activeSpan()).toBe(a);
    t.end(a);
    expect(t.activeSpan()).toBeUndefined();
  });

  it("explicit parent via startWith overrides active span", () => {
    const t = new InMemoryTracer();
    const root = t.start("root");
    const other = t.start("decoy");
    const child = t.startWith("custom-child", { parent: root });
    expect(child.parentSpanId).toBe(root.spanId);
    expect(child.traceId).toBe(root.traceId);
    t.end(child);
    t.end(other);
    t.end(root);
  });

  it("tolerates out-of-order end() without throwing", () => {
    const t = new InMemoryTracer();
    const a = t.start("a");
    const b = t.start("b");
    expect(() => t.end(a)).not.toThrow();
    expect(() => t.end(b)).not.toThrow();
  });

  it("end on an unknown span still records it", () => {
    const t = new InMemoryTracer();
    const orphan = t.start("orphan");
    // Drop from stack first to simulate already-removed
    t.end(orphan);
    // Calling end again is tolerated — recorded twice but no throw
    expect(() => t.end(orphan)).not.toThrow();
    expect(t.spans.length).toBeGreaterThanOrEqual(1);
  });

  it("supports custom kind and attributes", () => {
    const t = new InMemoryTracer();
    const s = t.start("op", "server", { http_status: 200 });
    expect(s.kind).toBe("server");
    expect(s.attributes.http_status).toBe(200);
    t.end(s);
  });

  it("startWith uses default kind=internal and empty attributes", () => {
    const t = new InMemoryTracer();
    const s = t.startWith("x");
    expect(s.kind).toBe("internal");
    expect(s.attributes).toEqual({});
    t.end(s);
  });
});
