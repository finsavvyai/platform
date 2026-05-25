import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ExchangeRateService,
  InMemoryRateProvider,
} from '../exchange-rate-service';

function createTestProvider(): InMemoryRateProvider {
  const provider = new InMemoryRateProvider();
  provider.setRate('USD_EUR', 0.92);
  provider.setRate('USD_GBP', 0.79);
  provider.setRate('USD_JPY', 149.5);
  provider.setRate('EUR_USD', 1.087);
  return provider;
}

describe('InMemoryRateProvider', () => {
  it('returns a configured rate', async () => {
    const provider = createTestProvider();
    expect(await provider.getRate('USD', 'EUR')).toBe(0.92);
  });

  it('throws for unconfigured pair', async () => {
    const provider = createTestProvider();
    await expect(provider.getRate('USD', 'ZZZ')).rejects.toThrow('Rate not available');
  });

  it('returns all rates for a base currency', async () => {
    const provider = createTestProvider();
    const rates = await provider.getRates('USD');
    expect(rates).toEqual({ EUR: 0.92, GBP: 0.79, JPY: 149.5 });
  });

  it('allows setting rates dynamically', async () => {
    const provider = new InMemoryRateProvider();
    provider.setRate('GBP_USD', 1.27);
    expect(await provider.getRate('GBP', 'USD')).toBe(1.27);
  });
});

describe('ExchangeRateService', () => {
  let provider: InMemoryRateProvider;
  let service: ExchangeRateService;

  beforeEach(() => {
    provider = createTestProvider();
    service = new ExchangeRateService(provider, 60_000);
  });

  it('fetches rate from provider', async () => {
    const rate = await service.getRate('USD', 'EUR');
    expect(rate.rate).toBe(0.92);
    expect(rate.source_currency).toBe('USD');
    expect(rate.target_currency).toBe('EUR');
  });

  it('returns rate 1 for same-currency conversion', async () => {
    const rate = await service.getRate('USD', 'USD');
    expect(rate.rate).toBe(1);
    expect(rate.source).toBe('manual');
  });

  it('caches rate on second call', async () => {
    const spy = vi.spyOn(provider, 'getRate');
    await service.getRate('USD', 'EUR');
    await service.getRate('USD', 'EUR');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', async () => {
    const spy = vi.spyOn(provider, 'getRate');
    const shortTTL = new ExchangeRateService(provider, 1);
    await shortTTL.getRate('USD', 'EUR');
    await new Promise((r) => setTimeout(r, 10));
    await shortTTL.getRate('USD', 'EUR');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('falls back to last-known-good on provider failure', async () => {
    // Use a short-TTL service so cache expires quickly
    const shortService = new ExchangeRateService(provider, 1);
    // First call populates both cache and lastKnownGood
    await shortService.getRate('USD', 'EUR');
    // Wait for cache to expire
    await new Promise((r) => setTimeout(r, 10));
    // Mock provider to fail on next call
    vi.spyOn(provider, 'getRate').mockRejectedValue(new Error('Network error'));
    const rate = await shortService.getRate('USD', 'EUR');
    expect(rate.source).toBe('fallback');
    expect(rate.rate).toBe(0.92);
  });

  it('throws when no fallback available', async () => {
    vi.spyOn(provider, 'getRate').mockRejectedValue(new Error('fail'));
    await expect(service.getRate('USD', 'ZZZ')).rejects.toThrow('No rate available');
  });

  it('isStale returns true for uncached pairs', () => {
    expect(service.isStale('USD', 'EUR')).toBe(true);
  });

  it('isStale returns false after fetching', async () => {
    await service.getRate('USD', 'EUR');
    expect(service.isStale('USD', 'EUR')).toBe(false);
  });
});

describe('ExchangeRateService.convertAmount', () => {
  it('converts USD to EUR', async () => {
    const provider = createTestProvider();
    const service = new ExchangeRateService(provider);
    const result = await service.convertAmount(100, 'USD', 'EUR');
    expect(result.converted).toBe(92);
    expect(result.rate.rate).toBe(0.92);
  });

  it('converts USD to JPY with zero decimals', async () => {
    const provider = createTestProvider();
    const service = new ExchangeRateService(provider);
    const result = await service.convertAmount(100, 'USD', 'JPY');
    expect(result.converted).toBe(14950);
    expect(Number.isInteger(result.converted)).toBe(true);
  });

  it('returns same amount for same currency', async () => {
    const provider = createTestProvider();
    const service = new ExchangeRateService(provider);
    const result = await service.convertAmount(55.55, 'USD', 'USD');
    expect(result.converted).toBe(55.55);
  });
});

describe('ExchangeRateService.refreshRates', () => {
  it('populates cache for all base rates', async () => {
    const provider = createTestProvider();
    const service = new ExchangeRateService(provider);
    const rates = await service.refreshRates('USD');
    expect(rates).toEqual({ EUR: 0.92, GBP: 0.79, JPY: 149.5 });
    expect(service.isStale('USD', 'EUR')).toBe(false);
    expect(service.isStale('USD', 'GBP')).toBe(false);
  });
});
