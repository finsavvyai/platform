import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSmartSort, groupByTier } from './useSmartSort';
import type { Alert } from '../types';

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 'a1',
  entity: { name: { fullName: 'Test', firstName: 'Test', lastName: '' }, type: 'individual', nationality: 'US' },
  status: 'open',
  priority: 'medium',
  riskLevel: 'medium',
  matchedCount: 1,
  evidenceCount: 1,
  notes: '',
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  updatedAt: new Date().toISOString(),
  ...overrides,
} as Alert);

describe('useSmartSort', () => {
  it('default mode returns all alerts with urgency scores', () => {
    const alerts = [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2' })];
    const { result } = renderHook(() => useSmartSort(alerts, 'default'));
    expect(result.current).toHaveLength(2);
    expect(result.current[0].urgencyScore).toBeGreaterThan(0);
  });

  it('oldest mode sorts by createdAt ascending', () => {
    const old = makeAlert({ id: 'old', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() });
    const fresh = makeAlert({ id: 'fresh', createdAt: new Date().toISOString() });
    const { result } = renderHook(() => useSmartSort([fresh, old], 'oldest'));
    expect(result.current[0].id).toBe('old');
    expect(result.current[1].id).toBe('fresh');
  });

  it('smart mode: critical before medium', () => {
    const critical = makeAlert({ id: 'c1', riskLevel: 'critical', status: 'open' });
    const medium = makeAlert({ id: 'm1', riskLevel: 'medium', status: 'open' });
    const { result } = renderHook(() => useSmartSort([medium, critical], 'smart'));
    expect(result.current[0].id).toBe('c1');
  });

  it('smart mode: investigating alerts go to in-progress tier', () => {
    const investigating = makeAlert({ id: 'i1', status: 'investigating', riskLevel: 'low' });
    const critical = makeAlert({ id: 'c1', riskLevel: 'critical', status: 'open' });
    const { result } = renderHook(() => useSmartSort([investigating, critical], 'smart'));
    expect(result.current[0].urgencyTier).toBe('needs-attention');
    expect(result.current[1].urgencyTier).toBe('in-progress');
  });

  it('smart mode: low risk open alert goes to actionable', () => {
    const low = makeAlert({ id: 'l1', riskLevel: 'low', status: 'open' });
    const { result } = renderHook(() => useSmartSort([low], 'smart'));
    expect(result.current[0].urgencyTier).toBe('actionable');
  });

  it('score includes risk weight', () => {
    const high = makeAlert({ riskLevel: 'high', matchedCount: 0, evidenceCount: 0, createdAt: new Date().toISOString() });
    const low = makeAlert({ riskLevel: 'low', matchedCount: 0, evidenceCount: 0, createdAt: new Date().toISOString() });
    const { result: rh } = renderHook(() => useSmartSort([high], 'default'));
    const { result: rl } = renderHook(() => useSmartSort([low], 'default'));
    expect(rh.current[0].urgencyScore).toBeGreaterThan(rl.current[0].urgencyScore);
  });
});

describe('groupByTier', () => {
  it('splits into three tiers', () => {
    const alerts = [
      { ...makeAlert({ id: 'a', riskLevel: 'critical', status: 'open' }), urgencyScore: 80, urgencyTier: 'needs-attention' as const },
      { ...makeAlert({ id: 'b', status: 'investigating', riskLevel: 'low' }), urgencyScore: 20, urgencyTier: 'in-progress' as const },
      { ...makeAlert({ id: 'c', riskLevel: 'low', status: 'open' }), urgencyScore: 5, urgencyTier: 'actionable' as const },
    ];
    const grouped = groupByTier(alerts);
    expect(grouped['needs-attention']).toHaveLength(1);
    expect(grouped['in-progress']).toHaveLength(1);
    expect(grouped['actionable']).toHaveLength(1);
  });

  it('returns empty arrays for empty tiers', () => {
    const grouped = groupByTier([]);
    expect(grouped['needs-attention']).toHaveLength(0);
    expect(grouped['in-progress']).toHaveLength(0);
    expect(grouped['actionable']).toHaveLength(0);
  });
});
