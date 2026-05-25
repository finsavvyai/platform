/**
 * MCP Tool: clawpipe_prompt — send a prompt through the full pipeline.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PipelineContext } from './pipeline.js';

export function registerPromptTool(server: McpServer, ctx: PipelineContext): void {
  server.tool(
    'clawpipe_prompt',
    'Send a prompt through the ClawPipe pipeline (Booster -> Pack -> Cache -> Route -> Call -> Learn). Returns the response text and pipeline metadata.',
    {
      prompt: z.string().describe('The prompt text to send through the pipeline'),
      system: z.string().optional().describe('Optional system message'),
      model: z.string().optional().describe('Override model selection (e.g. gpt-4o)'),
      provider: z.string().optional().describe('Override provider (e.g. openai, anthropic)'),
    },
    async ({ prompt, system, model, provider }) => {
      try {
        const result = await ctx.client.prompt(prompt, {
          system,
          model,
          provider,
        });

        const meta = result.meta;
        const summary = [
          `Provider: ${meta.route || 'booster'}`,
          `Model: ${meta.model || 'n/a'}`,
          `Boosted: ${meta.boosted}`,
          `Cached: ${meta.cached}`,
          `Packed: ${meta.packed} (savings: ${meta.contextSavings})`,
          `Tokens: ${meta.tokensIn} in / ${meta.tokensOut} out`,
          `Cost: $${meta.estimatedCostUsd.toFixed(6)}`,
          `Latency: ${meta.latencyMs}ms`,
        ].join('\n');

        return {
          content: [
            { type: 'text' as const, text: result.text },
            { type: 'text' as const, text: `\n---\nPipeline Meta:\n${summary}` },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    },
  );
}
