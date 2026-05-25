/**
 * Markdown formatter for benchmark summary data.
 * Extracted from analyze.ts to respect the 200-line file limit.
 */

interface CategoryStat {
  category: string;
  count: number;
  boosterHits: number;
  cacheHits: number;
  avgPackerSavings: number;
  avgTotalMs: number;
  totalDirectCost: number;
  totalClawPipeCost: number;
}

interface LatencyData {
  boosterMs: number;
  packerMs: number;
  cacheMs: number;
  routerMs: number;
  gatewayMs: number;
  totalMs: number;
}

export interface SummaryInput {
  total: number;
  boosterRate: string;
  cacheRate: string;
  avgPackerSavings: number;
  costSavingsPercent: string;
  totalDirectCost: number;
  totalClawPipeCost: number;
  pipelineOverhead: number;
  latency: LatencyData;
  catStats: CategoryStat[];
  topRoutes: [string, number][];
  pass1CacheHits: number;
  pass2CacheHits: number;
  half: number;
}

function r(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function formatMarkdown(s: SummaryInput): string {
  return `# ClawPipe Benchmark Results

> Generated: ${new Date().toISOString()}
> Dataset: ${s.total} prompts (2 passes = ${s.total / 2} unique prompts x 2)

## Key Metrics

| Metric | Value |
|--------|-------|
| Total prompts tested | ${s.total} |
| Booster hit rate (resolved without AI) | **${s.boosterRate}%** |
| Average Packer savings (token reduction) | **${r(s.avgPackerSavings)}%** |
| Cache hit rate (after second pass) | **${s.cacheRate}%** |
| Estimated cost savings overall | **${s.costSavingsPercent}%** |
| Average pipeline overhead | **${r(s.pipelineOverhead)}ms** |

## Cost Comparison

| Scenario | Total Cost |
|----------|-----------|
| Direct API calls (no ClawPipe) | $${r(s.totalDirectCost)} |
| With ClawPipe pipeline | $${r(s.totalClawPipeCost)} |
| **Savings** | **$${r(s.totalDirectCost - s.totalClawPipeCost)}** |

## Stage Latency Breakdown

| Stage | Avg Time |
|-------|----------|
| Booster | ${r(s.latency.boosterMs)}ms |
| Packer | ${r(s.latency.packerMs)}ms |
| Cache | ${r(s.latency.cacheMs)}ms |
| Router | ${r(s.latency.routerMs)}ms |
| Gateway (mock) | ${r(s.latency.gatewayMs)}ms |
| **Total** | **${r(s.latency.totalMs)}ms** |

## Category Breakdown

| Category | Count | Booster Hits | Cache Hits | Avg Packer Savings | Direct Cost | ClawPipe Cost |
|----------|-------|-------------|------------|-------------------|-------------|---------------|
${s.catStats.map((c) =>
  `| ${c.category} | ${c.count} | ${c.boosterHits} | ${c.cacheHits} | ${r(c.avgPackerSavings)}% | $${r(c.totalDirectCost)} | $${r(c.totalClawPipeCost)} |`
).join('\n')}

## Cache Performance by Pass

| Pass | Cache Hits | Cache Miss |
|------|-----------|------------|
| Pass 1 (cold) | ${s.pass1CacheHits} | ${s.half - s.pass1CacheHits} |
| Pass 2 (warm) | ${s.pass2CacheHits} | ${s.half - s.pass2CacheHits} |

## Top Routes Selected

| Model | Times Selected |
|-------|---------------|
${s.topRoutes.map(([model, count]) => `| ${model} | ${count} |`).join('\n')}
`;
}
