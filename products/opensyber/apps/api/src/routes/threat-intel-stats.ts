/**
 * Threat Intelligence Stats Computation
 *
 * Pure functions to compute feed statistics from stored entries.
 */
import type { ThreatEntry, FeedMeta, FeedStats } from './threat-intel-types.js';

/** Compute feed metadata from entries */
export function computeFeedMeta(entries: ThreatEntry[]): FeedMeta {
  let totalIocs = 0;
  let autoBlockRules = 0;
  const sourceSet = new Set<string>();

  for (const entry of entries) {
    totalIocs += entry.indicators.length;
    if (entry.autoBlockEnabled) autoBlockRules++;
    sourceSet.add(entry.source);
  }

  const lastUpdated = entries.length > 0
    ? entries.reduce((latest, e) =>
        e.updatedAt > latest ? e.updatedAt : latest, entries[0]!.updatedAt)
    : new Date().toISOString();

  return {
    totalIocs,
    lastUpdated,
    feedSources: Array.from(sourceSet),
    autoBlockRules,
  };
}

/** Compute aggregate feed statistics from entries */
export function computeFeedStats(entries: ThreatEntry[]): FeedStats {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const cutoff24h = now - day;
  const cutoff7d = now - 7 * day;

  let last24h = 0;
  let last7d = 0;
  let autoBlockedToday = 0;
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};

  for (const entry of entries) {
    const ts = new Date(entry.publishedAt).getTime();
    if (ts >= cutoff24h) {
      last24h++;
      if (entry.autoBlockEnabled) autoBlockedToday++;
    }
    if (ts >= cutoff7d) last7d++;

    byType[entry.type] = (byType[entry.type] ?? 0) + 1;
    bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
    sourceCounts[entry.source] = (sourceCounts[entry.source] ?? 0) + 1;
  }

  const topSources = Object.entries(sourceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEntries: entries.length,
    last24h,
    last7d,
    byType,
    bySeverity,
    topSources,
    autoBlockedToday,
  };
}
