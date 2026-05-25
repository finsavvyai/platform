import { describe, it, expect } from 'vitest';
import {
  SWG_CATEGORIES,
  getCategory,
  alwaysOnCategories,
  normaliseCategoryIds,
} from './categories.js';

describe('SWG_CATEGORIES catalog', () => {
  it('every category has all required fields', () => {
    for (const c of SWG_CATEGORIES) {
      expect(c.id).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(10);
      expect(c.riskScore).toBeGreaterThanOrEqual(0);
      expect(c.riskScore).toBeLessThanOrEqual(100);
      expect(c.shallaPath).toMatch(/^[a-z0-9_/\-]+$/);
      expect(typeof c.alwaysOn).toBe('boolean');
    }
  });

  it('has no duplicate ids', () => {
    const ids = SWG_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the expected eight canonical categories', () => {
    const ids = SWG_CATEGORIES.map((c) => c.id).sort();
    expect(ids).toEqual([
      'adult',
      'anonymizers',
      'cryptocurrency-mining',
      'file-sharing',
      'gambling',
      'malware',
      'phishing',
      'social-media',
    ]);
  });

  it('marks malware, phishing, and crypto-mining as always-on', () => {
    const alwaysOnIds = alwaysOnCategories()
      .map((c) => c.id)
      .sort();
    expect(alwaysOnIds).toEqual(['cryptocurrency-mining', 'malware', 'phishing']);
  });
});

describe('getCategory', () => {
  it('returns the category for a known id', () => {
    expect(getCategory('malware')?.riskScore).toBe(100);
  });
  it('returns undefined for unknown ids', () => {
    expect(getCategory('does-not-exist')).toBeUndefined();
  });
});

describe('normaliseCategoryIds', () => {
  it('lowercases, trims, dedupes, and sorts known ids', () => {
    const out = normaliseCategoryIds(['Malware', ' phishing ', 'malware', 'gambling']);
    expect(out.known).toEqual(['gambling', 'malware', 'phishing']);
    expect(out.unknown).toEqual([]);
  });

  it('reports unknown ids separately', () => {
    const out = normaliseCategoryIds(['malware', 'bogus', 'nope']);
    expect(out.known).toEqual(['malware']);
    expect(out.unknown).toEqual(['bogus', 'nope']);
  });

  it('drops empty / whitespace-only entries', () => {
    const out = normaliseCategoryIds(['', '  ', 'malware']);
    expect(out.known).toEqual(['malware']);
    expect(out.unknown).toEqual([]);
  });
});
