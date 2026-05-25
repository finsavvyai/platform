/**
 * Markdown report renderer for real-benchmark results.
 * Kept separate so real-benchmark.ts stays under the 250-line product cap.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderMarkdown(r: any): string {
  const cp = r.clawpipe, oa = r.direct_openai, an = r.direct_anthropic, c = r.comparison;
  const savedVsOA = (oa.total_cost - cp.total_cost).toFixed(5);
  const savedVsAN = (an.total_cost - cp.total_cost).toFixed(5);
  const cats = Object.entries(r.dataset.categories as Record<string, number>)
    .map(([k, v]) => `- ${k}: ${v}`).join('\n');
  return `# ClawPipe Real Benchmark Results

Generated: ${r.timestamp}

## Dataset
Prompts tested: **${r.dataset.prompts_tested}** (real API calls to OpenAI + Anthropic)

${cats}

## Cost Comparison (real dollars)

| Path | Total Cost | Avg Latency | Tokens In | Tokens Out | API Calls |
|---|---|---|---|---|---|
| Direct OpenAI (gpt-4o-mini) | $${oa.total_cost.toFixed(5)} | ${oa.avg_latency_ms}ms | ${oa.tokens_in} | ${oa.tokens_out} | ${oa.calls_made} |
| Direct Anthropic (claude-3-haiku) | $${an.total_cost.toFixed(5)} | ${an.avg_latency_ms}ms | ${an.tokens_in} | ${an.tokens_out} | ${an.calls_made} |
| **ClawPipe (full pipeline)** | **$${cp.total_cost.toFixed(5)}** | **${cp.avg_latency_ms}ms** | ${cp.tokens_in} | ${cp.tokens_out} | ${cp.total_api_calls_made} |

## Savings
- vs OpenAI:    **${c.cost_reduction_vs_openai}** ($${savedVsOA} saved)
- vs Anthropic: **${c.cost_reduction_vs_anthropic}** ($${savedVsAN} saved)

## Pipeline Efficiency
- Booster hits: **${cp.boosted_count}** (zero-cost, sub-ms resolution)
- Cache hits:   **${cp.cached_count}** (zero-cost re-serves)
- API calls saved: **${r.dataset.prompts_tested - cp.total_api_calls_made}** / ${r.dataset.prompts_tested}

## Latency
- ClawPipe p50: ${c.latency_p50_ms}ms
- ClawPipe p95: ${c.latency_p95_ms}ms

## Category breakdown
See real-results.json for per-prompt numbers across boostable, packable, simple, complex.

## Safety
- Budget cap: $${r.safety.budget_cap_usd}
- Total spent: $${r.safety.total_spent_usd}

## Disclaimer
Results depend heavily on prompt mix. A dataset skewed toward boostable or
cacheable prompts will show dramatic savings; a pure-novel dataset will show
savings only from Packer + Router selection. These numbers reflect a
20-prompt subset across four categories and should be read as indicative,
not guaranteed for all workloads.
`;
}
