/**
 * Discovery Pipeline Orchestrator
 *
 * Coordinates asset discovery from multiple sources, deduplicates assets,
 * and upserts them into the database.
 */
import { eq, and } from 'drizzle-orm';
import { assets, assetRelations } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { DiscoveredAsset, DiscoveredRelation } from './types.js';

type Db = DrizzleD1Database<typeof import('@opensyber/db')>;

/**
 * Upsert discovered assets — dedup on (orgId, assetType, identifier).
 * Updates lastSeenAt if asset already exists; creates if new.
 * Returns a map of identifier → assetId.
 */
export async function upsertAssets(
  db: Db,
  orgId: string,
  discovered: DiscoveredAsset[],
): Promise<Map<string, string>> {
  const identifierToId = new Map<string, string>();
  const now = new Date().toISOString();

  for (const asset of discovered) {
    const [existing] = await db.select({ id: assets.id }).from(assets)
      .where(and(
        eq(assets.orgId, orgId),
        eq(assets.assetType, asset.assetType),
        eq(assets.identifier, asset.identifier),
      ));

    if (existing) {
      identifierToId.set(asset.identifier, existing.id);
      await db.update(assets)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(assets.id, existing.id));
    } else {
      const id = `asset-${crypto.randomUUID()}`;
      identifierToId.set(asset.identifier, id);
      const metadata = asset.metadata ? JSON.stringify(asset.metadata) : null;
      await db.insert(assets).values({
        id, orgId,
        assetType: asset.assetType,
        name: asset.name,
        identifier: asset.identifier,
        sensitivity: asset.sensitivity,
        isCrownJewel: asset.isCrownJewel ?? false,
        metadata,
        discoverySource: asset.discoverySource,
        status: 'active',
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  return identifierToId;
}

/**
 * Upsert discovered relations — dedup on (orgId, sourceAssetId, targetAssetId, relationType).
 * Updates lastSeenAt if relation already exists; creates if new.
 */
export async function upsertRelations(
  db: Db,
  orgId: string,
  discovered: DiscoveredRelation[],
  identifierToId: Map<string, string>,
): Promise<number> {
  const now = new Date().toISOString();
  let created = 0;

  for (const rel of discovered) {
    const sourceId = identifierToId.get(rel.sourceIdentifier);
    const targetId = identifierToId.get(rel.targetIdentifier);
    if (!sourceId || !targetId) continue;

    const [existing] = await db.select({ id: assetRelations.id }).from(assetRelations)
      .where(and(
        eq(assetRelations.orgId, orgId),
        eq(assetRelations.sourceAssetId, sourceId),
        eq(assetRelations.targetAssetId, targetId),
        eq(assetRelations.relationType, rel.relationType),
      ));

    if (existing) {
      await db.update(assetRelations)
        .set({ lastSeenAt: now })
        .where(eq(assetRelations.id, existing.id));
    } else {
      const id = `rel-${crypto.randomUUID()}`;
      const metadata = rel.metadata ? JSON.stringify(rel.metadata) : null;
      await db.insert(assetRelations).values({
        id, orgId,
        sourceAssetId: sourceId,
        targetAssetId: targetId,
        relationType: rel.relationType,
        confidence: rel.confidence,
        discoverySource: rel.discoverySource,
        metadata,
        firstSeenAt: now,
        lastSeenAt: now,
      });
      created++;
    }
  }

  return created;
}

/**
 * Run the full discovery pipeline for a set of discovered assets and relations.
 */
export async function runDiscoveryPipeline(
  db: Db,
  orgId: string,
  assets: DiscoveredAsset[],
  relations: DiscoveredRelation[],
): Promise<{ assetsUpserted: number; relationsCreated: number }> {
  const identifierToId = await upsertAssets(db, orgId, assets);
  const relationsCreated = await upsertRelations(db, orgId, relations, identifierToId);
  return { assetsUpserted: identifierToId.size, relationsCreated };
}
