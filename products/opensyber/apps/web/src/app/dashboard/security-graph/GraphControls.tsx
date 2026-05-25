'use client';

import { Search, Layers, AlertTriangle, Download } from 'lucide-react';
import { ALL_NODE_TYPES, NODE_COLORS, NODE_LABELS } from './graph-types';
import type { NodeType } from './graph-types';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  activeTypes: Set<NodeType>;
  onToggleType: (t: NodeType) => void;
  layout: 'force' | 'hierarchical';
  onLayoutChange: (l: 'force' | 'hierarchical') => void;
  highlightRisks: boolean;
  onToggleRisks: () => void;
  onExport: () => void;
}

export function GraphControls({
  search, onSearchChange, activeTypes, onToggleType,
  layout, onLayoutChange, highlightRisks, onToggleRisks, onExport,
}: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes..."
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2 pl-10 pr-4 text-sm focus:border-signal focus:outline-none"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-neutral-400">Node Types</p>
        <div className="flex flex-wrap gap-2">
          {ALL_NODE_TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={activeTypes.has(t)}
                onChange={() => onToggleType(t)}
                className="rounded border-neutral-700"
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: NODE_COLORS[t] }}
              />
              <span className="text-neutral-300">{NODE_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onLayoutChange(layout === 'force' ? 'hierarchical' : 'force')}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 transition"
        >
          <Layers className="h-3.5 w-3.5" />
          {layout === 'force' ? 'Hierarchical' : 'Force-Directed'}
        </button>
        <button
          onClick={onToggleRisks}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
            highlightRisks
              ? 'border-red-500 bg-red-500/10 text-red-400'
              : 'border-neutral-700 hover:bg-neutral-800'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Highlight Risks
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 transition"
        >
          <Download className="h-3.5 w-3.5" />
          Export PNG
        </button>
      </div>
    </div>
  );
}
