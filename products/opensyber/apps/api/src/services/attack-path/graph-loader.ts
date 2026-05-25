/**
 * Graph Loader
 *
 * Loads the full asset graph for an organization into an in-memory adjacency list.
 * For 10K assets + 50K relations this is ~10MB — well within Worker limits.
 */
import { eq } from 'drizzle-orm';
import { assets, assetRelations } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { GraphNode, GraphEdge } from './types.js';
import type { AssetType, SensitivityLevel, RelationType } from '@opensyber/shared';

type Db = DrizzleD1Database<typeof import('@opensyber/db')>;

export async function loadOrgGraph(db: Db, orgId: string): Promise<Map<string, GraphNode>> {
  const [allAssets, allRelations] = await Promise.all([
    db.select().from(assets).where(eq(assets.orgId, orgId)),
    db.select().from(assetRelations).where(eq(assetRelations.orgId, orgId)),
  ]);

  const graph = new Map<string, GraphNode>();

  for (const asset of allAssets) {
    graph.set(asset.id, {
      id: asset.id,
      assetType: asset.assetType as AssetType,
      name: asset.name,
      identifier: asset.identifier,
      sensitivity: asset.sensitivity as SensitivityLevel,
      isCrownJewel: asset.isCrownJewel,
      edges: [],
    });
  }

  for (const rel of allRelations) {
    const node = graph.get(rel.sourceAssetId);
    if (!node) continue;
    if (!graph.has(rel.targetAssetId)) continue;
    node.edges.push({
      relationId: rel.id,
      targetId: rel.targetAssetId,
      relationType: rel.relationType as RelationType,
      confidence: rel.confidence,
    });
  }

  return graph;
}
