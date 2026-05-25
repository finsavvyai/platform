/**
 * ClawPipe Benchmark Analyzer
 *
 * Reads benchmark-results.json and generates summary.md + summary.json
 * with key metrics: Booster hit rate, Packer savings, Cache hit rate,
 * cost comparison, and per-stage latency breakdown.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatMarkdown } from './format-markdown';

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
const INPUT = join(RESULTS_DIR, 'benchmark-results.json');
const OUTPUT = join(RESULTS_DIR, 'summary.md');
const JSON_OUT = join(RESULTS_DIR, 'summary.json');

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function analyze(): void {
  const results: PromptResult[] = JSON.parse(readFileSync(INPUT, 'utf-8'));
  const total = results.length;

  const boosterHits = results.filter((r) => r.boosterHit).length;
  const cacheHits = results.filter((r) => r.cacheHit).length;
  const boosterRate = ((boosterHits / total) * 100).toFixed(1);
  const cacheRate = ((cacheHits / total) * 100).toFixed(1);

  const nonCachedNonBoosted = results.filter((r) => !r.boosterHit && !r.cacheHit);
  const avgPackerSavings = nonCachedNonBoosted.length > 0
    ? nonCachedNonBoosted.reduce((s, r) => s + r.packerSavingsPercent, 0)
      / nonCachedNonBoosted.length
    : 0;

  const totalDirectCost = results.reduce((s, r) => s + r.estimatedDirectCostUsd, 0);
  const totalClawPipeCost = results.reduce((s, r) => s + r.estimatedClawPipeCostUsd, 0);
  const costSavingsPercent = totalDirectCost > 0
    ? ((1 - totalClawPipeCost / totalDirectCost) * 100).toFixed(1) : '0.0';

  const avgBoosterMs = avg(results.map((r) => r.boosterTimeMs));
  const avgPackerMs = avg(results.map((r) => r.packerTimeMs));
  const avgCacheMs = avg(results.map((r) => r.cacheTimeMs));
  const avgRouterMs = avg(results.map((r) => r.routerTimeMs));
  const avgGatewayMs = avg(results.filter((r) => r.gatewayTimeMs > 0).map((r) => r.gatewayTimeMs));
  const avgTotalMs = avg(results.map((r) => r.totalTimeMs));
  const pipelineOverhead = avgBoosterMs + avgPackerMs + avgCacheMs + avgRouterMs;

  const categories = ['boostable', 'packable', 'simple', 'complex'];
  const catStats = categories.map((cat) => {
    const cr = results.filter((r) => r.category === cat);
    return {
      category: cat, count: cr.length,
      boosterHits: cr.filter((r) => r.boosterHit).length,
      cacheHits: cr.filter((r) => r.cacheHit).length,
      avgPackerSavings: avg(cr.map((r) => r.packerSavingsPercent)),
      avgTotalMs: avg(cr.map((r) => r.totalTimeMs)),
      totalDirectCost: cr.reduce((s, r) => s + r.estimatedDirectCostUsd, 0),
      totalClawPipeCost: cr.reduce((s, r) => s + r.estimatedClawPipeCostUsd, 0),
    };
  });

  const routeCounts = new Map<string, number>();
  for (const r of results) {
    if (!r.boosterHit && !r.cacheHit) {
      const key = `${r.routeProvider}:${r.routeModel}`;
      routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
    }
  }
  const topRoutes = Array.from(routeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const half = total / 2;
  const pass1CacheHits = results.slice(0, half).filter((r) => r.cacheHit).length;
  const pass2CacheHits = results.slice(half).filter((r) => r.cacheHit).length;

  const summaryData = {
    totalPrompts: total, boosterHitRate: parseFloat(boosterRate),
    cacheHitRate: parseFloat(cacheRate), avgPackerSavings: round(avgPackerSavings),
    costSavingsPercent: parseFloat(costSavingsPercent),
    totalDirectCostUsd: round(totalDirectCost), totalClawPipeCostUsd: round(totalClawPipeCost),
    pipelineOverheadMs: round(pipelineOverhead),
    avgLatency: {
      boosterMs: round(avgBoosterMs), packerMs: round(avgPackerMs),
      cacheMs: round(avgCacheMs), routerMs: round(avgRouterMs),
      gatewayMs: round(avgGatewayMs), totalMs: round(avgTotalMs),
    },
    categoryBreakdown: catStats.map((c) => ({
      ...c, avgPackerSavings: round(c.avgPackerSavings), avgTotalMs: round(c.avgTotalMs),
      totalDirectCost: round(c.totalDirectCost), totalClawPipeCost: round(c.totalClawPipeCost),
    })),
    topRoutes: topRoutes.map(([model, count]) => ({ model, count })),
    pass1CacheHits, pass2CacheHits,
  };

  writeFileSync(JSON_OUT, JSON.stringify(summaryData, null, 2));
  console.log(`Wrote summary JSON to ${JSON_OUT}`);

  const md = formatMarkdown({
    total, boosterRate, cacheRate, avgPackerSavings, costSavingsPercent,
    totalDirectCost, totalClawPipeCost, pipelineOverhead,
    latency: { boosterMs: avgBoosterMs, packerMs: avgPackerMs, cacheMs: avgCacheMs,
      routerMs: avgRouterMs, gatewayMs: avgGatewayMs, totalMs: avgTotalMs },
    catStats, topRoutes, pass1CacheHits, pass2CacheHits, half,
  });

  writeFileSync(OUTPUT, md);
  console.log(`Wrote summary to ${OUTPUT}`);

  console.log('\n=== ClawPipe Benchmark Summary ===');
  console.log(`${boosterRate}% of prompts resolved without AI (Booster)`);
  console.log(`${round(avgPackerSavings)}% average token reduction (Packer)`);
  console.log(`${costSavingsPercent}% estimated cost savings overall`);
  console.log(`Average pipeline overhead: ${round(pipelineOverhead)}ms`);
}

analyze();
