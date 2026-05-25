import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { LunaForgeCore, WorkspaceInfo } from "lunaforge-core";
import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";

// Initialize LunaForge Core
const workspacePath = process.cwd();
const workspaceInfo: WorkspaceInfo = {
    rootPath: workspacePath,
    name: path.basename(workspacePath),
    folders: [workspacePath],
};

const core = new LunaForgeCore({
    workspace: workspaceInfo,
    fsListProvider: async () => {
        // Basic glob pattern to include code files
        const files = await glob("**/*.{ts,js,jsx,tsx,json,md,css,html}", {
            cwd: workspacePath,
            ignore: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/.git/**"],
            nodir: true,
        });
        return files.map((f: string) => path.resolve(workspacePath, f));
    },
    // Disable logging to console to avoid interfering with MCP stdio transport
    logging: {
        enableConsole: false,
        level: "error",
    },
});

// Create MCP Server
const server = new Server(
    {
        name: "lunaforge-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define Tools
const BUILD_GRAPH_TOOL: Tool = {
    name: "lunaforge_build_graph",
    description: "Builds or refreshes the project graph for the current workspace.",
    inputSchema: {
        type: "object",
        properties: {
            forceRefresh: {
                type: "boolean",
                description: "Force a full refresh of the graph",
            },
        },
    },
};

const GET_STATS_TOOL: Tool = {
    name: "lunaforge_get_stats",
    description: "Get statistics about the project graph.",
    inputSchema: {
        type: "object",
        properties: {},
    },
};

// Request Handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [BUILD_GRAPH_TOOL, GET_STATS_TOOL],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "lunaforge_build_graph": {
                const forceRefresh = (args as any)?.forceRefresh || false;

                if (forceRefresh) {
                    await core.refreshGraph();
                } else {
                    await core.ensureGraph();
                }

                const graph = core.getGraph();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    success: true,
                                    fileCount: graph?.metadata.fileCount,
                                    dependencyCount: graph?.metadata.dependencyCount,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }

            case "lunaforge_get_stats": {
                const graph = await core.ensureGraph();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(graph.metadata, null, 2),
                        },
                    ],
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

// Start Server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // console.error("LunaForge MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main loop:", error);
    process.exit(1);
});
