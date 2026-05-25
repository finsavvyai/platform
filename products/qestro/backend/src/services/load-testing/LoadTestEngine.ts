import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { VirtualUserPool } from './VirtualUserPool.js';
import { MetricsCollector } from './MetricsCollector.js';
import type {
  LoadTestConfig,
  LoadTestResult,
  LoadTestMetrics,
  ThresholdRule,
} from './types.js';

export class LoadTestEngine {
  private activeTests: Map<string, LoadTestState> = new Map();
  private maxConcurrentTests: number = 10;

  async startLoadTest(config: LoadTestConfig): Promise<string> {
    if (this.activeTests.size >= this.maxConcurrentTests) {
      throw new Error('Maximum concurrent tests reached');
    }

    const runId = uuidv4();
    const metricsCollector = new MetricsCollector();
    const virtualUserPool = new VirtualUserPool(config, metricsCollector);

    const state: LoadTestState = {
      runId,
      config,
      startTime: Date.now(),
      endTime: 0,
      metricsCollector,
      virtualUserPool,
      isRunning: true,
      error: undefined,
    };

    this.activeTests.set(runId, state);
    logger.info(`Load test started: ${runId}`, { testId: config.testId });

    this.executeLoadTest(runId).catch((error) => {
      logger.error(`Load test error: ${runId}`, { error: error.message });
      state.error = error.message;
      state.isRunning = false;
    });

    return runId;
  }

  async stopLoadTest(runId: string): Promise<void> {
    const state = this.activeTests.get(runId);
    if (!state) throw new Error(`Load test not found: ${runId}`);

    state.isRunning = false;
    await state.virtualUserPool.shutdown();
    logger.info(`Load test stopped: ${runId}`);
  }

  async getResults(runId: string): Promise<LoadTestResult> {
    const state = this.activeTests.get(runId);
    if (!state) throw new Error(`Load test not found: ${runId}`);

    const finalMetrics = state.metricsCollector.getSnapshot();
    const thresholdViolations = this.checkThresholds(
      state.config.thresholdRules || [],
      finalMetrics,
    );

    const result: LoadTestResult = {
      runId,
      testId: state.config.testId,
      projectId: state.config.projectId,
      userId: state.config.userId,
      startTime: state.startTime,
      endTime: state.endTime,
      durationMs: state.endTime - state.startTime,
      config: state.config,
      finalMetrics,
      metricsTimeSeries: state.metricsCollector.getTimeSeries(),
      peakVirtualUsers: state.virtualUserPool.getPeakUserCount(),
      status: state.isRunning ? 'running' : 'completed',
      error: state.error,
      thresholdViolations,
    };

    return result;
  }

  private async executeLoadTest(runId: string): Promise<void> {
    const state = this.activeTests.get(runId);
    if (!state) return;

    try {
      const { config, virtualUserPool } = state;
      const startTime = Date.now();
      let currentVirtualUsers = config.initialVirtualUsers;

      // Initial spawn
      await virtualUserPool.spawn(currentVirtualUsers);

      while (state.isRunning && Date.now() - startTime < config.testDurationMs) {
        const elapsedMs = Date.now() - startTime;
        const progressRatio = elapsedMs / config.testDurationMs;

        if (config.loadProfile === 'constant') {
          // Keep constant load
        } else if (config.loadProfile === 'ramp_up') {
          const rampDuration = config.rampUpDurationMs || config.testDurationMs;
          if (elapsedMs < rampDuration) {
            const targetUsers = Math.floor(
              config.initialVirtualUsers +
                (config.maxVirtualUsers - config.initialVirtualUsers) * progressRatio,
            );
            if (targetUsers > currentVirtualUsers) {
              await virtualUserPool.rampUp(targetUsers - currentVirtualUsers);
              currentVirtualUsers = targetUsers;
            }
          }
        } else if (config.loadProfile === 'spike') {
          const spikeDuration = config.spikeDurationMs || 10000;
          if (elapsedMs < spikeDuration && elapsedMs > spikeDuration / 2) {
            if (currentVirtualUsers < config.maxVirtualUsers) {
              await virtualUserPool.rampUp(config.maxVirtualUsers - currentVirtualUsers);
              currentVirtualUsers = config.maxVirtualUsers;
            }
          } else if (elapsedMs > spikeDuration && currentVirtualUsers > config.initialVirtualUsers) {
            await virtualUserPool.rampDown(currentVirtualUsers - config.initialVirtualUsers);
            currentVirtualUsers = config.initialVirtualUsers;
          }
        } else if (config.loadProfile === 'step') {
          const stepDuration = config.stepDurationMs || 30000;
          const stepCount = Math.floor(elapsedMs / stepDuration);
          const targetUsers = Math.min(
            config.initialVirtualUsers + (stepCount * (config.stepIncrement || 10)),
            config.maxVirtualUsers,
          );
          if (targetUsers > currentVirtualUsers) {
            await virtualUserPool.rampUp(targetUsers - currentVirtualUsers);
            currentVirtualUsers = targetUsers;
          }
        }

        // Check thresholds
        const metrics = state.metricsCollector.getSnapshot();
        const violations = this.checkThresholds(config.thresholdRules || [], metrics);
        if (violations.some((v) => v.rule.action === 'stop')) {
          state.isRunning = false;
          logger.warn(`Threshold violated, stopping load test: ${runId}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await virtualUserPool.shutdown();
      state.endTime = Date.now();
      state.isRunning = false;
      logger.info(`Load test completed: ${runId}`);
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Unknown error';
      state.isRunning = false;
    }
  }

  private checkThresholds(
    rules: ThresholdRule[],
    metrics: LoadTestMetrics,
  ): { rule: ThresholdRule; value: number }[] {
    const violations: { rule: ThresholdRule; value: number }[] = [];

    for (const rule of rules) {
      let value = 0;
      if (rule.metric === 'errorRate') value = metrics.errorRate;
      else if (rule.metric === 'p95Latency') value = metrics.p95Latency;
      else if (rule.metric === 'throughput') value = metrics.throughput;
      else if (rule.metric === 'avgLatency') value = metrics.avgLatency;

      const violated =
        (rule.operator === '>' && value > rule.value) ||
        (rule.operator === '<' && value < rule.value) ||
        (rule.operator === '>=' && value >= rule.value) ||
        (rule.operator === '<=' && value <= rule.value) ||
        (rule.operator === '=' && value === rule.value);

      if (violated) violations.push({ rule, value });
    }

    return violations;
  }
}

interface LoadTestState {
  runId: string;
  config: LoadTestConfig;
  startTime: number;
  endTime: number;
  metricsCollector: MetricsCollector;
  virtualUserPool: VirtualUserPool;
  isRunning: boolean;
  error?: string;
}

export const loadTestEngine = new LoadTestEngine();
