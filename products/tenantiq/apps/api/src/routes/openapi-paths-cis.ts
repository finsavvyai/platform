/** OpenAPI paths for CIS Benchmark and Health endpoints. */

const tenantParam = { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } };
const cisResultRef = { $ref: '#/components/schemas/CISResult' };

const jsonContent = (schema: object) => ({
	content: { 'application/json': { schema } },
});

export const cisPaths = {
	'/api/cis-benchmark/{tenantId}/scan': {
		post: {
			tags: ['CIS Benchmark'],
			summary: 'Trigger a CIS benchmark compliance scan',
			parameters: [tenantParam],
			responses: {
				'200': {
					description: 'Scan initiated',
					...jsonContent({
						type: 'object',
						properties: {
							scanId: { type: 'string' },
							status: { type: 'string', enum: ['queued', 'running'] },
						},
					}),
				},
			},
		},
	},
	'/api/cis-benchmark/{tenantId}/results': {
		get: {
			tags: ['CIS Benchmark'],
			summary: 'Get CIS benchmark scan results for a tenant',
			parameters: [
				tenantParam,
				{
					name: 'scanId',
					in: 'query',
					schema: { type: 'string' },
					description: 'Filter by scan ID',
				},
				{
					name: 'severity',
					in: 'query',
					schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
				},
			],
			responses: {
				'200': {
					description: 'CIS control results',
					...jsonContent({
						type: 'object',
						properties: {
							score: { type: 'number', description: 'Percentage of passing controls' },
							controls: { type: 'array', items: cisResultRef },
						},
					}),
				},
			},
		},
	},
} as const;

export const healthPaths = {
	'/health': {
		get: {
			tags: ['Health'],
			summary: 'Basic health check',
			security: [],
			responses: {
				'200': {
					description: 'Service is healthy',
					...jsonContent({
						type: 'object',
						properties: { status: { type: 'string', enum: ['ok'] } },
					}),
				},
			},
		},
	},
	'/health/ready': {
		get: {
			tags: ['Health'],
			summary: 'Readiness check including downstream dependencies',
			security: [],
			responses: {
				'200': {
					description: 'Service is ready',
					...jsonContent({
						type: 'object',
						properties: {
							status: { type: 'string' },
							database: { type: 'string' },
							graphApi: { type: 'string' },
						},
					}),
				},
			},
		},
	},
} as const;
