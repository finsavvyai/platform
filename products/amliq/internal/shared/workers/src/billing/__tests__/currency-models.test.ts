import { describe, expect, it } from 'vitest';
import {
  exchangeRateSchema,
  currencyConversionSchema,
  multiCurrencyInvoiceSchema,
  isRateStale,
  roundForCurrency,
  getDecimalPlaces,
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
} from '../currency-models';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = '2026-07-20T12:00:00Z';

describe('exchangeRateSchema', () => {
  const validRate = {
    source_currency: 'USD',
    target_currency: 'EUR',
    rate: 0.92,
    source: 'ecb' as const,
    fetched_at: NOW,
  };

  it('accepts a valid exchange rate', () => {
    expect(exchangeRateSchema.safeParse(validRate).success).toBe(true);
  });

  it('rejects same source and target currency', () => {
    const result = exchangeRateSchema.safeParse({ ...validRate, target_currency: 'USD' });
    expect(result.success).toBe(false);
  });

  it('rejects negative rate', () => {
    const result = exchangeRateSchema.safeParse({ ...validRate, rate: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects zero rate', () => {
    const result = exchangeRateSchema.safeParse({ ...validRate, rate: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency code', () => {
    const result = exchangeRateSchema.safeParse({ ...validRate, source_currency: 'us' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime', () => {
    const result = exchangeRateSchema.safeParse({ ...validRate, fetched_at: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid source types', () => {
    for (const source of ['ecb', 'fixer', 'manual', 'fallback'] as const) {
      const result = exchangeRateSchema.safeParse({ ...validRate, source });
      expect(result.success).toBe(true);
    }
  });
});

describe('currencyConversionSchema', () => {
  const validConversion = {
    original_amount: 100,
    original_currency: 'USD',
    converted_amount: 92,
    target_currency: 'EUR',
    rate_used: 0.92,
    converted_at: NOW,
  };

  it('accepts a valid conversion', () => {
    expect(currencyConversionSchema.safeParse(validConversion).success).toBe(true);
  });

  it('rejects negative original amount', () => {
    const result = currencyConversionSchema.safeParse({ ...validConversion, original_amount: -10 });
    expect(result.success).toBe(false);
  });

  it('accepts zero amount (free items)', () => {
    const result = currencyConversionSchema.safeParse({
      ...validConversion, original_amount: 0, converted_amount: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('multiCurrencyInvoiceSchema', () => {
  const validInvoice = {
    invoice_id: 'inv-001',
    tenant_id: VALID_UUID,
    customer_id: VALID_UUID,
    display_currency: 'EUR',
    settlement_currency: 'USD',
    exchange_rate_at_creation: 1.09,
    line_items: [{
      description: 'Pro Plan',
      quantity: 1,
      unit_price_display: 91.74,
      unit_price_settlement: 100,
    }],
    total_display: 91.74,
    total_settlement: 100,
    rate_source: 'ecb' as const,
    created_at: NOW,
    status: 'draft' as const,
  };

  it('accepts a valid multi-currency invoice', () => {
    expect(multiCurrencyInvoiceSchema.safeParse(validInvoice).success).toBe(true);
  });

  it('rejects empty line items', () => {
    const result = multiCurrencyInvoiceSchema.safeParse({ ...validInvoice, line_items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid tenant_id', () => {
    const result = multiCurrencyInvoiceSchema.safeParse({ ...validInvoice, tenant_id: 'bad' });
    expect(result.success).toBe(false);
  });

  it('defaults status to draft', () => {
    const { status: _, ...withoutStatus } = validInvoice;
    const result = multiCurrencyInvoiceSchema.safeParse(withoutStatus);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
    }
  });
});

describe('isRateStale', () => {
  it('returns false for a recently fetched rate', () => {
    const now = new Date('2026-07-20T13:00:00Z');
    expect(isRateStale('2026-07-20T12:00:00Z', now)).toBe(false);
  });

  it('returns true for a rate older than 24 hours', () => {
    const now = new Date('2026-07-22T00:00:00Z');
    expect(isRateStale('2026-07-20T12:00:00Z', now)).toBe(true);
  });

  it('returns false for exactly 24 hours (boundary)', () => {
    const now = new Date('2026-07-21T12:00:00Z');
    expect(isRateStale('2026-07-20T12:00:00Z', now)).toBe(false);
  });
});

describe('roundForCurrency', () => {
  it('rounds USD to 2 decimal places', () => {
    expect(roundForCurrency(10.456, 'USD')).toBe(10.46);
  });

  it('rounds JPY to 0 decimal places', () => {
    expect(roundForCurrency(1234.56, 'JPY')).toBe(1235);
  });

  it('rounds KRW to 0 decimal places', () => {
    expect(roundForCurrency(50000.4, 'KRW')).toBe(50000);
  });

  it('rounds BHD to 3 decimal places', () => {
    expect(roundForCurrency(1.2345, 'BHD')).toBe(1.235);
  });

  it('handles zero correctly', () => {
    expect(roundForCurrency(0, 'USD')).toBe(0);
  });
});

describe('getDecimalPlaces', () => {
  it('returns 0 for JPY', () => expect(getDecimalPlaces('JPY')).toBe(0));
  it('returns 0 for KRW', () => expect(getDecimalPlaces('KRW')).toBe(0));
  it('returns 3 for BHD', () => expect(getDecimalPlaces('BHD')).toBe(3));
  it('returns 2 for USD', () => expect(getDecimalPlaces('USD')).toBe(2));
  it('returns 2 for EUR', () => expect(getDecimalPlaces('EUR')).toBe(2));
});

describe('SUPPORTED_CURRENCIES', () => {
  it('contains at least 15 currencies', () => {
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(15);
  });

  it('has metadata for all supported currencies', () => {
    for (const code of SUPPORTED_CURRENCIES) {
      expect(CURRENCY_INFO[code]).toBeDefined();
      expect(CURRENCY_INFO[code].name).toBeTruthy();
      expect(CURRENCY_INFO[code].symbol).toBeTruthy();
    }
  });
});
