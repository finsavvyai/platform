#!/usr/bin/env node
/**
 * ClawPipe MCP Server — expose the AI pipeline as tools for AI agents.
 *
 * Transport: stdio (for Claude Desktop, ChatGPT, etc.)
 * Tools: clawpipe_prompt, clawpipe_analyze_cost, clawpipe_stats, clawpipe_booster_check
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createPipeline } from './pipeline.js';
import { registerPromptTool } from './tool-prompt.js';
import { registerAnalyzeCostTool } from './tool-analyze-cost.js';
import { registerStatsTool } from './tool-stats.js';
import { registerBoosterCheckTool } from './tool-booster-check.js';
import { registerJiraTool } from './tool-jira.js';
import { registerNotionTool } from './tool-notion.js';
import { registerSkillTools } from './tool-skills.js';

const server = new McpServer({
  name: 'clawpipe',
  version: '3.2.0',
});

const apiKey = process.env.CLAWPIPE_API_KEY ?? '';
const projectId = process.env.CLAWPIPE_PROJECT_ID ?? 'mcp-default';
const pipeline = createPipeline(apiKey, projectId);

registerPromptTool(server, pipeline);
registerAnalyzeCostTool(server, pipeline);
registerStatsTool(server, pipeline);
registerBoosterCheckTool(server, pipeline);
registerJiraTool(server);
registerNotionTool(server);
registerSkillTools(server, pipeline);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`ClawPipe MCP server error: ${String(err)}\n`);
  process.exit(1);
});

export { server };
