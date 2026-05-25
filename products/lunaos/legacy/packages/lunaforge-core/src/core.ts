import { EventBus } from "./bus";
import { ModeRegistry } from "./modes";
import type { ModeContext, WorkspaceInfo, ProjectGraph, Mode } from "./types";
import { buildProjectGraph } from "./analysis";
import { WorkerClient, WorkerClientOptions } from "./workerClient";
import { CacheManager } from "./cache/CacheManager";
import { PerformanceMonitor, performanceMonitor } from "./metrics/PerformanceMonitor";
import { Logger, ErrorBoundary, createLogger } from "./logging/Logger";

export interface CoreConfig {
  workspace: WorkspaceInfo;
  fsListProvider: () => Promise<string[]>;
  worker?: WorkerClientOptions;
  license?: { valid: boolean; plan: string; features: string[] };
  cache?: {
    memoryMaxSize?: number;
    memoryMaxEntries?: number;
    defaultTTL?: number;
  };
  logging?: {
    level?: any;
    enableConsole?: boolean;
  };
}

/**
 * Enhanced LunaForgeCore with production-ready capabilities:
 * - Robust error handling and logging
 * - Performance monitoring and metrics
 * - Advanced caching system
 * - Memory management and cleanup
 */
export class LunaForgeCore {
  readonly bus = new EventBus();
  readonly modes = new ModeRegistry();
  readonly workspace: WorkspaceInfo;
  readonly license: { valid: boolean; plan: string; features: string[] };
  readonly workerClient?: WorkerClient;
  readonly cacheManager: CacheManager;
  readonly performanceMonitor: PerformanceMonitor;
  readonly logger: Logger;
  readonly errorBoundary: ErrorBoundary;

  // Callback for license upgrade prompts
  showUpgradePrompt?: (featureName: string) => void;

  // State management
  private graph: ProjectGraph | null = null;
  private fsListProvider: () => Promise<string[]>;
  private cleanupTasks: Array<() => Promise<void>> = [];
  private isDisposed = false;

  constructor(config: CoreConfig) {
    this.workspace = config.workspace;
    this.fsListProvider = config.fsListProvider;

    // Initialize subsystems
    this.logger = createLogger('LunaForgeCore', config.logging);
    this.cacheManager = new CacheManager(config.cache);
    this.performanceMonitor = performanceMonitor;
    this.errorBoundary = new ErrorBoundary(this.logger);

    // Initialize worker client
    this.workerClient = config.worker
      ? new WorkerClient(config.worker)
      : undefined;

    // Initialize license
    this.license = config.license ?? {
      valid: false,
      plan: "free",
      features: []
    };

    this.logger.info('LunaForgeCore initialized', {
      workspace: this.workspace.name,
      hasWorker: !!this.workerClient,
      licensePlan: this.license.plan
    });

    // Setup error handling
    this.setupErrorHandling();

    // Setup periodic cleanup
    this.setupPeriodicCleanup();
  }

  /**
   * Ensure project graph is built and cached
   */
  async ensureGraph(): Promise<ProjectGraph> {
    return this.errorBoundary.execute(
      async () => {
        const timerId = this.performanceMonitor.startTimer('graph.build');

        // Check cache first
        const cacheKey = this.generateGraphCacheKey();
        const cachedGraph = await this.cacheManager.get<ProjectGraph>(cacheKey);

        if (cachedGraph) {
          this.performanceMonitor.recordMetric('graph.cache.hit', 1);
          this.graph = cachedGraph;
          this.logger.debug('Graph loaded from cache');
          return cachedGraph;
        }

        this.performanceMonitor.recordMetric('graph.cache.miss', 1);
        this.logger.info('Building project graph');

        // Build graph from file system
        const fsList = await this.fsListProvider();
        this.graph = await buildProjectGraph(this.workspace, fsList);

        // Cache the result
        await this.cacheManager.set(cacheKey, this.graph, 15 * 60 * 1000); // 15 minutes

        const duration = this.performanceMonitor.endTimer(timerId);
        this.logger.info('Project graph built successfully', {
          fileCount: this.graph.files.length,
          dependencyCount: this.graph.dependencies.length,
          duration
        });

        // Emit events
        this.bus.emit("graph:ready", this.graph);
        this.modes.broadcastGraphUpdate(this.getModeContext());

        return this.graph;
      },
      'graph.build'
    );
  }

  /**
   * Get current graph without rebuilding
   */
  getGraph(): ProjectGraph | null {
    return this.graph;
  }

  /**
   * Refresh project graph
   */
  async refreshGraph(): Promise<void> {
    return this.refresh();
  }

  /**
   * Alias for refresh (backwards compatibility)
   */
  async refresh(): Promise<void> {
    return this.errorBoundary.execute(
      async () => {
        this.logger.info('Refreshing project graph');

        // Clear cache and existing graph
        const cacheKey = this.generateGraphCacheKey();
        await this.cacheManager.delete(cacheKey);
        this.graph = null;

        // Rebuild graph
        await this.ensureGraph();

        this.logger.info('Project graph refreshed');
      },
      'graph.refresh'
    );
  }

  /**
   * Clear all graph data
   */
  async clearGraph(): Promise<void> {
    const cacheKey = this.generateGraphCacheKey();
    await this.cacheManager.delete(cacheKey);
    this.graph = null;
    this.logger.info('Graph cleared');
  }

  /**
   * Register a mode with the core
   */
  async registerMode(mode: Mode): Promise<void> {
    return this.errorBoundary.execute(
      () => {
        this.logger.info('Registering mode', { modeId: mode.id, title: mode.title });
        this.modes.register(mode);

        this.bus.emit("mode:registered", {
          modeId: mode.id,
          title: mode.title,
          requiredFeature: mode.requiredFeature
        });
      },
      'mode.register'
    );
  }

  /**
   * Activate a mode with performance tracking
   */
  async activateMode(id: string): Promise<void> {
    return this.errorBoundary.execute(
      async () => {
        const timerId = this.performanceMonitor.startTimer('mode.activation');

        this.logger.info('Activating mode', { modeId: id });

        const mode = this.modes.get(id);
        if (!mode) {
          throw new Error(`Mode '${id}' not registered`);
        }

        // Check license requirements
        if (
          mode.requiredFeature &&
          !this.license.features.includes(mode.requiredFeature)
        ) {
          const error = `Feature '${mode.requiredFeature}' not available in current license`;
          this.logger.warn('License feature not available', {
            modeId: id,
            requiredFeature: mode.requiredFeature,
            currentPlan: this.license.plan
          });

          this.bus.emit("license:error", {
            mode: id,
            reason: "feature_not_enabled",
            feature: mode.requiredFeature
          });

          if (this.showUpgradePrompt) {
            this.showUpgradePrompt(mode.requiredFeature);
          }

          return;
        }

        try {
          const modeContext = this.getModeContext();
          await mode.activate(modeContext);

          const duration = this.performanceMonitor.endTimer(timerId);

          // Record mode metrics
          this.performanceMonitor.recordModeMetrics(id, {
            activationTime: duration,
            lastActivated: Date.now(),
            memoryUsage: this.getCurrentMemoryUsage()
          });

          this.logger.info('Mode activated successfully', {
            modeId: id,
            duration
          });

          this.bus.emit("mode:activated", { modeId: id });

        } catch (error) {
          this.performanceMonitor.recordModeMetrics(id, {
            errorCount: 1
          });

          throw error;
        }
      },
      'mode.activation'
    );
  }

  /**
   * Deactivate a mode
   */
  async deactivateMode(id: string): Promise<void> {
    return this.errorBoundary.execute(
      async () => {
        this.logger.info('Deactivating mode', { modeId: id });

        const mode = this.modes.get(id);
        if (!mode || !mode.deactivate) {
          this.logger.debug('Mode does not support deactivation', { modeId: id });
          return;
        }

        const modeContext = this.getModeContext();
        await mode.deactivate(modeContext);

        this.logger.info('Mode deactivated successfully', { modeId: id });
        this.bus.emit("mode:deactivated", { modeId: id });
      },
      'mode.deactivation'
    );
  }

  /**
   * Get a registered mode by ID
   */
  getMode(id: string): Mode | undefined {
    return this.modes.get(id);
  }

  /**
   * Get mode context for mode operations
   */
  getModeContext(): ModeContext {
    return {
      workspace: this.workspace,
      graph: this.graph,
      emit: (event, payload) => this.bus.emit(event, payload),
      license: this.license,
      showUpgradePrompt: this.showUpgradePrompt?.bind(this)
    };
  }

  /**
   * Request AI plan from worker
   */
  async requestPlan(target = "workspace", summary?: string) {
    return this.errorBoundary.execute(
      async () => {
        const timerId = this.performanceMonitor.startTimer('api.request');

        if (!this.workerClient) {
          throw new Error("Worker client not configured");
        }

        this.logger.info('Requesting AI plan', { target, summary });

        const plan = await this.workerClient.plan(target, summary);

        const duration = this.performanceMonitor.endTimer(timerId);

        this.logger.info('AI plan received', {
          planId: plan.id,
          stepCount: plan.steps.length,
          duration
        });

        this.bus.emit("plan:received", plan);
        return plan;
      },
      'api.request'
    );
  }

  /**
   * Get system performance metrics
   */
  getPerformanceMetrics() {
    return this.performanceMonitor.getCurrentMetrics();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getStats();
  }

  /**
   * Get log entries for debugging
   */
  getLogs(level?: any, limit = 100) {
    return this.logger.getLogs(level, limit);
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    return this.errorBoundary.execute(
      async () => {
        const health = {
          status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
          checks: {
            memory: this.checkMemoryUsage(),
            cache: this.checkCacheHealth(),
            modes: this.checkModeHealth(),
            worker: await this.checkWorkerHealth()
          },
          metrics: this.getPerformanceMetrics(),
          timestamp: Date.now()
        };

        // Determine overall health
        const unhealthyChecks = Object.values(health.checks).filter(check => check.status !== 'healthy');
        if (unhealthyChecks.length > 0) {
          health.status = unhealthyChecks.length > 2 ? 'unhealthy' : 'degraded';
        }

        this.logger.info('Health check completed', { status: health.status });
        return health;
      },
      'health.check'
    );
  }

  /**
   * Cleanup and dispose resources
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) return;

    this.logger.info('Disposing LunaForgeCore');

    // Run cleanup tasks
    for (const cleanupTask of this.cleanupTasks) {
      try {
        await cleanupTask();
      } catch (error) {
        this.logger.error('Error during cleanup task', error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Clear cache
    await this.cacheManager.clear();

    // Clear performance metrics
    this.performanceMonitor.clearMetrics();

    // Clear logs
    this.logger.clear();

    this.isDisposed = true;
    this.logger.info('LunaForgeCore disposed');
  }

  /**
   * Generate cache key for project graph
   */
  private generateGraphCacheKey(): string {
    return `graph:${this.workspace.rootPath}:${this.workspace.folders.join(',')}`;
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    // Handle unhandled promise rejections
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
        this.logger.error('Unhandled promise rejection', new Error(String(reason)), { promise });
      });

      process.on('uncaughtException', (error: Error) => {
        this.logger.fatal('Uncaught exception', error);
      });
    }

    // Setup error boundary handlers
    this.errorBoundary.onError((error, context) => {
      this.bus.emit('core:error', { error: error.message, context });
    });
  }

  /**
   * Setup periodic cleanup tasks
   */
  private setupPeriodicCleanup(): void {
    const cleanupInterval = setInterval(async () => {
      if (this.isDisposed) {
        clearInterval(cleanupInterval);
        return;
      }

      try {
        await this.cacheManager.cleanup();
      } catch (error) {
        this.logger.error('Error during periodic cleanup', error instanceof Error ? error : new Error(String(error)));
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    this.cleanupTasks.push(async () => {
      clearInterval(cleanupInterval);
    });
  }

  /**
   * Check memory usage health
   */
  private checkMemoryUsage() {
    const usage = this.getCurrentMemoryUsage();
    const threshold = 100 * 1024 * 1024; // 100MB

    return {
      status: usage > threshold ? 'degraded' : 'healthy',
      usage,
      threshold
    };
  }

  /**
   * Check cache health
   */
  private checkCacheHealth() {
    const stats = this.cacheManager.getStats();
    const usagePercent = stats.memoryUsagePercent;

    return {
      status: usagePercent > 90 ? 'degraded' : 'healthy',
      ...stats
    };
  }

  /**
   * Check mode health
   */
  private checkModeHealth() {
    const registeredModes = this.modes.list();
    const modeMetrics = this.performanceMonitor.getAllModeMetrics();

    return {
      status: 'healthy',
      registeredCount: registeredModes.length,
      activeMetrics: modeMetrics.length
    };
  }

  /**
   * Check worker health
   */
  private async checkWorkerHealth() {
    if (!this.workerClient) {
      return { status: 'healthy', message: 'No worker configured' };
    }

    try {
      // Simple health check - this would be implemented in WorkerClient
      const timerId = this.performanceMonitor.startTimer('worker.health');
      const isHealthy = await this.workerClient.ping?.();
      const duration = this.performanceMonitor.endTimer(timerId);

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: duration
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}