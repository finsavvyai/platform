import { describe, it, expect } from 'vitest';
import { DEFAULT_RBI_POLICIES, getPolicyById, validatePolicies } from './policies.js';

describe('DEFAULT_RBI_POLICIES', () => {
  it('every policy has required fields', () => {
    for (const p of DEFAULT_RBI_POLICIES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.urlPatterns.length).toBeGreaterThan(0);
      expect(['isolate', 'block', 'allow']).toContain(p.action);
      expect(typeof p.priority).toBe('number');
      if (p.action === 'isolate') {
        expect(p.kasmImageId).toBeTruthy();
        expect(p.durationSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('has no duplicate ids', () => {
    const ids = DEFAULT_RBI_POLICIES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains a default ("*") fallback policy', () => {
    const def = DEFAULT_RBI_POLICIES.find((p) => p.urlPatterns.includes('*'));
    expect(def).toBeDefined();
  });

  it('getPolicyById returns the matching policy', () => {
    expect(getPolicyById('allow-default')?.action).toBe('allow');
    expect(getPolicyById('isolate-anonymizers')?.action).toBe('isolate');
    expect(getPolicyById('does-not-exist')).toBeUndefined();
  });
});

describe('validatePolicies', () => {
  it('passes for the bundled default set', () => {
    expect(validatePolicies(DEFAULT_RBI_POLICIES)).toEqual([]);
  });

  it('flags duplicate ids', () => {
    const issues = validatePolicies([
      { ...DEFAULT_RBI_POLICIES[0]! },
      { ...DEFAULT_RBI_POLICIES[0]! },
    ]);
    expect(issues.some((s) => s.includes('duplicate id'))).toBe(true);
  });

  it('flags isolate without kasmImageId', () => {
    const issues = validatePolicies([
      {
        id: 'broken',
        name: 'x',
        description: 'x',
        urlPatterns: ['*.evil'],
        action: 'isolate',
        kasmImageId: '',
        durationSeconds: 100,
        priority: 1,
      },
    ]);
    expect(issues.some((s) => s.includes('kasmImageId'))).toBe(true);
  });

  it('flags missing urlPatterns', () => {
    const issues = validatePolicies([
      {
        id: 'empty',
        name: 'x',
        description: 'x',
        urlPatterns: [],
        action: 'allow',
        kasmImageId: '',
        durationSeconds: 0,
        priority: 1,
      },
    ]);
    expect(issues.some((s) => s.includes('urlPatterns'))).toBe(true);
  });

  it('flags bad id format', () => {
    const issues = validatePolicies([
      {
        id: 'BAD_ID',
        name: 'x',
        description: 'x',
        urlPatterns: ['a'],
        action: 'allow',
        kasmImageId: '',
        durationSeconds: 0,
        priority: 1,
      },
    ]);
    expect(issues.some((s) => s.includes('bad id'))).toBe(true);
  });
});
