'use client';

import { useState } from 'react';
import { Database, Crown, Filter, Search } from 'lucide-react';
import type { AssetRecord } from '../attack-paths/types';

const SENSITIVITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-amber-500/20 text-amber-400',
  medium: 'bg-signal/20 text-signal',
  low: 'bg-neutral-500/20 text-text-secondary',
  info: 'bg-neutral-600/20 text-text-dim',
};

const TYPE_LABEL: Record<string, string> = {
  file: 'File', env_var: 'Env Var', cloud_resource: 'Cloud', secret: 'Secret',
  database: 'Database', saas_app: 'SaaS', agent_session: 'Agent',
};

interface Props {
  initialAssets: AssetRecord[];
}

export function AssetsClient({ initialAssets }: Props) {
  const [assets] = useState(initialAssets);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sensFilter, setSensFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = assets.filter((a) => {
    if (typeFilter !== 'all' && a.assetType !== typeFilter) return false;
    if (sensFilter !== 'all' && a.sensitivity !== sensFilter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())
      && !a.identifier.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const types = [...new Set(assets.map((a) => a.assetType))];
  const sensitivities = [...new Set(assets.map((a) => a.sensitivity))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Database className="h-8 w-8 text-signal" /> Asset Inventory
        </h1>
        <p className="mt-2 text-text-secondary">{assets.length} assets discovered across all sources.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-dim" />
          <input
            type="text" placeholder="Search assets..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-dim" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm">
            <option value="all">All Types</option>
            {types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
          </select>
          <select value={sensFilter} onChange={(e) => setSensFilter(e.target.value)}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm">
            <option value="all">All Sensitivity</option>
            {sensitivities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded border border-border overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
          <thead>
            <tr className="bg-panel/50 border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-dim uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-dim uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-dim uppercase">Sensitivity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-dim uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-dim uppercase">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-text-dim">No assets match filters.</td></tr>
            ) : filtered.map((a) => (
              <tr key={a.id} className="hover:bg-surface/30 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {a.isCrownJewel && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                    <span className="font-medium truncate max-w-[200px]">{a.name}</span>
                  </div>
                  <p className="text-xs text-text-dim truncate max-w-[200px]">{a.identifier}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">{TYPE_LABEL[a.assetType] ?? a.assetType}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${SENSITIVITY_BADGE[a.sensitivity] ?? ''}`}>
                    {a.sensitivity}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary text-xs">{a.discoverySource}</td>
                <td className="px-4 py-3 text-text-dim text-xs">
                  {new Date(a.lastSeenAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
