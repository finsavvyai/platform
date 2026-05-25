/**
 * FinSavvyAI Cluster Extension for LM Studio
 *
 * This extension adds cluster management capabilities to LM Studio,
 * allowing you to run LM Studio across multiple machines with automatic
 * load balancing, failover, and observability.
 */

import {
  ExtensionAPI,
  ExtensionContext,
  UIRegistry,
  Logger,
} from '@lmstudio/sdk';

import { ClusterPanel } from './components/ClusterPanel';
import { registerClusterAPI } from './api/cluster';

/**
 * Main extension class
 */
export class FinSavvyAIExtension implements ExtensionAPI {
  private context: ExtensionContext;
  private logger: Logger;
  private clusterUrl: string = 'http://localhost:8080';
  private clusterStatus: any = null;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Called when extension is activated
   */
  async onActivate(context: ExtensionContext): Promise<void> {
    this.context = context;
    this.logger = context.logger;

    this.logger.info('FinSavvyAI Cluster Extension activating...');

    // Register cluster panel in sidebar
    context.ui.registerPanel({
      id: 'finSavvyCluster',
      title: 'FinSavvyAI Cluster',
      component: ClusterPanel,
      icon: 'network',
      location: 'sidebar',
    });

    // Register API routes
    registerClusterAPI(context, this.clusterUrl);

    // Add menu items
    context.ui.addMenuItem({
      id: 'finSavvy.joinCluster',
      label: 'Join FinSavvyAI Cluster',
      icon: 'plus',
      action: () => this.joinCluster(),
    });

    context.ui.addMenuItem({
      id: 'finSavvy.openDashboard',
      label: 'Open FinSavvyAI Dashboard',
      icon: 'external-link',
      action: () => this.openDashboard(),
    });

    context.ui.addMenuItem({
      id: 'finSavvy.discoverNodes',
      label: 'Discover LM Studio Nodes',
      icon: 'search',
      action: () => this.discoverNodes(),
    });

    // Start background sync
    await this.startClusterSync();

    this.logger.info('FinSavvyAI Cluster Extension activated!');
  }

  /**
   * Called when extension is deactivated
   */
  async onDeactivate(): Promise<void> {
    this.logger.info('FinSavvyAI Cluster Extension deactivating...');

    // Stop background sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.logger.info('FinSavvyAI Cluster Extension deactivated.');
  }

  /**
   * Join a FinSavvyAI cluster
   */
  private async joinCluster(): Promise<void> {
    const url = await this.context.ui.prompt({
      title: 'Join FinSavvyAI Cluster',
      message: 'Enter FinSavvyAI Gateway URL:',
      defaultValue: this.clusterUrl,
    });

    if (url && url !== this.clusterUrl) {
      this.clusterUrl = url;

      try {
        // Get current model info from LM Studio
        const currentModel = this.context.config.currentModel;
        const apiHost = this.context.config.apiHost || 'localhost';
        const apiPort = this.context.config.apiPort || 1234;

        // Register with cluster
        await this.context.api.post(`${url}/api/cluster/join`, {
          nodeId: `lmstudio-${apiHost}`,
          nodeName: `LM Studio @ ${apiHost}`,
          host: apiHost,
          port: apiPort,
          models: currentModel ? [currentModel] : [],
        });

        await this.context.ui.notify({
          type: 'success',
          message: 'Successfully joined FinSavvyAI cluster!',
        });

        // Refresh cluster status
        await this.refreshClusterStatus();

      } catch (error: any) {
        await this.context.ui.notify({
          type: 'error',
          message: `Failed to join cluster: ${error.message}`,
        });
        this.logger.error('Failed to join cluster:', error);
      }
    }
  }

  /**
   * Open FinSavvyAI dashboard in external browser
   */
  private async openDashboard(): Promise<void> {
    try {
      await this.context.ui.openExternal(`${this.clusterUrl}/dashboard`);
    } catch (error: any) {
      this.logger.error('Failed to open dashboard:', error);
      await this.context.ui.notify({
        type: 'error',
        message: 'Failed to open dashboard',
      });
    }
  }

  /**
   * Trigger node discovery
   */
  private async discoverNodes(): Promise<void> {
    try {
      await this.context.ui.notify({
        type: 'info',
        message: 'Discovering LM Studio nodes on your network...',
      });

      const response = await this.context.api.post(
        `${this.clusterUrl}/api/cluster/discover`,
        {}
      );

      const { nodes_found } = await response.json();

      await this.context.ui.notify({
        type: 'success',
        message: `Discovery complete! Found ${nodes_found} node(s).`,
      });

      // Refresh cluster status
      await this.refreshClusterStatus();

    } catch (error: any) {
      this.logger.error('Discovery failed:', error);
      await this.context.ui.notify({
        type: 'error',
        message: `Discovery failed: ${error.message}`,
      });
    }
  }

  /**
   * Start background cluster status sync
   */
  private async startClusterSync(): Promise<void> {
    // Initial sync
    await this.refreshClusterStatus();

    // Sync every 5 seconds
    this.syncInterval = setInterval(async () => {
      await this.refreshClusterStatus();
    }, 5000);
  }

  /**
   * Refresh cluster status from API
   */
  private async refreshClusterStatus(): Promise<void> {
    try {
      const response = await this.context.api.get(
        `${this.clusterUrl}/api/cluster/status`
      );

      this.clusterStatus = await response.json();

      // Update UI state
      this.context.ui.setState('clusterStatus', this.clusterStatus);
      this.context.ui.setState('clusterNodes', this.clusterStatus?.nodes || []);
      this.context.ui.setState('clusterStats', this.clusterStatus?.stats || {});

    } catch (error: any) {
      this.logger.error('Failed to refresh cluster status:', error);
      // Don't show notification for sync failures (too noisy)
    }
  }

  /**
   * Get current cluster status
   */
  getClusterStatus(): any {
    return this.clusterStatus;
  }

  /**
   * Get cluster URL
   */
  getClusterUrl(): string {
    return this.clusterUrl;
  }
}

/**
 * Extension factory function
 */
export default function createExtension(): FinSavvyAIExtension {
  return new FinSavvyAIExtension();
}
