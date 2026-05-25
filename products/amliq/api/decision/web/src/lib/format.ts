/**
 * Pure formatters for the Investigate analyst console.
 *
 * - `formatMoneyMinor(minor, currency)` — money minor units → display.
 *   Never accepts floats; rejects non-integer with a thrown error
 *   (decimals indicate a caller bug, not user input). Negative values are
 *   permitted (refunds / reversals). Currency assumed ISO-4217 alpha-3.
 * - `formatTimestamp(iso)` — ISO-8601 → YYYY-MM-DD HH:mm UTC.
 * - `scoreColor(score)` — 0..100 score → semantic risk tier name
 *   ("low" / "medium" / "high"). Drives the EngineScoreBadge visual.
 * - `actionLabel(action)` — `RecommendedAction` → display label.
 *
 * 100% coverage target on this module — see format.test.ts.
 *
 * IMPORTANT: This module is dependency-free, tree-shakeable, and safe to
 * import from both Astro components (build-time) and the browser at
 * runtime once an SSR adapter is wired.
 */
import type {
  MoneyMinor,
  RecommendedAction,
  RiskTier,
} from './types.js';

/** Symbols for common currencies; falls back to ISO code otherwise. */
const CURRENCY_SYMBOL: Readonly<Record<string, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  ILS: '₪',
  JPY: '¥',
};

const MINOR_UNITS_2 = 100;

/**
 * Convert money in integer minor units to a display string.
 * Throws if `minor` is not a finite integer — the decision-API contract
 * guarantees integers, so a non-integer reaching the UI is a bug.
 */
export const formatMoneyMinor = (
  minor: MoneyMinor,
  currency: string,
): string => {
  if (!Number.isFinite(minor) || !Number.isInteger(minor)) {
    throw new TypeError(
      `formatMoneyMinor: expected integer minor units, got ${String(minor)}`,
    );
  }
  const cur = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur];
  const isNeg = minor < 0;
  const abs = Math.abs(minor);
  // JPY-style zero-decimal currencies — extend as needed.
  const isZeroDecimal = cur === 'JPY';
  const major = isZeroDecimal ? abs : Math.floor(abs / MINOR_UNITS_2);
  const remainder = isZeroDecimal ? 0 : abs % MINOR_UNITS_2;
  const majorStr = major.toLocaleString('en-US');
  const fraction = isZeroDecimal
    ? ''
    : `.${remainder.toString().padStart(2, '0')}`;
  const sign = isNeg ? '-' : '';
  return symbol
    ? `${sign}${symbol}${majorStr}${fraction}`
    : `${sign}${majorStr}${fraction} ${cur}`;
};

/**
 * ISO-8601 timestamp → "YYYY-MM-DD HH:mm UTC". Stable, sortable, locale-
 * independent. Returns the input string unchanged if Date parsing fails
 * (defensive — never throw on a display path).
 */
export const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${y}-${mo}-${da} ${hh}:${mm} UTC`;
};

const pad2 = (n: number): string => n.toString().padStart(2, '0');

/**
 * Score (0..100) → risk tier. Cutoffs match the round-1 decision contract:
 * < 40 → low, 40..84 → medium, >= 85 → high.
 * Out-of-range scores clamp to the nearest tier.
 */
export const scoreColor = (score: number): RiskTier => {
  if (!Number.isFinite(score)) return 'low';
  if (score < 40) return 'low';
  if (score < 85) return 'medium';
  return 'high';
};

/** Pretty label for the analyst console pill. */
export const actionLabel = (action: RecommendedAction): string => {
  switch (action) {
    case 'allow':
      return 'Allow';
    case 'flag':
      return 'Flag for review';
    case 'block':
      return 'Block';
  }
};
