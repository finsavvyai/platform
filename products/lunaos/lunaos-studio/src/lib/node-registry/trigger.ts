import type { NodeTypeDefinition } from '../../types';

export const triggerNodes: NodeTypeDefinition[] = [
  {
    id: 'webhook-trigger',
    name: 'Webhook Trigger',
    category: 'trigger',
    description: 'Start workflow via HTTP webhook',
    icon: 'bolt.fill',
    color: '#FF9500',
    inputs: [],
    outputs: [{ name: 'payload', type: 'any', description: 'Webhook payload' }],
    configSchema: {
      path: { type: 'string', default: '/webhook', label: 'Webhook Path' },
      method: {
        type: 'select',
        options: ['POST', 'GET'],
        default: 'POST',
        label: 'HTTP Method',
      },
    },
  },
  {
    id: 'schedule-trigger',
    name: 'Schedule Trigger',
    category: 'trigger',
    description: 'Start workflow on a cron schedule',
    icon: 'clock.fill',
    color: '#FFCC00',
    inputs: [],
    outputs: [{ name: 'timestamp', type: 'string', description: 'Trigger time' }],
    configSchema: {
      cron: { type: 'string', default: '0 * * * *', label: 'Cron Expression' },
      timezone: { type: 'string', default: 'UTC', label: 'Timezone' },
    },
  },
];
