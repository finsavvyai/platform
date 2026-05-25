import { EventEmitter } from 'events';
import { Agent, AgentStatus, LifecycleConfig, LifecycleEvent, LifecycleAction } from './interfaces';
import { logger } from '@claude-agent/utils';

export interface LifecycleState {
  agentId: string;
  status: AgentStatus;
  pid?: number;
  startTime?: Date;
  lastHealthCheck?: Date;
  restartCount: number;
  maxRestarts: number;
  restartDelay: number;
  isShuttingDown: boolean;
  shutdownTimeout?: NodeJS.Timeout;
  startupTimeout?: NodeJS.Timeout;
}

export interface LifecycleOptions {
  autoRestart?: boolean;
  maxRestartAttempts?: number;
  restartDelayMs?: number;
  gracefulShutdownTimeoutMs?: number;
  startupTimeoutMs?: number;
  healthCheckIntervalMs?: number;
}

export class AgentLifecycleManager extends EventEmitter {
  private agentStates = new Map<string, LifecycleState>();
  private options: LifecycleOptions;
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  constructor(options: LifecycleOptions = {}) {
    super();
    this.options = {
      autoRestart: true,
      maxRestartAttempts: 3,
      restartDelayMs: 5000,
      gracefulShutdownTimeoutMs: 30000,
      startupTimeoutMs: 60000,
      healthCheckIntervalMs: 30000,
      ...options
    };
  }

  async startAgent(agent: Agent): Promise<void> {
    const state = this.getOrCreateState(agent);

    if (state.status === AgentStatus.RUNNING) {
      logger.warn(`Agent ${agent.id} is already running`);
      return;
    }

    if (state.isShuttingDown) {
      logger.warn(`Agent ${agent.id} is currently shutting down`);
      return;
    }

    logger.info(`Starting agent ${agent.id} (${agent.name})`);

    try {
      // Update state to starting
      state.status = AgentStatus.STARTING;
      state.isShuttingDown = false;
      await this.updateAgentStatus(agent.id, AgentStatus.STARTING);

      // Emit lifecycle event
      await this.emitLifecycleEvent(agent.id, LifecycleAction.START, 'starting');

      // Check dependencies
      await this.validateDependencies(agent);

      // Check resource availability
      await this.checkResourceAvailability(agent);

      // Start the agent process (simulated - in real implementation would start actual process)
      const pid = await this.startAgentProcess(agent);
      state.pid = pid;
      state.startTime = new Date();

      // Set startup timeout
      state.startupTimeout = setTimeout(() => {
        if (state.status === AgentStatus.STARTING) {
          logger.error(`Agent ${agent.id} failed to start within timeout`);
          this.handleStartupFailure(agent, 'Startup timeout');
        }
      }, this.options.startupTimeoutMs);

      // Wait for agent to become healthy
      await this.waitForAgentHealthy(agent.id);

      // Clear startup timeout
      if (state.startupTimeout) {
        clearTimeout(state.startupTimeout);
        state.startupTimeout = undefined;
      }

      // Update state to running
      state.status = AgentStatus.RUNNING;
      state.lastHealthCheck = new Date();
      await this.updateAgentStatus(agent.id, AgentStatus.RUNNING);

      // Start health monitoring
      this.startHealthMonitoring(agent);

      // Emit success event
      await this.emitLifecycleEvent(agent.id, LifecycleAction.START, 'success', {
        pid,
        startTime: state.startTime
      });

      logger.info(`Agent ${agent.id} started successfully with PID ${pid}`);

    } catch (error) {
      logger.error(`Failed to start agent ${agent.id}:`, error);
      state.status = AgentStatus.FAILED;
      await this.updateAgentStatus(agent.id, AgentStatus.FAILED);

      await this.emitLifecycleEvent(agent.id, LifecycleAction.START, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Handle startup failure
      await this.handleStartupFailure(agent, error instanceof Error ? error.message : 'Unknown error');

      throw error;
    }
  }

  async stopAgent(agent: Agent, graceful: boolean = true): Promise<void> {
    const state = this.agentStates.get(agent.id);

    if (!state) {
      logger.warn(`No state found for agent ${agent.id}`);
      return;
    }

    if (state.status === AgentStatus.STOPPED) {
      logger.warn(`Agent ${agent.id} is already stopped`);
      return;
    }

    if (state.isShuttingDown) {
      logger.warn(`Agent ${agent.id} is already shutting down`);
      return;
    }

    logger.info(`Stopping agent ${agent.id} (${agent.name}) - ${graceful ? 'graceful' : 'force'}`);

    try {
      // Update state
      state.isShuttingDown = true;
      state.status = AgentStatus.STOPPING;
      await this.updateAgentStatus(agent.id, AgentStatus.STOPPING);

      // Stop health monitoring
      this.stopHealthMonitoring(agent.id);

      // Emit lifecycle event
      await this.emitLifecycleEvent(agent.id, LifecycleAction.STOP, 'stopping', {
        graceful,
        pid: state.pid
      });

      // Stop the agent process
      if (state.pid) {
        await this.stopAgentProcess(state.pid, graceful);

        // Set shutdown timeout for graceful shutdown
        if (graceful) {
          state.shutdownTimeout = setTimeout(async () => {
            logger.warn(`Graceful shutdown timeout for agent ${agent.id}, force killing`);
            await this.forceStopAgent(agent.id);
          }, this.options.gracefulShutdownTimeoutMs);
        }
      }

      // Wait for agent to stop
      await this.waitForAgentStopped(agent.id);

      // Clear shutdown timeout
      if (state.shutdownTimeout) {
        clearTimeout(state.shutdownTimeout);
        state.shutdownTimeout = undefined;
      }

      // Update state
      state.status = AgentStatus.STOPPED;
      state.pid = undefined;
      state.startTime = undefined;
      state.isShuttingDown = false;
      await this.updateAgentStatus(agent.id, AgentStatus.STOPPED);

      // Emit success event
      await this.emitLifecycleEvent(agent.id, LifecycleAction.STOP, 'success', {
        graceful,
        stoppedAt: new Date()
      });

      logger.info(`Agent ${agent.id} stopped successfully`);

    } catch (error) {
      logger.error(`Failed to stop agent ${agent.id}:`, error);
      state.status = AgentStatus.FAILED;
      state.isShuttingDown = false;
      await this.updateAgentStatus(agent.id, AgentStatus.FAILED);

      await this.emitLifecycleEvent(agent.id, LifecycleAction.STOP, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async restartAgent(agent: Agent): Promise<void> {
    logger.info(`Restarting agent ${agent.id} (${agent.name})`);

    const state = this.getOrCreateState(agent);

    // Check restart limit
    if (state.restartCount >= this.options.maxRestartAttempts) {
      const error = `Agent ${agent.id} has exceeded maximum restart attempts (${this.options.maxRestartAttempts})`;
      logger.error(error);
      throw new Error(error);
    }

    try {
      // Emit restart event
      await this.emitLifecycleEvent(agent.id, LifecycleAction.RESTART, 'starting', {
        restartCount: state.restartCount + 1
      });

      // Stop the agent if running
      if (state.status === AgentStatus.RUNNING) {
        await this.stopAgent(agent, true);
      }

      // Wait before restart
      if (state.restartCount > 0) {
        await this.delay(state.restartDelay);
      }

      // Start the agent
      await this.startAgent(agent);

      // Update restart count
      state.restartCount++;
      state.restartDelay = Math.min(
        state.restartDelay * 2,
        60000 // Max 1 minute delay
      );

      // Emit success event
      await this.emitLifecycleEvent(agent.id, LifecycleAction.RESTART, 'success', {
        restartCount: state.restartCount,
        pid: state.pid
      });

      logger.info(`Agent ${agent.id} restarted successfully (attempt ${state.restartCount})`);

    } catch (error) {
      logger.error(`Failed to restart agent ${agent.id}:`, error);

      await this.emitLifecycleEvent(agent.id, LifecycleAction.RESTART, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        restartCount: state.restartCount
      });

      throw error;
    }
  }

  async pauseAgent(agent: Agent): Promise<void> {
    const state = this.agentStates.get(agent.id);

    if (!state || state.status !== AgentStatus.RUNNING) {
      logger.warn(`Agent ${agent.id} is not running, cannot pause`);
      return;
    }

    logger.info(`Pausing agent ${agent.id}`);

    try {
      state.status = AgentStatus.PAUSED;
      await this.updateAgentStatus(agent.id, AgentStatus.PAUSED);

      // Stop health monitoring but keep process running
      this.stopHealthMonitoring(agent.id);

      await this.emitLifecycleEvent(agent.id, LifecycleAction.PAUSE, 'success', {
        pausedAt: new Date()
      });

      logger.info(`Agent ${agent.id} paused successfully`);

    } catch (error) {
      logger.error(`Failed to pause agent ${agent.id}:`, error);
      throw error;
    }
  }

  async resumeAgent(agent: Agent): Promise<void> {
    const state = this.agentStates.get(agent.id);

    if (!state || state.status !== AgentStatus.PAUSED) {
      logger.warn(`Agent ${agent.id} is not paused, cannot resume`);
      return;
    }

    logger.info(`Resuming agent ${agent.id}`);

    try {
      state.status = AgentStatus.RUNNING;
      await this.updateAgentStatus(agent.id, AgentStatus.RUNNING);

      // Resume health monitoring
      this.startHealthMonitoring(agent);

      await this.emitLifecycleEvent(agent.id, LifecycleAction.RESUME, 'success', {
        resumedAt: new Date()
      });

      logger.info(`Agent ${agent.id} resumed successfully`);

    } catch (error) {
      logger.error(`Failed to resume agent ${agent.id}:`, error);
      throw error;
    }
  }

  getAgentState(agentId: string): LifecycleState | undefined {
    return this.agentStates.get(agentId);
  }

  getAllAgentStates(): Map<string, LifecycleState> {
    return new Map(this.agentStates);
  }

  async cleanupAgent(agentId: string): Promise<void> {
    logger.info(`Cleaning up agent ${agentId}`);

    // Stop health monitoring
    this.stopHealthMonitoring(agentId);

    // Clear any timeouts
    const state = this.agentStates.get(agentId);
    if (state) {
      if (state.startupTimeout) {
        clearTimeout(state.startupTimeout);
      }
      if (state.shutdownTimeout) {
        clearTimeout(state.shutdownTimeout);
      }
    }

    // Remove state
    this.agentStates.delete(agentId);

    logger.info(`Agent ${agentId} cleaned up successfully`);
  }

  private getOrCreateState(agent: Agent): LifecycleState {
    let state = this.agentStates.get(agent.id);

    if (!state) {
      state = {
        agentId: agent.id,
        status: agent.status,
        restartCount: 0,
        maxRestarts: this.options.maxRestartAttempts!,
        restartDelay: this.options.restartDelayMs!,
        isShuttingDown: false
      };
      this.agentStates.set(agent.id, state);
    }

    return state;
  }

  private async startAgentProcess(agent: Agent): Promise<number> {
    // Simulate starting an agent process
    // In real implementation, this would use child_process.spawn or similar
    const pid = Math.floor(Math.random() * 10000) + 1000;

    logger.info(`Started agent process ${agent.id} with PID ${pid}`);

    // Simulate process startup
    await this.delay(1000);

    return pid;
  }

  private async stopAgentProcess(pid: number, graceful: boolean): Promise<void> {
    logger.info(`Stopping process ${pid} - ${graceful ? 'graceful' : 'force'}`);

    // Simulate stopping a process
    // In real implementation, this would send SIGTERM for graceful or SIGKILL for force
    await this.delay(graceful ? 2000 : 500);
  }

  private async forceStopAgent(agentId: string): Promise<void> {
    const state = this.agentStates.get(agentId);
    if (state?.pid) {
      logger.warn(`Force killing agent ${agentId} process ${state.pid}`);
      await this.stopAgentProcess(state.pid, false);
    }
  }

  private async validateDependencies(agent: Agent): Promise<void> {
    // Simulate dependency validation
    logger.debug(`Validating dependencies for agent ${agent.id}`);

    for (const dependency of agent.dependencies) {
      // In real implementation, check if dependency is available
      logger.debug(`Checking dependency: ${dependency}`);
    }
  }

  private async checkResourceAvailability(agent: Agent): Promise<void> {
    // Simulate resource availability check
    logger.debug(`Checking resource availability for agent ${agent.id}`);

    // Check if agent's resource quota can be satisfied
    const quota = agent.resourceQuota;

    // In real implementation, check actual system resources
    logger.debug(`Resource requirements - CPU: ${quota.maxCpuCores}, Memory: ${quota.maxMemoryMb}MB`);
  }

  private async waitForAgentHealthy(agentId: string, timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const state = this.agentStates.get(agentId);

      // In real implementation, check actual agent health
      // For simulation, assume agent becomes healthy after a short delay
      await this.delay(1000);

      if (Math.random() > 0.3) { // 70% chance of being healthy
        logger.debug(`Agent ${agentId} is healthy`);
        return;
      }

      await this.delay(1000);
    }

    throw new Error(`Agent ${agentId} did not become healthy within ${timeoutMs}ms`);
  }

  private async waitForAgentStopped(agentId: string, timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const state = this.agentStates.get(agentId);

      // In real implementation, check if process has actually stopped
      // For simulation, assume process stops quickly
      await this.delay(500);

      logger.debug(`Agent ${agentId} process stopped`);
      return;
    }

    throw new Error(`Agent ${agentId} did not stop within ${timeoutMs}ms`);
  }

  private startHealthMonitoring(agent: Agent): void {
    if (this.healthCheckIntervals.has(agent.id)) {
      return; // Already monitoring
    }

    const interval = setInterval(async () => {
      try {
        // In real implementation, perform actual health check
        const state = this.agentStates.get(agent.id);
        if (state) {
          state.lastHealthCheck = new Date();
        }

        // Emit health check event
        this.emit('agent:health:check', {
          agentId: agent.id,
          timestamp: new Date(),
          status: 'healthy'
        });

      } catch (error) {
        logger.error(`Health check failed for agent ${agent.id}:`, error);

        // Handle health check failure
        await this.handleHealthCheckFailure(agent, error);
      }
    }, this.options.healthCheckIntervalMs);

    this.healthCheckIntervals.set(agent.id, interval);
  }

  private stopHealthMonitoring(agentId: string): void {
    const interval = this.healthCheckIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(agentId);
    }
  }

  private async handleStartupFailure(agent: Agent, reason: string): Promise<void> {
    logger.error(`Agent ${agent.id} startup failed: ${reason}`);

    // Auto-restart if enabled and within limits
    if (this.options.autoRestart) {
      const state = this.agentStates.get(agent.id);
      if (state && state.restartCount < this.options.maxRestartAttempts!) {
        logger.info(`Attempting auto-restart for agent ${agent.id} (attempt ${state.restartCount + 1})`);

        setTimeout(async () => {
          try {
            await this.restartAgent(agent);
          } catch (error) {
            logger.error(`Auto-restart failed for agent ${agent.id}:`, error);
          }
        }, state.restartDelay);
      }
    }

    // Emit startup failure event
    this.emit('agent:startup:failed', {
      agentId: agent.id,
      reason,
      timestamp: new Date()
    });
  }

  private async handleHealthCheckFailure(agent: Agent, error: any): Promise<void> {
    logger.error(`Health check failed for agent ${agent.id}:`, error);

    const state = this.agentStates.get(agent.id);
    if (!state) return;

    // Mark as unhealthy but keep running
    state.status = AgentStatus.UNHEALTHY;
    await this.updateAgentStatus(agent.id, AgentStatus.UNHEALTHY);

    // Emit health failure event
    this.emit('agent:health:failed', {
      agentId: agent.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });

    // Consider restart if agent is unhealthy for too long
    if (this.options.autoRestart) {
      setTimeout(async () => {
        try {
          await this.restartAgent(agent);
        } catch (restartError) {
          logger.error(`Health-triggered restart failed for agent ${agent.id}:`, restartError);
        }
      }, 10000); // Wait 10 seconds before restart
    }
  }

  private async emitLifecycleEvent(
    agentId: string,
    action: LifecycleAction,
    status: 'starting' | 'success' | 'failed',
    metadata?: any
  ): Promise<void> {
    const event: LifecycleEvent = {
      id: this.generateEventId(),
      agentId,
      action,
      status,
      timestamp: new Date(),
      metadata
    };

    this.emit('agent:lifecycle:event', event);
    logger.debug(`Lifecycle event: ${action} ${status} for agent ${agentId}`);
  }

  private async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    // Emit status change event
    this.emit('agent:status:changed', {
      agentId,
      status,
      timestamp: new Date()
    });
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down AgentLifecycleManager');

    // Stop all health monitoring
    for (const [agentId] of this.healthCheckIntervals) {
      this.stopHealthMonitoring(agentId);
    }

    // Clear all states
    this.agentStates.clear();

    logger.info('AgentLifecycleManager shutdown complete');
  }
}
