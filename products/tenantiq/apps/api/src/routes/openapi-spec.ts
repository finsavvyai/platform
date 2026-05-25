import { authPaths, tenantPaths } from './openapi-paths-auth';
import { aiPaths } from './openapi-paths-ai';
import { cisPaths, healthPaths } from './openapi-paths-cis';

export const OPENAPI_SPEC = {
	openapi: '3.1.0',
	info: {
		title: 'TenantIQ API',
		version: '1.0.0',
		description:
			'AI-powered Microsoft 365 security, compliance, and cost intelligence API for MSPs.',
		contact: { name: 'TenantIQ', url: 'https://tenantiq.app' },
	},
	servers: [
		{ url: 'https://api.tenantiq.app', description: 'Production' },
		{ url: 'http://localhost:8787', description: 'Local development' },
	],
	components: {
		securitySchemes: {
			bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
		},
		schemas: {
			Error: {
				type: 'object',
				properties: { error: { type: 'string' } },
				required: ['error'],
			},
			Tenant: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					azureTenantId: { type: 'string' },
					orgId: { type: 'string' },
					status: { type: 'string', enum: ['active', 'inactive', 'syncing'] },
				},
			},
			CISResult: {
				type: 'object',
				properties: {
					controlId: { type: 'string' },
					title: { type: 'string' },
					status: { type: 'string', enum: ['pass', 'fail', 'manual', 'not_applicable'] },
					severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
					remediation: { type: 'string' },
				},
			},
			AIResponse: {
				type: 'object',
				properties: {
					analysis: { type: 'string' },
					recommendations: { type: 'array', items: { type: 'string' } },
					severity: { type: 'string' },
				},
			},
		},
	},
	security: [{ bearerAuth: [] }],
	paths: {
		...authPaths,
		...tenantPaths,
		...aiPaths,
		...cisPaths,
		...healthPaths,
	},
} as const;
