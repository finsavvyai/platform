/**
 * Five starter workflow templates for the TemplateLibrary.
 */

import type { WorkflowTemplate } from '../types';
import { insightsToCodeTemplate } from './templates/insights-to-code';

export const templates: WorkflowTemplate[] = [
  insightsToCodeTemplate,
  {
    id: 'customer-support',
    name: 'Customer Support Bot',
    description: 'AI chatbot that answers FAQs and escalates when unsure.',
    category: 'Support',
    difficulty: 'beginner',
    tags: ['chat', 'support', 'automation'],
    preview: 'Webhook  >  Chat Agent  >  If/Else  >  Output',
    nodes: [
      {
        id: 'n1', type: 'workflow-node',
        position: { x: 80, y: 200 },
        data: {
          typeId: 'webhook-trigger', label: 'Incoming Request',
          category: 'trigger', icon: 'bolt.fill', color: '#FF9500',
          config: { path: '/support', method: 'POST' },
          inputs: [], outputs: [{ name: 'payload', type: 'any', description: 'Webhook payload' }],
        },
      },
      {
        id: 'n2', type: 'workflow-node',
        position: { x: 360, y: 200 },
        data: {
          typeId: 'chat-agent', label: 'Support Agent',
          category: 'agent', icon: 'bubble.left.fill', color: '#007AFF',
          config: { model: 'gpt-4o', temperature: 0.5, maxTokens: 800, systemPrompt: 'You are a customer support agent.' },
          inputs: [
            { name: 'message', type: 'string', required: true, description: 'Input message' },
          ],
          outputs: [
            { name: 'response', type: 'string', description: 'AI response' },
            { name: 'confidence', type: 'number', description: 'Confidence score' },
          ],
        },
      },
      {
        id: 'n3', type: 'workflow-node',
        position: { x: 640, y: 200 },
        data: {
          typeId: 'if-else', label: 'Confident?',
          category: 'condition', icon: 'arrow.triangle.branch', color: '#AF52DE',
          config: { expression: 'return input.confidence > 0.8;' },
          inputs: [{ name: 'input', type: 'any', required: true, description: 'Value to test' }],
          outputs: [
            { name: 'true', type: 'any', description: 'High confidence' },
            { name: 'false', type: 'any', description: 'Low confidence' },
          ],
        },
      },
      {
        id: 'n4', type: 'workflow-node',
        position: { x: 920, y: 200 },
        data: {
          typeId: 'json-output', label: 'Send Reply',
          category: 'output', icon: 'doc.text.fill', color: '#34C759',
          config: { pretty: true },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to output' }],
          outputs: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out-payload', targetHandle: 'in-message' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out-response', targetHandle: 'in-input' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'out-true', targetHandle: 'in-data' },
    ],
  },

  {
    id: 'data-pipeline',
    name: 'ETL Data Pipeline',
    description: 'Fetch data from an API, process it, and output JSON.',
    category: 'Data',
    difficulty: 'intermediate',
    tags: ['etl', 'data', 'api'],
    preview: 'Schedule  >  API Client  >  Data Processor  >  Output',
    nodes: [
      {
        id: 'n1', type: 'workflow-node', position: { x: 80, y: 200 },
        data: {
          typeId: 'schedule-trigger', label: 'Hourly Trigger',
          category: 'trigger', icon: 'clock.fill', color: '#FFCC00',
          config: { cron: '0 * * * *', timezone: 'UTC' },
          inputs: [], outputs: [{ name: 'timestamp', type: 'string', description: 'Trigger time' }],
        },
      },
      {
        id: 'n2', type: 'workflow-node', position: { x: 360, y: 200 },
        data: {
          typeId: 'api-client', label: 'Fetch Data',
          category: 'agent', icon: 'network', color: '#64D2FF',
          config: { method: 'GET', headers: '{"Content-Type":"application/json"}' },
          inputs: [
            { name: 'url', type: 'string', required: true, description: 'Endpoint URL' },
          ],
          outputs: [
            { name: 'response', type: 'any', description: 'Response data' },
            { name: 'status', type: 'number', description: 'HTTP status' },
          ],
        },
      },
      {
        id: 'n3', type: 'workflow-node', position: { x: 640, y: 200 },
        data: {
          typeId: 'data-processor', label: 'Transform',
          category: 'agent', icon: 'cpu.fill', color: '#5AC8FA',
          config: { operation: 'map', expression: 'return data.results;' },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Input data' }],
          outputs: [
            { name: 'processed', type: 'any', description: 'Processed data' },
            { name: 'metadata', type: 'object', description: 'Metadata' },
          ],
        },
      },
      {
        id: 'n4', type: 'workflow-node', position: { x: 920, y: 200 },
        data: {
          typeId: 'json-output', label: 'Output JSON',
          category: 'output', icon: 'doc.text.fill', color: '#34C759',
          config: { pretty: true },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to output' }],
          outputs: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out-timestamp', targetHandle: 'in-url' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out-response', targetHandle: 'in-data' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'out-processed', targetHandle: 'in-data' },
    ],
  },

  {
    id: 'content-moderation',
    name: 'Content Moderation',
    description: 'Analyze content with AI and route safe vs. flagged items.',
    category: 'AI',
    difficulty: 'intermediate',
    tags: ['moderation', 'ai', 'safety'],
    preview: 'Webhook  >  Chat Agent  >  Switch  >  Outputs',
    nodes: [
      {
        id: 'n1', type: 'workflow-node', position: { x: 80, y: 200 },
        data: {
          typeId: 'webhook-trigger', label: 'Content In',
          category: 'trigger', icon: 'bolt.fill', color: '#FF9500',
          config: { path: '/moderate', method: 'POST' },
          inputs: [], outputs: [{ name: 'payload', type: 'any', description: 'Webhook payload' }],
        },
      },
      {
        id: 'n2', type: 'workflow-node', position: { x: 360, y: 200 },
        data: {
          typeId: 'chat-agent', label: 'Moderator AI',
          category: 'agent', icon: 'bubble.left.fill', color: '#007AFF',
          config: { model: 'gpt-4o', temperature: 0, maxTokens: 200, systemPrompt: 'Classify content as safe, warning, or blocked. Return JSON.' },
          inputs: [{ name: 'message', type: 'string', required: true, description: 'Content' }],
          outputs: [{ name: 'response', type: 'string', description: 'Classification' }],
        },
      },
      {
        id: 'n3', type: 'workflow-node', position: { x: 640, y: 200 },
        data: {
          typeId: 'switch', label: 'Route',
          category: 'condition', icon: 'arrow.triangle.swap', color: '#BF5AF2',
          config: { case1: 'safe', case2: 'warning' },
          inputs: [{ name: 'input', type: 'any', required: true, description: 'Classification' }],
          outputs: [
            { name: 'case1', type: 'any', description: 'Safe' },
            { name: 'case2', type: 'any', description: 'Warning' },
            { name: 'default', type: 'any', description: 'Blocked' },
          ],
        },
      },
      {
        id: 'n4', type: 'workflow-node', position: { x: 920, y: 120 },
        data: {
          typeId: 'json-output', label: 'Approve',
          category: 'output', icon: 'doc.text.fill', color: '#34C759',
          config: { pretty: true },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Approved content' }],
          outputs: [],
        },
      },
      {
        id: 'n5', type: 'workflow-node', position: { x: 920, y: 280 },
        data: {
          typeId: 'webhook-output', label: 'Flag for Review',
          category: 'output', icon: 'paperplane.fill', color: '#30D158',
          config: { url: '', method: 'POST' },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Flagged content' }],
          outputs: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out-payload', targetHandle: 'in-message' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out-response', targetHandle: 'in-input' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'out-case1', targetHandle: 'in-data' },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'out-case2', targetHandle: 'in-data' },
    ],
  },

  {
    id: 'scheduled-report',
    name: 'Scheduled Report',
    description: 'Generate a daily AI summary report from API data.',
    category: 'Reporting',
    difficulty: 'beginner',
    tags: ['report', 'schedule', 'summary'],
    preview: 'Schedule  >  API  >  Chat Agent  >  Webhook Out',
    nodes: [
      {
        id: 'n1', type: 'workflow-node', position: { x: 80, y: 200 },
        data: {
          typeId: 'schedule-trigger', label: 'Daily 8 AM',
          category: 'trigger', icon: 'clock.fill', color: '#FFCC00',
          config: { cron: '0 8 * * *', timezone: 'UTC' },
          inputs: [], outputs: [{ name: 'timestamp', type: 'string', description: 'Trigger time' }],
        },
      },
      {
        id: 'n2', type: 'workflow-node', position: { x: 360, y: 200 },
        data: {
          typeId: 'api-client', label: 'Pull Metrics',
          category: 'agent', icon: 'network', color: '#64D2FF',
          config: { method: 'GET', headers: '{}' },
          inputs: [{ name: 'url', type: 'string', required: true, description: 'Metrics URL' }],
          outputs: [{ name: 'response', type: 'any', description: 'Metrics data' }],
        },
      },
      {
        id: 'n3', type: 'workflow-node', position: { x: 640, y: 200 },
        data: {
          typeId: 'chat-agent', label: 'Summarize',
          category: 'agent', icon: 'bubble.left.fill', color: '#007AFF',
          config: { model: 'gpt-4o', temperature: 0.3, maxTokens: 1500, systemPrompt: 'Summarize the following metrics into a concise report.' },
          inputs: [{ name: 'message', type: 'string', required: true, description: 'Metrics' }],
          outputs: [{ name: 'response', type: 'string', description: 'Report' }],
        },
      },
      {
        id: 'n4', type: 'workflow-node', position: { x: 920, y: 200 },
        data: {
          typeId: 'webhook-output', label: 'Post to Slack',
          category: 'output', icon: 'paperplane.fill', color: '#30D158',
          config: { url: 'https://hooks.slack.com/...', method: 'POST' },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Report text' }],
          outputs: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out-timestamp', targetHandle: 'in-url' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out-response', targetHandle: 'in-message' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'out-response', targetHandle: 'in-data' },
    ],
  },

  {
    id: 'multi-agent-chain',
    name: 'Multi-Agent Chain',
    description: 'Chain multiple AI agents for a complex analysis pipeline.',
    category: 'AI',
    difficulty: 'advanced',
    tags: ['chain', 'multi-agent', 'analysis'],
    preview: 'Webhook  >  Agent 1  >  Agent 2  >  Condition  >  Output',
    nodes: [
      {
        id: 'n1', type: 'workflow-node', position: { x: 80, y: 200 },
        data: {
          typeId: 'webhook-trigger', label: 'Input',
          category: 'trigger', icon: 'bolt.fill', color: '#FF9500',
          config: { path: '/analyze', method: 'POST' },
          inputs: [], outputs: [{ name: 'payload', type: 'any', description: 'Payload' }],
        },
      },
      {
        id: 'n2', type: 'workflow-node', position: { x: 320, y: 200 },
        data: {
          typeId: 'chat-agent', label: 'Researcher',
          category: 'agent', icon: 'bubble.left.fill', color: '#007AFF',
          config: { model: 'gpt-4o', temperature: 0.2, maxTokens: 2000, systemPrompt: 'Research and extract key facts.' },
          inputs: [{ name: 'message', type: 'string', required: true, description: 'Query' }],
          outputs: [{ name: 'response', type: 'string', description: 'Research' }],
        },
      },
      {
        id: 'n3', type: 'workflow-node', position: { x: 560, y: 200 },
        data: {
          typeId: 'chat-agent', label: 'Analyst',
          category: 'agent', icon: 'bubble.left.fill', color: '#5AC8FA',
          config: { model: 'claude-3.5-sonnet', temperature: 0.4, maxTokens: 2000, systemPrompt: 'Analyze the research and provide insights.' },
          inputs: [{ name: 'message', type: 'string', required: true, description: 'Research' }],
          outputs: [
            { name: 'response', type: 'string', description: 'Analysis' },
            { name: 'confidence', type: 'number', description: 'Score' },
          ],
        },
      },
      {
        id: 'n4', type: 'workflow-node', position: { x: 800, y: 200 },
        data: {
          typeId: 'if-else', label: 'Quality Gate',
          category: 'condition', icon: 'arrow.triangle.branch', color: '#AF52DE',
          config: { expression: 'return input.confidence > 0.7;' },
          inputs: [{ name: 'input', type: 'any', required: true, description: 'Analysis' }],
          outputs: [
            { name: 'true', type: 'any', description: 'Pass' },
            { name: 'false', type: 'any', description: 'Fail' },
          ],
        },
      },
      {
        id: 'n5', type: 'workflow-node', position: { x: 1040, y: 200 },
        data: {
          typeId: 'json-output', label: 'Final Output',
          category: 'output', icon: 'doc.text.fill', color: '#34C759',
          config: { pretty: true },
          inputs: [{ name: 'data', type: 'any', required: true, description: 'Result' }],
          outputs: [],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out-payload', targetHandle: 'in-message' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out-response', targetHandle: 'in-message' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'out-response', targetHandle: 'in-input' },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'out-true', targetHandle: 'in-data' },
    ],
  },
];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return templates.filter((t) => t.category === category);
}
