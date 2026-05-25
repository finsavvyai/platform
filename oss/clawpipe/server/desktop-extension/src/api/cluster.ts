/**
 * Cluster API Client
 *
 * Handles API communication with FinSavvyAI cluster manager
 */

import { ExtensionContext } from '@lmstudio/sdk';

/**
 * Register cluster API routes with LM Studio's API client
 */
export function registerClusterAPI(
  context: ExtensionContext,
  clusterUrl: string
): void {
  // Cluster status
  context.api.registerRoute({
    method: 'GET',
    path: '/api/cluster/status',
    handler: async () => {
      const response = await fetch(`${clusterUrl}/api/cluster/status`);
      return await response.json();
    },
  });

  // List nodes
  context.api.registerRoute({
    method: 'GET',
    path: '/api/cluster/nodes',
    handler: async () => {
      const response = await fetch(`${clusterUrl}/api/cluster/nodes`);
      return await response.json();
    },
  });

  // List models
  context.api.registerRoute({
    method: 'GET',
    path: '/api/cluster/models',
    handler: async () => {
      const response = await fetch(`${clusterUrl}/api/cluster/models`);
      return await response.json();
    },
  });

  // Discover nodes
  context.api.registerRoute({
    method: 'POST',
    path: '/api/cluster/discover',
    handler: async () => {
      const response = await fetch(`${clusterUrl}/api/cluster/discover`, {
        method: 'POST',
      });
      return await response.json();
    },
  });

  // Remove node
  context.api.registerRoute({
    method: 'DELETE',
    path: '/api/cluster/nodes/:nodeId',
    handler: async (params: { nodeId: string }) => {
      const response = await fetch(
        `${clusterUrl}/api/cluster/nodes/${params.nodeId}`,
        { method: 'DELETE' }
      );
      return await response.json();
    },
  });
}
