/**
 * Luna Vision RAG™ MCP Server (Cloudflare Workers)
 * 
 * HTTP-based MCP server that proxies requests to rag.lunaos.ai
 * Provides MCP protocol over HTTP for Claude Desktop
 */

const API_BASE = 'https://rag.lunaos.ai';

// MCP Server metadata
const SERVER_INFO = {
  name: 'luna-vision-rag-mcp',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
  capabilities: {
    tools: {},
    prompts: {},
    resources: {},
  },
};

// Tool definitions
const TOOLS = [
  {
    name: 'rag_setup',
    description: 'Configure RAG system for a project',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Project directory path' },
        collectionName: { type: 'string', description: 'Collection name' },
        vectorDB: { type: 'string', enum: ['pinecone', 'weaviate', 'qdrant'] },
      },
      required: ['projectPath', 'collectionName'],
    },
  },
  {
    name: 'rag_query',
    description: 'Query codebase using natural language',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query' },
        collectionName: { type: 'string', description: 'Collection to query' },
        topK: { type: 'number', description: 'Number of results', default: 5 },
      },
      required: ['query', 'collectionName'],
    },
  },
  {
    name: 'rag_index',
    description: 'Index files into vector database',
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string' } },
        collectionName: { type: 'string' },
      },
      required: ['files', 'collectionName'],
    },
  },
  {
    name: 'glm_capture',
    description: 'Capture screenshot of web page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        selector: { type: 'string' },
        fullPage: { type: 'boolean', default: false },
      },
      required: ['url'],
    },
  },
  {
    name: 'glm_analyze',
    description: 'Analyze UI screenshot using GLM Vision',
    inputSchema: {
      type: 'object',
      properties: {
        screenshotUrl: { type: 'string' },
        analysisType: {
          type: 'string',
          enum: ['ui-elements', 'layout', 'accessibility', 'visual-bugs', 'comprehensive'],
        },
      },
      required: ['screenshotUrl', 'analysisType'],
    },
  },
  {
    name: 'glm_test',
    description: 'Run automated GUI tests',
    inputSchema: {
      type: 'object',
      properties: {
        testSuite: { type: 'string' },
        url: { type: 'string' },
      },
      required: ['testSuite', 'url'],
    },
  },
  {
    name: 'integration_validate',
    description: 'Validate UI against code specifications',
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string' },
        expectedBehavior: { type: 'string' },
        context: { type: 'string' },
      },
      required: ['component', 'expectedBehavior'],
    },
  },
  {
    name: 'integration_generate',
    description: 'Generate automated tests',
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string' },
        testType: { type: 'string', enum: ['unit', 'integration', 'e2e', 'visual'] },
        coverage: { type: 'string', enum: ['basic', 'comprehensive', 'exhaustive'], default: 'comprehensive' },
      },
      required: ['component', 'testType'],
    },
  },
  {
    name: 'integration_report',
    description: 'Generate comprehensive test report',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string' },
        includeMetrics: { type: 'boolean', default: true },
      },
      required: ['projectName'],
    },
  },
  {
    name: 'health_check',
    description: 'Check API health',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'api_info',
    description: 'Get API endpoint information',
    inputSchema: { type: 'object', properties: {} },
  },
];

/**
 * CORS headers
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handle CORS preflight
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Make API request
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return {
      success: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handle MCP requests
 */
async function handleMCPRequest(request) {
  try {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body;

    // Validate JSON-RPC
    if (jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request' },
      };
    }

    let result;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: SERVER_INFO.protocolVersion,
          capabilities: SERVER_INFO.capabilities,
          serverInfo: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version,
          },
        };
        break;

      case 'tools/list':
        result = { tools: TOOLS };
        break;

      case 'tools/call':
        const { name, arguments: args } = params;
        
        // Map tool calls to API endpoints
        const endpointMap = {
          rag_setup: '/api/rag/setup',
          rag_query: '/api/rag/query',
          rag_index: '/api/rag/index',
          glm_capture: '/api/glm/capture',
          glm_analyze: '/api/glm/analyze',
          glm_test: '/api/glm/test',
          integration_validate: '/api/integration/validate',
          integration_generate: '/api/integration/generate',
          integration_report: '/api/integration/report',
          health_check: '/health',
          api_info: '/api',
        };

        const endpoint = endpointMap[name];
        if (!endpoint) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown tool: ${name}` },
          };
        }

        const apiResult = await apiRequest(
          endpoint,
          endpoint === '/health' || endpoint === '/api' ? 'GET' : 'POST',
          endpoint === '/health' || endpoint === '/api' ? null : args
        );

        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify(apiResult, null, 2),
            },
          ],
        };
        break;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error', data: error.message },
    };
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'Luna Vision RAG MCP',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && request.method === 'POST') {
      const mcpResponse = await handleMCPRequest(request);
      return new Response(JSON.stringify(mcpResponse), {
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    // Root - API info
    if (url.pathname === '/') {
      return new Response(
        JSON.stringify({
          name: 'Luna Vision RAG MCP Server',
          version: '1.0.0',
          protocol: 'MCP over HTTP',
          endpoint: '/mcp',
          tools: TOOLS.length,
          api: API_BASE,
          documentation: 'https://github.com/shacharsol/luna-agent',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
};
