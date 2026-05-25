/**
 * Attack Graph Builder
 *
 * Transforms BFS reachable maps into the render-ready `{ nodes, edges }` shape
 * consumed by the `AttackGraph3D` React component.
 *
 * Node-type mapping (visualization semantics):
 *   agent_session                     -> 'entry'          (the compromised entry point)
 *   isCrownJewel=true                 -> 'crown-jewel'    (highest-value targets)
 *   secret | env_var | file           -> 'vulnerability'  (exploitable material)
 *   cloud_resource | database | ...   -> 'asset'          (neutral assets in blast radius)
 *
 * Edge weights derive from the underlying relation confidence (0-1).
 */
import type { SensitivityLevel } from '@opensyber/shared';
import type { BfsResult, GraphNode as ServiceGraphNode } from './types.js';

export type VizNodeType = 'asset' | 'vulnerability' | 'entry' | 'crown-jewel';
export type VizSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface VizGraphNode {
  id: string;
  label: string;
  type: VizNodeType;
  severity?: VizSeverity;
}

export interface VizGraphEdge {
  source: string;
  target: string;
  weight: number;
  label?: string;
}

export interface RankedAttackPath {
  targetId: string;
  targetName: string;
  hops: number;
  path: string[];
  maxSeverityWeight: number;
  riskScore: number; // blast_radius * max_severity (per-path)
}

export interface BuiltGraph {
  nodes: VizGraphNode[];
  edges: VizGraphEdge[];
}

const VULNERABILITY_TYPES = new Set(['secret', 'env_var', 'file']);
const SEVERITY_WEIGHT: Record<VizSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function severityFromSensitivity(sensitivity: SensitivityLevel): VizSeverity | undefined {
  if (sensitivity === 'info') return undefined;
  return sensitivity;
}

function classifyNodeType(node: ServiceGraphNode, isEntry: boolean): VizNodeType {
  if (isEntry) return 'entry';
  if (node.isCrownJewel) return 'crown-jewel';
  if (VULNERABILITY_TYPES.has(node.assetType)) return 'vulnerability';
  return 'asset';
}

/**
 * Build a render-ready graph from a BFS result.
 *
 * The entry node is always included as `type: 'entry'`, even though BFS does
 * not place the entry asset in `reachable`.
 */
export function buildVizGraph(
  entryNode: ServiceGraphNode,
  bfs: BfsResult,
): BuiltGraph {
  const nodes: VizGraphNode[] = [];
  const edges: VizGraphEdge[] = [];

  nodes.push({
    id: entryNode.id,
    label: entryNode.name,
    type: classifyNodeType(entryNode, true),
    severity: severityFromSensitivity(entryNode.sensitivity),
  });

  for (const [id, r] of bfs.reachable.entries()) {
    nodes.push({
      id,
      label: r.asset.name,
      type: classifyNodeType(r.asset, false),
      severity: severityFromSensitivity(r.asset.sensitivity),
    });

    // Emit the edge from the previous hop in the path — this rebuilds
    // the actual traversal chain (parent → child) rather than inventing
    // a star topology. The BFS `path` array is [entry, ..., id].
    const parentId = r.path[r.path.length - 2];
    if (!parentId) continue;

    const parentNode = bfs.reachable.get(parentId)?.asset ?? entryNode;
    const edge = parentNode.edges.find((e) => e.targetId === id);
    edges.push({
      source: parentId,
      target: id,
      weight: edge?.confidence ?? 0.5,
      label: edge?.relationType,
    });
  }

  return { nodes, edges };
}

/**
 * Rank attack paths by `blast_radius * max_severity`.
 *
 * `blast_radius` here is the per-path count of assets reachable downstream
 * from the target (i.e. how much further an attacker could pivot from the
 * target). `max_severity` is the target's own sensitivity weight.
 *
 * We use the reachable map as the full graph snapshot: every node's own
 * depth is counted against the entry, and downstream reach is approximated
 * by counting reachable nodes whose path contains the target id.
 */
export function rankAttackPaths(
  bfs: BfsResult,
  topN = 10,
): RankedAttackPath[] {
  const downstream = new Map<string, number>();
  for (const r of bfs.reachable.values()) {
    for (const hopId of r.path) {
      downstream.set(hopId, (downstream.get(hopId) ?? 0) + 1);
    }
  }

  const ranked: RankedAttackPath[] = [];
  for (const [id, r] of bfs.reachable.entries()) {
    const sev = severityFromSensitivity(r.asset.sensitivity);
    const maxSeverityWeight = sev ? SEVERITY_WEIGHT[sev] : 0;
    // Exclude the target itself from its own downstream count.
    const blastRadius = Math.max(0, (downstream.get(id) ?? 1) - 1);
    // Crown jewels get a boost so they rise to the top even with small radius.
    const crownBoost = r.asset.isCrownJewel ? 5 : 1;
    const riskScore = (blastRadius + 1) * maxSeverityWeight * crownBoost;

    ranked.push({
      targetId: id,
      targetName: r.asset.name,
      hops: r.depth,
      path: r.path,
      maxSeverityWeight,
      riskScore,
    });
  }

  ranked.sort((a, b) => b.riskScore - a.riskScore);
  return ranked.slice(0, topN);
}
