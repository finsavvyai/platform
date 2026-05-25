/**
 * Multi-Currency Invoice Generation
 * Creates invoices with per-line currency conversion, exchange rate
 * snapshots, and currency-specific formatting for audit compliance.
 */

import type { ExchangeRate, MultiCurrencyInvoice } from './currency-models';
import { roundForCurrency, multiCurrencyInvoiceSchema } from './currency-models';
import type { ExchangeRateService } from './exchange-rate-service';

// --- Input Types ---

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreateMultiCurrencyInvoiceInput {
  tenant_id: string;
  customer_id: string;
  display_currency: string;
  settlement_currency: string;
  line_items: InvoiceLineInput[];
}

// --- Invoice Generator ---

export async function createMultiCurrencyInvoice(
  input: CreateMultiCurrencyInvoiceInput,
  rateService: ExchangeRateService,
): Promise<MultiCurrencyInvoice> {
  const { display_currency, settlement_currency } = input;
  const rate = await rateService.getRate(settlement_currency, display_currency);

  const convertedItems = input.line_items.map((item) =>
    convertLineItem(item, rate, display_currency, settlement_currency),
  );

  const totalSettlement = roundForCurrency(
    convertedItems.reduce((s, i) => s + i.unit_price_settlement * i.quantity, 0),
    settlement_currency,
  );
  const totalDisplay = roundForCurrency(
    convertedItems.reduce((s, i) => s + i.unit_price_display * i.quantity, 0),
    display_currency,
  );

  const invoice = {
    invoice_id: generateInvoiceId(),
    tenant_id: input.tenant_id,
    customer_id: input.customer_id,
    display_currency,
    settlement_currency,
    exchange_rate_at_creation: rate.rate,
    line_items: convertedItems,
    total_display: totalDisplay,
    total_settlement: totalSettlement,
    rate_source: rate.source,
    created_at: new Date().toISOString(),
    status: 'draft' as const,
  };

  const parsed = multiCurrencyInvoiceSchema.safeParse(invoice);
  if (!parsed.success) {
    throw new Error(`Invoice validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

// --- Currency Formatting ---

export function formatCurrencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: getMinFraction(currency),
      maximumFractionDigits: getMaxFraction(currency),
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// --- Internal Helpers ---

function convertLineItem(
  item: InvoiceLineInput,
  rate: ExchangeRate,
  displayCurrency: string,
  settlementCurrency: string,
) {
  const unitPriceSettlement = roundForCurrency(item.unit_price, settlementCurrency);
  const unitPriceDisplay = roundForCurrency(item.unit_price * rate.rate, displayCurrency);

  return {
    description: item.description,
    quantity: item.quantity,
    unit_price_display: unitPriceDisplay,
    unit_price_settlement: unitPriceSettlement,
  };
}

function getMinFraction(currency: string): number {
  const zeroDecimal = ['JPY', 'KRW'];
  if (zeroDecimal.includes(currency)) return 0;
  return 2;
}

function getMaxFraction(currency: string): number {
  const zeroDecimal = ['JPY', 'KRW'];
  const threeDecimal = ['BHD', 'KWD', 'OMR'];
  if (zeroDecimal.includes(currency)) return 0;
  if (threeDecimal.includes(currency)) return 3;
  return 2;
}

function generateInvoiceId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'inv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}
