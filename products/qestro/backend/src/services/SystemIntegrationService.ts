import { EventEmitter } from 'events';
import WebSocketService from './WebSocketService.js';
import ZeroSyncService from './ZeroSyncService.js';
import { healthCheckService } from './HealthCheckService.js';
import { monitoringService } from './MonitoringService.js';
import logger from '../utils/logger.js';

interface SystemComponent {
  name: string;
  service: any;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  dependencies: string[];
}

interface SystemState {
  components: Map<string, SystemComponent>;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  lastUpdate: Date;
}

interface IntegrationEvent {
  type: string;
  component: string;
  data: any;
  timestamp: Date;
}

class SystemIntegrationService extends EventEmitter {
  private systemState: SystemState;
  private components: Map<string, SystemComponent>;
  private eventQueue: IntegrationEvent[];
  private isInitialized: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.components = new Map();
    this.eventQueue = [];
    this.systemState = {
      components: this.components,
      overallHealth: 'unhealthy',
      lastUpdate: new Date()
    };
  }

  /**
   * Initialize the system integration service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing System Integration Service...');

      // Register core components
      await this.registerComponents();

      // Setup component health monitoring
      await this.setupHealthMonitoring();

      // Setup inter-component communication
      await this.setupCommunication();

      // Setup error handling and recovery
      await this.setupErrorHandling();

      // Start system monitoring
      await this.startSystemMonitoring();

      this.isInitialized = true;
      this.updateSystemHealth();

      logger.info('System Integration Service initialized successfully');
      this.emit('system:initialized', { timestamp: new Date() });

    } catch (error) {
      logger.error('Failed to initialize System Integration Service:', error);
      throw error;
    }
  }

  /**
   * Register all system components
   */
  private async registerComponents(): Promise<void> {
    const components = [
      {
        name: 'websocket',
        service: null, // Will be injected
        dependencies: []
      },
      {
        name: 'zerosync',
        service: null, // Will be injected
        dependencies: ['websocket']
      },
      {
        name: 'health',
        service: healthCheckService,
        dependencies: []
      },
      {
        name: 'monitoring',
        service: monitoringService,
        dependencies: ['health']
      },
      {
        name: 'database',
        service: null, // Database connection
        dependencies: []
      },
      {
        name: 'redis',
        service: null, // Redis connection
        dependencies: []
      },
      {
        name: 'frontend',
        service: null, // Frontend health check
        dependencies: ['websocket', 'zerosync']
      },
      {
        name: 'extension',
        service: null, // Browser extension connectivity
        dependencies: ['websocket']
      },
      {
        name: 'mobile',
        service: null, // Mobile app connectivity
        dependencies: ['websocket', 'zerosync']
      }
    ];

    for (const component of components) {
      this.components.set(component.name, {
        ...component,
        status: 'unhealthy',
        lastCheck: new Date()
      });
    }

    logger.info(`Registered ${components.length} system components`);
  }

  /**
   * Setup health monitoring for all components
   */
  private async setupHealthMonitoring(): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllComponents();
    }, 30000); // Check every 30 seconds

    // Initial health check
    await this.checkAllComponents();
  }

  /**
   * Check health of all registered components
   */
  private async checkAllComponents(): Promise<void> {
    const healthPromises = Array.from(this.components.keys()).map(async (componentName) => {
      try {
        const isHealthy = await this.checkComponentHealth(componentName);
        this.updateComponentStatus(componentName, isHealthy ? 'healthy' : 'unhealthy');
      } catch (error) {
        logger.error(`Health check failed for component ${componentName}:`, error);
        this.updateComponentStatus(componentName, 'unhealthy');
      }
    });

    await Promise.allSettled(healthPromises);
    this.updateSystemHealth();
  }

  /**
   * Check health of a specific component
   */
  private async checkComponentHealth(componentName: string): Promise<boolean> {
    const component = this.components.get(componentName);
    if (!component) return false;

    switch (componentName) {
      case 'websocket':
        return this.checkWebSocketHealth();
      case 'zerosync':
        return this.checkZeroSyncHealth();
      case 'health':
        return healthCheckService.isHealthy();
      case 'monitoring':
        return monitoringService.isHealthy();
      case 'database':
        return this.checkDatabaseHealth();
      case 'redis':
        return this.checkRedisHealth();
      case 'frontend':
        return this.checkFrontendHealth();
      case 'extension':
        return this.checkExtensionHealth();
      case 'mobile':
        return this.checkMobileHealth();
      default:
        return false;
    }
  }

  /**
   * Component-specific health checks
   */
  private async checkWebSocketHealth(): Promise<boolean> {
    try {
      // Check if WebSocket service is running and has active connections
      return true; // Implement actual check
    } catch (error) {
      return false;
    }
  }

  private async checkZeroSyncHealth(): Promise<boolean> {
    try {
      // Check if ZeroSync service is operational
      return true; // Implement actual check
    } catch (error) {
      return false;
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Implement database connectivity check
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      // Implement Redis connectivity check
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkFrontendHealth(): Promise<boolean> {
    try {
      // Check if frontend is accessible and responding
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkExtensionHealth(): Promise<boolean> {
    try {
      // Check if browser extension can connect
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkMobileHealth(): Promise<boolean> {
    try {
      // Check if mobile app can connect
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update component status
   */
  private updateComponentStatus(componentName: string, status: 'healthy' | 'degraded' | 'unhealthy'): void {
    const component = this.components.get(componentName);
    if (component) {
      const previousStatus = component.status;
      component.status = status;
      component.lastCheck = new Date();

      if (previousStatus !== status) {
        logger.info(`Component ${componentName} status changed: ${previousStatus} -> ${status}`);
        this.emit('component:status_changed', {
          component: componentName,
          previousStatus,
          currentStatus: status,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Update overall system health
   */
  private updateSystemHealth(): void {
    const componentStatuses = Array.from(this.components.values()).map(c => c.status);
    const unhealthyCount = componentStatuses.filter(s => s === 'unhealthy').length;
    const degradedCount = componentStatuses.filter(s => s === 'degraded').length;

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';

    if (unhealthyCount > 0) {
      overallHealth = 'unhealthy';
    } else if (degradedCount > 0) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    const previousHealth = this.systemState.overallHealth;
    this.systemState.overallHealth = overallHealth;
    this.systemState.lastUpdate = new Date();

    if (previousHealth !== overallHealth) {
      logger.info(`System health changed: ${previousHealth} -> ${overallHealth}`);
      this.emit('system:health_changed', {
        previousHealth,
        currentHealth: overallHealth,
        timestamp: new Date()
      });
    }
  }

  /**
   * Setup inter-component communication
   */
  private async setupCommunication(): Promise<void> {
    // Setup event forwarding between components
    this.on('frontend:state_change', (data) => {
      this.broadcastToComponents('state_sync', data);
    });

    this.on('extension:recording_start', (data) => {
      this.broadcastToComponents('recording_sync', data);
    });

    this.on('mobile:test_result', (data) => {
      this.broadcastToComponents('test_result_sync', data);
    });

    logger.info('Inter-component communication setup complete');
  }

  /**
   * Broadcast event to all healthy components
   */
  private broadcastToComponents(eventType: string, data: any): void {
    const healthyComponents = Array.from(this.components.entries())
      .filter(([_, component]) => component.status === 'healthy')
      .map(([name, _]) => name);

    const event: IntegrationEvent = {
      type: eventType,
      component: 'system',
      data,
      timestamp: new Date()
    };

    this.eventQueue.push(event);
    this.emit('system:broadcast', { event, targets: healthyComponents });
  }

  /**
   * Setup error handling and recovery
   */
  private async setupErrorHandling(): Promise<void> {
    // Handle component failures
    this.on('component:status_changed', async (event) => {
      if (event.currentStatus === 'unhealthy') {
        await this.handleComponentFailure(event.component);
      }
    });

    // Handle system-wide failures
    this.on('system:health_changed', async (event) => {
      if (event.currentHealth === 'unhealthy') {
        await this.handleSystemFailure();
      }
    });

    // Setup graceful degradation
    this.setupGracefulDegradation();

    logger.info('Error handling and recovery setup complete');
  }

  /**
   * Handle component failure
   */
  private async handleComponentFailure(componentName: string): Promise<void> {
    logger.warn(`Handling failure for component: ${componentName}`);

    const component = this.components.get(componentName);
    if (!component) return;

    // Attempt recovery based on component type
    try {
      switch (componentName) {
        case 'websocket':
          await this.recoverWebSocket();
          break;
        case 'zerosync':
          await this.recoverZeroSync();
          break;
        case 'database':
          await this.recoverDatabase();
          break;
        case 'redis':
          await this.recoverRedis();
          break;
        default:
          logger.warn(`No recovery strategy for component: ${componentName}`);
      }
    } catch (error) {
      logger.error(`Recovery failed for component ${componentName}:`, error);
    }
  }

  /**
   * Component recovery methods
   */
  private async recoverWebSocket(): Promise<void> {
    // Implement WebSocket recovery logic
    logger.info('Attempting WebSocket recovery...');
  }

  private async recoverZeroSync(): Promise<void> {
    // Implement ZeroSync recovery logic
    logger.info('Attempting ZeroSync recovery...');
  }

  private async recoverDatabase(): Promise<void> {
    // Implement database recovery logic
    logger.info('Attempting database recovery...');
  }

  private async recoverRedis(): Promise<void> {
    // Implement Redis recovery logic
    logger.info('Attempting Redis recovery...');
  }

  /**
   * Handle system-wide failure
   */
  private async handleSystemFailure(): Promise<void> {
    logger.error('System-wide failure detected, initiating emergency procedures');

    // Notify monitoring systems
    await monitoringService.reportCriticalAlert({
      type: 'system_failure',
      message: 'System-wide failure detected',
      timestamp: new Date(),
      components: Array.from(this.components.entries())
        .filter(([_, component]) => component.status === 'unhealthy')
        .map(([name, _]) => name)
    });

    // Attempt system recovery
    await this.attemptSystemRecovery();
  }

  /**
   * Attempt system recovery
   */
  private async attemptSystemRecovery(): Promise<void> {
    logger.info('Attempting system recovery...');

    // Restart critical components in dependency order
    const criticalComponents = ['database', 'redis', 'websocket', 'zerosync'];
    
    for (const componentName of criticalComponents) {
      try {
        await this.restartComponent(componentName);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between restarts
      } catch (error) {
        logger.error(`Failed to restart component ${componentName}:`, error);
      }
    }
  }

  /**
   * Restart a specific component
   */
  private async restartComponent(componentName: string): Promise<void> {
    logger.info(`Restarting component: ${componentName}`);
    // Implement component restart logic
  }

  /**
   * Setup graceful degradation
   */
  private setupGracefulDegradation(): void {
    // Define fallback behaviors when components are unavailable
    this.on('component:status_changed', (event) => {
      if (event.currentStatus === 'unhealthy') {
        this.enableFallbackMode(event.component);
      } else if (event.currentStatus === 'healthy') {
        this.disableFallbackMode(event.component);
      }
    });
  }

  /**
   * Enable fallback mode for a component
   */
  private enableFallbackMode(componentName: string): void {
    logger.info(`Enabling fallback mode for component: ${componentName}`);

    switch (componentName) {
      case 'zerosync':
        // Fall back to polling-based updates
        this.emit('system:fallback', { component: componentName, mode: 'polling' });
        break;
      case 'websocket':
        // Fall back to HTTP-only communication
        this.emit('system:fallback', { component: componentName, mode: 'http_only' });
        break;
      case 'redis':
        // Fall back to in-memory caching
        this.emit('system:fallback', { component: componentName, mode: 'memory_cache' });
        break;
    }
  }

  /**
   * Disable fallback mode for a component
   */
  private disableFallbackMode(componentName: string): void {
    logger.info(`Disabling fallback mode for component: ${componentName}`);
    this.emit('system:fallback_disabled', { component: componentName });
  }

  /**
   * Start system monitoring
   */
  private async startSystemMonitoring(): Promise<void> {
    // Monitor system resources
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute

    // Monitor event queue
    setInterval(() => {
      this.processEventQueue();
    }, 5000); // Every 5 seconds

    logger.info('System monitoring started');
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const metrics = {
      timestamp: new Date(),
      components: {
        total: this.components.size,
        healthy: Array.from(this.components.values()).filter(c => c.status === 'healthy').length,
        degraded: Array.from(this.components.values()).filter(c => c.status === 'degraded').length,
        unhealthy: Array.from(this.components.values()).filter(c => c.status === 'unhealthy').length
      },
      eventQueue: {
        size: this.eventQueue.length,
        oldestEvent: this.eventQueue.length > 0 ? this.eventQueue[0].timestamp : null
      },
      systemHealth: this.systemState.overallHealth
    };

    this.emit('system:metrics', metrics);
    monitoringService.recordMetric('system_integration', metrics as any);
  }

  /**
   * Process event queue
   */
  private processEventQueue(): void {
    const now = new Date();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    // Remove old events
    this.eventQueue = this.eventQueue.filter(event => {
      return (now.getTime() - event.timestamp.getTime()) < maxAge;
    });

    // Process pending events
    if (this.eventQueue.length > 100) {
      logger.warn(`Event queue is large: ${this.eventQueue.length} events`);
    }
  }

  /**
   * Get system status
   */
  getSystemStatus(): SystemState {
    return {
      ...this.systemState,
      components: new Map(this.systemState.components)
    };
  }

  /**
   * Get component status
   */
  getComponentStatus(componentName: string): SystemComponent | null {
    return this.components.get(componentName) || null;
  }

  /**
   * Register external service
   */
  registerService(name: string, service: any, dependencies: string[] = []): void {
    this.components.set(name, {
      name,
      service,
      status: 'unhealthy',
      lastCheck: new Date(),
      dependencies
    });

    logger.info(`Registered external service: ${name}`);
  }

  /**
   * Shutdown system integration service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down System Integration Service...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Notify all components of shutdown
    this.emit('system:shutdown', { timestamp: new Date() });

    // Clear event queue
    this.eventQueue = [];

    this.isInitialized = false;
    logger.info('System Integration Service shutdown complete');
  }
}

export default SystemIntegrationService;