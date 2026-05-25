import { describe, it, expect } from 'vitest';
import { computeFeedMeta, computeFeedStats } from './threat-intel-stats.js';
import type { ThreatEntry } from './threat-intel-types.js';

function makeEntry(overrides: Partial<ThreatEntry> = {}): ThreatEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type: 'ioc',
    title: 'Test Entry',
    description: 'A test threat entry.',
    severity: 'high',
    source: 'opensyber-research',
    indicators: [{ type: 'ip', value: '1.2.3.4', confidence: 90 }],
    tags: [],
    publishedAt: now,
    updatedAt: now,
    autoBlockEnabled: false,
    ...overrides,
  };
}

describe('computeFeedMeta', () => {
  it('returns zeroed meta for empty entries', () => {
    const meta = computeFeedMeta([]);
    expect(meta.totalIocs).toBe(0);
    expect(meta.feedSources).toEqual([]);
    expect(meta.autoBlockRules).toBe(0);
  });

  it('counts total IOCs across all entries', () => {
    const entries = [
      makeEntry({ indicators: [
        { type: 'ip', value: '1.1.1.1', confidence: 80 },
        { type: 'domain', value: 'evil.com', confidence: 90 },
      ] }),
      makeEntry({ indicators: [{ type: 'hash', value: 'abc123', confidence: 95 }] }),
    ];
    const meta = computeFeedMeta(entries);
    expect(meta.totalIocs).toBe(3);
  });

  it('deduplicates feed sources', () => {
    const entries = [
      makeEntry({ source: 'nvd' }),
      makeEntry({ source: 'nvd' }),
      makeEntry({ source: 'circl' }),
    ];
    const meta = computeFeedMeta(entries);
    expect(meta.feedSources).toHaveLength(2);
    expect(meta.feedSources).toContain('nvd');
    expect(meta.feedSources).toContain('circl');
  });

  it('counts auto-block rules', () => {
    const entries = [
      makeEntry({ autoBlockEnabled: true }),
      makeEntry({ autoBlockEnabled: false }),
      makeEntry({ autoBlockEnabled: true }),
    ];
    const meta = computeFeedMeta(entries);
    expect(meta.autoBlockRules).toBe(2);
  });

  it('finds the latest updatedAt timestamp', () => {
    const old = '2026-01-01T00:00:00.000Z';
    const recent = '2026-04-30T12:00:00.000Z';
    const entries = [
      makeEntry({ updatedAt: old }),
      makeEntry({ updatedAt: recent }),
    ];
    const meta = computeFeedMeta(entries);
    expect(meta.lastUpdated).toBe(recent);
  });
});

describe('computeFeedStats', () => {
  it('returns zeroed stats for empty entries', () => {
    const stats = computeFeedStats([]);
    expect(stats.totalEntries).toBe(0);
    expect(stats.last24h).toBe(0);
    expect(stats.last7d).toBe(0);
    expect(stats.autoBlockedToday).toBe(0);
    expect(stats.topSources).toEqual([]);
  });

  it('counts entries by time window', () => {
    const now = Date.now();
    const hour = 3_600_000;
    const day = 24 * hour;
    const entries = [
      makeEntry({ publishedAt: new Date(now - 1 * hour).toISOString() }),
      makeEntry({ publishedAt: new Date(now - 2 * day).toISOString() }),
      makeEntry({ publishedAt: new Date(now - 10 * day).toISOString() }),
    ];
    const stats = computeFeedStats(entries);
    expect(stats.totalEntries).toBe(3);
    expect(stats.last24h).toBe(1);
    expect(stats.last7d).toBe(2);
  });

  it('aggregates by type and severity', () => {
    const entries = [
      makeEntry({ type: 'campaign', severity: 'critical' }),
      makeEntry({ type: 'campaign', severity: 'high' }),
      makeEntry({ type: 'ioc', severity: 'critical' }),
    ];
    const stats = computeFeedStats(entries);
    expect(stats.byType).toEqual({ campaign: 2, ioc: 1 });
    expect(stats.bySeverity).toEqual({ critical: 2, high: 1 });
  });

  it('sorts topSources by count descending', () => {
    const entries = [
      makeEntry({ source: 'nvd' }),
      makeEntry({ source: 'circl' }),
      makeEntry({ source: 'nvd' }),
      makeEntry({ source: 'nvd' }),
      makeEntry({ source: 'community' }),
    ];
    const stats = computeFeedStats(entries);
    expect(stats.topSources[0]).toEqual({ name: 'nvd', count: 3 });
    expect(stats.topSources[1]).toEqual({ name: 'circl', count: 1 });
  });

  it('counts auto-blocked entries in last 24h', () => {
    const now = Date.now();
    const entries = [
      makeEntry({ publishedAt: new Date(now - 3_600_000).toISOString(), autoBlockEnabled: true }),
      makeEntry({ publishedAt: new Date(now - 3_600_000).toISOString(), autoBlockEnabled: false }),
      makeEntry({ publishedAt: new Date(now - 3_600_000).toISOString(), autoBlockEnabled: true }),
    ];
    const stats = computeFeedStats(entries);
    expect(stats.autoBlockedToday).toBe(2);
  });
});
