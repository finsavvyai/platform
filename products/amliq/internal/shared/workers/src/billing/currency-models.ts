/**
 * Multi-Currency Domain Models and Validation Schemas
 * ISO 4217 currency support with exchange rate tracking,
 * currency conversion, and multi-currency invoice models.
 */

import { z } from 'zod';

// --- ISO 4217 Currency Constants ---

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF',
  'CNY', 'INR', 'BRL', 'MXN', 'KRW', 'SGD', 'HKD', 'SEK',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Zero-decimal currencies that have no fractional units. */
export const ZERO_DECIMAL_CURRENCIES = ['JPY', 'KRW'] as const;

/** Three-decimal currencies. */
export const THREE_DECIMAL_CURRENCIES = ['BHD', 'KWD', 'OMR'] as const;

export function getDecimalPlaces(currency: string): number {
  if ((ZERO_DECIMAL_CURRENCIES as readonly string[]).includes(currency)) return 0;
  if ((THREE_DECIMAL_CURRENCIES as readonly string[]).includes(currency)) return 3;
  return 2;
}

// --- Currency Metadata ---

export const CURRENCY_INFO: Record<string, { name: string; symbol: string; flag: string }> = {
  USD: { name: 'US Dollar', symbol: '$', flag: '\u{1F1FA}\u{1F1F8}' },
  EUR: { name: 'Euro', symbol: '\u20AC', flag: '\u{1F1EA}\u{1F1FA}' },
  GBP: { name: 'British Pound', symbol: '\u00A3', flag: '\u{1F1EC}\u{1F1E7}' },
  JPY: { name: 'Japanese Yen', symbol: '\u00A5', flag: '\u{1F1EF}\u{1F1F5}' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$', flag: '\u{1F1E8}\u{1F1E6}' },
  AUD: { name: 'Australian Dollar', symbol: 'A$', flag: '\u{1F1E6}\u{1F1FA}' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF', flag: '\u{1F1E8}\u{1F1ED}' },
  CNY: { name: 'Chinese Yuan', symbol: '\u00A5', flag: '\u{1F1E8}\u{1F1F3}' },
  INR: { name: 'Indian Rupee', symbol: '\u20B9', flag: '\u{1F1EE}\u{1F1F3}' },
  BRL: { name: 'Brazilian Real', symbol: 'R$', flag: '\u{1F1E7}\u{1F1F7}' },
  MXN: { name: 'Mexican Peso', symbol: 'MX$', flag: '\u{1F1F2}\u{1F1FD}' },
  KRW: { name: 'South Korean Won', symbol: '\u20A9', flag: '\u{1F1F0}\u{1F1F7}' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', flag: '\u{1F1F8}\u{1F1EC}' },
  HKD: { name: 'Hong Kong Dollar', symbol: 'HK$', flag: '\u{1F1ED}\u{1F1F0}' },
  SEK: { name: 'Swedish Krona', symbol: 'kr', flag: '\u{1F1F8}\u{1F1EA}' },
};

// --- Zod Schemas ---

const iso4217Schema = z.string().length(3).regex(
  /^[A-Z]{3}$/, 'Must be a valid ISO 4217 currency code',
);

export const exchangeRateSchema = z.object({
  source_currency: iso4217Schema,
  target_currency: iso4217Schema,
  rate: z.number().positive('Exchange rate must be positive'),
  source: z.enum(['ecb', 'fixer', 'manual', 'fallback']),
  fetched_at: z.string().datetime(),
}).refine(
  (data) => data.source_currency !== data.target_currency,
  { message: 'Source and target currencies must differ', path: ['target_currency'] },
);

export type ExchangeRate = z.infer<typeof exchangeRateSchema>;

export const currencyConversionSchema = z.object({
  original_amount: z.number().nonnegative('Amount must be non-negative'),
  original_currency: iso4217Schema,
  converted_amount: z.number().nonnegative('Converted amount must be non-negative'),
  target_currency: iso4217Schema,
  rate_used: z.number().positive('Rate must be positive'),
  converted_at: z.string().datetime(),
});

export type CurrencyConversion = z.infer<typeof currencyConversionSchema>;

export const multiCurrencyInvoiceSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID required'),
  tenant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  display_currency: iso4217Schema,
  settlement_currency: iso4217Schema,
  exchange_rate_at_creation: z.number().positive('Rate must be positive'),
  line_items: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unit_price_display: z.number().nonnegative(),
    unit_price_settlement: z.number().nonnegative(),
  })).min(1, 'At least one line item required'),
  total_display: z.number().nonnegative(),
  total_settlement: z.number().nonnegative(),
  rate_source: z.enum(['ecb', 'fixer', 'manual', 'fallback']),
  created_at: z.string().datetime(),
  status: z.enum(['draft', 'issued', 'paid', 'voided']).default('draft'),
});

export type MultiCurrencyInvoice = z.infer<typeof multiCurrencyInvoiceSchema>;

// --- Rate Staleness Check ---

const RATE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isRateStale(fetchedAt: string, now: Date = new Date()): boolean {
  const fetched = new Date(fetchedAt);
  return now.getTime() - fetched.getTime() > RATE_MAX_AGE_MS;
}

/** Round an amount to the correct decimal places for a currency. */
export function roundForCurrency(amount: number, currency: string): number {
  const decimals = getDecimalPlaces(currency);
  const factor = Math.pow(10, decimals);
  const result = Math.round(amount * factor) / factor;
  return result === 0 ? 0 : result;
}
