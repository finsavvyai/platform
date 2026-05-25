import { describe, expect, it } from "vitest";
import type { AuditRecord } from "../audit-log.js";
import { chainAppend } from "./chain.js";
import { createHmacSigner, createHmacVerifier, signRecord } from "./sign.js";
import type { SignedRecord } from "./types.js";
import { verifyChain } from "./verifier.js";

const KEY = "verifier-tests";

const rec = (i: number): AuditRecord => ({
  ts: "2026-01-01T00:00:00.000Z",
  actor_id: `u${i}`,
  event: `e${i}`,
  resource: `r${i}`,
  decision: "allow",
  reason: "",
});

const buildChain = (n: number): SignedRecord[] => {
  const signer = createHmacSigner(KEY);
  let prev: string | null = null;
  const out: SignedRecord[] = [];
  for (let i = 0; i < n; i++) {
    const c = chainAppend(prev, rec(i), i);
    out.push(signRecord(c, signer));
    prev = c.hash;
  }
  return out;
};

describe("verifyChain — happy path", () => {
  const verifier = createHmacVerifier(KEY);

  it("accepts an empty chain", () => {
    expect(verifyChain([], verifier)).toEqual({ ok: true });
  });

  it("accepts a one-record genesis chain", () => {
    expect(verifyChain(buildChain(1), verifier)).toEqual({ ok: true });
  });

  it("accepts a multi-record valid chain", () => {
    expect(verifyChain(buildChain(10), verifier)).toEqual({ ok: true });
  });
});

describe("verifyChain — tamper detection", () => {
  const verifier = createHmacVerifier(KEY);

  it("detects mutation of a record (hash_mismatch)", () => {
    const chain = buildChain(5);
    // Mutate record at index 2 without re-hashing/re-signing.
    const tampered: SignedRecord = {
      ...chain[2],
      chained: {
        ...chain[2].chained,
        record: { ...chain[2].chained.record, actor_id: "evil" },
      },
    };
    const broken = [...chain.slice(0, 2), tampered, ...chain.slice(3)];
    const res = verifyChain(broken, verifier);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.breakIndex).toBe(2);
      expect(res.reason).toBe("hash_mismatch");
    }
  });

  it("detects a bad signature when the record itself is consistent", () => {
    const chain = buildChain(3);
    const tampered: SignedRecord = {
      ...chain[1],
      sig: "0".repeat(64),
    };
    const broken = [chain[0], tampered, chain[2]];
    const res = verifyChain(broken, verifier);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.breakIndex).toBe(1);
      expect(res.reason).toBe("bad_signature");
    }
  });

  it("detects an inserted (foreign but self-consistent) record", () => {
    const chain = buildChain(4);
    // Build a foreign record that is self-consistent but does NOT chain.
    const signer = createHmacSigner(KEY);
    const intruder = signRecord(
      chainAppend(null, rec(99), 1), // wrong prev_hash + clashing seq
      signer,
    );
    const broken = [chain[0], intruder, ...chain.slice(1)];
    const res = verifyChain(broken, verifier);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.breakIndex).toBe(1);
      expect(res.reason).toBe("prev_hash_mismatch");
    }
  });

  it("detects a deleted record via sequence_gap", () => {
    const chain = buildChain(5);
    const broken = [chain[0], chain[1], chain[3], chain[4]]; // drop index 2
    const res = verifyChain(broken, verifier);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.breakIndex).toBe(2);
      expect(res.reason).toBe("sequence_gap");
    }
  });

  it("detects reordered records", () => {
    const chain = buildChain(4);
    const broken = [chain[0], chain[2], chain[1], chain[3]];
    const res = verifyChain(broken, verifier);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // index 1 has the wrong sequence_id (expected 1, got 2)
      expect(res.breakIndex).toBe(1);
      expect(res.reason).toBe("sequence_gap");
    }
  });

  it("detects a non-null prev_hash on the genesis when chain head is wrong", () => {
    const chain = buildChain(2);
    // Replace index 0 with a record claiming a non-null prev_hash.
    const signer = createHmacSigner(KEY);
    const fakeGenesis = signRecord(
      chainAppend("ff".repeat(32), rec(0), 0),
      signer,
    );
    const broken = [fakeGenesis, chain[1]];
    const res = verifyChain(broken, verifier);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.breakIndex).toBe(0);
      expect(res.reason).toBe("prev_hash_mismatch");
    }
  });

  it("detects wrong-key verifier on otherwise valid chain", () => {
    const chain = buildChain(3);
    const wrong = createHmacVerifier("different-key");
    const res = verifyChain(chain, wrong);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.breakIndex).toBe(0);
      expect(res.reason).toBe("bad_signature");
    }
  });
});
