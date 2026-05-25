/**
 * OpenAPI 3.1 spec — GET /v1/openapi.json.
 *
 * Hand-written spec covering the public TokenForge API surface.
 * Generated from route inventory, not runtime introspection —
 * keeps the Worker lean (no @hono/zod-openapi dep).
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';

export const openapiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'TokenForge API',
    version: '1.0.0',
    description: 'Device-bound session security — W3C DBSC-aligned.',
    contact: { url: 'https://tokenforge.opensyber.cloud' },
  },
  servers: [{ url: 'https://tokenforge-api.opensyber.cloud' }],
  paths: {
    '/health': {
      get: { summary: 'Health check', tags: ['System'], responses: { 200: { description: 'OK' } } },
    },
    '/v1/dbsc/challenge': {
      post: {
        summary: 'Issue DBSC challenge nonce',
        tags: ['DBSC'],
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ChallengeRequest' } } } },
        responses: { 200: { description: 'Challenge issued' } },
      },
    },
    '/v1/dbsc/register': {
      post: {
        summary: 'Register device with JWS-signed challenge',
        tags: ['DBSC'],
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: { 201: { description: 'Session bound' } },
      },
    },
    '/v1/dbsc/refresh': {
      post: {
        summary: 'Refresh bound cookie via signed nonce',
        tags: ['DBSC'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Cookie rotated' } },
      },
    },
    '/v1/dbsc/sessions': {
      get: { summary: 'List DBSC sessions', tags: ['DBSC'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Session list' } } },
    },
    '/v1/dbsc/sessions/{id}/revoke': {
      post: { summary: 'Revoke a DBSC session', tags: ['DBSC'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Revoked' } } },
    },
    '/v1/sessions': {
      get: { summary: 'List legacy sessions', tags: ['Sessions'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Session list' } } },
    },
    '/v1/verify': {
      post: { summary: 'Verify session + trust score', tags: ['Sessions'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Verified' } } },
    },
    '/v1/bind': {
      post: { summary: 'Legacy device bind', tags: ['Sessions'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Bound' } } },
    },
    '/v1/policies': {
      get: { summary: 'List policies', tags: ['Policies'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Policy list' } } },
      post: { summary: 'Create policy', tags: ['Policies'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/v1/policies/{id}': {
      patch: { summary: 'Update policy', tags: ['Policies'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Updated' } } },
      delete: { summary: 'Delete policy', tags: ['Policies'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Deleted' } } },
    },
    '/v1/workforce/apps': {
      get: { summary: 'List workforce IdP apps', tags: ['Workforce'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'App list' } } },
      post: { summary: 'Connect workforce IdP app', tags: ['Workforce'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/v1/workforce/sso/{appId}/exchange': {
      post: { summary: 'OIDC ID token → DBSC challenge', tags: ['Workforce'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Challenge issued' } } },
    },
    '/v1/workforce/subjects': {
      get: { summary: 'List workforce users', tags: ['Workforce'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Subject list' } } },
    },
    '/v1/webhooks': {
      get: { summary: 'List webhook subscriptions', tags: ['Webhooks'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Webhook list' } } },
      post: { summary: 'Create webhook subscription', tags: ['Webhooks'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/v1/saml/metadata/{tenantId}': {
      get: { summary: 'SAML SP metadata XML', tags: ['SAML'], responses: { 200: { description: 'XML metadata' } } },
    },
    '/v1/saml/acs/{tenantId}': {
      post: { summary: 'SAML assertion consumer', tags: ['SAML'], responses: { 200: { description: 'Challenge issued' } } },
    },
    '/scim/v2/Users': {
      get: { summary: 'List SCIM users', tags: ['SCIM'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'ListResponse' } } },
      post: { summary: 'Provision SCIM user', tags: ['SCIM'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Created' } } },
    },
    '/scim/v2/Groups': {
      get: { summary: 'List SCIM groups (stub)', tags: ['SCIM'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'ListResponse' } } },
    },
    '/.well-known/tokenforge/jwks': {
      get: { summary: 'Public JWKS', tags: ['Discovery'], responses: { 200: { description: 'JWKS' } } },
    },
    '/.well-known/tokenforge/dbsc': {
      get: { summary: 'DBSC service descriptor', tags: ['Discovery'], responses: { 200: { description: 'Descriptor' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Tenant API key (tf_*)' },
    },
    schemas: {
      ChallengeRequest: {
        type: 'object',
        required: ['purpose'],
        properties: {
          purpose: { type: 'string', enum: ['register', 'refresh', 'step_up'] },
          sessionId: { type: 'string' },
          ttlSeconds: { type: 'integer', minimum: 15, maximum: 300 },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['alg', 'publicKey', 'challenge', 'challengeResponse'],
        properties: {
          alg: { type: 'string', enum: ['ES256'] },
          publicKey: { type: 'string' },
          challenge: { type: 'string' },
          challengeResponse: { type: 'string' },
          origin: { type: 'string', format: 'uri' },
          attestation: { type: 'string' },
        },
      },
    },
  },
};

openapiRoutes.get('/', (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  return c.json(spec);
});
