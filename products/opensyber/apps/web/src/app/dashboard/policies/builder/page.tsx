'use client';

import { useEffect, useState, useCallback } from 'react';
import { Layers, Plus, Search } from 'lucide-react';
import type { RulePack, RulePackCategory, RuleCondition, RuleAction } from './builder-types';
import { CATEGORY_LABELS } from './builder-types';
import { RulePackCard } from './RulePackCard';
import { RuleComposer } from './RuleComposer';

const CATEGORIES: RulePackCategory[] = ['ai_security', 'cloud_posture', 'dev_environment', 'compliance'];

export default function RuleBuilderPage() {
  const [packs, setPacks] = useState<RulePack[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<RulePackCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<RulePack | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [packsRes, instancesRes] = await Promise.all([
        fetch('/api/proxy/rule-packs').then((r) => r.json()) as Promise<{ packs: RulePack[] }>,
        fetch('/api/proxy/instances').then((r) => r.json()) as Promise<{ instances: Array<{ id: string }> }>,
      ]);
      setPacks(packsRes.packs);
      const instId = instancesRes.instances[0]?.id ?? null;
      setInstanceId(instId);
      if (instId) {
        const installed = await fetch(`/api/proxy/rule-packs/instances/${instId}/active-packs`).then((r) => r.json()) as { installedPacks: Array<{ packId: string }> };
        setInstalledIds(new Set(installed.installedPacks.map((p) => p.packId)));
      }
    } catch (err) { console.error('[PolicyBuilder] Failed to load rule packs:', err instanceof Error ? err.message : err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleInstall(packId: string) {
    if (!instanceId) return;
    setInstalling(packId);
    try {
      await fetch('/api/proxy/rule-packs/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, instanceId }),
      });
      setInstalledIds((prev) => new Set([...prev, packId]));
    } catch (err) { console.error('[PolicyBuilder] Failed to install rule pack:', err instanceof Error ? err.message : err); }
    finally { setInstalling(null); }
  }

  async function handleSaveCustomRule(rule: { name: string; conditions: RuleCondition[]; actions: RuleAction[] }) {
    if (!instanceId) return;
    setSaving(true);
    try {
      const severity = rule.actions[0]?.config?.severity ?? 'medium';
      await fetch(`/api/proxy/security/instances/${instanceId}/alert-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rule.name,
          eventType: String(rule.conditions[0]?.value ?? 'custom'),
          severityFilter: severity,
          threshold: 1, windowMinutes: 60, cooldownMinutes: 30,
        }),
      });
      setShowComposer(false);
    } catch (err) { console.error('[PolicyBuilder] Failed to save custom rule:', err instanceof Error ? err.message : err); }
    finally { setSaving(false); }
  }

  const filtered = packs.filter((p) => {
    if (filter !== 'all' && p.category !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-info" />
      </div>
    );
  }

  return (
    <div>
      <Header onCreateRule={() => setShowComposer(true)} />
      <Filters filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} />
      {filtered.length === 0 ? <EmptyState /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pack) => (
            <RulePackCard key={pack.id} pack={pack} isInstalled={installedIds.has(pack.id)}
              installing={installing === pack.id} onInstall={handleInstall} onPreview={setPreview} />
          ))}
        </div>
      )}
      {preview && <PreviewModal pack={preview} onClose={() => setPreview(null)} />}
      {showComposer && <RuleComposer onSave={handleSaveCustomRule} onClose={() => setShowComposer(false)} saving={saving} />}
    </div>
  );
}

function Header({ onCreateRule }: { onCreateRule: () => void }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Policy Rule Builder</h1>
        <p className="mt-1 text-sm text-text-secondary">Install pre-built rule packs or compose custom detection rules.</p>
      </div>
      <button onClick={onCreateRule} className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition">
        <Plus className="h-4 w-4" /> Custom Rule
      </button>
    </div>
  );
}

function Filters({ filter, setFilter, search, setSearch }: {
  filter: RulePackCategory | 'all'; setFilter: (f: RulePackCategory | 'all') => void;
  search: string; setSearch: (s: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2 flex-wrap">
        {(['all', ...CATEGORIES] as const).map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === cat ? 'bg-signal text-white' : 'bg-surface text-text-secondary hover:bg-neutral-700'}`}>
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packs..."
          className="rounded-lg border border-wire bg-surface pl-9 pr-3 py-1.5 text-sm text-neutral-200 placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-signal w-56" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-border bg-panel/30 p-12 text-center">
      <Layers className="mx-auto mb-4 h-12 w-12 text-text-dim" />
      <p className="text-lg font-medium text-text-secondary">No rule packs match your filter</p>
      <p className="mt-2 text-sm text-text-dim">Try a different category or search term.</p>
    </div>
  );
}

function PreviewModal({ pack, onClose }: { pack: RulePack; onClose: () => void }) {
  let rules: Array<{ name: string; conditions: Array<{ field: string; operator: string; value: unknown }> }> = [];
  try { rules = JSON.parse(pack.rules); } catch { /* skip */ }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded border border-border bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-neutral-100 mb-2">{pack.name}</h2>
        <p className="text-sm text-text-secondary mb-4">{pack.description}</p>
        <div className="space-y-3">
          {rules.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface/30 p-3">
              <p className="text-sm font-medium text-neutral-200 mb-1">{r.name}</p>
              {r.conditions?.map((cond, j) => (
                <p key={j} className="text-xs text-text-dim">
                  IF <span className="text-text-primary">{cond.field}</span>{' '}
                  <span className="text-amber-400">{cond.operator}</span>{' '}
                  <span className="text-signal">{String(cond.value)}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-wire py-2 text-sm text-text-secondary hover:bg-surface transition">Close</button>
      </div>
    </div>
  );
}
