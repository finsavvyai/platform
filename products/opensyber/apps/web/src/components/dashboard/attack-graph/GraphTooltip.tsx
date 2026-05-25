'use client';

import { X } from 'lucide-react';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  name: string;
  assetType: string;
  sensitivity: string;
  isCrownJewel: boolean;
  hops: number;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  node: LayoutNode;
  viewBox: ViewBox;
  svgWidth: number;
  svgHeight: number;
  onDismiss: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  agent_session: 'Agent Session',
  file: 'File',
  env_var: 'Environment Variable',
  cloud_resource: 'Cloud Resource',
  secret: 'Secret',
  database: 'Database',
  saas_app: 'SaaS Application',
};

export function GraphTooltip({ node, viewBox, svgWidth, svgHeight, onDismiss }: Props) {
  const screenX = ((node.x - viewBox.x) / viewBox.w) * svgWidth;
  const screenY = ((node.y - viewBox.y) / viewBox.h) * svgHeight;

  const tooltipW = 220;
  const tooltipH = 130;
  const left = Math.max(8, Math.min(screenX - tooltipW / 2, svgWidth - tooltipW - 8));
  const above = screenY - tooltipH - 30;
  const top = above > 8 ? above : screenY + 30;

  return (
    <div
      className="absolute z-10 rounded-lg border border-wire bg-panel p-3 shadow-xl"
      style={{ left, top, width: tooltipW }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-white truncate pr-2">{node.name}</h4>
        <button
          onClick={onDismiss}
          className="text-text-secondary hover:text-white shrink-0"
          aria-label="Close tooltip"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1 text-xs text-text-secondary">
        <Row label="Type" value={TYPE_LABELS[node.assetType] ?? node.assetType} />
        <Row label="Sensitivity" value={node.sensitivity} />
        <Row label="Hops from entry" value={String(node.hops)} />
        <Row label="ID" value={node.id.slice(0, 12) + '...'} />
        {node.isCrownJewel && (
          <span className="inline-block mt-1 text-amber-400 font-medium">Crown Jewel</span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-dim">{label}</span>
      <span className="text-text-primary capitalize">{value}</span>
    </div>
  );
}
