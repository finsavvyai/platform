import type { Recipe } from '../types';

/** MSP Morning Check recipe: quick daily health overview. */
export const mspMorningRecipe: Recipe = {
	name: 'MSP Morning Check',
	description:
		'Daily health overview — list tenants, check health scores, surface critical alerts, and summarize.',
	steps: [
		{
			tool: 'tenantiq.list_tenants',
			input: {},
			onFailure: 'abort',
		},
		{
			tool: 'tenantiq.get_health_score',
			input: {},
			onFailure: 'skip',
		},
		{
			tool: 'tenantiq.list_alerts',
			input: { severity: 'critical' },
			onFailure: 'skip',
		},
		{
			tool: 'tenantiq.executive_report',
			input: { format: 'summary' },
			onFailure: 'skip',
		},
	],
};
