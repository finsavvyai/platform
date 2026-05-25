/**
 * MCP Tool: clawpipe_analyze_cost — estimate cost without sending the prompt.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PipelineContext } from './pipeline.js';

const COST_PER_1K: Record<string, number> = {
  'deepseek:deepseek-chat': 0.00014,
  'openai:gpt-4o-mini': 0.00015,
  'anthropic:claude-3-haiku': 0.00025,
  'openai:gpt-4o': 0.0025,
  'anthropic:claude-sonnet-4': 0.003,
  'anthropic:claude-opus-4': 0.015,
  'groq:llama-3.1-70b': 0.00059,
  'mistral:mistral-large': 0.002,
};

export function registerAnalyzeCostTool(server: McpServer, ctx: PipelineContext): void {
  server.tool(
    'clawpipe_analyze_cost',
    'Estimate the cost of a prompt without sending it. Shows token count, estimated cost per model, and potential savings from Booster and Packer.',
    {
      prompt: z.string().describe('The prompt text to analyze'),
    },
    async ({ prompt }) => {
      const boostResult = ctx.booster.tryResolve(prompt);
      const boostable = boostResult !== null;

      const packResult = ctx.packer.pack(prompt);
      const originalTokens = packResult.originalTokens;
      const packedTokens = packResult.packedTokens;
      const packableSavings = packResult.savings;

      const estimates = Object.entries(COST_PER_1K).map(([model, rate]) => {
        const cost = (packedTokens / 1000) * rate;
        return `  ${model}: $${cost.toFixed(6)}`;
      });

      const lines = [
        `Estimated tokens: ${originalTokens} (${packedTokens} after packing)`,
        `Packing savings: ${packableSavings}`,
        `Boostable (free): ${boostable}`,
        boostable ? `Booster result: ${boostResult}` : null,
        '',
        'Estimated cost per model (after packing):',
        ...estimates,
      ].filter((line): line is string => line !== null);

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
