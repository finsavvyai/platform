/**
 * MCP Tool: clawpipe_stats — get current session telemetry snapshot.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PipelineContext } from './pipeline.js';

export function registerStatsTool(server: McpServer, ctx: PipelineContext): void {
  server.tool(
    'clawpipe_stats',
    'Get current session telemetry: total requests, tokens, cost, cache hit rate, top models, and average latency.',
    {},
    async () => {
      const stats = ctx.client.stats();

      const topModelsStr = stats.topModels.length > 0
        ? stats.topModels
            .map((m) => `  ${m.model}: ${m.calls} calls, $${m.cost.toFixed(6)}`)
            .join('\n')
        : '  (no requests yet)';

      const lines = [
        `Total requests: ${stats.totalRequests}`,
        `Total tokens: ${stats.totalTokensIn} in / ${stats.totalTokensOut} out`,
        `Total cost: $${stats.totalCostUsd.toFixed(4)}`,
        `Cache hit rate: ${stats.cacheHitRate}`,
        `Saved by cache: ${stats.totalSavedByCache} requests`,
        `Saved by booster: ${stats.totalSavedByBooster} requests`,
        `Avg latency: ${stats.avgLatencyMs}ms`,
        '',
        'Top models:',
        topModelsStr,
      ];

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
