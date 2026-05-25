import type { GraphNode, GraphEdge, PositionedNode, NodeType } from './graph-types';

const CANVAS_W = 1200;
const CANVAS_H = 800;
const NODE_RADIUS = 24;

export function applyForceLayout(nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] {
  const positioned: PositionedNode[] = nodes.map((n, i) => ({
    ...n,
    x: CANVAS_W / 2 + (Math.cos((i / nodes.length) * Math.PI * 2) * CANVAS_W * 0.35),
    y: CANVAS_H / 2 + (Math.sin((i / nodes.length) * Math.PI * 2) * CANVAS_H * 0.35),
  }));

  const indexMap = new Map(positioned.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < 80; iter++) {
    const forces = positioned.map(() => ({ fx: 0, fy: 0 }));
    applyRepulsion(positioned, forces);
    applyAttraction(positioned, edges, indexMap, forces);
    applyCenter(positioned, forces);
    applyForces(positioned, forces, iter);
  }

  return positioned;
}

function applyRepulsion(nodes: PositionedNode[], forces: { fx: number; fy: number }[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = 8000 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces[i].fx += fx;
      forces[i].fy += fy;
      forces[j].fx -= fx;
      forces[j].fy -= fy;
    }
  }
}

function applyAttraction(
  nodes: PositionedNode[],
  edges: GraphEdge[],
  indexMap: Map<string, number>,
  forces: { fx: number; fy: number }[],
): void {
  for (const edge of edges) {
    const si = indexMap.get(edge.source);
    const ti = indexMap.get(edge.target);
    if (si === undefined || ti === undefined) continue;
    const dx = nodes[ti].x - nodes[si].x;
    const dy = nodes[ti].y - nodes[si].y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const force = (dist - 120) * 0.05;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    forces[si].fx += fx;
    forces[si].fy += fy;
    forces[ti].fx -= fx;
    forces[ti].fy -= fy;
  }
}

function applyCenter(
  nodes: PositionedNode[],
  forces: { fx: number; fy: number }[],
): void {
  for (let i = 0; i < nodes.length; i++) {
    forces[i].fx += (CANVAS_W / 2 - nodes[i].x) * 0.01;
    forces[i].fy += (CANVAS_H / 2 - nodes[i].y) * 0.01;
  }
}

function applyForces(
  nodes: PositionedNode[],
  forces: { fx: number; fy: number }[],
  iter: number,
): void {
  const cooling = 1 - iter / 100;
  const pad = NODE_RADIUS + 10;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].x += forces[i].fx * cooling;
    nodes[i].y += forces[i].fy * cooling;
    nodes[i].x = Math.max(pad, Math.min(CANVAS_W - pad, nodes[i].x));
    nodes[i].y = Math.max(pad, Math.min(CANVAS_H - pad, nodes[i].y));
  }
}

export function applyHierarchicalLayout(nodes: GraphNode[]): PositionedNode[] {
  const typeOrder: NodeType[] = [
    'agent_session', 'iam_role', 'secret',
    'compute_instance', 'cloud_account', 'storage_bucket',
    'database', 'network',
  ];
  const groups = new Map<NodeType, GraphNode[]>();
  for (const n of nodes) {
    const arr = groups.get(n.type) ?? [];
    arr.push(n);
    groups.set(n.type, arr);
  }

  const positioned: PositionedNode[] = [];
  let row = 0;
  for (const type of typeOrder) {
    const group = groups.get(type) ?? [];
    if (group.length === 0) continue;
    const yPos = 60 + row * 100;
    group.forEach((n, col) => {
      positioned.push({
        ...n,
        x: 100 + col * (CANVAS_W - 200) / Math.max(group.length - 1, 1),
        y: yPos,
      });
    });
    row++;
  }
  return positioned;
}

export function filterNodes(
  nodes: GraphNode[],
  activeTypes: Set<NodeType>,
  search: string,
): GraphNode[] {
  return nodes.filter((n) => {
    if (!activeTypes.has(n.type)) return false;
    if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

export function getConnectedIds(nodeId: string, edges: GraphEdge[]): Set<string> {
  const connected = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId) connected.add(e.target);
    if (e.target === nodeId) connected.add(e.source);
  }
  return connected;
}

export function getGraphStats(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { total: number; edgeCount: number; critical: number; isolated: number } {
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }
  return {
    total: nodes.length,
    edgeCount: edges.length,
    critical: nodes.filter((n) => n.riskScore >= 70).length,
    isolated: nodes.filter((n) => !connectedIds.has(n.id)).length,
  };
}

export const CANVAS_WIDTH = CANVAS_W;
export const CANVAS_HEIGHT = CANVAS_H;
