/**
 * Adapts ConnectionManager onto the ClientRegistry shape that
 * ProgressBroadcaster expects. Iterates the in-process connection map
 * filtered by tenantId; cross-server delivery is handled by the
 * existing Redis pub/sub fan-out in ConnectionManager.
 *
 * Day 11 of the production-ready roadmap (broadcaster consumer).
 */

import type { ConnectionManager, Connection } from "./connection-manager";
import type { AuthedClient, ClientRegistry } from "./progress-broadcaster";

export class TenantClientRegistry implements ClientRegistry {
  constructor(private readonly cm: ConnectionManager) {}

  *forTenant(tenantId: string): Iterable<AuthedClient> {
    // ConnectionManager keeps a private `connections` Map; we expose
    // it via the public iterator to avoid surface-area changes there.
    const all = (this.cm as unknown as { connections: Map<string, Connection> }).connections;
    if (!all) return;
    for (const conn of all.values()) {
      if (conn.user.tenantId === tenantId) {
        yield {
          socket: conn.connection,
          tenantId: conn.user.tenantId,
          userId: conn.user.id,
        };
      }
    }
  }
}
