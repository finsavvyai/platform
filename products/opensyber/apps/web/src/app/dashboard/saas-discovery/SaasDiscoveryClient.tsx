'use client';

import { useState, useMemo, useEffect } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import type { SaasApp } from './types';
import { INITIALS_COLORS } from './types';
import { StatsRow } from './StatsRow';
import { SaasFilters } from './SaasFilters';
import { SaasAppCard } from './SaasAppCard';
import { ShadowAISection } from './ShadowAISection';

export function SaasDiscoveryClient(): React.ReactElement {
  const [apps, setApps] = useState<SaasApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [shadowOnly, setShadowOnly] = useState(false);

  useEffect(() => {
    fetch('/api/proxy/saas/accounts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.data) && d.data.length) {
          setApps(d.data.map(mapApiSaasApp));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (riskFilter !== 'All' && a.riskLevel !== riskFilter) return false;
      if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
      if (shadowOnly && !a.isShadowAI) return false;
      return true;
    });
  }, [apps, search, riskFilter, categoryFilter, shadowOnly]);

  function handleRevoke(id: string): void {
    setApps((prev) => prev.filter((a) => a.id !== id));
  }

  function handleBlock(id: string): void {
    setApps((prev) => prev.filter((a) => a.id !== id));
  }

  function handleAllow(id: string): void {
    setApps((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, isShadowAI: false, riskLevel: 'Low' as const } : a
      )
    );
  }

  return (
    <div className="space-y-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading SaaS data...
        </div>
      )}

      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Globe className="h-8 w-8 text-info" />
          SaaS Discovery
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Continuously discovers SaaS applications connected to your
          organization. Identifies shadow AI tools, risky OAuth grants,
          and unauthorized data flows.
        </p>
      </div>

      {!loading && apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Globe className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No SaaS Discovery Data Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start discovering SaaS applications. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <StatsRow apps={apps} />
          <ShadowAISection apps={apps} onBlock={handleBlock} onAllow={handleAllow} />
          <SaasFilters
            search={search} onSearchChange={setSearch}
            riskFilter={riskFilter} onRiskChange={setRiskFilter}
            categoryFilter={categoryFilter} onCategoryChange={setCategoryFilter}
            shadowOnly={shadowOnly} onShadowToggle={setShadowOnly}
          />

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center">
              <Globe className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
              <p className="text-lg font-medium text-neutral-400">No SaaS apps match your filters</p>
              <p className="mt-2 text-sm text-neutral-600">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((app) => (
                <SaasAppCard key={app.id} app={app} onRevoke={handleRevoke} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function mapApiSaasApp(a: Record<string, unknown>, idx: number): SaasApp {
  const name = String(a.name ?? a.appName ?? 'Unknown');
  const initials = name.slice(0, 2).toUpperCase();
  const validRisks = ['Critical', 'High', 'Medium', 'Low', 'Safe'];
  const validCats = ['Productivity', 'AI', 'DevTools', 'Communication', 'Storage'];
  const risk = validRisks.includes(String(a.riskLevel)) ? String(a.riskLevel) : 'Medium';
  const cat = validCats.includes(String(a.category)) ? String(a.category) : 'Productivity';

  return {
    id: String(a.id ?? idx),
    name,
    initials,
    color: INITIALS_COLORS[idx % INITIALS_COLORS.length],
    category: cat as SaasApp['category'],
    riskLevel: risk as SaasApp['riskLevel'],
    users: Number(a.users ?? a.userCount ?? 0),
    oauthPermissions: String(a.oauthPermissions ?? a.permissions ?? 'Unknown permissions'),
    isShadowAI: Boolean(a.isShadowAI ?? a.shadowAI ?? false),
    lastSeen: String(a.lastSeen ?? a.lastActivity ?? new Date().toISOString()),
  };
}
