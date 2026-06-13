import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SCREEN_TOOL, handleScreen, type ScreenToolDeps } from "./screen-tool.js";
import type { ScreenToolTextResult } from "./types.js";

// Adapt the SDK-agnostic tool result to the SDK's CallToolResult shape.
// (isError is conditionally included: exactOptionalPropertyTypes forbids
// assigning `undefined` to an optional property.)
function toCallToolResult(r: ScreenToolTextResult): CallToolResult {
  return r.isError ? { content: r.content, isError: true } : { content: r.content };
}

/**
 * Build an MCP server exposing the metered `aml_screen` tool. Transport
 * connection is the caller's responsibility (see bin.ts for stdio).
 */
export function createScreenSkillServer(deps: ScreenToolDeps): Server {
  const server = new Server(
    { name: "amliq-screen-skill", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [SCREEN_TOOL],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== SCREEN_TOOL.name) {
      return toCallToolResult({
        content: [
          { type: "text", text: `Unknown tool: ${request.params.name}` },
        ],
        isError: true,
      });
    }
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    return toCallToolResult(await handleScreen(deps, args));
  });

  return server;
}
