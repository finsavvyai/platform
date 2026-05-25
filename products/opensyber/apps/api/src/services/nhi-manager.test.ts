/**
 * NHI Manager Service Tests
 */
import { describe, it, expect } from 'vitest';
import {
  calculateRiskScore, isOrphaned, buildSummary, createNhiAgent,
} from './nhi-manager.js';

describe('NHI Manager Service', () => {
  describe('calculateRiskScore', () => {
    it('returns low risk for active owned agent', () => {
      const result = calculateRiskScore({
        type: 'claude_code',
        ownerId: 'user-1',
        lastActiveAt: new Date().toISOString(),
        tokenHash: 'abc123',
      });
      expect(result.score).toBeLessThanOrEqual(25);
      expect(result.level).toBe('low');
    });

    it('increases risk for no owner', () => {
      const result = calculateRiskScore({
        type: 'claude_code',
        ownerId: null,
        lastActiveAt: new Date().toISOString(),
        tokenHash: 'abc123',
      });
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it('increases risk for no token', () => {
      const withToken = calculateRiskScore({
        type: 'cursor',
        ownerId: 'user-1',
        lastActiveAt: new Date().toISOString(),
        tokenHash: 'abc',
      });
      const noToken = calculateRiskScore({
        type: 'cursor',
        ownerId: 'user-1',
        lastActiveAt: new Date().toISOString(),
        tokenHash: null,
      });
      expect(noToken.score).toBeGreaterThan(withToken.score);
    });

    it('increases risk for stale agents (90+ days)', () => {
      const staleDate = new Date(Date.now() - 100 * 86400000).toISOString();
      const result = calculateRiskScore({
        type: 'custom',
        ownerId: 'user-1',
        lastActiveAt: staleDate,
        tokenHash: 'abc',
      });
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('custom type has higher base risk', () => {
      const claude = calculateRiskScore({
        type: 'claude_code',
        ownerId: 'u',
        lastActiveAt: new Date().toISOString(),
        tokenHash: 't',
      });
      const custom = calculateRiskScore({
        type: 'custom',
        ownerId: 'u',
        lastActiveAt: new Date().toISOString(),
        tokenHash: 't',
      });
      expect(custom.score).toBeGreaterThan(claude.score);
    });
  });

  describe('isOrphaned', () => {
    it('returns true for agent with no owner', () => {
      expect(isOrphaned({
        ownerId: null,
        lastActiveAt: new Date().toISOString(),
      })).toBe(true);
    });

    it('returns true for agent inactive 30+ days', () => {
      const old = new Date(Date.now() - 31 * 86400000).toISOString();
      expect(isOrphaned({ ownerId: 'user-1', lastActiveAt: old })).toBe(true);
    });

    it('returns false for active owned agent', () => {
      expect(isOrphaned({
        ownerId: 'user-1',
        lastActiveAt: new Date().toISOString(),
      })).toBe(false);
    });
  });

  describe('buildSummary', () => {
    it('correctly tallies agents by status and risk', () => {
      const agent = createNhiAgent({
        id: 'a1', name: 'A1', type: 'claude_code', ownerId: 'u1',
      });
      const summary = buildSummary([agent]);
      expect(summary.total).toBe(1);
      expect(summary.active).toBe(1);
      expect(summary.suspended).toBe(0);
    });
  });

  describe('createNhiAgent', () => {
    it('creates agent with correct defaults', () => {
      const agent = createNhiAgent({
        id: 'test-id', name: 'Test', type: 'mcp_server', ownerId: 'u1',
      });
      expect(agent.id).toBe('test-id');
      expect(agent.status).toBe('active');
      expect(agent.tokenHash).toBeNull();
      expect(agent.riskScore).toBeGreaterThanOrEqual(0);
    });
  });
});
