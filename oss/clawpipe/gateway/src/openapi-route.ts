/** GET /v1/openapi.json — embedded OpenAPI 3.1 description served by the
 *  gateway itself. Mirrors the full spec at https://clawpipe.ai/openapi.json
 *  but is small enough to fit the 200-line source cap and stay deployable
 *  with the Worker bundle.
 */

import { GATEWAY_VERSION } from './version';

const DOC = {
  openapi: '3.1.0',
  info: {
    title: 'ClawPipe Gateway API',
    version: GATEWAY_VERSION,
    summary: 'Pipeline gateway: Booster -> Pack -> Cache -> Route -> Call -> Learn.',
    contact: { name: 'ClawPipe Support', email: 'support@clawpipe.ai', url: 'https://clawpipe.ai' },
    license: { name: 'MIT' },
  },
  servers: [{ url: 'https://api.clawpipe.ai', description: 'Production' }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Pipeline' }, { name: 'Router' }, { name: 'Analytics' },
    { name: 'Billing' }, { name: 'Webhooks' }, { name: 'Discovery' },
  ],
  paths: {
    '/v1/prompt': {
      post: {
        tags: ['Pipeline'], operationId: 'sendPrompt', summary: 'Send a prompt through the ClawPipe pipeline.',
        parameters: [
          { name: 'Idempotency-Key', in: 'header', schema: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,200}$' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PromptRequest' } } } },
        responses: {
          '200': { description: 'OK', headers: ratelimitHeaders(), content: { 'application/json': { schema: { $ref: '#/components/schemas/PromptResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '402': { description: 'Monthly budget exceeded.' },
          '413': { description: 'Prompt or system message too large.' },
          '429': { description: 'Daily quota exceeded.' },
          '502': { description: 'Upstream provider error.' },
          '503': { description: 'Provider not configured.' },
        },
      },
    },
    '/v1/stream': {
      post: {
        tags: ['Pipeline'], operationId: 'streamPrompt', summary: 'Server-sent-events stream of a prompt completion.',
        parameters: [
          { name: 'Last-Event-ID', in: 'header', schema: { type: 'string' }, description: 'Resume after this id.' },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PromptRequest' } } } },
        responses: {
          '200': { description: 'SSE stream (text/event-stream).' },
          '400': { description: 'Streaming not supported for this provider.' },
          '502': { description: 'Upstream stream failure.' },
        },
      },
    },
    '/v1/weights': {
      get: { tags: ['Router'], operationId: 'getWeights', summary: 'Read learned weights.', responses: { '200': { description: 'OK' } } },
      put: { tags: ['Router'], operationId: 'putWeights', summary: 'Push learned weights (global learning).', responses: { '200': { description: 'OK' } } },
    },
    '/v1/savings': {
      get: { tags: ['Analytics'], operationId: 'getSavings', summary: 'Per-project saved-USD aggregates.', responses: { '200': { description: 'Savings snapshot.' } } },
    },
    '/v1/index': {
      get: { tags: ['Discovery'], operationId: 'getIndex', summary: 'Public anonymized aggregate stats (no auth).', security: [], responses: { '200': { description: 'Aggregate stats.' } } },
    },
    '/v1/billing/checkout': {
      post: { tags: ['Billing'], operationId: 'billingCheckout', summary: 'Create a LemonSqueezy checkout URL.', responses: { '200': { description: 'OK' } } },
    },
    '/v1/billing/portal': {
      get: { tags: ['Billing'], operationId: 'billingPortal', summary: 'Customer portal URL.', responses: { '200': { description: 'OK' } } },
    },
    '/v1/webhooks/dlq': {
      get: { tags: ['Webhooks'], operationId: 'listDeadLetters', summary: 'List pending + dead deliveries for this project.', responses: { '200': { description: 'OK' } } },
    },
    '/v1/webhooks/dlq/{id}/replay': {
      post: {
        tags: ['Webhooks'], operationId: 'replayDelivery', summary: 'Replay a parked delivery.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Re-queued.' }, '403': { description: 'Cross-project access denied.' }, '404': { description: 'Delivery not found.' } },
      },
    },
    '/v1/openapi.json': {
      get: {
        tags: ['Discovery'], operationId: 'getOpenApi', summary: 'Self-describe (no auth).', security: [],
        responses: { '200': { description: 'OpenAPI 3.1 document.' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'ClawPipe API key (cp_live_... or cp_test_...)' },
    },
    schemas: {
      PromptRequest: {
        type: 'object', required: ['prompt', 'provider', 'model'],
        properties: {
          prompt: { type: 'string', maxLength: 100000 },
          provider: { type: 'string' },
          model: { type: 'string' },
          system: { type: 'string', maxLength: 50000 },
          maxTokens: { type: 'integer', minimum: 1 },
          temperature: { type: 'number', minimum: 0, maximum: 2 },
        },
      },
      PromptResponse: {
        type: 'object', required: ['text', 'tokensIn', 'tokensOut', 'latencyMs'],
        properties: {
          text: { type: 'string' },
          tokensIn: { type: 'integer', minimum: 0 },
          tokensOut: { type: 'integer', minimum: 0 },
          latencyMs: { type: 'integer', minimum: 0 },
          request_id: { type: 'string', format: 'uuid' },
          meta: { type: 'object', properties: { attribution: { type: 'string' }, savings: { type: 'object' } } },
        },
      },
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
    },
    responses: {
      BadRequest: { description: 'Invalid request body or parameters.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      Unauthorized: { description: 'Missing or invalid bearer token.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
};

function ratelimitHeaders() {
  return {
    'RateLimit-Limit': { schema: { type: 'string' }, description: 'RFC 9239 — limit, plus `;w=86400` window suffix.' },
    'RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Calls remaining in current daily bucket.' },
    'RateLimit-Reset': { schema: { type: 'integer' }, description: 'Seconds until UTC midnight reset.' },
  };
}

export function getOpenApiDoc(): typeof DOC { return DOC; }

/** Route handler. Public — no auth required. */
export function handleOpenApi(): Response {
  return new Response(JSON.stringify(DOC, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
    },
  });
}
