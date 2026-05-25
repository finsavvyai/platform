import type { NodeTypeDefinition } from '../../types';

export const outputNodes: NodeTypeDefinition[] = [
  {
    id: 'json-output',
    name: 'JSON Output',
    category: 'output',
    description: 'Return result as JSON response',
    icon: 'doc.text.fill',
    color: '#34C759',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to output' }],
    outputs: [],
    configSchema: {
      pretty: { type: 'boolean', default: true, label: 'Pretty Print' },
    },
  },
  {
    id: 'webhook-output',
    name: 'Webhook Output',
    category: 'output',
    description: 'Send result to an external webhook',
    icon: 'paperplane.fill',
    color: '#30D158',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Payload' }],
    outputs: [],
    configSchema: {
      url: { type: 'string', default: '', label: 'Destination URL', placeholder: 'https://...' },
      method: {
        type: 'select',
        options: ['POST', 'PUT'],
        default: 'POST',
        label: 'Method',
      },
    },
  },
];
