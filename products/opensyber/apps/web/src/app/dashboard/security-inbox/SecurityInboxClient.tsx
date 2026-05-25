'use client';

import { useState, useMemo, useEffect } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './types';
import type { Category, Severity, Status, InboxItem } from './types';
import { ALL_CATEGORIES, ALL_SEVERITIES, ALL_STATUSES, STATUS_LABELS } from './types';
import { InboxCard } from './InboxCard';
import { fetchSecurityInbox } from './fetch-inbox';

export function SecurityInboxClient(): React.ReactElement {
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityInbox()
      .then((realItems) => {
        if (realItems.length) setItems(realItems);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    return items
      .filter((item) => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
        if (statusFilter !== 'all' && item.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [items, categoryFilter, severityFilter, statusFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = { vulnerability: 0, misconfiguration: 0, incident: 0, identity: 0, compliance: 0, agent: 0 };
    for (const item of items) counts[item.category]++;
    return counts;
  }, [items]);

  function handleSnooze(id: string): void {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'snoozed' as Status } : i)));
  }

  function handleDismiss(id: string): void {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading security data...
        </div>
      )}

      <div>
        <h1 className="text-4xl font-bold">Security Inbox</h1>
        <p className="mt-2 text-neutral-400">Unified, prioritized list of what to fix next across all finding types.</p>
      </div>

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Inbox className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Security Inbox Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing security findings. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
            <p className="text-lg font-medium mb-4">{items.length} items need attention</p>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((cat) => (
                <span key={cat} className={`rounded-md px-2.5 py-1 text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_LABELS[cat]}: {categoryCounts[cat]}
                </span>
              ))}
            </div>
          </div>

          <InboxFilters
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />

          <div className="space-y-3">
            {visible.map((item) => (
              <InboxCard
                key={item.id}
                item={item}
                onInvestigate={() => {}}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
              />
            ))}
            {visible.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <Inbox className="h-8 w-8 text-neutral-600 mb-3" />
                <p className="text-neutral-400 text-sm">No items match your filters</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InboxFilters({ categoryFilter, setCategoryFilter, severityFilter, setSeverityFilter, statusFilter, setStatusFilter }: {
  categoryFilter: Category | 'all'; setCategoryFilter: (v: Category | 'all') => void;
  severityFilter: Severity | 'all'; setSeverityFilter: (v: Severity | 'all') => void;
  statusFilter: Status | 'all'; setStatusFilter: (v: Status | 'all') => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setCategoryFilter('all')} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${categoryFilter === 'all' ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'}`}>All</button>
        {ALL_CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${categoryFilter === cat ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'}`}>{CATEGORY_LABELS[cat]}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Severity:</span>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')} className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
          <option value="all">All</option>
          {ALL_SEVERITIES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Status:</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status | 'all')} className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">
          <option value="all">All</option>
          {ALL_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABELS[s]}</option>))}
        </select>
      </div>
    </div>
  );
}
