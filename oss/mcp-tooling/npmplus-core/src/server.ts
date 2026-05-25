import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Import tool modules that export their tool definitions and handlers (FREE TIER ONLY)
import * as searchTools from "./tools/search-tools.js";
import * as installTools from "./tools/install-tools.js";
import * as basicTools from "./tools/basic-tools.js";

export async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: "npmplus-core",
      version: "1.0.0-core"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Aggregate all tools (FREE TIER - 8 tools total)
  const allTools = [
    ...searchTools.tools,      // search_packages (1 tool)
    ...installTools.tools,     // install_packages, update_packages, remove_packages, check_outdated (4 tools)
    ...basicTools.tools        // package_info, check_license, clean_cache (3 tools)
  ];

  // Create a map of tool handlers
  const toolHandlers = new Map<string, (args: any) => Promise<any>>([
    ...searchTools.handlers,
    ...installTools.handlers,
    ...basicTools.handlers
  ]);

  // Register unified tools/list handler
  server.setRequestHandler(
    ListToolsRequestSchema,
    async (request) => {
      const parsed = ListToolsRequestSchema.safeParse(request);
      if (!parsed.success) {
        throw new Error(`Invalid request: ${parsed.error}`);
      }
      
      return {
        tools: allTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    }
  );

  // Register unified tools/call handler
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      const parsed = CallToolRequestSchema.safeParse(request);
      if (!parsed.success) {
        throw new Error(`Invalid request: ${parsed.error}`);
      }

      const { name, arguments: args } = parsed.data.params;
      
      const handler = toolHandlers.get(name);
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        return await handler(args);
      } catch (error: any) {
        if (error.name === "ZodError") {
          throw new Error(`Invalid arguments: ${error.message}`);
        }
        throw error;
      }
    }
  );

  return server;
}