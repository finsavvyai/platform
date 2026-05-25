'use client';

import { X, ArrowRight, ArrowLeft, Search, AlertTriangle, Eye } from 'lucide-react';
import { NODE_COLORS, NODE_LABELS } from './graph-types';
import type { GraphNode, GraphEdge } from './graph-types';

interface Props {
  node: GraphNode;
  edges: GraphEdge[];
  allNodes: GraphNode[];
  onClose: () => void;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-info/10 text-info',
};

export function GraphDetailPanel({ node, edges, allNodes, onClose }: Props) {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const incoming = edges
    .filter((e) => e.target === node.id)
    .map((e) => ({ edge: e, peer: nodeMap.get(e.source) }));
  const outgoing = edges
    .filter((e) => e.source === node.id)
    .map((e) => ({ edge: e, peer: nodeMap.get(e.target) }));

  return (
    <div className="flex h-full w-80 flex-col border-l border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 p-4">
        <h3 className="text-sm font-medium">Node Details</h3>
        <button onClick={onClose} className="text-neutral-500 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="space-y-2">
          <p className="text-lg font-medium">{node.name}</p>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${NODE_COLORS[node.type]}20`, color: NODE_COLORS[node.type] }}
            >
              {NODE_LABELS[node.type]}
            </span>
            <RiskBadge score={node.riskScore} />
          </div>
        </div>

        <MetadataSection metadata={node.metadata} />
        <ConnectionSection title="Incoming" items={incoming} icon={<ArrowLeft className="h-3 w-3" />} />
        <ConnectionSection title="Outgoing" items={outgoing} icon={<ArrowRight className="h-3 w-3" />} />
        <FindingsSection findings={node.findings} />
        <QuickActions />
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-amber-400' : 'text-green-400';
  return <span className={`text-xs font-medium ${color}`}>Risk: {score}</span>;
}

function MetadataSection({ metadata }: { metadata: Record<string, string> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400">Metadata</p>
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-neutral-500">{k}</span>
            <span className="text-neutral-300">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionSection({
  title, items, icon,
}: { title: string; items: { edge: GraphEdge; peer?: GraphNode }[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400">{title} ({items.length})</p>
      <div className="space-y-1">
        {items.map(({ edge, peer }) => (
          <div key={edge.id} className="flex items-center gap-1.5 text-xs text-neutral-300">
            {icon}
            <span>{peer?.name ?? 'Unknown'}</span>
            <span className="text-neutral-600">({edge.label})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingsSection({ findings }: { findings: GraphNode['findings'] }) {
  if (findings.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400">Findings ({findings.length})</p>
      <div className="space-y-1.5">
        {findings.map((f) => (
          <div key={f.id} className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-xs text-neutral-300">{f.title}</p>
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${severityColors[f.severity]}`}>
                {f.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: 'Investigate', icon: Search },
    { label: 'Add to Watchlist', icon: Eye },
  ];
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-400">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 transition"
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}
