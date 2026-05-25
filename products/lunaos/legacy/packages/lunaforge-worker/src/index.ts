import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TypeScriptAnalyzer } from "lunaforge-core";

// --- Environment Types ---
interface Env {
  ENVIRONMENT: string;
  API_KEY?: string;
  RATE_LIMIT_REQUESTS?: number;
  RATE_LIMIT_WINDOW_MS?: number;
}

// --- Request Logging & Monitoring ---
interface RequestLog {
  timestamp: string;
  method: string;
  tool?: string;
  duration: number;
  success: boolean;
  error?: string;
  contentLength?: number;
}

function logRequest(log: RequestLog): void {
  console.log(JSON.stringify({
    ...log,
    service: "lunaforge-mcp",
    version: "1.0.0",
  }));
}

// --- Rate Limiting (In-Memory for Cloudflare Workers) ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  clientId: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now };
}

// --- API Key Authentication ---
function validateApiKey(request: Request, env: Env): { valid: boolean; error?: string } {
  // If no API key is configured, allow all requests (for backward compatibility)
  if (!env.API_KEY) {
    return { valid: true };
  }

  const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!apiKey) {
    return { valid: false, error: "Missing API key. Provide X-API-Key header or Authorization: Bearer <key>" };
  }

  if (apiKey !== env.API_KEY) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}

// --- Custom Stateless Transport for Cloudflare Workers ---
class WorkerRequestTransport implements Transport {
  private responseProm: Promise<JSONRPCMessage>;
  private resolveResponse!: (msg: JSONRPCMessage) => void;

  constructor(private requestBody: JSONRPCMessage) {
    this.responseProm = new Promise((resolve) => {
      this.resolveResponse = resolve;
    });
  }

  async start(): Promise<void> {
    // No-op for stateless
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.resolveResponse(message);
  }

  async close(): Promise<void> {
    // No-op
  }

  async handleMessage(server: Server) {
    if (this.onmessage) {
      this.onmessage(this.requestBody);
    }
    return this.responseProm;
  }

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
}

// --- MCP Server Setup ---
const server = new Server(
  {
    name: "lunaforge-worker",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// --- Tools Definition ---
const ANALYZE_CONTENT_TOOL: Tool = {
  name: "lunaforge_analyze_content",
  description: "Analyzes code content (TypeScript/JavaScript) and returns dependencies and metrics.",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The code content to analyze",
      },
      filePath: {
        type: "string",
        description: "The virtual file path (e.g. 'src/foo.ts')",
        default: "file.ts",
      },
    },
    required: ["content"],
  },
};

const GET_VERSION_TOOL: Tool = {
  name: "lunaforge_get_version",
  description: "Get the version and status of the LunaForge Worker.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const GET_HEALTH_TOOL: Tool = {
  name: "lunaforge_health_check",
  description: "Check the health status of the LunaForge Worker.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

// --- Request Handlers ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [ANALYZE_CONTENT_TOOL, GET_VERSION_TOOL, GET_HEALTH_TOOL],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "lunaforge_analyze_content": {
        const content = (args as any).content as string;
        const filePath = (args as any).filePath || "file.ts";

        // Content size validation
        if (content.length > 1024 * 1024) { // 1MB limit
          throw new Error("Content too large. Maximum size is 1MB.");
        }

        const analyzer = new TypeScriptAnalyzer();

        const result = await analyzer.analyzeFile({
          path: filePath,
          content: content,
          lastModified: Date.now(),
          size: content.length,
          hash: "temp"
        } as any);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "lunaforge_get_version": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                version: "1.0.0",
                environment: "cloudflare-worker",
                features: ["analyze_content", "health_check"],
                limits: {
                  maxContentSize: "1MB",
                  rateLimit: "100 requests/minute"
                }
              }),
            },
          ],
        };
      }

      case "lunaforge_health_check": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "healthy",
                timestamp: new Date().toISOString(),
                uptime: "always-on",
                region: "global-edge"
              }),
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

// --- Cloudflare Worker Entry Point ---
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const startTime = Date.now();
    const clientId = request.headers.get("CF-Connecting-IP") || "unknown";

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // GET request - public health check
    if (request.method === "GET") {
      return new Response(JSON.stringify({
        service: "LunaForge MCP Worker",
        version: "1.0.0",
        status: "running",
        documentation: "Send POST requests with JSON-RPC 2.0 format",
        tools: ["lunaforge_analyze_content", "lunaforge_get_version", "lunaforge_health_check"]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(
      clientId,
      env.RATE_LIMIT_REQUESTS || 100,
      env.RATE_LIMIT_WINDOW_MS || 60000
    );

    if (!rateLimit.allowed) {
      logRequest({
        timestamp: new Date().toISOString(),
        method: "POST",
        duration: Date.now() - startTime,
        success: false,
        error: "Rate limit exceeded"
      });

      return new Response(JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000)
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          ...corsHeaders
        }
      });
    }

    // API Key authentication
    const authResult = validateApiKey(request, env);
    if (!authResult.valid) {
      logRequest({
        timestamp: new Date().toISOString(),
        method: "POST",
        duration: Date.now() - startTime,
        success: false,
        error: authResult.error
      });

      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      const body = await request.json() as JSONRPCMessage;
      const toolName = (body as any)?.params?.name;

      // Create transport and process
      const transport = new WorkerRequestTransport(body);
      await server.connect(transport);
      const responseMsg = await transport.handleMessage(server);

      // Log successful request
      logRequest({
        timestamp: new Date().toISOString(),
        method: "POST",
        tool: toolName,
        duration: Date.now() - startTime,
        success: true,
        contentLength: (body as any)?.params?.arguments?.content?.length
      });

      return new Response(JSON.stringify(responseMsg), {
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          ...corsHeaders
        },
      });

    } catch (error: any) {
      logRequest({
        timestamp: new Date().toISOString(),
        method: "POST",
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });

      return new Response(JSON.stringify({
        error: error.message,
        code: "INTERNAL_ERROR"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  },
};