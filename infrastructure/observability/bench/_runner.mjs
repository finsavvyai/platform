// Shared bench harness. Zero-dep. Node 20+.
//
// API:
//   await runBench({ name, setup, op, sizes, warmupMs, measureMs })
//
// - setup(size) -> ctx (sync or async); called once per size.
// - op(ctx) -> any | Promise<any>; the hot path under measurement.
// - For each size we run a warmup, then measure for measureMs.
// - Reports throughput (ops/sec) + p50/p95/p99/max latency (microseconds).
//
// We intentionally hand-roll over tinybench: the monorepo has no
// tinybench devDep, and this lets the benches run with a bare `node`.

import { performance } from "node:perf_hooks";

const NS_PER_MS = 1e6;
const US_PER_MS = 1e3;

function quantile(sortedUs, q) {
  if (sortedUs.length === 0) return 0;
  const idx = Math.min(sortedUs.length - 1, Math.floor(q * sortedUs.length));
  return sortedUs[idx];
}

async function measureOnce(op, ctx) {
  const t0 = performance.now();
  const out = op(ctx);
  if (out && typeof out.then === "function") await out;
  return (performance.now() - t0) * US_PER_MS; // microseconds
}

export async function runBench({
  name,
  setup,
  op,
  sizes,
  warmupMs = 200,
  measureMs = 800,
  sampleCap = 200_000,
}) {
  const rows = [];
  for (const size of sizes) {
    const ctx = await setup(size);

    // Warmup — discard.
    const warmEnd = performance.now() + warmupMs;
    while (performance.now() < warmEnd) {
      await measureOnce(op, ctx);
    }

    // Measure.
    const samples = new Array(Math.min(sampleCap, 50_000));
    let n = 0;
    const measureEnd = performance.now() + measureMs;
    while (performance.now() < measureEnd && n < sampleCap) {
      const us = await measureOnce(op, ctx);
      if (n < samples.length) samples[n] = us;
      else samples.push(us);
      n += 1;
    }
    const trimmed = samples.slice(0, n).sort((a, b) => a - b);
    const totalMs = trimmed.reduce((a, b) => a + b, 0) / US_PER_MS;
    const throughput = (n / totalMs) * 1000;

    rows.push({
      size,
      iterations: n,
      throughputOpsPerSec: Math.round(throughput),
      p50us: Math.round(quantile(trimmed, 0.5)),
      p95us: Math.round(quantile(trimmed, 0.95)),
      p99us: Math.round(quantile(trimmed, 0.99)),
      maxUs: Math.round(trimmed[trimmed.length - 1] ?? 0),
    });
  }
  return { name, rows };
}

export function printReport({ name, rows }) {
  const lines = [];
  lines.push(`\n=== ${name} ===`);
  lines.push(
    [
      "size".padEnd(18),
      "iters".padStart(8),
      "ops/sec".padStart(12),
      "p50us".padStart(8),
      "p95us".padStart(8),
      "p99us".padStart(10),
      "maxus".padStart(10),
    ].join(" "),
  );
  for (const r of rows) {
    lines.push(
      [
        String(r.size).padEnd(18),
        String(r.iterations).padStart(8),
        String(r.throughputOpsPerSec).padStart(12),
        String(r.p50us).padStart(8),
        String(r.p95us).padStart(8),
        String(r.p99us).padStart(10),
        String(r.maxUs).padStart(10),
      ].join(" "),
    );
  }
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

export function emitMachineReadable({ name, rows }) {
  // Single JSON line; downstream CI can parse.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ bench: name, rows, node: process.version }));
}

export { NS_PER_MS, US_PER_MS };
