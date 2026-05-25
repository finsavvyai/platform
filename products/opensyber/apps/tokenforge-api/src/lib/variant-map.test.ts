import { describe, it, expect } from 'vitest';
import { buildVariantMap } from './variant-map.js';
import { createMockEnv } from '../test/helpers.js';

describe('buildVariantMap', () => {
  it('maps all variant IDs to plans', () => {
    const env = createMockEnv();
    const map = buildVariantMap(env);
    expect(map[100]).toBe('pro');
    expect(map[200]).toBe('team');
    expect(map[300]).toBe('enterprise');
  });

  it('handles missing env vars gracefully', () => {
    const env = createMockEnv({
      TF_LS_VARIANT_PRO: '',
      TF_LS_VARIANT_TEAM: '',
      TF_LS_VARIANT_ENTERPRISE: '',
    });
    const map = buildVariantMap(env);
    // Empty strings parse to NaN which are ignored
    expect(Object.keys(map).length).toBe(0);
  });

  it('parses numeric variant IDs', () => {
    const env = createMockEnv({
      TF_LS_VARIANT_PRO: '12345',
      TF_LS_VARIANT_TEAM: '67890',
      TF_LS_VARIANT_ENTERPRISE: '11111',
    });
    const map = buildVariantMap(env);
    expect(map[12345]).toBe('pro');
    expect(map[67890]).toBe('team');
    expect(map[11111]).toBe('enterprise');
  });

  it('omits a tier when only its env var is missing (partial config supported)', () => {
    const env = createMockEnv({ TF_LS_VARIANT_TEAM: '' });
    const map = buildVariantMap(env);
    expect(map[100]).toBe('pro');
    expect(map[300]).toBe('enterprise');
    // team variant 200 should be absent
    expect(map[200]).toBeUndefined();
    expect(Object.keys(map).length).toBe(2);
  });

  it('does not include "free" — free is the default plan with no variant id', () => {
    const env = createMockEnv();
    const map = buildVariantMap(env);
    expect(Object.values(map)).not.toContain('free');
  });

  it('parseInt strips trailing non-digit chars (LemonSqueezy is numeric IDs only)', () => {
    // parseInt("100abc", 10) === 100 — guards against the env being set to
    // an accidentally appended suffix in a config tool.
    const env = createMockEnv({ TF_LS_VARIANT_PRO: '100abc' });
    const map = buildVariantMap(env);
    expect(map[100]).toBe('pro');
  });

  it('returns an empty object when ALL env vars are missing (fresh self-host)', () => {
    const env = createMockEnv({
      TF_LS_VARIANT_PRO: '',
      TF_LS_VARIANT_TEAM: '',
      TF_LS_VARIANT_ENTERPRISE: '',
    });
    expect(buildVariantMap(env)).toEqual({});
  });
});
