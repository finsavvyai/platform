'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, AlertTriangle, Search, FileWarning } from 'lucide-react';
import { ChainVisualization } from './ChainVisualization';
import { SeverityBadge } from './SeverityBadge';
import type { ToxicCombination } from './types';

interface Props {
  combination: ToxicCombination;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CombinationCard({ combination }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { title, severity, blastRadius, chain, detectedAt } = combination;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 transition hover:border-neutral-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <SeverityBadge severity={severity} />
            <span className="text-xs text-neutral-500">{timeAgo(detectedAt)}</span>
          </div>
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Affects {blastRadius.assets} assets, {blastRadius.dataStores} data stores
          </p>
        </div>
      </div>

      {/* Chain visualization */}
      <ChainVisualization chain={chain} />

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 mt-4 transition"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {chain.length} individual risks
      </button>

      {/* Expanded risk list */}
      {expanded && (
        <ul className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
          {chain.map((node) => (
            <li key={node.id} className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
              <span className="text-neutral-300">{node.label}</span>
              <SeverityBadge severity={node.severity} small />
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-neutral-800">
        <Link
          href="/dashboard/security-graph"
          className="flex items-center gap-1.5 rounded-lg bg-info/10 px-3 py-1.5 text-xs font-medium text-info hover:bg-info/20 transition"
        >
          <Search className="h-3.5 w-3.5" />
          Investigate
        </Link>
        <Link
          href="/dashboard/security/incidents"
          className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 transition"
        >
          <FileWarning className="h-3.5 w-3.5" />
          Create Incident
        </Link>
      </div>
    </div>
  );
}
