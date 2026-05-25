/**
 * JSON schemas for Anthropic structured outputs.
 * Extracted from ai-anthropic.ts to keep that file under the 200-line cap.
 */

export const SECURITY_SCHEMA = {
	type: 'object',
	properties: {
		riskScore: { type: 'integer', description: '0-100' },
		criticalFindings: { type: 'array', items: { type: 'string' } },
		recommendations: { type: 'array', items: { type: 'string' } },
		complianceGaps: { type: 'array', items: { type: 'string' } },
		estimatedRemediationHours: { type: 'integer' },
	},
	required: ['riskScore', 'criticalFindings', 'recommendations', 'complianceGaps', 'estimatedRemediationHours'],
	additionalProperties: false,
} as const;

export const LICENSE_SCHEMA = {
	type: 'object',
	properties: {
		wastedLicenses: { type: 'integer' },
		estimatedMonthlySavings: { type: 'integer' },
		recommendations: {
			type: 'array',
			items: {
				type: 'object',
				properties: { action: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } },
				required: ['action', 'priority'],
				additionalProperties: false,
			},
		},
	},
	required: ['wastedLicenses', 'estimatedMonthlySavings', 'recommendations'],
	additionalProperties: false,
} as const;
