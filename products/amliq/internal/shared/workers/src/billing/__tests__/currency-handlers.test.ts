import { describe, expect, it, vi } from 'vitest';
import {
  createListCurrenciesHandler,
  createGetRatesHandler,
  createMultiCurrencyInvoiceHandler,
  createReconciliationHandler,
  type CurrencyRequest,
  type SettlementStore,
} from '../currency-handlers';
import { ExchangeRateService, InMemoryRateProvider } from '../exchange-rate-service';
import type { SettlementRecord } from '../currency-settlement';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = '2026-07-20T12:00:00Z';

function makeRequest(overrides: Partial<CurrencyRequest> = {}): CurrencyRequest {
  return { tenantId: VALID_UUID, userRole: 'admin', ...overrides };
}

function makeService(): ExchangeRateService {
  const p = new InMemoryRateProvider();
  p.setRate('USD_EUR', 0.92);
  p.setRate('USD_GBP', 0.79);
  p.setRate('USD_JPY', 149.5);
  return new ExchangeRateService(p);
}

describe('createListCurrenciesHandler', () => {
  const handler = createListCurrenciesHandler();

  it('returns all supported currencies', async () => {
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = res.body as { data: unknown[]; count: number };
    expect(body.count).toBeGreaterThanOrEqual(15);
    expect(body.data[0]).toHaveProperty('code');
    expect(body.data[0]).toHaveProperty('name');
    expect(body.data[0]).toHaveProperty('symbol');
    expect(body.data[0]).toHaveProperty('decimal_places');
  });
});

describe('createGetRatesHandler', () => {
  it('returns rates for base currency', async () => {
    const handler = createGetRatesHandler(makeService());
    const res = await handler(makeRequest({ query: { base: 'USD' } }));
    expect(res.status).toBe(200);
    const body = res.body as { data: { base: string; rates: Record<string, number> } };
    expect(body.data.base).toBe('USD');
    expect(body.data.rates.EUR).toBe(0.92);
  });

  it('defaults to USD base', async () => {
    const handler = createGetRatesHandler(makeService());
    const res = await handler(makeRequest({ query: {} }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid base currency', async () => {
    const handler = createGetRatesHandler(makeService());
    const res = await handler(makeRequest({ query: { base: 'xx' } }));
    expect(res.status).toBe(400);
  });
});

describe('createMultiCurrencyInvoiceHandler', () => {
  it('creates an invoice successfully', async () => {
    const handler = createMultiCurrencyInvoiceHandler(makeService());
    const res = await handler(makeRequest({
      body: {
        customer_id: VALID_UUID,
        display_currency: 'EUR',
        settlement_currency: 'USD',
        line_items: [{ description: 'Pro Plan', quantity: 1, unit_price: 100 }],
      },
    }));
    expect(res.status).toBe(201);
    const body = res.body as { data: { display_currency: string } };
    expect(body.data.display_currency).toBe('EUR');
  });

  it('returns 400 for invalid input', async () => {
    const handler = createMultiCurrencyInvoiceHandler(makeService());
    const res = await handler(makeRequest({ body: { invalid: true } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing line items', async () => {
    const handler = createMultiCurrencyInvoiceHandler(makeService());
    const res = await handler(makeRequest({
      body: {
        customer_id: VALID_UUID,
        display_currency: 'EUR',
        settlement_currency: 'USD',
        line_items: [],
      },
    }));
    expect(res.status).toBe(400);
  });
});

describe('createReconciliationHandler', () => {
  const mockStore: SettlementStore = {
    listByPeriod: vi.fn().mockResolvedValue([
      {
        id: 'stl-001', invoice_id: 'inv-001', tenant_id: VALID_UUID,
        payment_amount: 100, payment_currency: 'EUR',
        settlement_amount: 109, settlement_currency: 'USD',
        exchange_rate_at_payment: 1.08, exchange_rate_at_settlement: 1.09,
        payment_date: NOW, settlement_date: NOW, status: 'settled',
      } satisfies SettlementRecord,
    ]),
  };

  it('returns reconciliation summary', async () => {
    const handler = createReconciliationHandler(mockStore);
    const res = await handler(makeRequest({ query: { period: '2026-07' } }));
    expect(res.status).toBe(200);
    const body = res.body as { data: { period: string; settlement_count: number } };
    expect(body.data.period).toBe('2026-07');
    expect(body.data.settlement_count).toBe(1);
  });

  it('returns 400 for invalid period format', async () => {
    const handler = createReconciliationHandler(mockStore);
    const res = await handler(makeRequest({ query: { period: 'bad' } }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing period', async () => {
    const handler = createReconciliationHandler(mockStore);
    const res = await handler(makeRequest({ query: {} }));
    expect(res.status).toBe(400);
  });
});
