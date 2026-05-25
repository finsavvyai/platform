/**
 * Gateway Management API Handlers
 * REST handlers for managing payment gateways: list, health,
 * routing rules, and connectivity testing. Admin-only access.
 * Follows the handler pattern from dunning-handlers.ts.
 */

import { z } from 'zod';
import type { GatewayRouter, RoutingRule } from './gateway-router';
import { routingRuleSchema } from './gateway-router';
import type { GatewayRegistry } from './gateway-models';

// --- Request/Response types ---

export interface GatewayRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  tenantId: string;
  userRole: string;
}

export interface GatewayResponse {
  status: number;
  body: unknown;
}

// --- Validation Schemas ---

const updateRoutingRulesBody = z.object({
  rules: z.array(routingRuleSchema).min(1).max(50),
});

// --- Handler factories ---

/** GET /api/v1/gateways -- list configured gateways with health. */
export function createListGatewaysHandler(router: GatewayRouter) {
  return async (_req: GatewayRequest): Promise<GatewayResponse> => {
    const health = router.getHealth();
    return { status: 200, body: { data: health, count: health.length } };
  };
}

/** GET /api/v1/gateways/:id/health -- detailed gateway health. */
export function createGetGatewayHealthHandler(router: GatewayRouter) {
  return async (req: GatewayRequest): Promise<GatewayResponse> => {
    const gatewayId = req.params?.id;
    if (!gatewayId) {
      return { status: 400, body: { error: 'Gateway ID is required' } };
    }

    const allHealth = router.getHealth();
    const health = allHealth.find((h) => h.gateway === gatewayId);
    if (!health) {
      return { status: 404, body: { error: 'Gateway not found' } };
    }

    return { status: 200, body: { data: health } };
  };
}

/** PUT /api/v1/gateways/routing-rules -- update routing rules (admin). */
export function createUpdateRoutingRulesHandler(router: GatewayRouter) {
  return async (req: GatewayRequest): Promise<GatewayResponse> => {
    if (req.userRole !== 'admin') {
      return { status: 403, body: { error: 'Admin role required' } };
    }

    const parsed = updateRoutingRulesBody.safeParse(req.body);
    if (!parsed.success) {
      return {
        status: 400,
        body: { error: 'Validation failed', details: parsed.error.issues },
      };
    }

    router.setRules(parsed.data.rules);
    return { status: 200, body: { data: parsed.data.rules, count: parsed.data.rules.length } };
  };
}

/** POST /api/v1/gateways/:id/test -- test gateway connectivity (admin). */
export function createTestGatewayHandler(registry: GatewayRegistry) {
  return async (req: GatewayRequest): Promise<GatewayResponse> => {
    if (req.userRole !== 'admin') {
      return { status: 403, body: { error: 'Admin role required' } };
    }

    const gatewayId = req.params?.id;
    if (!gatewayId) {
      return { status: 400, body: { error: 'Gateway ID is required' } };
    }

    const gateway = registry.get(gatewayId);
    if (!gateway) {
      return { status: 404, body: { error: 'Gateway not found' } };
    }

    try {
      const testIntent = {
        id: `test-${Date.now()}`,
        gateway: gatewayId,
        amount: 0.01,
        currency: 'USD',
        customer_id: 'test-customer',
        status: 'created' as const,
        created_at: new Date().toISOString(),
      };
      await gateway.authorize(testIntent);
      return {
        status: 200,
        body: { data: { gateway: gatewayId, status: 'connected', tested_at: new Date().toISOString() } },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      return {
        status: 200,
        body: { data: { gateway: gatewayId, status: 'error', error: msg, tested_at: new Date().toISOString() } },
      };
    }
  };
}
