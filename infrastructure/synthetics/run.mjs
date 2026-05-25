#!/usr/bin/env node
// FinsavvyAI synthetic probe runner.
// Usage: node run.mjs --target staging|production [--probe NAME]
// Emits JSON-lines to stdout AND writes results.jsonl. Exit 1 if any probe failed.

import { readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBES_DIR = join(__dirname, "probes");
const RESULTS_FILE = resolve(__dirname, "results.jsonl");

function parseArgs(argv) {
  const out = { target: null, probe: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--target") out.target = argv[++i];
    else if (a === "--probe") out.probe = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function usage() {
  process.stdout.write(
    "Usage: node run.mjs --target staging|production [--probe NAME]\n",
  );
}

function resolveBaseUrl(target) {
  if (target === "staging") {
    const u = process.env.FINSAVVY_STAGING_URL;
    if (!u) throw new Error("FINSAVVY_STAGING_URL not set");
    return u.replace(/\/$/, "");
  }
  if (target === "production") {
    const u = process.env.FINSAVVY_PROD_URL;
    if (!u) throw new Error("FINSAVVY_PROD_URL not set");
    return u.replace(/\/$/, "");
  }
  throw new Error(`unknown target: ${target}`);
}

async function loadProbes(filter) {
  const entries = await readdir(PROBES_DIR);
  const files = entries
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => !f.startsWith("_"))
    .filter((f) => !f.endsWith(".test.mjs"));
  const probes = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(PROBES_DIR, f)).href);
    if (typeof mod.run !== "function" || typeof mod.name !== "string") {
      continue;
    }
    if (filter && mod.name !== filter) continue;
    probes.push(mod);
  }
  return probes;
}

function buildContext(baseUrl) {
  return {
    baseUrl,
    jwt: process.env.FINSAVVY_SYNTHETIC_JWT,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_TEST_SECRET,
    lemonSqueezyWebhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_TEST_SECRET,
    timeoutMs: Number(process.env.FINSAVVY_PROBE_TIMEOUT_MS ?? 10_000),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target) {
    usage();
    process.exit(args.help ? 0 : 2);
  }
  let baseUrl;
  try {
    baseUrl = resolveBaseUrl(args.target);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  const probes = await loadProbes(args.probe);
  if (probes.length === 0) {
    process.stderr.write(
      `no probes matched (filter='${args.probe ?? ""}')\n`,
    );
    process.exit(2);
  }
  const ctx = buildContext(baseUrl);
  const results = await Promise.all(
    probes.map((p) =>
      p.run(ctx).catch((err) => ({
        probe: p.name,
        ok: false,
        latency_ms: 0,
        ts: new Date().toISOString(),
        error: `probe threw: ${err?.message ?? String(err)}`,
      })),
    ),
  );
  const lines = results.map((r) => JSON.stringify(r)).join("\n") + "\n";
  process.stdout.write(lines);
  await writeFile(RESULTS_FILE, lines, "utf8");
  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`runner crashed: ${err?.stack ?? err}\n`);
  process.exit(2);
});
