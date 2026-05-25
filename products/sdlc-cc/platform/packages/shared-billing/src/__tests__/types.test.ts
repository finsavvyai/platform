import { describe, it, expect } from 'vitest';
import {
  BillingError,
  DEFAULT_TIER_CONFIGS,
} from '../types';

describe('BillingError', () => {
  it('constructs with all required fields', () => {
    const ts = new Date();
    const err = new BillingError({
      code: 'TEST_CODE',
      message: 'test message',
      timestamp: ts,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BillingError);
    expect(err.name).toBe('BillingError');
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.timestamp).toBe(ts);
  });

  it('defaults processor to "stripe" when omitted', () => {
    const err = new BillingError({ code: 'X', message: 'x', timestamp: new Date() });
    expect(err.processor).toBe('stripe');
  });

  it('uses provided processor when set', () => {
    const err = new BillingError({
      code: 'X',
      message: 'x',
      processor: 'lemonsqueezy',
      timestamp: new Date(),
    });
    expect(err.processor).toBe('lemonsqueezy');
  });

  it('stores optional details payload', () => {
    const details = { foo: 'bar', count: 42 };
    const err = new BillingError({ code: 'X', message: 'x', details, timestamp: new Date() });
    expect(err.details).toEqual(details);
  });

  it('details is undefined when not provided', () => {
    const err = new BillingError({ code: 'X', message: 'x', timestamp: new Date() });
    expect(err.details).toBeUndefined();
  });
});

describe('DEFAULT_TIER_CONFIGS', () => {
  it('defines all three tiers', () => {
    expect(DEFAULT_TIER_CONFIGS).toHaveProperty('starter');
    expect(DEFAULT_TIER_CONFIGS).toHaveProperty('professional');
    expect(DEFAULT_TIER_CONFIGS).toHaveProperty('enterprise');
  });

  it('starter tier has correct price and currency', () => {
    const { starter } = DEFAULT_TIER_CONFIGS;
    expect(starter.price).toBe(99);
    expect(starter.currency).toBe('USD');
  });

  it('professional tier has correct price and currency', () => {
    const { professional } = DEFAULT_TIER_CONFIGS;
    expect(professional.price).toBe(499);
    expect(professional.currency).toBe('USD');
  });

  it('enterprise tier price is 0 (custom pricing)', () => {
    expect(DEFAULT_TIER_CONFIGS.enterprise.price).toBe(0);
  });

  it('enterprise tier uses -1 for unlimited quotas', () => {
    const { enterprise } = DEFAULT_TIER_CONFIGS;
    expect(enterprise.products.rag.queriesPerMonth).toBe(-1);
    expect(enterprise.products.rag.maxDocuments).toBe(-1);
    expect(enterprise.products.vectorSearch.indexCount).toBe(-1);
    expect(enterprise.products.dlp.scansPerMonth).toBe(-1);
    expect(enterprise.products.api.rateLimit).toBe(-1);
    expect(enterprise.products.api.teamMembers).toBe(-1);
  });

  it('starter tier has GDPR compliance only', () => {
    expect(DEFAULT_TIER_CONFIGS.starter.products.compliance.frameworks).toEqual(['GDPR']);
  });

  it('professional tier compliance includes HIPAA and PCI-DSS', () => {
    const frameworks = DEFAULT_TIER_CONFIGS.professional.products.compliance.frameworks;
    expect(frameworks).toContain('HIPAA');
    expect(frameworks).toContain('PCI-DSS');
  });

  it('enterprise tier compliance includes SOC2 and ISO27001', () => {
    const frameworks = DEFAULT_TIER_CONFIGS.enterprise.products.compliance.frameworks;
    expect(frameworks).toContain('SOC2');
    expect(frameworks).toContain('ISO27001');
  });

  it('professional tier has more team members than starter', () => {
    expect(DEFAULT_TIER_CONFIGS.professional.products.api.teamMembers).toBeGreaterThan(
      DEFAULT_TIER_CONFIGS.starter.products.api.teamMembers,
    );
  });

  it('each tier exposes a features array with at least one item', () => {
    for (const tier of ['starter', 'professional', 'enterprise'] as const) {
      expect(Array.isArray(DEFAULT_TIER_CONFIGS[tier].features)).toBe(true);
      expect(DEFAULT_TIER_CONFIGS[tier].features.length).toBeGreaterThan(0);
    }
  });
});
