/**
 * OpenAPI 3.0 Spec — Info + Security Schemes
 */
export const openApiInfo = {
  openapi: '3.0.3',
  info: {
    title: 'OpenSyber API',
    version: '1.0.0',
    description: 'AI Agent Runtime Security Monitoring Platform API',
    contact: { name: 'OpenSyber', url: 'https://opensyber.cloud' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: 'https://api.opensyber.cloud', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Auth.js JWT token' },
      gatewayToken: { type: 'apiKey', in: 'header', name: 'X-Gateway-Token', description: 'Agent gateway token' },
    },
    parameters: {
      orgId: { name: 'X-Org-Id', in: 'header', required: false, schema: { type: 'string' }, description: 'Organization ID for multi-tenant access' },
    },
  },
  security: [{ bearerAuth: [] }],
};
