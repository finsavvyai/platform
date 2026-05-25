import { describe, expect, it, vi } from 'vitest';
import {
  createListGatewaysHandler,
  createGetGatewayHealthHandler,
  createUpdateRoutingRulesHandler,
  createTestGatewayHandler,
  type GatewayRequest,
} from '../gateway-handlers';
import { GatewayRouter } from '../gateway-router';
import { GatewayRegistry, type PaymentGateway } from '../gateway-models';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequest(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return { tenantId: VALID_UUID, userRole: 'admin', ...overrides };
}

function makeMockGateway(name: string): PaymentGateway {
  return {
    name,
    authorize: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'authorized' }),
    capture: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'captured' }),
    refund: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'refunded' }),
    void: vi.fn().mockResolvedValue({ success: true, intent_id: 'pi-1', gateway: name, status: 'voided' }),
    verifyWebhook: vi.fn().mockResolvedValue({
      id: 'evt-1', gateway: name, event_type: 'test',
      payload: {}, received_at: '2026-07-20T12:00:00Z', verified: true,
    }),
  };
}

function makeSetup() {
  const registry = new GatewayRegistry();
  registry.register('stripe', makeMockGateway('stripe'), true);
  registry.register('paypal', makeMockGateway('paypal'));
  const router = new GatewayRouter(registry);
  return { registry, router };
}

describe('createListGatewaysHandler', () => {
  it('returns all gateways with health', async () => {
    const { router } = makeSetup();
    const handler = createListGatewaysHandler(router);
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = res.body as { data: unknown[]; count: number };
    expect(body.count).toBe(2);
  });
});

describe('createGetGatewayHealthHandler', () => {
  it('returns health for a specific gateway', async () => {
    const { router } = makeSetup();
    const handler = createGetGatewayHealthHandler(router);
    const res = await handler(makeRequest({ params: { id: 'stripe' } }));
    expect(res.status).toBe(200);
    const body = res.body as { data: { gateway: string } };
    expect(body.data.gateway).toBe('stripe');
  });

  it('returns 404 for unknown gateway', async () => {
    const { router } = makeSetup();
    const handler = createGetGatewayHealthHandler(router);
    const res = await handler(makeRequest({ params: { id: 'unknown' } }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when ID is missing', async () => {
    const { router } = makeSetup();
    const handler = createGetGatewayHealthHandler(router);
    const res = await handler(makeRequest());
    expect(res.status).toBe(400);
  });
});

describe('createUpdateRoutingRulesHandler', () => {
  it('updates routing rules for admin', async () => {
    const { router } = makeSetup();
    const handler = createUpdateRoutingRulesHandler(router);
    const res = await handler(makeRequest({
      body: {
        rules: [
          { id: 'r1', conditions: { currency: 'EUR' }, preferred_gateway: 'adyen', priority: 10 },
        ],
      },
    }));
    expect(res.status).toBe(200);
    const body = res.body as { count: number };
    expect(body.count).toBe(1);
  });

  it('rejects non-admin access', async () => {
    const { router } = makeSetup();
    const handler = createUpdateRoutingRulesHandler(router);
    const res = await handler(makeRequest({ userRole: 'viewer', body: { rules: [] } }));
    expect(res.status).toBe(403);
  });

  it('rejects invalid rules', async () => {
    const { router } = makeSetup();
    const handler = createUpdateRoutingRulesHandler(router);
    const res = await handler(makeRequest({ body: { rules: [{ invalid: true }] } }));
    expect(res.status).toBe(400);
  });
});

describe('createTestGatewayHandler', () => {
  it('tests gateway connectivity', async () => {
    const { registry } = makeSetup();
    const handler = createTestGatewayHandler(registry);
    const res = await handler(makeRequest({ params: { id: 'stripe' } }));
    expect(res.status).toBe(200);
    const body = res.body as { data: { status: string } };
    expect(body.data.status).toBe('connected');
  });

  it('returns error status on gateway failure', async () => {
    const registry = new GatewayRegistry();
    const failGw = makeMockGateway('failing');
    failGw.authorize = vi.fn().mockRejectedValue(new Error('Connection refused'));
    registry.register('failing', failGw);
    const handler = createTestGatewayHandler(registry);
    const res = await handler(makeRequest({ params: { id: 'failing' } }));
    expect(res.status).toBe(200);
    const body = res.body as { data: { status: string } };
    expect(body.data.status).toBe('error');
  });

  it('returns 404 for unknown gateway', async () => {
    const { registry } = makeSetup();
    const handler = createTestGatewayHandler(registry);
    const res = await handler(makeRequest({ params: { id: 'unknown' } }));
    expect(res.status).toBe(404);
  });

  it('rejects non-admin access', async () => {
    const { registry } = makeSetup();
    const handler = createTestGatewayHandler(registry);
    const res = await handler(makeRequest({ userRole: 'viewer', params: { id: 'stripe' } }));
    expect(res.status).toBe(403);
  });
});
