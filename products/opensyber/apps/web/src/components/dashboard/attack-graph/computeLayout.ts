import type { AssetNode } from '@/app/dashboard/attack-paths/types';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  name: string;
  assetType: string;
  sensitivity: string;
  isCrownJewel: boolean;
  hops: number;
}

export interface Edge {
  x1: number; y1: number; x2: number; y2: number;
  fromId: string; toId: string;
}

export function computeLayout(
  assets: AssetNode[], entryId: string,
): { nodes: LayoutNode[]; edges: Edge[] } {
  const WIDTH = 800;
  const Y_SPACING = 110;
  const Y_OFFSET = 50;

  const byHops = new Map<number, AssetNode[]>();
  for (const a of assets) {
    const list = byHops.get(a.hops) ?? [];
    list.push(a);
    byHops.set(a.hops, list);
  }

  const nodes: LayoutNode[] = [{
    id: entryId, x: WIDTH / 2, y: Y_OFFSET,
    name: 'Entry Session', assetType: 'agent_session',
    sensitivity: 'medium', isCrownJewel: false, hops: 0,
  }];

  const posMap = new Map<string, { x: number; y: number }>();
  posMap.set(entryId, { x: WIDTH / 2, y: Y_OFFSET });

  const maxHops = Math.max(...Array.from(byHops.keys()), 0);
  for (let hop = 1; hop <= maxHops; hop++) {
    const items = byHops.get(hop) ?? [];
    const count = items.length;
    const spacing = Math.min(WIDTH / (count + 1), 100);
    const startX = (WIDTH - spacing * (count - 1)) / 2;

    items.forEach((a, idx) => {
      const x = count === 1 ? WIDTH / 2 : startX + idx * spacing;
      const y = Y_OFFSET + hop * Y_SPACING;
      nodes.push({
        id: a.id, x, y, name: a.name, assetType: a.assetType,
        sensitivity: a.sensitivity, isCrownJewel: a.isCrownJewel, hops: hop,
      });
      posMap.set(a.id, { x, y });
    });
  }

  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (const a of assets) {
    if (a.path.length >= 2) {
      const parentId = a.path[a.path.length - 2];
      const key = `${parentId}->${a.id}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      const from = posMap.get(parentId);
      const to = posMap.get(a.id);
      if (from && to) {
        edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, fromId: parentId, toId: a.id });
      }
    }
  }

  return { nodes, edges };
}
