import { CurrencyMismatchError } from "../errors.js";
import type { Currency, Money } from "../types.js";

/**
 * Money math in integer minor units only. Never float currency.
 *
 * Tax rates and quantities are non-money scalars and may be fractional, but
 * all rounding here is banker's rounding (round half to even) to avoid drift
 * across many small line items. The caller is responsible for the final
 * rounding policy if it differs.
 */

export function money(amountMinor: number, currency: Currency): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError(
      `Money amount must be integer minor units, got ${amountMinor}`,
    );
  }
  return { amountMinor, currency };
}

export function zero(currency: Currency): Money {
  return { amountMinor: 0, currency };
}

function sameCurrencyOrThrow(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, b: Money): Money {
  sameCurrencyOrThrow(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  sameCurrencyOrThrow(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function multiplyByQuantity(price: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new TypeError(`Quantity must be a non-negative integer, got ${qty}`);
  }
  return { amountMinor: price.amountMinor * qty, currency: price.currency };
}

/**
 * Apply a tax rate to a Money amount. `rate` is a decimal fraction, e.g.
 * 0.17 for 17% VAT. Result is rounded with banker's rounding to the
 * nearest minor unit.
 */
export function applyTaxRate(base: Money, rate: number): Money {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new TypeError(`Tax rate must be a non-negative finite number, got ${rate}`);
  }
  const raw = base.amountMinor * rate;
  return { amountMinor: bankersRound(raw), currency: base.currency };
}

export function sumMoney(items: readonly Money[], currency: Currency): Money {
  let total = 0;
  for (const m of items) {
    if (m.currency !== currency) {
      throw new CurrencyMismatchError(currency, m.currency);
    }
    total += m.amountMinor;
  }
  return { amountMinor: total, currency };
}

export function equalsMoney(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

/** Round-half-to-even — IEEE 754 default; minimizes cumulative bias. */
export function bankersRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly .5 — round to even.
  return floor % 2 === 0 ? floor : floor + 1;
}
