import type { NodeTypeDefinition } from '../../types';

export const partnerNodes: NodeTypeDefinition[] = [
  {
    id: 'cepien-insight',
    name: 'Cepien: Top Recommendations',
    category: 'agent',
    description: 'Pull high-impact product recommendations from Cepien AI',
    icon: 'sparkles',
    color: '#FF375F',
    inputs: [
      { name: 'trigger', type: 'any', required: false, description: 'Optional trigger payload' },
    ],
    outputs: [
      { name: 'recommendations', type: 'object', description: 'Filtered recommendations (array)' },
      { name: 'summary', type: 'object', description: 'Fetched/filtered/skipped totals' },
    ],
    configSchema: {
      projectId: {
        type: 'string',
        default: '',
        label: 'Cepien Project ID',
        placeholder: 'cepien_prj_...',
      },
      minImpactScore: { type: 'number', min: 0, max: 100, default: 70, label: 'Min Impact Score' },
      impactDimension: {
        type: 'select',
        options: ['business', 'product', 'usability', 'combined'],
        default: 'combined',
        label: 'Impact Dimension',
      },
      limit: { type: 'number', min: 1, max: 50, default: 5, label: 'Max Results' },
      apiKeyEnv: { type: 'string', default: 'CEPIEN_API_KEY', label: 'API Key Env Var' },
    },
  },
];
