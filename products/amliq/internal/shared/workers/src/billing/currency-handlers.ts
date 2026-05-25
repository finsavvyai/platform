/**
 * Multi-Currency API Handlers
 * REST handlers for currency operations: list currencies, get rates,
 * create multi-currency invoices, view settlement reconciliation.
 * Follows the pattern from dunning-handlers.ts and revrec-handlers.ts.
 */

import { z } from 'zod';
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  getDecimalPlaces,
} from './currency-models';
import type { ExchangeRateService } from './exchange-rate-service';
import { createMultiCurrencyInvoice } from './currency-invoice';
import type { SettlementRecord } from './currency-settlement';
import { calculateMonthlySummary } from './currency-settlement';

// --- Request/Response types (matching existing handler pattern) ---

export interface CurrencyRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  tenantId: string;
  userRole: string;
}

export interface CurrencyResponse {
  status: number;
  body: unknown;
}

// --- Validation Schemas ---

const baseCurrencyQuery = z.object({
  base: z.string().length(3).regex(/^[A-Z]{3}$/).default('USD'),
});

const createInvoiceBody = z.object({
  customer_id: z.string().uuid(),
  display_currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  settlement_currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  line_items: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
  })).min(1),
});

const reconciliationQuery = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
});

// --- Store interface ---

export interface SettlementStore {
  listByPeriod(tenantId: string, period: string): Promise<SettlementRecord[]>;
}

// --- Handler factories ---

/** GET /api/v1/currencies -- list supported currencies with formatting info. */
export function createListCurrenciesHandler() {
  return async (_req: CurrencyRequest): Promise<CurrencyResponse> => {
    const currencies = SUPPORTED_CURRENCIES.map((code) => ({
      code,
      name: CURRENCY_INFO[code]?.name ?? code,
      symbol: CURRENCY_INFO[code]?.symbol ?? code,
      flag: CURRENCY_INFO[code]?.flag ?? '',
      decimal_places: getDecimalPlaces(code),
    }));

    return { status: 200, body: { data: currencies, count: currencies.length } };
  };
}

/** GET /api/v1/currencies/rates?base=USD -- get exchange rates. */
export function createGetRatesHandler(rateService: ExchangeRateService) {
  return async (req: CurrencyRequest): Promise<CurrencyResponse> => {
    const parsed = baseCurrencyQuery.safeParse(req.query ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    try {
      const rates = await rateService.refreshRates(parsed.data.base);
      return { status: 200, body: { data: { base: parsed.data.base, rates } } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch rates';
      return { status: 502, body: { error: msg } };
    }
  };
}

/** POST /api/v1/invoices/multi-currency -- create a multi-currency invoice. */
export function createMultiCurrencyInvoiceHandler(rateService: ExchangeRateService) {
  return async (req: CurrencyRequest): Promise<CurrencyResponse> => {
    const parsed = createInvoiceBody.safeParse(req.body);
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    try {
      const invoice = await createMultiCurrencyInvoice(
        { ...parsed.data, tenant_id: req.tenantId },
        rateService,
      );
      return { status: 201, body: { data: invoice } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invoice creation failed';
      return { status: 500, body: { error: msg } };
    }
  };
}

/** GET /api/v1/settlements/reconciliation?period=2026-07. */
export function createReconciliationHandler(store: SettlementStore) {
  return async (req: CurrencyRequest): Promise<CurrencyResponse> => {
    const parsed = reconciliationQuery.safeParse(req.query ?? {});
    if (!parsed.success) {
      return { status: 400, body: { error: 'Validation failed', details: parsed.error.issues } };
    }

    const records = await store.listByPeriod(req.tenantId, parsed.data.period);
    const summary = calculateMonthlySummary(records, parsed.data.period, 'USD');
    return { status: 200, body: { data: summary, records } };
  };
}
