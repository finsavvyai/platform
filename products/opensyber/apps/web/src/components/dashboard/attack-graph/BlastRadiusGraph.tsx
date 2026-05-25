'use client';

import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import type { AssetNode } from '@/app/dashboard/attack-paths/types';
import { useGraphInteraction } from './useGraphInteraction';
import { GraphTooltip } from './GraphTooltip';
import { GraphLegend } from './GraphLegend';
import { computeLayout } from './computeLayout';

const NODE_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#9ca3af', info: '#6b7280',
};

const TYPE_ICONS: Record<string, string> = {
  agent_session: 'A', file: 'F', env_var: 'E', cloud_resource: 'C',
  secret: 'S', database: 'D', saas_app: 'W',
};

interface Props {
  assets: AssetNode[];
  entryId: string;
}

export function BlastRadiusGraph({ assets, entryId }: Props) {
  const { nodes, edges } = useMemo(() => computeLayout(assets, entryId), [assets, entryId]);
  const width = 800;
  const height = Math.max(400, (Math.max(...nodes.map((n) => n.hops), 0) + 1) * 120 + 80);

  const {
    viewBox, hoveredNodeId, selectedNodeId, svgRef,
    onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
    onNodeHover, onNodeClick, onDismissTooltip, resetView,
  } = useGraphInteraction(width, height);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const connectedEdgeSet = useMemo(() => {
    if (!hoveredNodeId) return new Set<number>();
    const set = new Set<number>();
    edges.forEach((e, i) => {
      if (e.fromId === hoveredNodeId || e.toId === hoveredNodeId) set.add(i);
    });
    return set;
  }, [hoveredNodeId, edges]);

  if (assets.length === 0) {
    return (
      <div className="rounded border border-border bg-panel/30 p-12 text-center">
        <p className="text-text-dim">No reachable assets found from this session.</p>
      </div>
    );
  }

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return (
    <div className="rounded border border-border bg-panel/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium">Attack Graph</h3>
        <button
          onClick={resetView}
          className="flex items-center gap-1.5 rounded-md border border-wire bg-surface
            px-2.5 py-1 text-xs text-text-primary hover:bg-neutral-700 transition-colors"
          title="Reset zoom & pan"
        >
          <RotateCcw size={12} />
          Reset view
        </button>
      </div>
      <div className="relative overflow-hidden rounded-lg">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={vb}
          className="mx-auto cursor-grab active:cursor-grabbing select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onClick={onDismissTooltip}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="20" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#525252" />
            </marker>
            <marker id="arrow-hl" viewBox="0 0 10 10" refX="20" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const highlighted = connectedEdgeSet.has(i);
            return (
              <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={highlighted ? '#a78bfa' : '#525252'}
                strokeWidth={highlighted ? 2 : 1}
                markerEnd={highlighted ? 'url(#arrow-hl)' : 'url(#arrow)'}
                className="transition-all duration-150" />
            );
          })}
          {nodes.map((n) => {
            const isHovered = hoveredNodeId === n.id;
            const r = n.isCrownJewel ? 18 : 14;
            const color = NODE_COLORS[n.sensitivity] ?? '#6b7280';
            return (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}
                className="cursor-pointer"
                onMouseEnter={() => onNodeHover(n.id)}
                onMouseLeave={() => onNodeHover(null)}
                onClick={(e) => { e.stopPropagation(); onNodeClick(n.id); }}
              >
                <circle r={r + (isHovered ? 4 : 0)} fill={color}
                  opacity={isHovered ? 0.35 : 0.2}
                  stroke={color} strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-150" />
                {n.isCrownJewel && (
                  <circle r={22} fill="none" stroke="#fbbf24"
                    strokeWidth={1} strokeDasharray="4 2" />
                )}
                <text textAnchor="middle" dy="4" fill="white"
                  fontSize="10" fontWeight="bold">
                  {TYPE_ICONS[n.assetType] ?? '?'}
                </text>
                <text textAnchor="middle" dy="30" fill="#a3a3a3" fontSize="8">
                  {n.name.length > 16 ? n.name.slice(0, 14) + '..' : n.name}
                </text>
              </g>
            );
          })}
        </svg>
        {selectedNode && (
          <GraphTooltip node={selectedNode} viewBox={viewBox}
            svgWidth={width} svgHeight={height} onDismiss={onDismissTooltip} />
        )}
      </div>
      <GraphLegend />
    </div>
  );
}
