// audit-tamper bench: chainAppend + sign throughput at 100B / 1KB / 10KB records.
//
// Mirrors packages/telemetry/src/audit-tamper/{chain.ts,sign.ts} so the bench
// stays runnable without the TS toolchain. If chain.ts changes its hash
// inputs, update `chainAppend` here too.

import { createHash, createHmac } from "node:crypto";
import { runBench, printReport, emitMachineReadable } from "./_runner.mjs";

// --- replicated production primitives (kept tiny + faithful) ---

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = [];
  for (const k of keys) {
    const v = value[k];
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(k)}:${canonicalJson(v)}`);
  }
  return `{${parts.join(",")}}`;
}

function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function chainAppend(prevHash, record, sequenceId) {
  const payload = canonicalJson({
    prev_hash: prevHash,
    record,
    sequence_id: sequenceId,
  });
  const hash = sha256Hex(payload);
  return { record, prev_hash: prevHash, hash, sequence_id: sequenceId };
}

function createHmacSigner(key) {
  const keyBuf = Buffer.from(key, "utf8");
  return {
    algo: "hmac-sha256",
    sign(hash) {
      return createHmac("sha256", keyBuf).update(hash, "utf8").digest("hex");
    },
  };
}

function signRecord(chained, signer) {
  return { chained, sig: signer.sign(chained.hash) };
}

// --- record fixtures sized to target byte counts ---

function makeRecord(approxBytes) {
  const overhead = 200; // ts + actor_id + event + resource + decision + reason keys
  const padLen = Math.max(0, approxBytes - overhead);
  return {
    ts: "2026-05-25T20:00:00.000Z",
    actor_id: "user:abc123",
    event: "policy.evaluate",
    resource: "tenant:t1/case:c42",
    decision: "allow",
    reason: "ok",
    meta: { trace_id: "t-".padEnd(16, "x"), pad: "x".repeat(padLen) },
  };
}

const SIZES = [
  { label: "100B", bytes: 100 },
  { label: "1KB", bytes: 1024 },
  { label: "10KB", bytes: 10240 },
];

const signer = createHmacSigner("bench-secret-do-not-use-in-prod");

const setup = (sizeLabel) => {
  const sizeDef = SIZES.find((s) => s.label === sizeLabel);
  const record = makeRecord(sizeDef.bytes);
  // Genesis chain state for repeatable runs.
  let prevHash = null;
  let seq = 0;
  return {
    record,
    getNext: () => ({ prev: prevHash, seq: seq++ }),
    setPrev: (h) => (prevHash = h),
  };
};

const op = (ctx) => {
  const { prev, seq } = ctx.getNext();
  const chained = chainAppend(prev, ctx.record, seq);
  ctx.setPrev(chained.hash);
  return signRecord(chained, signer);
};

const machine = process.argv.includes("--json");

const result = await runBench({
  name: "audit-tamper: chainAppend + signRecord",
  setup,
  op,
  sizes: SIZES.map((s) => s.label),
  warmupMs: 200,
  measureMs: 800,
});

if (machine) emitMachineReadable(result);
else printReport(result);
