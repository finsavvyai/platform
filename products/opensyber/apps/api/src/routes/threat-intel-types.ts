/**
 * Threat Intelligence Feed Types
 *
 * Shared interfaces for the IOC feed, stats, and metadata.
 */

export interface IOC {
  type: 'domain' | 'ip' | 'hash' | 'url' | 'package' | 'cve';
  value: string;
  confidence: number;
}

export interface ThreatEntry {
  id: string;
  type: 'ioc' | 'campaign' | 'technique' | 'advisory';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source: string;
  indicators: IOC[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  autoBlockEnabled: boolean;
}

export interface FeedMeta {
  totalIocs: number;
  lastUpdated: string;
  feedSources: string[];
  autoBlockRules: number;
}

export interface FeedStats {
  totalEntries: number;
  last24h: number;
  last7d: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topSources: Array<{ name: string; count: number }>;
  autoBlockedToday: number;
}
