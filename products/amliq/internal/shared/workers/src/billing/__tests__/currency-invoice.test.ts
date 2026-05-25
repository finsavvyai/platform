import { describe, expect, it } from 'vitest';
import { createMultiCurrencyInvoice, formatCurrencyAmount } from '../currency-invoice';
import { ExchangeRateService, InMemoryRateProvider } from '../exchange-rate-service';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeService(): ExchangeRateService {
  const provider = new InMemoryRateProvider();
  provider.setRate('USD_EUR', 0.92);
  provider.setRate('USD_GBP', 0.79);
  provider.setRate('USD_JPY', 149.5);
  provider.setRate('EUR_USD', 1.087);
  return new ExchangeRateService(provider);
}

describe('createMultiCurrencyInvoice', () => {
  it('creates an invoice with EUR display currency', async () => {
    const service = makeService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: VALID_UUID,
      customer_id: VALID_UUID,
      display_currency: 'EUR',
      settlement_currency: 'USD',
      line_items: [{ description: 'Pro Plan', quantity: 1, unit_price: 100 }],
    }, service);

    expect(invoice.display_currency).toBe('EUR');
    expect(invoice.settlement_currency).toBe('USD');
    expect(invoice.total_settlement).toBe(100);
    expect(invoice.exchange_rate_at_creation).toBe(0.92);
    expect(invoice.status).toBe('draft');
  });

  it('generates invoice with multiple line items', async () => {
    const service = makeService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: VALID_UUID,
      customer_id: VALID_UUID,
      display_currency: 'EUR',
      settlement_currency: 'USD',
      line_items: [
        { description: 'Seat license', quantity: 5, unit_price: 20 },
        { description: 'Add-on', quantity: 1, unit_price: 50 },
      ],
    }, service);

    expect(invoice.line_items).toHaveLength(2);
    expect(invoice.total_settlement).toBe(150);
  });

  it('handles JPY display currency with zero decimals', async () => {
    const service = makeService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: VALID_UUID,
      customer_id: VALID_UUID,
      display_currency: 'JPY',
      settlement_currency: 'USD',
      line_items: [{ description: 'Plan', quantity: 1, unit_price: 100 }],
    }, service);

    expect(Number.isInteger(invoice.total_display)).toBe(true);
  });

  it('handles same-currency invoice', async () => {
    const service = makeService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: VALID_UUID,
      customer_id: VALID_UUID,
      display_currency: 'USD',
      settlement_currency: 'USD',
      line_items: [{ description: 'Plan', quantity: 1, unit_price: 99.99 }],
    }, service);

    expect(invoice.total_display).toBe(99.99);
    expect(invoice.total_settlement).toBe(99.99);
  });

  it('records the exchange rate snapshot', async () => {
    const service = makeService();
    const invoice = await createMultiCurrencyInvoice({
      tenant_id: VALID_UUID,
      customer_id: VALID_UUID,
      display_currency: 'GBP',
      settlement_currency: 'USD',
      line_items: [{ description: 'Plan', quantity: 1, unit_price: 200 }],
    }, service);

    expect(invoice.exchange_rate_at_creation).toBe(0.79);
    expect(invoice.rate_source).toBeDefined();
  });
});

describe('formatCurrencyAmount', () => {
  it('formats USD with dollar sign and 2 decimals', () => {
    const result = formatCurrencyAmount(1234.56, 'USD');
    expect(result).toContain('1,234.56');
  });

  it('formats JPY with no decimals', () => {
    const result = formatCurrencyAmount(1500, 'JPY');
    expect(result).toContain('1,500');
    expect(result).not.toContain('.');
  });

  it('formats EUR with euro symbol', () => {
    const result = formatCurrencyAmount(99.99, 'EUR');
    expect(result).toContain('99.99');
  });

  it('formats GBP with pound symbol', () => {
    const result = formatCurrencyAmount(49.99, 'GBP');
    expect(result).toContain('49.99');
  });

  it('handles zero amount', () => {
    const result = formatCurrencyAmount(0, 'USD');
    expect(result).toContain('0');
  });
});
