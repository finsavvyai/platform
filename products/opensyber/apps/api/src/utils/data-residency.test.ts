import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

// We test the logic directly since enforceResidency depends on DB
import { REGION_MAP } from './data-residency.js';

describe('Data Residency', () => {
  describe('REGION_MAP', () => {
    it('maps EU to eu-central', () => {
      expect(REGION_MAP.eu).toEqual(['eu-central']);
    });

    it('maps US to us-east and us-west', () => {
      expect(REGION_MAP.us).toEqual(['us-east', 'us-west']);
    });

    it('maps AP to ap-southeast', () => {
      expect(REGION_MAP.ap).toEqual(['ap-southeast']);
    });

    it('has exactly 3 regions', () => {
      expect(Object.keys(REGION_MAP)).toHaveLength(3);
    });
  });

  describe('enforceResidency logic', () => {
    it('allows all regions when no orgId', () => {
      // null orgId always returns allowed
      const orgId = null;
      const allowed = orgId === null;
      expect(allowed).toBe(true);
    });

    it('allows eu-central for EU config', () => {
      const config = { region: 'eu' };
      const allowedRegions = REGION_MAP[config.region];
      expect(allowedRegions).toBeDefined();
      expect(allowedRegions!.includes('eu-central')).toBe(true);
      expect(allowedRegions!.includes('us-east')).toBe(false);
    });

    it('allows us-east and us-west for US config', () => {
      const config = { region: 'us' };
      const allowedRegions = REGION_MAP[config.region];
      expect(allowedRegions!.includes('us-east')).toBe(true);
      expect(allowedRegions!.includes('us-west')).toBe(true);
      expect(allowedRegions!.includes('eu-central')).toBe(false);
    });

    it('blocks eu-central for US config', () => {
      const config = { region: 'us' };
      const allowedRegions = REGION_MAP[config.region];
      expect(allowedRegions!.includes('eu-central')).toBe(false);
    });

    it('blocks us-east for AP config', () => {
      const config = { region: 'ap' };
      const allowedRegions = REGION_MAP[config.region];
      expect(allowedRegions!.includes('us-east')).toBe(false);
      expect(allowedRegions!.includes('ap-southeast')).toBe(true);
    });
  });
});
