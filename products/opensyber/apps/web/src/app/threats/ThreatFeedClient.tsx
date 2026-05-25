'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Radio, Shield, Clock, Database, ShieldCheck } from 'lucide-react';
import { ThreatEntryCard } from './ThreatEntryCard';
import type { ThreatEntry, FeedMeta, FeedStats, FilterTab } from './threat-intel-types';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'campaign', label: 'Campaigns' },
  { key: 'ioc', label: 'IOCs' },
  { key: 'technique', label: 'Techniques' },
  { key: 'advisory', label: 'Advisories' },
];

export default function ThreatFeedClient() {
  const [entries, setEntries] = useState<ThreatEntry[]>([]);
  const [meta, setMeta] = useState<FeedMeta | null>(null);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/threat-intel/feed');
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data ?? []);
        setMeta(json.meta ?? null);
      }
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/threat-intel/stats');
      if (res.ok) {
        const json = await res.json();
        setStats(json.data ?? null);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: loaders are useCallbacks, setLoading runs after Promise.all resolves
    Promise.all([fetchFeed(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchFeed, fetchStats]);

  const filtered = activeTab === 'all'
    ? entries
    : entries.filter((e) => e.type === activeTab);

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <HeroHeader />
        {loading ? <LoadingSpinner /> : (
          <div className="space-y-8">
            {meta && <StatsBar meta={meta} stats={stats} />}
            <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <p className="text-center text-text-dim py-12">No entries found.</p>
              ) : (
                filtered.map((entry, i) => (
                  <ThreatEntryCard key={entry.id} entry={entry} index={i} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroHeader() {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-4xl font-bold">Threat Intelligence Feed</h1>
        <motion.div
          className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Radio className="h-3 w-3 text-red-400" />
          <span className="text-xs font-medium text-red-400">LIVE</span>
        </motion.div>
      </div>
      <p className="text-sm text-text-secondary max-w-2xl">
        Live indicators of compromise for AI agent security. Updated continuously from
        OpenSyber Research, NVD, and CIRCL.
      </p>
    </div>
  );
}

function StatsBar({ meta, stats }: { meta: FeedMeta; stats: FeedStats | null }) {
  const cards = [
    { icon: Database, label: 'Total IOCs', value: meta.totalIocs, color: 'text-signal' },
    { icon: Clock, label: 'Last Updated', value: formatTimeShort(meta.lastUpdated), color: 'text-amber-400' },
    { icon: Shield, label: 'Feed Sources', value: meta.feedSources.length, color: 'text-purple-400' },
    { icon: ShieldCheck, label: 'Auto-Block Rules', value: meta.autoBlockRules, color: 'text-green-400' },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, color }, i) => (
        <motion.div
          key={label}
          className="rounded border border-border bg-panel/30 p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
            <Icon className={`h-4 w-4 ${color}`} /> {label}
          </div>
          <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </motion.div>
      ))}
    </div>
  );
}

function FilterTabs({ activeTab, onTabChange }: {
  activeTab: FilterTab; onTabChange: (t: FilterTab) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-border pb-px">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
            activeTab === key
              ? 'text-signal border-b-2 border-signal bg-signal/5'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-info" />
    </div>
  );
}

function formatTimeShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
