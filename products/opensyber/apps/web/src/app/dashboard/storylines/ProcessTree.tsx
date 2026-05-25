'use client';

import type { ProcessNode } from './types';

interface ProcessTreeProps {
  nodes: ProcessNode[];
}

interface LayoutNode extends ProcessNode {
  x: number;
  y: number;
  children: LayoutNode[];
}

function buildTree(nodes: ProcessNode[]): LayoutNode[] {
  const map = new Map<string, LayoutNode>();
  const roots: LayoutNode[] = [];
  for (const n of nodes) {
    map.set(n.id, { ...n, x: 0, y: 0, children: [] });
  }
  for (const n of nodes) {
    const ln = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(ln);
    } else {
      roots.push(ln);
    }
  }
  return roots;
}

function layoutTree(roots: LayoutNode[]): { nodes: LayoutNode[]; w: number; h: number } {
  const all: LayoutNode[] = [];
  let col = 0;
  function walk(node: LayoutNode, depth: number): void {
    if (node.children.length === 0) {
      node.x = col * 180;
      node.y = depth * 70;
      col++;
      all.push(node);
      return;
    }
    for (const c of node.children) walk(c, depth + 1);
    const first = node.children[0];
    const last = node.children[node.children.length - 1];
    node.x = (first.x + last.x) / 2;
    node.y = depth * 70;
    all.push(node);
  }
  for (const r of roots) walk(r, 0);
  const w = Math.max(...all.map((n) => n.x)) + 180;
  const h = Math.max(...all.map((n) => n.y)) + 50;
  return { nodes: all, w, h };
}

export function ProcessTree({ nodes }: ProcessTreeProps): React.ReactElement {
  const roots = buildTree(nodes);
  const { nodes: laid, w, h } = layoutTree(roots);

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const n of laid) {
    for (const c of n.children) {
      edges.push({ x1: n.x + 60, y1: n.y + 30, x2: c.x + 60, y2: c.y });
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(w, 300)} height={h + 20} className="mx-auto">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#525252" strokeWidth={1.5}
          />
        ))}
        {laid.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x} y={n.y} width={120} height={30} rx={6}
              fill={n.suspicious ? 'rgba(239,68,68,0.15)' : 'rgba(64,64,64,0.5)'}
              stroke={n.suspicious ? '#ef4444' : '#525252'}
              strokeWidth={1}
            />
            <text
              x={n.x + 60} y={n.y + 18}
              textAnchor="middle" fontSize={11}
              fill={n.suspicious ? '#fca5a5' : '#d4d4d4'}
            >
              {n.name.length > 16 ? n.name.slice(0, 14) + '..' : n.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
