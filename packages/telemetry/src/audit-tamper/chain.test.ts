import { describe, expect, it } from "vitest";
import type { AuditRecord } from "../audit-log.js";
import { canonicalJson, chainAppend, recomputeHash, sha256Hex } from "./chain.js";

const rec = (overrides: Partial<AuditRecord> = {}): AuditRecord => ({
  ts: "2026-01-01T00:00:00.000Z",
  actor_id: "user_1",
  event: "auth.login",
  resource: "session:abc",
  decision: "allow",
  reason: "",
  ...overrides,
});

describe("canonicalJson", () => {
  it("emits primitives the same as JSON.stringify", () => {
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("x")).toBe('"x"');
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
  });

  it("is key-order independent for objects", () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it("recurses into nested objects in sorted order", () => {
    const a = canonicalJson({ outer: { z: 1, a: 2 }, alpha: 3 });
    expect(a).toBe('{"alpha":3,"outer":{"a":2,"z":1}}');
  });

  it("preserves array order (semantic)", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("drops undefined properties (matches JSON.stringify)", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("returns 'null' for top-level undefined fallback", () => {
    // JSON.stringify(undefined) === undefined; canonicalJson must return a string
    expect(canonicalJson(undefined)).toBe("null");
  });
});

describe("sha256Hex", () => {
  it("produces stable 64-char lowercase hex", () => {
    const h = sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(sha256Hex("hello"));
  });

  it("changes when input changes", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});

describe("chainAppend", () => {
  it("creates a genesis record with prev_hash=null and sequence_id=0", () => {
    const out = chainAppend(null, rec());
    expect(out.prev_hash).toBeNull();
    expect(out.sequence_id).toBe(0);
    expect(out.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.record).toEqual(rec());
  });

  it("produces identical hashes for identical inputs", () => {
    const a = chainAppend(null, rec());
    const b = chainAppend(null, rec());
    expect(a.hash).toBe(b.hash);
  });

  it("produces different hashes for different records", () => {
    const a = chainAppend(null, rec({ event: "auth.login" }));
    const b = chainAppend(null, rec({ event: "auth.logout" }));
    expect(a.hash).not.toBe(b.hash);
  });

  it("produces different hashes when prev_hash differs", () => {
    const seed = chainAppend(null, rec());
    const a = chainAppend(seed.hash, rec({ event: "x" }), 1);
    const b = chainAppend(null, rec({ event: "x" }), 1);
    expect(a.hash).not.toBe(b.hash);
  });

  it("builds a chain where each record's prev_hash matches predecessor's hash", () => {
    let prev = null as string | null;
    const chain = [];
    for (let i = 0; i < 5; i++) {
      const c = chainAppend(prev, rec({ event: `e${i}` }), i);
      chain.push(c);
      prev = c.hash;
    }
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].prev_hash).toBe(chain[i - 1].hash);
      expect(chain[i].sequence_id).toBe(chain[i - 1].sequence_id + 1);
    }
  });

  it("hash is key-order independent of the underlying record fields", () => {
    const r1: AuditRecord = rec({ meta: { a: 1, b: 2 } });
    const r2: AuditRecord = rec({ meta: { b: 2, a: 1 } });
    expect(chainAppend(null, r1).hash).toBe(chainAppend(null, r2).hash);
  });

  it("handles an empty-ish record (all empty strings)", () => {
    const empty: AuditRecord = {
      ts: "",
      actor_id: "",
      event: "",
      resource: "",
      decision: "allow",
      reason: "",
    };
    const c = chainAppend(null, empty);
    expect(c.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults sequence_id to 0 when not supplied", () => {
    const c = chainAppend(null, rec());
    expect(c.sequence_id).toBe(0);
  });
});

describe("recomputeHash", () => {
  it("matches the hash assigned by chainAppend", () => {
    const c = chainAppend(null, rec());
    expect(recomputeHash(c)).toBe(c.hash);
  });

  it("differs when the record is mutated", () => {
    const c = chainAppend(null, rec());
    const tampered = { ...c, record: { ...c.record, actor_id: "user_2" } };
    expect(recomputeHash(tampered)).not.toBe(c.hash);
  });
});
