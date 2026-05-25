/**
 * MCP Tool: clawpipe_booster_check — check if Booster can resolve without AI.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PipelineContext } from './pipeline.js';

export function registerBoosterCheckTool(server: McpServer, ctx: PipelineContext): void {
  server.tool(
    'clawpipe_booster_check',
    'Check if a prompt can be resolved by the Agent Booster without calling an LLM. Returns the result if resolvable, or indicates that an LLM call is needed.',
    {
      prompt: z.string().describe('The prompt to check against booster rules'),
    },
    async ({ prompt }) => {
      const result = ctx.booster.tryResolve(prompt);
      const resolvable = result !== null;

      const lines = [
        `Resolvable without AI: ${resolvable}`,
        resolvable ? `Result: ${result}` : 'This prompt requires an LLM call.',
        `Active booster rules: ${ctx.booster.ruleCount}`,
      ];

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
