/** Integration Tests: Multi-Currency + Payment Gateway */

import { describe, expect, it, vi } from 'vitest';
import { InMemoryRateProvider, ExchangeRateService } from '../exchange-rate-service';
import { createMultiCurrencyInvoice } from '../currency-invoice';
import { reconcileSettlement, calculateFXGainLoss, calculateMonthlySummary } from '../currency-settlement';
import { GatewayRegistry, type PaymentGateway, type PaymentIntent, type PaymentResult } from '../gateway-models';
import { GatewayRouter } from '../gateway-router';

function mockGateway(name: string, shouldFail = false): PaymentGateway {
  return {
    name,
    authorize: vi.fn().mockImplementation(async (intent: PaymentIntent): Promise<PaymentResult> => {
      if (shouldFail) throw new Error(`${name} authorization failed`);
      return {
        success: true, intent_id: intent.id, gateway: name,
        gateway_reference: `${name}-ref-${intent.id}`, status: 'authorized',
      };
    }),
    capture: vi.fn().mockResolvedValue({ success: true, intent_id: '', gateway: name, status: 'captured' }),
    refund: vi.fn().mockResolvedValue({ success: true, intent_id: '', gateway: name, status: 'refunded' }),
    void: vi.fn().mockResolvedValue({ success: true, intent_id: '', gateway: name, status: 'voided' }),
    verifyWebhook: vi.fn().mockResolvedValue({
      id: 'wh-1', gateway: name, event_type: 'payment.completed',
      payload: {}, received_at: new Date().toISOString(), verified: true,
    }),
  };
}

function makeRateService(): ExchangeRateService {
  const provider = new InMemoryRateProvider();
  provider.setRate('USD_EUR', 0.92);
  provider.setRate('USD_GBP', 0.79);
  provider.setRate('EUR_USD', 1.087);
  provider.setRate('GBP_USD', 1.266);
  provider.setRate('JPY_USD', 0.0067);
  return new ExchangeRateService(provider);
}

function makeIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: `pi-${Date.now()}`, gateway: 'stripe', amount: 100, currency: 'EUR',
    customer_id: 'cust-1', status: 'created', created_at: new Date().toISOString(),
    ...overrides,
  };
}

const TENANT_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Integration: Multi-Currency + Gateway Flow', () => {
  it('creates EUR invoice, processes via PayPal, and tracks FX settlement', async () => {
    const rateService = makeRateService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: TENANT_UUID, customer_id: '550e8400-e29b-41d4-a716-446655440001',
      display_currency: 'EUR', settlement_currency: 'USD',
      line_items: [{ description: 'Enterprise License', quantity: 1, unit_price: 1000 }],
    }, rateService);

    expect(invoice.display_currency).toBe('EUR');
    expect(invoice.settlement_currency).toBe('USD');
    expect(invoice.exchange_rate_at_creation).toBeGreaterThan(0);

    const registry = new GatewayRegistry();
    const paypal = mockGateway('paypal');
    registry.register('paypal', paypal);

    const intent = makeIntent({ amount: invoice.total_display, currency: 'EUR' });
    const result = await paypal.authorize(intent);
    expect(result.success).toBe(true);
    expect(result.gateway).toBe('paypal');

    const settlement = reconcileSettlement(
      invoice.invoice_id, TENANT_UUID, invoice.total_display,
      'EUR', 'USD', invoice.exchange_rate_at_creation, 1.095,
    );

    expect(settlement.payment_currency).toBe('EUR');
    expect(settlement.settlement_currency).toBe('USD');
    expect(settlement.status).toBe('settled');

    const fx = calculateFXGainLoss(settlement);
    expect(typeof fx.gain_loss).toBe('number');
    expect(fx.currency).toBe('USD');
  });

  it('handles GBP invoice with Stripe failover to Adyen', async () => {
    const rateService = makeRateService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: TENANT_UUID, customer_id: '550e8400-e29b-41d4-a716-446655440002',
      display_currency: 'GBP', settlement_currency: 'USD',
      line_items: [
        { description: 'Pro Plan', quantity: 1, unit_price: 500 },
        { description: 'Support Add-on', quantity: 2, unit_price: 100 },
      ],
    }, rateService);

    expect(invoice.line_items).toHaveLength(2);

    const registry = new GatewayRegistry();
    const failingStripe = mockGateway('stripe', true);
    const adyen = mockGateway('adyen');
    registry.register('stripe', failingStripe, true);
    registry.register('adyen', adyen);

    const router = new GatewayRouter(registry);
    router.setRules([{
      id: 'gbp-rule', conditions: { currency: 'GBP' },
      preferred_gateway: 'stripe', fallback_gateway: 'adyen', priority: 10,
    }]);

    const intent = makeIntent({ amount: invoice.total_display, currency: 'GBP' });
    const result = await router.processPayment(intent);

    expect(result.success).toBe(true);
    expect(result.gateway).toBe('adyen');
    expect(failingStripe.authorize).toHaveBeenCalledTimes(1);
    expect(adyen.authorize).toHaveBeenCalledTimes(1);
  });

  it('multi-currency revrec: settlement summary with mixed currencies', async () => {
    const records = [
      reconcileSettlement('inv-1', TENANT_UUID, 1000, 'EUR', 'USD', 1.08, 1.10),
      reconcileSettlement('inv-2', TENANT_UUID, 500, 'GBP', 'USD', 1.25, 1.22),
      reconcileSettlement('inv-3', TENANT_UUID, 2000, 'EUR', 'USD', 1.09, 1.09),
    ];

    const summary = calculateMonthlySummary(records, '2026-07', 'USD');

    expect(summary.period).toBe('2026-07');
    expect(summary.settlement_count).toBe(3);
    expect(summary.total_settled).toBeGreaterThan(0);
    expect(typeof summary.net_fx_impact).toBe('number');
    expect(summary.total_fx_gain + summary.total_fx_loss).toBeCloseTo(summary.net_fx_impact, 1);
  });

  it('gateway router health tracks success/failure across gateways', async () => {
    const registry = new GatewayRegistry();
    registry.register('stripe', mockGateway('stripe'), true);
    registry.register('paypal', mockGateway('paypal'));

    const router = new GatewayRouter(registry);
    const intent = makeIntent({ currency: 'USD' });

    await router.processPayment(intent);
    await router.processPayment(intent);

    const health = router.getHealth();
    expect(health).toHaveLength(2);

    const stripeHealth = health.find((h) => h.gateway === 'stripe');
    expect(stripeHealth?.successCount).toBe(2);
    expect(stripeHealth?.isHealthy).toBe(true);
  });

  it('circuit breaker opens after repeated gateway failures', async () => {
    const registry = new GatewayRegistry();
    const failingGw = mockGateway('failing', true);
    const healthyGw = mockGateway('healthy');
    registry.register('failing', failingGw, true);
    registry.register('healthy', healthyGw);

    const router = new GatewayRouter(registry);
    const intent = makeIntent({ currency: 'USD' });

    for (let i = 0; i < 5; i++) {
      await router.processPayment(intent);
    }

    const health = router.getHealth();
    const failingHealth = health.find((h) => h.gateway === 'failing');
    expect(failingHealth?.isHealthy).toBe(false);
    expect(failingHealth?.failureCount).toBe(5);
  });

  it('end-to-end: invoice -> gateway -> settlement -> monthly summary', async () => {
    const rateService = makeRateService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: TENANT_UUID, customer_id: '550e8400-e29b-41d4-a716-446655440003',
      display_currency: 'EUR', settlement_currency: 'USD',
      line_items: [{ description: 'Platform Fee', quantity: 1, unit_price: 5000 }],
    }, rateService);

    const registry = new GatewayRegistry();
    registry.register('stripe', mockGateway('stripe'), true);
    const router = new GatewayRouter(registry);

    const intent = makeIntent({ id: invoice.invoice_id, amount: invoice.total_display, currency: 'EUR' });
    const paymentResult = await router.processPayment(intent);
    expect(paymentResult.success).toBe(true);

    const settlement = reconcileSettlement(
      invoice.invoice_id, TENANT_UUID, invoice.total_display,
      'EUR', 'USD', invoice.exchange_rate_at_creation, 1.095,
    );

    const summary = calculateMonthlySummary([settlement], '2026-07', 'USD');
    expect(summary.settlement_count).toBe(1);
    expect(summary.total_settled).toBeGreaterThan(0);
  });
});
