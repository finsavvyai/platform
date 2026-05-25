import type { Recipe } from '../types';

/** Incident Response recipe: investigate alert and escalate. */
export const incidentResponseRecipe: Recipe = {
	name: 'Incident Response',
	description:
		'Investigate a security alert — get details, run CIS scan, create PSA ticket, notify team.',
	steps: [
		{
			tool: 'tenantiq.list_alerts',
			input: { severity: 'critical' },
			onFailure: 'abort',
		},
		{
			tool: 'tenantiq.run_cis_scan',
			input: {},
			onFailure: 'skip',
		},
		{
			tool: 'tenantiq.sync_psa',
			input: { provider: 'connectwise' },
			onFailure: 'skip',
		},
		{
			tool: 'tenantiq.executive_report',
			input: { format: 'incident' },
			onFailure: 'skip',
		},
	],
};
