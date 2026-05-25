import type { WorkflowTemplate } from '../../types';

export const insightsToCodeTemplate: WorkflowTemplate = {
  id: 'insights-to-code',
  name: 'Insights → PRD → Code',
  description:
        'Ingest feedback → cluster patterns → impact-score → auto-draft PRD → generate code PR. LunaOS showcase pipeline.',
  category: 'Discovery',
  difficulty: 'advanced',
  tags: ['insights', 'impact-scoring', 'rag', 'agent-chain', 'showcase'],
  preview: 'Schedule › LL Insights › Impact Filter › Chat Agent (PRD) › API Client (GitHub)',
  nodes: [
    {
      id: 'n1',
      type: 'workflow-node',
      position: { x: 60, y: 200 },
      data: {
        typeId: 'schedule-trigger',
        label: 'Weekly Trigger',
        category: 'trigger',
        icon: 'clock.fill',
        color: '#FFCC00',
        config: { cron: '0 9 * * 1', timezone: 'UTC' },
        inputs: [],
        outputs: [{ name: 'timestamp', type: 'string', description: 'Trigger time' }],
      },
    },
    {
      id: 'n2',
      type: 'workflow-node',
      position: { x: 320, y: 200 },
      data: {
        typeId: 'cepien-insight',
        label: 'LL Insights: Top Backlog',
        category: 'agent',
        icon: 'sparkles',
        color: '#FF375F',
        config: {
          projectId: 'default',
          minImpactScore: 75,
          impactDimension: 'combined',
          limit: 3,
          apiKeyEnv: 'LUNAOS_API_KEY',
        },
        inputs: [
          { name: 'trigger', type: 'any', required: false, description: 'Trigger payload' },
        ],
        outputs: [
          { name: 'recommendations', type: 'object', description: 'Filtered backlog' },
          { name: 'summary', type: 'object', description: 'Totals' },
        ],
      },
    },
    {
      id: 'n3',
      type: 'workflow-node',
      position: { x: 600, y: 200 },
      data: {
        typeId: 'if-else',
        label: 'Has Top Item?',
        category: 'condition',
        icon: 'arrow.triangle.branch',
        color: '#AF52DE',
        config: { expression: 'return input.recommendations && input.recommendations.length > 0;' },
        inputs: [{ name: 'input', type: 'any', required: true, description: 'Backlog response' }],
        outputs: [
          { name: 'true', type: 'any', description: 'Has items' },
          { name: 'false', type: 'any', description: 'Empty' },
        ],
      },
    },
    {
      id: 'n4',
      type: 'workflow-node',
      position: { x: 880, y: 120 },
      data: {
        typeId: 'chat-agent',
        label: 'Draft PRD',
        category: 'agent',
        icon: 'bubble.left.fill',
        color: '#007AFF',
        config: {
          model: 'claude-sonnet-4-6',
          temperature: 0.3,
          maxTokens: 2500,
          systemPrompt:
                        'You are a senior PM. Turn the top recommendation into a concise PRD with goals, non-goals, user stories, success metrics. Output markdown.',
        },
        inputs: [
          { name: 'message', type: 'string', required: true, description: 'Recommendation' },
          { name: 'context', type: 'object', required: false, description: 'Impact scores' },
        ],
        outputs: [
          { name: 'response', type: 'string', description: 'Generated PRD markdown' },
          { name: 'confidence', type: 'number', description: 'Confidence' },
        ],
      },
    },
    {
      id: 'n5',
      type: 'workflow-node',
      position: { x: 1160, y: 120 },
      data: {
        typeId: 'api-client',
        label: 'Open GitHub Issue',
        category: 'agent',
        icon: 'network',
        color: '#64D2FF',
        config: {
          method: 'POST',
          headers:
                        '{"Content-Type":"application/json","Authorization":"Bearer ${GITHUB_TOKEN}"}',
        },
        inputs: [
          {
            name: 'url',
            type: 'string',
            required: true,
            description: 'https://api.github.com/repos/{owner}/{repo}/issues',
          },
          { name: 'body', type: 'any', required: false, description: 'Issue title + body' },
        ],
        outputs: [
          { name: 'response', type: 'any', description: 'Created issue' },
          { name: 'status', type: 'number', description: 'HTTP status' },
        ],
      },
    },
    {
      id: 'n6',
      type: 'workflow-node',
      position: { x: 880, y: 320 },
      data: {
        typeId: 'json-output',
        label: 'No Action Log',
        category: 'output',
        icon: 'doc.text.fill',
        color: '#34C759',
        config: { pretty: true },
        inputs: [{ name: 'data', type: 'any', required: true, description: 'Empty summary' }],
        outputs: [],
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out-timestamp', targetHandle: 'in-trigger' },
    { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'out-recommendations', targetHandle: 'in-input' },
    { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'out-true', targetHandle: 'in-message' },
    { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'out-response', targetHandle: 'in-body' },
    { id: 'e5', source: 'n3', target: 'n6', sourceHandle: 'out-false', targetHandle: 'in-data' },
  ],
};
