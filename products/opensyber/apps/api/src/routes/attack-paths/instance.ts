/**
 * GET /api/attack-paths/graph/:instanceId
 *
 * Returns the full blast radius of an agent instance/session in the
 * `{ nodes, edges }` shape expected by the `AttackGraph3D` React component,
 * alongside risk scoring and the top-ranked attack paths.
 *
 * Resolution order for `:instanceId`:
 *   1. Direct match on `assets.id` (any asset type — lets the caller pass
 *      the attack graph node id directly).
 *   2. Match on `assets.identifier` where `assetType = 'agent_session'` —
 *      lets the caller pass a runtime session identifier.
 *
 * The handler is org-scoped and requires `cloud.read`.
 */
import { Hono } from 'hono';
import { and, eq, or } from 'drizzle-orm';
import { assets } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import {
  loadOrgGraph,
  bfsTraverse,
  computeBlastRadius,
  buildVizGraph,
  rankAttackPaths,
} from '../../services/attack-path/index.js';

export const instanceGraphRoute = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

instanceGraphRoute.get('/graph/:instanceId', async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const instanceId = c.req.param('instanceId');

  if (!orgId) {
    return c.json(
      { error: 'Bad Request', message: 'Organization context required' },
      400,
    );
  }
  if (!instanceId) {
    return c.json(
      { error: 'Bad Request', message: 'instanceId path param required' },
      400,
    );
  }

  // Resolve the instance → entry asset. We try id-match first, then
  // identifier-match scoped to agent_session.
  const entryCandidates = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.orgId, orgId),
        or(
          eq(assets.id, instanceId),
          and(
            eq(assets.identifier, instanceId),
            eq(assets.assetType, 'agent_session'),
          ),
        ),
      ),
    );

  const entryAsset = entryCandidates[0];
  if (!entryAsset) {
    return c.json(
      {
        error: 'Not Found',
        message: `No agent session asset for instance ${instanceId}`,
      },
      404,
    );
  }

  const graph = await loadOrgGraph(db, orgId);
  const entryNode = graph.get(entryAsset.id);
  if (!entryNode) {
    return c.json(
      { error: 'Not Found', message: 'Entry asset missing from graph' },
      404,
    );
  }

  const bfs = bfsTraverse(graph, entryAsset.id);
  const blastRadius = computeBlastRadius(bfs.reachable);
  const built = buildVizGraph(entryNode, bfs);
  const rankedPaths = rankAttackPaths(bfs, 10);

  return c.json({
    data: {
      instanceId,
      entryAssetId: entryAsset.id,
      nodes: built.nodes,
      edges: built.edges,
      riskScore: blastRadius.score,
      blastRadius,
      rankedPaths,
    },
  });
});
