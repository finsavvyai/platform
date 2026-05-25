import { Position3D, Connection } from './types';

/** Calculate 3D Euclidean distance between two positions. */
export function euclideanDistance(a: Position3D, b: Position3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Minimum distance before nodes are considered overlapping. */
export const OVERLAP_THRESHOLD = 3;

/** Default spacing for auto-layout. */
export const LAYOUT_SPACING = 50;

/** Check if adding a node at `pos` overlaps any existing positions. */
export function checkOverlap(
  pos: Position3D,
  existing: Position3D[],
): boolean {
  return existing.some((p) => {
    const d = euclideanDistance(pos, p);
    return d > 0 && d < OVERLAP_THRESHOLD;
  });
}

/**
 * Detect if there is a path from `from` to `to` in the connection graph.
 * Used to prevent circular connections.
 */
export function hasPath(
  from: string,
  to: string,
  connections: Connection[],
): boolean {
  const visited = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const conn of connections) {
      if (conn.sourceId === current) {
        queue.push(conn.targetId);
      }
    }
  }
  return false;
}

/**
 * Topological sort of node IDs based on connections.
 * Returns ordered array of node IDs from sources to sinks.
 */
export function topologicalSort(
  nodeIds: string[],
  connections: Connection[],
): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }
  for (const conn of connections) {
    adjList.get(conn.sourceId)?.push(conn.targetId);
    inDegree.set(
      conn.targetId,
      (inDegree.get(conn.targetId) ?? 0) + 1,
    );
  }
  const queue = nodeIds.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighbor of adjList.get(node) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }
  return order;
}

/**
 * Find all distinct paths from source nodes (in-degree 0)
 * through the connection graph.
 */
export function findPaths(
  nodeIds: string[],
  connections: Connection[],
): string[][] {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) {
    adjList.set(id, []);
    inDegree.set(id, 0);
  }
  for (const conn of connections) {
    adjList.get(conn.sourceId)?.push(conn.targetId);
    inDegree.set(
      conn.targetId,
      (inDegree.get(conn.targetId) ?? 0) + 1,
    );
  }
  const roots = nodeIds.filter((id) => inDegree.get(id) === 0);
  const paths: string[][] = [];

  function dfs(current: string, path: string[]): void {
    const neighbors = adjList.get(current) ?? [];
    if (neighbors.length === 0) {
      paths.push([...path]);
      return;
    }
    for (const next of neighbors) {
      path.push(next);
      dfs(next, path);
      path.pop();
    }
  }

  for (const root of roots) {
    dfs(root, [root]);
  }
  return paths;
}
