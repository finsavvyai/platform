'use client';

import { useRef, useState, useCallback } from 'react';
import type { PositionedNode, GraphEdge } from './graph-types';
import { NodeShape } from './NodeShape';
import { getConnectedIds, CANVAS_WIDTH, CANVAS_HEIGHT } from './graph-utils';

interface Props {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  highlightRisks: boolean;
  onSelectNode: (id: string) => void;
  selectedNodeId: string | null;
}

export function GraphSvg({ nodes, edges, highlightRisks, onSelectNode, selectedNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const connectedIds = hoveredId ? getConnectedIds(hoveredId, edges) : new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((vb) => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const nw = vb.w * scale;
      const nh = vb.h * scale;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.x) * (viewBox.w / CANVAS_WIDTH);
    const dy = (e.clientY - dragStart.y) * (viewBox.h / CANVAS_HEIGHT);
    setViewBox((vb) => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [dragging, dragStart, viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  return (
    <svg
      ref={svgRef}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      className="h-full w-full rounded-xl border border-neutral-800 bg-neutral-950"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="graph-svg"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#525252" />
        </marker>
      </defs>
      {edges.map((e) => {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) return null;
        const isHighlighted = hoveredId === e.source || hoveredId === e.target;
        return (
          <g key={e.id}>
            <line
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={isHighlighted ? '#737373' : '#404040'}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeDasharray={e.direct ? undefined : '6 3'}
              markerEnd="url(#arrow)"
            />
          </g>
        );
      })}
      {nodes.map((n) => {
        const isHovered = hoveredId === n.id;
        const isConnected = connectedIds.has(n.id);
        const isDimmed = hoveredId !== null && !isHovered && !isConnected;
        const isPulsing = highlightRisks && n.riskScore >= 70;
        return (
          <NodeShape
            key={n.id}
            type={n.type}
            x={n.x}
            y={n.y}
            r={24}
            highlighted={isHovered || selectedNodeId === n.id}
            dimmed={isDimmed}
            pulsing={isPulsing}
            onClick={() => onSelectNode(n.id)}
            onMouseEnter={() => setHoveredId(n.id)}
            onMouseLeave={() => setHoveredId(null)}
            label={n.name}
          />
        );
      })}
    </svg>
  );
}
