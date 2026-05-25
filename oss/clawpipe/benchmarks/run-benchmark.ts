/**
 * ClawPipe Benchmark Runner
 *
 * Runs each prompt through the SDK pipeline stages (Booster, Packer,
 * Cache, Router) with a mocked gateway so no real API calls are made.
 * Outputs detailed per-prompt results to results/benchmark-results.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Booster } from '../sdk/src/booster';
import { Packer } from '../sdk/src/packer';
import { Cache } from '../sdk/src/cache';
import { Router } from '../sdk/src/router';

interface PromptEntry {
  prompt: string;
  category: string;
  expected_booster: boolean;
}

interface PromptResult {
  index: number;
  category: string;
  promptLength: number;
  boosterHit: boolean;
  boosterTimeMs: number;
  packerSavingsPercent: number;
  originalTokens: number;
  packedTokens: number;
  packerTimeMs: number;
  cacheHit: boolean;
  cacheTimeMs: number;
  routeProvider: string;
  routeModel: string;
  routeScore: number;
  routerTimeMs: number;
  gatewayTimeMs: number;
  totalTimeMs: number;
  estimatedDirectCostUsd: number;
  estimatedClawPipeCostUsd: number;
}

const __benchDir = new URL('.', import.meta.url).pathname;
const RESULTS_DIR = join(__benchDir, 'results');
const DATASET_PATH = join(__benchDir, 'prompt-dataset.json');
const OUTPUT_PATH = join(RESULTS_DIR, 'benchmark-results.json');

/** Simulated gateway latency range in ms. */
const MOCK_GATEWAY_MIN_MS = 200;
const MOCK_GATEWAY_MAX_MS = 1500;

/** Average cost per 1K tokens for direct API calls (blended rate). */
const DIRECT_COST_PER_1K = 0.005;

function mockGatewayLatency(complexity: string): number {
  const base = complexity === 'complex' ? 800 : complexity === 'packable' ? 500 : 300;
  return base + Math.random() * (MOCK_GATEWAY_MAX_MS - MOCK_GATEWAY_MIN_MS);
}

function estimateDirectCost(tokens: number): number {
  return (tokens / 1000) * DIRECT_COST_PER_1K;
}

function hrMs(): number {
  return performance.now();
}

function run(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const dataset: PromptEntry[] = JSON.parse(
    readFileSync(DATASET_PATH, 'utf-8'),
  );

  console.log(`Loaded ${dataset.length} prompts from dataset`);

  const booster = new Booster();
  const packer = new Packer();
  const cache = new Cache(300_000);
  const router = new Router();
  const results: PromptResult[] = [];

  // Pass 1: run all prompts
  runPass(dataset, booster, packer, cache, router, results, 1);

  // Pass 2: re-run to measure cache hits
  runPass(dataset, booster, packer, cache, router, results, 2);

  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} results to ${OUTPUT_PATH}`);
}

function runPass(
  dataset: PromptEntry[],
  booster: Booster,
  packer: Packer,
  cache: Cache,
  router: Router,
  results: PromptResult[],
  pass: number,
): void {
  console.log(`\n--- Pass ${pass} (${dataset.length} prompts) ---`);

  for (let i = 0; i < dataset.length; i++) {
    const entry = dataset[i];
    const totalStart = hrMs();

    // Stage 1: Booster
    const boosterStart = hrMs();
    const boosted = booster.tryResolve(entry.prompt);
    const boosterTimeMs = hrMs() - boosterStart;
    const boosterHit = boosted !== null;

    // Stage 2: Packer
    const packerStart = hrMs();
    const packResult = packer.pack(entry.prompt);
    const packerTimeMs = hrMs() - packerStart;
    const savingsStr = packResult.savings.replace('%', '');
    const packerSavingsPercent = parseInt(savingsStr, 10) || 0;

    // Stage 3: Cache
    const cacheKey = cache.key(packResult.packed);
    const cacheStart = hrMs();
    const cached = cache.get(cacheKey);
    const cacheTimeMs = hrMs() - cacheStart;
    const cacheHit = cached !== null;

    // If not cached, store a dummy response for future passes
    if (!cacheHit && !boosterHit) {
      cache.set(cacheKey, `[mock response for prompt ${i}]`);
    }

    // Stage 4: Router
    const routerStart = hrMs();
    const route = router.route(packResult.packed);
    const routerTimeMs = hrMs() - routerStart;

    // Stage 5: Mock gateway (skip if boosted or cached)
    let gatewayTimeMs = 0;
    if (!boosterHit && !cacheHit) {
      gatewayTimeMs = mockGatewayLatency(entry.category);
    }

    const totalTimeMs = hrMs() - totalStart + gatewayTimeMs;

    // Cost estimates
    const originalTokens = packResult.originalTokens;
    const directCost = estimateDirectCost(originalTokens);
    let clawpipeCost = 0;
    if (!boosterHit && !cacheHit) {
      clawpipeCost = estimateDirectCost(packResult.packedTokens);
    }

    results.push({
      index: (pass - 1) * dataset.length + i,
      category: entry.category,
      promptLength: entry.prompt.length,
      boosterHit,
      boosterTimeMs: round(boosterTimeMs),
      packerSavingsPercent,
      originalTokens,
      packedTokens: packResult.packedTokens,
      packerTimeMs: round(packerTimeMs),
      cacheHit,
      cacheTimeMs: round(cacheTimeMs),
      routeProvider: route.provider,
      routeModel: route.model,
      routeScore: round(route.score),
      routerTimeMs: round(routerTimeMs),
      gatewayTimeMs: round(gatewayTimeMs),
      totalTimeMs: round(totalTimeMs),
      estimatedDirectCostUsd: round(directCost),
      estimatedClawPipeCostUsd: round(clawpipeCost),
    });

    if ((i + 1) % 50 === 0) {
      console.log(`  Pass ${pass}: ${i + 1}/${dataset.length} processed`);
    }
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

run();
