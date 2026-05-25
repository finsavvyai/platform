export const stats = {
  totalRequests: 284_391,
  avgLatency: '142ms',
  activeModels: 4,
  errorRate: '0.08%',
}

export const models = [
  {
    id: '1',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    status: 'Active',
    requestsPerDay: 12_480,
    avgLatency: '180ms',
    costPer1K: '$0.03',
  },
  {
    id: '2',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    status: 'Active',
    requestsPerDay: 8_920,
    avgLatency: '155ms',
    costPer1K: '$0.015',
  },
  {
    id: '3',
    name: 'Llama 3 70B',
    provider: 'Self-hosted',
    status: 'Active',
    requestsPerDay: 5_340,
    avgLatency: '95ms',
    costPer1K: '$0.002',
  },
  {
    id: '4',
    name: 'Mistral Large',
    provider: 'Mistral AI',
    status: 'Degraded',
    requestsPerDay: 2_110,
    avgLatency: '210ms',
    costPer1K: '$0.008',
  },
]

export const routingRules = [
  { id: '1', rule: 'Route compliance queries to GPT-4 Turbo', priority: 'High', active: true },
  { id: '2', rule: 'Route code generation to Claude 3.5 Sonnet', priority: 'High', active: true },
  { id: '3', rule: 'Route summarization to Llama 3 70B', priority: 'Medium', active: true },
  { id: '4', rule: 'Fallback all requests to GPT-4 Turbo on failure', priority: 'Critical', active: true },
  { id: '5', rule: 'Route translation tasks to Mistral Large', priority: 'Low', active: false },
]
