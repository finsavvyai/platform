#!/usr/bin/env node

/**
 * Luna Vision RAG™ MCP Client
 * Connects Claude Code to the Luna Vision RAG API at rag.lunaos.ai
 * 
 * Provides tools for:
 * - RAG: Context-aware code retrieval
 * - GLM Vision: GUI testing and analysis
 * - Integration: Automated test generation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const API_BASE = 'https://rag.lunaos.ai';

// Create MCP server
const server = new Server(
  {
    name: 'luna-vision-rag',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Helper function to make API requests
 */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
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
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // RAG Tools
      {
        name: 'rag_setup',
        description: 'Configure RAG system for a project. Sets up vector database connection and project context.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Absolute path to the project directory',
            },
            collectionName: {
              type: 'string',
              description: 'Name for the vector database collection',
            },
            vectorDB: {
              type: 'string',
              description: 'Vector database to use (pinecone, weaviate, qdrant)',
              enum: ['pinecone', 'weaviate', 'qdrant'],
            },
          },
          required: ['projectPath', 'collectionName'],
        },
      },
      {
        name: 'rag_query',
        description: 'Query the codebase using natural language. Returns relevant code context with semantic search.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language query about the codebase',
            },
            collectionName: {
              type: 'string',
              description: 'Collection name to query',
            },
            topK: {
              type: 'number',
              description: 'Number of results to return (default: 5)',
              default: 5,
            },
          },
          required: ['query', 'collectionName'],
        },
      },
      {
        name: 'rag_index',
        description: 'Index files into the vector database for semantic search.',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file paths to index',
            },
            collectionName: {
              type: 'string',
              description: 'Collection name to index into',
            },
          },
          required: ['files', 'collectionName'],
        },
      },

      // GLM Vision Tools
      {
        name: 'glm_capture',
        description: 'Capture screenshot of a web page or UI element for analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the page to capture',
            },
            selector: {
              type: 'string',
              description: 'CSS selector for specific element (optional)',
            },
            fullPage: {
              type: 'boolean',
              description: 'Capture full page scroll (default: false)',
              default: false,
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'glm_analyze',
        description: 'Analyze UI screenshot using GLM Vision AI. Identifies elements, layout, and accessibility issues.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotUrl: {
              type: 'string',
              description: 'URL or path to screenshot image',
            },
            analysisType: {
              type: 'string',
              description: 'Type of analysis to perform',
              enum: ['ui-elements', 'layout', 'accessibility', 'visual-bugs', 'comprehensive'],
            },
          },
          required: ['screenshotUrl', 'analysisType'],
        },
      },
      {
        name: 'glm_test',
        description: 'Run automated GUI tests using GLM Vision.',
        inputSchema: {
          type: 'object',
          properties: {
            testSuite: {
              type: 'string',
              description: 'Name of test suite to run',
            },
            url: {
              type: 'string',
              description: 'URL to test',
            },
          },
          required: ['testSuite', 'url'],
        },
      },

      // Integration Tools
      {
        name: 'integration_validate',
        description: 'Validate UI implementation against code specifications using RAG + GLM Vision.',
        inputSchema: {
          type: 'object',
          properties: {
            component: {
              type: 'string',
              description: 'Component name to validate',
            },
            expectedBehavior: {
              type: 'string',
              description: 'Expected behavior description',
            },
            context: {
              type: 'string',
              description: 'Additional context for validation',
            },
          },
          required: ['component', 'expectedBehavior'],
        },
      },
      {
        name: 'integration_generate',
        description: 'Generate automated tests based on codebase understanding and visual analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            component: {
              type: 'string',
              description: 'Component to generate tests for',
            },
            testType: {
              type: 'string',
              description: 'Type of tests to generate',
              enum: ['unit', 'integration', 'e2e', 'visual'],
            },
            coverage: {
              type: 'string',
              description: 'Test coverage level',
              enum: ['basic', 'comprehensive', 'exhaustive'],
              default: 'comprehensive',
            },
          },
          required: ['component', 'testType'],
        },
      },
      {
        name: 'integration_report',
        description: 'Generate comprehensive test report combining RAG insights and visual testing results.',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'Project name for the report',
            },
            includeMetrics: {
              type: 'boolean',
              description: 'Include performance metrics',
              default: true,
            },
          },
          required: ['projectName'],
        },
      },

      // Utility Tools
      {
        name: 'health_check',
        description: 'Check if Luna Vision RAG API is healthy and responsive.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'api_info',
        description: 'Get information about available API endpoints.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // RAG Tools
      case 'rag_setup':
        result = await apiRequest('/api/rag/setup', 'POST', args);
        break;

      case 'rag_query':
        result = await apiRequest('/api/rag/query', 'POST', args);
        break;

      case 'rag_index':
        result = await apiRequest('/api/rag/index', 'POST', args);
        break;

      // GLM Vision Tools
      case 'glm_capture':
        result = await apiRequest('/api/glm/capture', 'POST', args);
        break;

      case 'glm_analyze':
        result = await apiRequest('/api/glm/analyze', 'POST', args);
        break;

      case 'glm_test':
        result = await apiRequest('/api/glm/test', 'POST', args);
        break;

      // Integration Tools
      case 'integration_validate':
        result = await apiRequest('/api/integration/validate', 'POST', args);
        break;

      case 'integration_generate':
        result = await apiRequest('/api/integration/generate', 'POST', args);
        break;

      case 'integration_report':
        result = await apiRequest('/api/integration/report', 'POST', args);
        break;

      // Utility Tools
      case 'health_check':
        result = await apiRequest('/health', 'GET');
        break;

      case 'api_info':
        result = await apiRequest('/api', 'GET');
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Luna Vision RAG MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
