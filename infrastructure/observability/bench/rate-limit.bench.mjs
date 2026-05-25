// rate-limit bench: DEFERRED.
//
// The sliding-window implementation lives under
//   products/amliq/brain/services/api/src/rate-limit/sliding-window.ts
// which is owned by the in-flight SOC2-PREP agent (M3). Per quality-swarm
// conventions we MUST NOT read or measure code under that subtree while
// SOC2-PREP is active, even though the file is present on disk
// (currently untracked / not yet committed).
//
// When SOC2-PREP merges, replace this stub with the real bench:
//   - inputs: tracked timestamps in window — 100, 1k, 10k
//   - measure: decisions/sec for `allow()` under steady-state load
//   - record: p50/p95/p99 latency in microseconds
//
// Until then this script is a placeholder so the bench directory contract
// stays whole and CI wiring doesn't bit-rot. Exit code 0; prints a
// machine-readable deferral marker.

const payload = {
  bench: "rate-limit: sliding-window decision",
  status: "deferred",
  reason:
    "SOC2-PREP agent owns products/amliq/brain/services/api/src/rate-limit/; quality swarm conventions forbid reading in-flight subtrees.",
  unblock_when:
    "SOC2-PREP commits sliding-window.ts to main; rerun this bench and update docs/quality/PERF_BENCHMARKS.md.",
};

if (process.argv.includes("--json")) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
} else {
  // eslint-disable-next-line no-console
  console.log(
    `[deferred] ${payload.bench}\n  reason: ${payload.reason}\n  unblock: ${payload.unblock_when}`,
  );
}
