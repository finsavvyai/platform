'use client';

import { useState, useMemo, useEffect } from 'react';
import { Zap, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { CombinationCard } from './CombinationCard';
import type { Severity, ToxicCombination } from './types';
import { fetchToxicCombinations } from './fetch-toxic';

const SEVERITY_FILTERS: Severity[] = ['critical', 'high', 'medium'];
const ASSET_TYPES = ['all', 'agent', 'cloud', 'container', 'application', 'network'];
type SortOption = 'severity' | 'blast-radius' | 'age';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };

export function ToxicCombinationsClient() {
  const [combos, setCombos] = useState<ToxicCombination[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(new Set(SEVERITY_FILTERS));
  const [assetFilter, setAssetFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('severity');

  useEffect(() => {
    fetchToxicCombinations()
      .then((real) => { if (real?.length) setCombos(real); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0 };
    for (const tc of combos) c[tc.severity]++;
    return c;
  }, [combos]);

  const filtered = useMemo(() => {
    let items = combos.filter(
      (tc) => severityFilter.has(tc.severity) && (assetFilter === 'all' || tc.assetType === assetFilter),
    );
    if (sort === 'severity') items = [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    else if (sort === 'blast-radius') items = [...items].sort((a, b) => b.blastRadius.assets - a.blastRadius.assets);
    else items = [...items].sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    return items;
  }, [combos, severityFilter, assetFilter, sort]);

  function toggleSeverity(s: Severity) {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading toxic combinations...
        </div>
      )}
      {/* Page header */}
      <div>
        <h1 className="text-4xl font-bold">Toxic Combinations</h1>
        <p className="mt-2 text-neutral-400">
          Chains of medium-severity risks that combine into critical findings with real blast radius.
        </p>
      </div>

      {!loading && combos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Zap className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Toxic Combinations Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing toxic risk combinations. Data will appear here automatically.
          </p>
        </div>
      ) : (
      <>
      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Zap} label="Total Combinations" value={combos.length} color="text-red-500" />
        <StatCard icon={AlertTriangle} label="Critical" value={counts.critical} color="text-red-400" />
        <StatCard icon={AlertCircle} label="High" value={counts.high} color="text-amber-400" />
        <StatCard icon={Info} label="Medium" value={counts.medium} color="text-info" />
      </div>

      {/* Filters */}
      <FilterBar
        severityFilter={severityFilter}
        toggleSeverity={toggleSeverity}
        assetFilter={assetFilter}
        setAssetFilter={setAssetFilter}
        sort={sort}
        setSort={setSort}
      />

      {/* Combination cards */}
      <div className="space-y-4">
        {filtered.map((tc) => (
          <CombinationCard key={tc.id} combination={tc} />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Zap className="h-8 w-8 text-neutral-600 mb-3" />
            <p className="text-neutral-400 text-sm">No combinations match current filters.</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Zap; label: string; value: number; color: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function FilterBar({ severityFilter, toggleSeverity, assetFilter, setAssetFilter, sort, setSort }: {
  severityFilter: Set<Severity>; toggleSeverity: (s: Severity) => void;
  assetFilter: string; setAssetFilter: (v: string) => void;
  sort: SortOption; setSort: (v: SortOption) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Severity:</span>
        {SEVERITY_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => toggleSeverity(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
              severityFilter.has(s) ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Asset:</span>
        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Sort:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
        >
          <option value="severity">Severity</option>
          <option value="blast-radius">Blast Radius</option>
          <option value="age">Most Recent</option>
        </select>
      </div>
    </div>
  );
}
