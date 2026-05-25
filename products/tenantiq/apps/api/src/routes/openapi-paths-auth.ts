/** OpenAPI paths for Auth and Tenant endpoints. */

const jsonContent = (schema: object) => ({
	content: { 'application/json': { schema } },
});

const tokenPairSchema = {
	type: 'object',
	properties: {
		accessToken: { type: 'string' },
		refreshToken: { type: 'string' },
		expiresIn: { type: 'integer' },
	},
};

const errorRef = { $ref: '#/components/schemas/Error' };
const tenantRef = { $ref: '#/components/schemas/Tenant' };

export const authPaths = {
	'/api/auth/login': {
		post: {
			tags: ['Auth'],
			summary: 'Initiate Microsoft OAuth login',
			security: [],
			requestBody: {
				required: true,
				...jsonContent({
					type: 'object',
					properties: { redirectUri: { type: 'string', format: 'uri' } },
				}),
			},
			responses: {
				'200': {
					description: 'OAuth redirect URL',
					...jsonContent({
						type: 'object',
						properties: { url: { type: 'string', format: 'uri' } },
					}),
				},
			},
		},
	},
	'/api/auth/callback': {
		post: {
			tags: ['Auth'],
			summary: 'Handle Microsoft OAuth callback and issue JWT',
			security: [],
			requestBody: {
				required: true,
				...jsonContent({
					type: 'object',
					properties: { code: { type: 'string' }, state: { type: 'string' } },
					required: ['code'],
				}),
			},
			responses: {
				'200': { description: 'JWT token pair', ...jsonContent(tokenPairSchema) },
				'401': { description: 'Invalid OAuth code', ...jsonContent(errorRef) },
			},
		},
	},
	'/api/auth/refresh': {
		post: {
			tags: ['Auth'],
			summary: 'Refresh an expired access token',
			security: [],
			requestBody: {
				required: true,
				...jsonContent({
					type: 'object',
					properties: { refreshToken: { type: 'string' } },
					required: ['refreshToken'],
				}),
			},
			responses: {
				'200': { description: 'New token pair', ...jsonContent(tokenPairSchema) },
			},
		},
	},
} as const;

export const tenantPaths = {
	'/api/tenants': {
		get: {
			tags: ['Tenants'],
			summary: 'List all tenants for the current organization',
			responses: {
				'200': {
					description: 'Tenant list',
					...jsonContent({
						type: 'object',
						properties: { data: { type: 'array', items: tenantRef } },
					}),
				},
			},
		},
	},
	'/api/tenants/{id}': {
		get: {
			tags: ['Tenants'],
			summary: 'Get tenant details by ID',
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			responses: {
				'200': {
					description: 'Tenant details',
					...jsonContent({ type: 'object', properties: { data: tenantRef } }),
				},
				'404': { description: 'Tenant not found', ...jsonContent(errorRef) },
			},
		},
	},
	'/api/tenants/{id}/sync': {
		post: {
			tags: ['Tenants'],
			summary: 'Trigger data sync from Microsoft Graph for a tenant',
			parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
			responses: {
				'200': {
					description: 'Sync initiated',
					...jsonContent({ type: 'object', properties: { status: { type: 'string' } } }),
				},
				'404': { description: 'Tenant not found', ...jsonContent(errorRef) },
			},
		},
	},
} as const;
