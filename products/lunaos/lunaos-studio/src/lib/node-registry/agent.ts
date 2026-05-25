import type { NodeTypeDefinition } from '../../types';

export const agentNodes: NodeTypeDefinition[] = [
  {
    id: 'chat-agent',
    name: 'Chat Agent',
    category: 'agent',
    description: 'AI conversation agent for NLP tasks',
    icon: 'bubble.left.fill',
    color: '#007AFF',
    inputs: [
      { name: 'message', type: 'string', required: true, description: 'Input message' },
      { name: 'context', type: 'object', required: false, description: 'Additional context' },
    ],
    outputs: [
      { name: 'response', type: 'string', description: 'AI response' },
      { name: 'confidence', type: 'number', description: 'Confidence score' },
    ],
    configSchema: {
      model: {
        type: 'select',
        options: [
          'claude-sonnet-4-6',
          'claude-opus-4-6',
          'gpt-4o',
          'gpt-4.1',
          'gemini-2.5-pro',
          'llama-4-maverick',
          'deepseek-r1',
        ],
        default: 'claude-sonnet-4-6',
        label: 'Model',
      },
      temperature: { type: 'number', min: 0, max: 2, default: 0.7, label: 'Temperature' },
      maxTokens: { type: 'number', min: 1, max: 4000, default: 1000, label: 'Max Tokens' },
      systemPrompt: {
        type: 'textarea',
        default: 'You are a helpful assistant.',
        label: 'System Prompt',
      },
    },
  },
  {
    id: 'data-processor',
    name: 'Data Processor',
    category: 'agent',
    description: 'Transform and process structured data',
    icon: 'cpu.fill',
    color: '#5AC8FA',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Input data' }],
    outputs: [
      { name: 'processed', type: 'any', description: 'Processed data' },
      { name: 'metadata', type: 'object', description: 'Processing metadata' },
    ],
    configSchema: {
      operation: {
        type: 'select',
        options: ['filter', 'map', 'reduce', 'sort', 'group'],
        default: 'map',
        label: 'Operation',
      },
      expression: { type: 'textarea', default: 'return data;', label: 'Expression' },
    },
  },
  {
    id: 'api-client',
    name: 'API Client',
    category: 'agent',
    description: 'Make HTTP requests to external APIs',
    icon: 'network',
    color: '#64D2FF',
    inputs: [
      { name: 'url', type: 'string', required: true, description: 'Endpoint URL' },
      { name: 'body', type: 'any', required: false, description: 'Request body' },
    ],
    outputs: [
      { name: 'response', type: 'any', description: 'Response data' },
      { name: 'status', type: 'number', description: 'HTTP status code' },
    ],
    configSchema: {
      method: {
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'DELETE'],
        default: 'GET',
        label: 'Method',
      },
      headers: {
        type: 'textarea',
        default: '{"Content-Type":"application/json"}',
        label: 'Headers (JSON)',
      },
    },
  },
];
