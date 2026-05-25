/** OpenAPI paths for AI Engine and AI Feedback endpoints. */

const tenantParam = { name: 'tenantId', in: 'path', required: true, schema: { type: 'string' } };
const aiResponseRef = { $ref: '#/components/schemas/AIResponse' };

const jsonContent = (schema: object) => ({
	content: { 'application/json': { schema } },
});

export const aiPaths = {
	'/api/ai/security-scan/{tenantId}': {
		post: {
			tags: ['AI Engine'],
			summary: 'Run AI-powered security scan on a tenant',
			parameters: [tenantParam],
			responses: {
				'200': { description: 'Security scan results', ...jsonContent(aiResponseRef) },
			},
		},
	},
	'/api/ai/license-optimize/{tenantId}': {
		post: {
			tags: ['AI Engine'],
			summary: 'AI-driven license optimization recommendations',
			parameters: [tenantParam],
			responses: {
				'200': { description: 'License optimization recommendations', ...jsonContent(aiResponseRef) },
			},
		},
	},
	'/api/ai/ask/{tenantId}': {
		post: {
			tags: ['AI Engine'],
			summary: 'Ask the AI engine a question about a tenant',
			parameters: [tenantParam],
			requestBody: {
				required: true,
				...jsonContent({
					type: 'object',
					properties: {
						question: { type: 'string' },
						context: { type: 'string' },
					},
					required: ['question'],
				}),
			},
			responses: {
				'200': { description: 'AI answer', ...jsonContent(aiResponseRef) },
			},
		},
	},
	'/api/ai/chain/{tenantId}': {
		post: {
			tags: ['AI Engine'],
			summary: 'Execute a multi-step AI reasoning chain',
			parameters: [tenantParam],
			requestBody: {
				required: true,
				...jsonContent({
					type: 'object',
					properties: {
						steps: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									action: { type: 'string' },
									params: { type: 'object' },
								},
							},
						},
					},
					required: ['steps'],
				}),
			},
			responses: {
				'200': { description: 'Chain execution results', ...jsonContent(aiResponseRef) },
			},
		},
	},
	'/api/ai/feedback/{tenantId}': {
		post: {
			tags: ['AI Feedback'],
			summary: 'Submit feedback on an AI response',
			parameters: [tenantParam],
			requestBody: {
				required: true,
				...jsonContent({
					type: 'object',
					properties: {
						responseId: { type: 'string' },
						rating: { type: 'integer', minimum: 1, maximum: 5 },
						comment: { type: 'string' },
					},
					required: ['responseId', 'rating'],
				}),
			},
			responses: {
				'200': { description: 'Feedback recorded' },
			},
		},
	},
	'/api/ai/feedback/insights': {
		get: {
			tags: ['AI Feedback'],
			summary: 'Get aggregated AI feedback insights',
			responses: {
				'200': {
					description: 'Feedback analytics',
					...jsonContent({
						type: 'object',
						properties: {
							averageRating: { type: 'number' },
							totalFeedback: { type: 'integer' },
							topIssues: { type: 'array', items: { type: 'string' } },
						},
					}),
				},
			},
		},
	},
} as const;
