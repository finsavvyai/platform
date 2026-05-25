/**
 * Exchange Rate Service with Caching and Fallback
 * Fetches rates from configurable providers, caches with TTL,
 * and falls back to last-known-good rates on failure.
 */

import type { ExchangeRate } from './currency-models';
import { roundForCurrency } from './currency-models';

// --- Provider Interface ---

export interface RateProvider {
  /** Fetch rate for a single currency pair. */
  getRate(source: string, target: string): Promise<number>;
  /** Fetch all rates for a base currency. */
  getRates(base: string): Promise<Record<string, number>>;
}

// --- In-Memory Rate Provider (for testing) ---

export class InMemoryRateProvider implements RateProvider {
  private rates: Map<string, number>;

  constructor(rates: Record<string, number> = {}) {
    this.rates = new Map(Object.entries(rates));
  }

  setRate(pair: string, rate: number): void {
    this.rates.set(pair, rate);
  }

  async getRate(source: string, target: string): Promise<number> {
    const key = `${source}_${target}`;
    const rate = this.rates.get(key);
    if (rate === undefined) {
      throw new Error(`Rate not available for ${key}`);
    }
    return rate;
  }

  async getRates(base: string): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.rates.entries()) {
      if (key.startsWith(`${base}_`)) {
        const target = key.split('_')[1];
        result[target] = value;
      }
    }
    return result;
  }
}

// --- Cache Entry ---

interface CacheEntry {
  rate: number;
  fetchedAt: Date;
  source: ExchangeRate['source'];
}

// --- Exchange Rate Service ---

export class ExchangeRateService {
  private provider: RateProvider;
  private cache = new Map<string, CacheEntry>();
  private lastKnownGood = new Map<string, CacheEntry>();
  private ttlMs: number;

  constructor(provider: RateProvider, ttlMs: number = 3600_000) {
    this.provider = provider;
    this.ttlMs = ttlMs;
  }

  /** Get the exchange rate for a currency pair. Uses cache when fresh. */
  async getRate(source: string, target: string): Promise<ExchangeRate> {
    if (source === target) {
      return this.buildRate(source, target, 1, 'manual');
    }

    const key = `${source}_${target}`;
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return this.buildRate(source, target, cached.rate, cached.source);
    }

    try {
      const rate = await this.provider.getRate(source, target);
      const entry: CacheEntry = { rate, fetchedAt: new Date(), source: 'ecb' };
      this.cache.set(key, entry);
      this.lastKnownGood.set(key, entry);
      return this.buildRate(source, target, rate, 'ecb');
    } catch {
      return this.fallback(source, target);
    }
  }

  /** Convert an amount between currencies. */
  async convertAmount(
    amount: number, source: string, target: string,
  ): Promise<{ converted: number; rate: ExchangeRate }> {
    const rate = await this.getRate(source, target);
    const converted = roundForCurrency(amount * rate.rate, target);
    return { converted, rate };
  }

  /** Force-refresh all rates for a base currency. */
  async refreshRates(base: string): Promise<Record<string, number>> {
    const rates = await this.provider.getRates(base);
    const now = new Date();
    for (const [target, rate] of Object.entries(rates)) {
      const key = `${base}_${target}`;
      const entry: CacheEntry = { rate, fetchedAt: now, source: 'ecb' };
      this.cache.set(key, entry);
      this.lastKnownGood.set(key, entry);
    }
    return rates;
  }

  /** Check whether a cached rate is stale (older than TTL). */
  isStale(source: string, target: string): boolean {
    const cached = this.cache.get(`${source}_${target}`);
    return !cached || this.isExpired(cached);
  }

  // --- Internal ---

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.fetchedAt.getTime() > this.ttlMs;
  }

  private fallback(source: string, target: string): ExchangeRate {
    const key = `${source}_${target}`;
    const last = this.lastKnownGood.get(key);
    if (last) {
      return this.buildRate(source, target, last.rate, 'fallback');
    }
    throw new Error(`No rate available for ${source}/${target} and no fallback`);
  }

  private buildRate(
    source: string, target: string, rate: number,
    rateSource: ExchangeRate['source'],
  ): ExchangeRate {
    return {
      source_currency: source,
      target_currency: source === target ? source : target,
      rate,
      source: rateSource,
      fetched_at: new Date().toISOString(),
    };
  }
}
