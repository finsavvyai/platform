/**
 * API Documentation Page - Core Endpoint Definitions (Overview, RAG)
 */

import type { EndpointInfo } from './types';

export const overviewEndpoints: EndpointInfo[] = [
  {
    path: '/health',
    method: 'GET',
    description: 'Check the health status of the SDLC.ai API',
    parameters: [],
    responses: [
      {
        code: 200,
        description: 'API is healthy',
        schema: {
          status: 'healthy',
          services: {
            rag: 'healthy',
            documents: 'healthy',
            payments: 'healthy',
          },
        },
      },
    ],
    examples: [
      {
        title: 'Basic Health Check',
        description: 'Get current API health status',
        language: 'curl',
      },
    ],
  },
  {
    path: '/version',
    method: 'GET',
    description: 'Get API version information',
    parameters: [],
    responses: [
      {
        code: 200,
        description: 'API version information',
        schema: {
          version: '1.0.0',
          build: '20240115-1234',
          environment: 'production',
        },
      },
    ],
    examples: [],
  },
];

export const ragEndpoints: EndpointInfo[] = [
  {
    path: '/api/v1/rag/query',
    method: 'POST',
    description: 'Execute a RAG (Retrieval-Augmented Generation) query',
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'The query to execute',
      },
      {
        name: 'max_results',
        type: 'integer',
        required: false,
        default: 10,
        description: 'Maximum number of results to return',
      },
      {
        name: 'include_citations',
        type: 'boolean',
        required: false,
        default: true,
        description: 'Include citation information in response',
      },
    ],
    requestBody: {
      query: 'string',
      max_results: 10,
      include_citations: true,
      filters: {},
    },
    responses: [
      {
        code: 200,
        description: 'Query response with citations',
        schema: {
          query_id: 'string',
          response: 'string',
          confidence: 'number',
          citations: 'array',
          token_usage: 'object',
          response_time_ms: 'number',
        },
      },
    ],
    examples: [
      {
        title: 'Basic RAG Query',
        description: 'Ask a question about your documents',
        request: {
          query:
            'What are the best practices for secure software development?',
          max_results: 5,
          include_citations: true,
        },
        language: 'python',
      },
      {
        title: 'Streaming Query',
        description: 'Execute a streaming RAG query',
        request: {
          query: 'Explain machine learning concepts',
          max_results: 10,
        },
        language: 'javascript',
      },
    ],
  },
  {
    path: '/api/v1/rag/query/stream',
    method: 'POST',
    description: 'Execute a streaming RAG query',
    parameters: [],
    requestBody: {
      query: 'string',
      max_results: 10,
    },
    responses: [
      {
        code: 200,
        description: 'Streaming response',
      },
    ],
    examples: [
      {
        title: 'Streaming Response',
        description: 'Get real-time streaming response',
        language: 'javascript',
      },
    ],
  },
];
