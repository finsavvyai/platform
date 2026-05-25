import type { Mode, EnhancedMode, ModeContext, ModeStatus, DependencyGraph, DependencyNode, ModeRegistration, ModeRegistryConfig, ProjectGraph } from "./types";

/**
 * Enhanced ModeRegistry with dependency management and advanced lifecycle
 */
export class ModeRegistry {
  private registrations = new Map<string, ModeRegistration>();
  private dependencyGraph: DependencyGraph;
  private config: ModeRegistryConfig;
  private activationQueue: string[] = [];
  private isActivating = new Set<string>();

  constructor(config: Partial<ModeRegistryConfig> = {}) {
    this.config = {
      enableDependencyResolution: true,
      enableActivationMetrics: true,
      enableCircularDependencyCheck: true,
      maxActivationRetries: 3,
      activationTimeout: 30000, // 30 seconds
      ...config
    };

    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map()
    };
  }

  /**
   * Register a mode with the registry
   */
  register(mode: Mode | EnhancedMode): void {
    const modeId = mode.id;
    const now = Date.now();

    // Check if mode is already registered
    if (this.registrations.has(modeId)) {
      throw new Error(`Mode '${modeId}' is already registered`);
    }

    // Create registration
    const registration: ModeRegistration = {
      mode,
      status: this.createInitialStatus(mode),
      registeredAt: now,
      activationHistory: []
    };

    // Register mode
    this.registrations.set(modeId, registration);

    // Update dependency graph
    this.updateDependencyGraph(mode);

    // Validate dependencies
    if (this.config.enableCircularDependencyCheck) {
      this.validateNoCircularDependencies();
    }

    // Sort activation order
    this.updateActivationOrder();
  }

  /**
   * Unregister a mode
   */
  unregister(modeId: string): void {
    const registration = this.registrations.get(modeId);
    if (!registration) {
      throw new Error(`Mode '${modeId}' is not registered`);
    }

    // Deactivate if active
    if (registration.status.status === 'active') {
      // Note: This would need context - handle at higher level
      registration.status.status = 'inactive';
    }

    // Remove from dependency graph
    this.dependencyGraph.nodes.delete(modeId);
    this.dependencyGraph.edges.delete(modeId);

    // Remove registration
    this.registrations.delete(modeId);

    // Update activation order
    this.updateActivationOrder();
  }

  /**
   * Get a mode by ID
   */
  get(modeId: string): Mode | EnhancedMode | undefined {
    const registration = this.registrations.get(modeId);
    return registration?.mode;
  }

  /**
   * Get registration details
   */
  getRegistration(modeId: string): ModeRegistration | undefined {
    return this.registrations.get(modeId);
  }

  /**
   * Get mode status
   */
  getStatus(modeId: string): ModeStatus | undefined {
    const registration = this.registrations.get(modeId);
    return registration?.status;
  }

  /**
   * Get all registered modes
   */
  list(): (Mode | EnhancedMode)[] {
    return Array.from(this.registrations.values()).map(reg => reg.mode);
  }

  /**
   * Get all mode statuses
   */
  getAllStatuses(): ModeStatus[] {
    return Array.from(this.registrations.values()).map(reg => reg.status);
  }

  /**
   * Get modes in activation order
   */
  getActivationOrder(): string[] {
    return Array.from(this.dependencyGraph.nodes.values())
      .filter(node => node.activationOrder !== undefined)
      .sort((a, b) => a.activationOrder! - b.activationOrder!)
      .map(node => node.modeId);
  }

  /**
   * Get active modes
   */
  getActiveModes(): (Mode | EnhancedMode)[] {
    return this.list().filter(mode => {
      const status = this.getStatus(mode.id);
      return status?.status === 'active';
    });
  }

  /**
   * Check if mode is active
   */
  isActive(modeId: string): boolean {
    const status = this.getStatus(modeId);
    return status?.status === 'active';
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): DependencyGraph {
    return {
      nodes: new Map(this.dependencyGraph.nodes),
      edges: new Map(this.dependencyGraph.edges)
    };
  }

  /**
   * Get dependencies for a mode
   */
  getDependencies(modeId: string): { required: string[]; optional: string[] } {
    const registration = this.registrations.get(modeId);
    if (!registration) {
      return { required: [], optional: [] };
    }

    const mode = registration.mode;
    const isEnhanced = this.isEnhancedMode(mode);

    return {
      required: isEnhanced ? (mode.dependencies || []) : [],
      optional: isEnhanced ? (mode.optionalDependencies || []) : []
    };
  }

  /**
   * Get dependents of a mode
   */
  getDependents(modeId: string): string[] {
    const node = this.dependencyGraph.nodes.get(modeId);
    return node?.dependents || [];
  }

  /**
   * Check if dependencies are satisfied for a mode
   */
  areDependenciesSatisfied(modeId: string): boolean {
    const status = this.getStatus(modeId);
    if (!status) return false;

    const { required, missing } = status.dependencies;
    return required.length === 0 && missing.length === 0;
  }

  /**
   * Activate a mode with dependency resolution
   */
  async activate(modeId: string, context: ModeContext): Promise<void> {
    if (this.isActivating.has(modeId)) {
      throw new Error(`Mode '${modeId}' is already being activated`);
    }

    const registration = this.registrations.get(modeId);
    if (!registration) {
      throw new Error(`Mode '${modeId}' is not registered`);
    }

    if (registration.status.status === 'active') {
      return; // Already active
    }

    this.isActivating.add(modeId);

    try {
      await this.activateInternal(modeId, context, registration);
    } finally {
      this.isActivating.delete(modeId);
    }
  }

  /**
   * Deactivate a mode
   */
  async deactivate(modeId: string, context: ModeContext): Promise<void> {
    const registration = this.registrations.get(modeId);
    if (!registration) {
      throw new Error(`Mode '${modeId}' is not registered`);
    }

    if (registration.status.status !== 'active') {
      return; // Not active
    }

    registration.status.status = 'deactivating';

    try {
      const mode = registration.mode;

      // Call mode's deactivate method
      if (mode.deactivate) {
        await mode.deactivate(context);
      } else if (this.isEnhancedMode(mode) && mode.onDeactivate) {
        await mode.onDeactivate(context);
      }

      // Update status
      registration.status.status = 'inactive';
      registration.status.lastDeactivated = Date.now();

    } catch (error) {
      registration.status.status = 'error';
      registration.status.error = error instanceof Error ? error.message : String(error);

      if (this.isEnhancedMode(registration.mode) && registration.mode.onError) {
        registration.mode.onError(error instanceof Error ? error : new Error(String(error)), 'deactivation');
      }

      throw error;
    }
  }

  /**
   * Update mode status
   */
  updateStatus(modeId: string, updates: Partial<ModeStatus>): void {
    const registration = this.registrations.get(modeId);
    if (!registration) {
      return;
    }

    Object.assign(registration.status, updates);
  }

  /**
   * Update mode metrics
   */
  updateMetrics(modeId: string, metrics: Partial<ModeStatus['metrics']>): void {
    const registration = this.registrations.get(modeId);
    if (!registration) {
      return;
    }

    Object.assign(registration.status.metrics, metrics);
  }

  /**
   * Broadcast graph update to all modes
   */
  async broadcastGraphUpdate(context: ModeContext): Promise<void> {
    const graph = context.graph;
    if (!graph) return;

    const promises = Array.from(this.registrations.values()).map(async (registration) => {
      const mode = registration.mode;

      try {
        if (this.isEnhancedMode(mode) && mode.onGraphUpdate) {
          try {
            await mode.onGraphUpdate(context, graph);
          } catch (error) {
            context.emit('mode:error', {
              modeId: mode.id,
              error: error instanceof Error ? error.message : String(error),
              context: 'onGraphUpdate'
            });
          }
        } else if (mode.onGraphUpdate) {
          try {
            await (mode as Mode).onGraphUpdate!(context);
          } catch (error) {
            context.emit('mode:error', {
              modeId: mode.id,
              error: error instanceof Error ? error.message : String(error),
              context: 'onGraphUpdate'
            });
          }
        }
      } catch (error) {
        registration.status.status = 'error';
        registration.status.error = error instanceof Error ? error.message : String(error);

        if (this.isEnhancedMode(mode) && mode.onError) {
          mode.onError(error instanceof Error ? error : new Error(String(error)), 'graph-update');
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registrations.clear();
    this.dependencyGraph.nodes.clear();
    this.dependencyGraph.edges.clear();
    this.activationQueue = [];
    this.isActivating.clear();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const registrations = Array.from(this.registrations.values());
    const active = registrations.filter(reg => reg.status.status === 'active');
    const errors = registrations.filter(reg => reg.status.status === 'error');

    return {
      total: registrations.length,
      active: active.length,
      inactive: registrations.length - active.length - errors.length,
      errors: errors.length,
      withDependencies: registrations.filter(reg =>
        reg.status.dependencies.required.length > 0 || reg.status.dependencies.optional.length > 0
      ).length
    };
  }

  /**
   * Internal activation logic
   */
  private async activateInternal(modeId: string, context: ModeContext, registration: ModeRegistration): Promise<void> {
    const mode = registration.mode;
    const startTime = Date.now();

    registration.status.status = 'activating';

    try {
      // Activate dependencies first if dependency resolution is enabled
      if (this.config.enableDependencyResolution && this.isEnhancedMode(mode)) {
        await this.activateDependencies(mode, context);
      }

      // Check license requirements
      if (mode.requiredFeature && !context.license.features.includes(mode.requiredFeature)) {
        throw new Error(`Feature '${mode.requiredFeature}' not available in current license`);
      }

      // Call enhanced activation hook
      if (this.isEnhancedMode(mode) && mode.onActivate) {
        await mode.onActivate(context);
      }

      // Call main activation method
      await mode.activate(context);

      // Update status and metrics
      const activationTime = Date.now() - startTime;
      registration.status.status = 'active';
      registration.status.lastActivated = Date.now();
      registration.status.metrics.activationTime = activationTime;
      registration.status.metrics.activationCount++;

      // Record activation history
      registration.activationHistory.push({
        timestamp: Date.now(),
        duration: activationTime,
        success: true
      });

      // Keep only last 10 activation attempts
      if (registration.activationHistory.length > 10) {
        registration.activationHistory = registration.activationHistory.slice(-10);
      }

    } catch (error) {
      const activationTime = Date.now() - startTime;
      registration.status.status = 'error';
      registration.status.error = error instanceof Error ? error.message : String(error);
      registration.status.metrics.errorCount++;

      // Record failed activation
      registration.activationHistory.push({
        timestamp: Date.now(),
        duration: activationTime,
        success: false,
        error: registration.status.error
      });

      // Call error handler
      if (this.isEnhancedMode(mode) && mode.onError) {
        mode.onError(error instanceof Error ? error : new Error(String(error)), 'activation');
      }

      throw error;
    }
  }

  /**
   * Activate dependencies for a mode
   */
  private async activateDependencies(mode: EnhancedMode | Mode, context: ModeContext): Promise<void> {
    if (!this.isEnhancedMode(mode)) {
      return;
    }

    const dependencies = mode.dependencies || [];
    for (const depId of dependencies) {
      const depRegistration = this.registrations.get(depId);
      if (!depRegistration) {
        throw new Error(`Dependency '${depId}' is not registered`);
      }

      if (depRegistration.status.status !== 'active') {
        await this.activate(depId, context);
      }
    }
  }

  /**
   * Update dependency graph with new mode
   */
  private updateDependencyGraph(mode: Mode | EnhancedMode): void {
    const modeId = mode.id;
    const isEnhanced = this.isEnhancedMode(mode);

    // Create dependency node
    const node: DependencyNode = {
      modeId,
      mode,
      priority: isEnhanced ? mode.priority : 0,
      dependencies: isEnhanced ? (mode.dependencies || []) : [],
      dependents: []
    };

    this.dependencyGraph.nodes.set(modeId, node);

    // Update edges and dependents
    if (isEnhanced) {
      // Required dependencies
      for (const depId of mode.dependencies || []) {
        if (!this.dependencyGraph.edges.has(modeId)) {
          this.dependencyGraph.edges.set(modeId, []);
        }
        this.dependencyGraph.edges.get(modeId)!.push({
          from: modeId,
          to: depId,
          type: 'required'
        });

        // Update dependents
        const depNode = this.dependencyGraph.nodes.get(depId);
        if (depNode && !depNode.dependents.includes(modeId)) {
          depNode.dependents.push(modeId);
        }
      }

      // Optional dependencies
      for (const depId of mode.optionalDependencies || []) {
        if (!this.dependencyGraph.edges.has(modeId)) {
          this.dependencyGraph.edges.set(modeId, []);
        }
        this.dependencyGraph.edges.get(modeId)!.push({
          from: modeId,
          to: depId,
          type: 'optional'
        });
      }
    }
  }

  /**
   * Validate no circular dependencies exist
   */
  private validateNoCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true; // Found cycle
      }

      if (visited.has(nodeId)) {
        return false; // Already processed
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = this.dependencyGraph.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.dependencyGraph.nodes.keys()) {
      if (hasCycle(nodeId)) {
        throw new Error(`Circular dependency detected involving mode '${nodeId}'`);
      }
    }
  }

  /**
   * Update activation order using topological sort
   */
  private updateActivationOrder(): void {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      const node = this.dependencyGraph.nodes.get(nodeId);
      if (node) {
        // Visit dependencies first
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      order.push(nodeId);
    };

    // Visit all nodes
    for (const nodeId of this.dependencyGraph.nodes.keys()) {
      visit(nodeId);
    }

    // Sort by priority within dependency constraints
    const sorted = order.sort((a, b) => {
      const nodeA = this.dependencyGraph.nodes.get(a)!;
      const nodeB = this.dependencyGraph.nodes.get(b)!;
      return nodeA.priority - nodeB.priority;
    });

    // Update activation order
    sorted.forEach((nodeId, index) => {
      const node = this.dependencyGraph.nodes.get(nodeId);
      if (node) {
        node.activationOrder = index;
      }
    });
  }

  /**
   * Create initial mode status
   */
  private createInitialStatus(mode: Mode | EnhancedMode): ModeStatus {
    const isEnhanced = this.isEnhancedMode(mode);
    const dependencies = isEnhanced ? (mode.dependencies || []) : [];
    const optionalDependencies = isEnhanced ? (mode.optionalDependencies || []) : [];

    return {
      id: mode.id,
      status: 'registered',
      config: isEnhanced ? (mode.defaultConfig || {}) : {},
      metrics: {
        activationTime: 0,
        memoryUsage: 0,
        apiCalls: 0,
        errorCount: 0,
        activationCount: 0
      },
      dependencies: {
        required: dependencies,
        optional: optionalDependencies,
        satisfied: [],
        missing: dependencies
      }
    };
  }

  /**
   * Check if mode is enhanced
   */
  private isEnhancedMode(mode: Mode | EnhancedMode): mode is EnhancedMode {
    return 'version' in mode && 'author' in mode && 'priority' in mode;
  }
}