/**
 * TestSchedulerService: Orchestrates cron-based scheduling and parallel test execution.
 *
 * Uses in-memory scheduling with setTimeout-based cron simulation.
 * Can be upgraded to BullMQ + cron-parser when Redis is available.
 *
 * Features:
 * - Cron preset support (hourly, daily, weekly, on-deploy)
 * - Test sharding (by type, browser, or round-robin)
 * - Priority-based execution
 * - Execution plan tracking
 */

import { EventEmitter } from 'events';

type CronPreset = 'hourly' | 'daily' | 'weekly' | 'on-deploy' | 'custom';
type ShardingStrategy = 'by-type' | 'by-browser' | 'round-robin';
type TestType = 'web' | 'mobile' | 'api';
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScheduleConfig {
  projectId: string;
  testIds: string[];
  cronExpression?: string;
  cronPreset?: CronPreset;
  name: string;
  shardingStrategy?: ShardingStrategy;
  maxConcurrentWorkers?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  enabled?: boolean;
}

export interface Schedule {
  scheduleId: string;
  projectId: string;
  name: string;
  testIds: string[];
  cronExpression: string;
  cronPreset?: CronPreset;
  enabled: boolean;
  priority: string;
  shardingStrategy: ShardingStrategy;
  nextRunTime: Date;
  lastRunTime?: Date;
  lastStatus?: ExecutionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shard {
  shardId: string;
  testIndices: number[];
  testType?: TestType;
  browser?: string;
  status: ExecutionStatus;
}

export interface ExecutionPlan {
  scheduleId: string;
  planId: string;
  shards: Shard[];
  totalTests: number;
  startTime: Date;
  status: ExecutionStatus;
}

class TestSchedulerService extends EventEmitter {
  private static instance: TestSchedulerService;
  private schedules = new Map<string, Schedule>();
  private executionPlans = new Map<string, ExecutionPlan>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  private constructor() {
    super();
  }

  static getInstance(): TestSchedulerService {
    if (!TestSchedulerService.instance) {
      TestSchedulerService.instance = new TestSchedulerService();
    }
    return TestSchedulerService.instance;
  }

  /** Create a new schedule */
  async createSchedule(config: ScheduleConfig): Promise<Schedule> {
    const scheduleId = `sched_${config.projectId}_${Date.now()}`;
    const cronExpr = config.cronExpression || this.resolveCronPreset(config.cronPreset);
    const nextRunTime = this.calculateNextRun(cronExpr);

    const schedule: Schedule = {
      scheduleId,
      projectId: config.projectId,
      name: config.name,
      testIds: config.testIds,
      cronExpression: cronExpr,
      cronPreset: config.cronPreset,
      enabled: config.enabled !== false,
      priority: config.priority || 'medium',
      shardingStrategy: config.shardingStrategy || 'round-robin',
      nextRunTime,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.schedules.set(scheduleId, schedule);

    if (schedule.enabled) {
      this.scheduleNextRun(schedule);
    }

    this.emit('schedule:created', schedule);
    return schedule;
  }

  /** Delete a schedule */
  async deleteSchedule(scheduleId: string): Promise<void> {
    const timer = this.timers.get(scheduleId);
    if (timer) clearTimeout(timer);
    this.timers.delete(scheduleId);
    this.schedules.delete(scheduleId);
    this.emit('schedule:deleted', { scheduleId });
  }

  /** Enable or disable a schedule */
  async updateScheduleStatus(scheduleId: string, enabled: boolean): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    schedule.enabled = enabled;
    schedule.updatedAt = new Date();

    if (enabled) {
      schedule.nextRunTime = this.calculateNextRun(schedule.cronExpression);
      this.scheduleNextRun(schedule);
    } else {
      const timer = this.timers.get(scheduleId);
      if (timer) clearTimeout(timer);
      this.timers.delete(scheduleId);
    }
  }

  /** Manually trigger execution for a schedule */
  async triggerExecution(scheduleId: string, testCases: Array<{ id: string; type?: TestType }>): Promise<ExecutionPlan> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

    const shards = this.generateShards(testCases, schedule.shardingStrategy);

    const plan: ExecutionPlan = {
      scheduleId,
      planId: `plan_${Date.now()}`,
      shards,
      totalTests: testCases.length,
      startTime: new Date(),
      status: 'running',
    };

    this.executionPlans.set(plan.planId, plan);
    schedule.lastRunTime = new Date();
    schedule.lastStatus = 'running';

    this.emit('execution:started', plan);
    return plan;
  }

  /** Get all schedules */
  getAllSchedules(): Schedule[] {
    return Array.from(this.schedules.values());
  }

  /** Get execution plan by ID */
  getExecutionPlan(planId: string): ExecutionPlan | undefined {
    return this.executionPlans.get(planId);
  }

  /** Cleanup */
  async close(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  // ─── Private helpers ─────────────────────────────────────────────

  private resolveCronPreset(preset?: CronPreset): string {
    const presets: Record<CronPreset, string> = {
      'hourly': '0 * * * *',
      'daily': '0 9 * * *',
      'weekly': '0 9 * * 1',
      'on-deploy': '* * * * *', // Triggered externally
      'custom': '0 * * * *',
    };
    return presets[preset || 'daily'];
  }

  private calculateNextRun(cronExpr: string): Date {
    // Simple next-run calculation based on cron pattern
    const parts = cronExpr.split(' ');
    const now = new Date();
    const minute = parts[0] === '*' ? now.getMinutes() : parseInt(parts[0]);
    const hour = parts[1] === '*' ? now.getHours() : parseInt(parts[1]);

    const next = new Date(now);
    next.setMinutes(minute);
    next.setHours(hour);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  private scheduleNextRun(schedule: Schedule): void {
    const delay = Math.max(0, schedule.nextRunTime.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.emit('schedule:triggered', schedule);
      schedule.lastRunTime = new Date();
      schedule.nextRunTime = this.calculateNextRun(schedule.cronExpression);
      schedule.updatedAt = new Date();
      if (schedule.enabled) this.scheduleNextRun(schedule);
    }, Math.min(delay, 2147483647)); // Cap at max setTimeout value
    this.timers.set(schedule.scheduleId, timer);
  }

  private generateShards(
    testCases: Array<{ id: string; type?: TestType }>,
    strategy: ShardingStrategy,
    workerCount = 3
  ): Shard[] {
    const shards: Shard[] = [];

    if (strategy === 'by-type') {
      const byType = new Map<string, number[]>();
      testCases.forEach((tc, i) => {
        const type = tc.type || 'web';
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push(i);
      });
      let idx = 0;
      for (const [type, indices] of byType) {
        shards.push({
          shardId: `shard_${idx++}`,
          testIndices: indices,
          testType: type as TestType,
          status: 'pending',
        });
      }
    } else {
      // round-robin
      for (let i = 0; i < workerCount; i++) {
        shards.push({ shardId: `shard_${i}`, testIndices: [], status: 'pending' });
      }
      testCases.forEach((_, i) => {
        shards[i % workerCount].testIndices.push(i);
      });
    }

    return shards.filter(s => s.testIndices.length > 0);
  }
}

export default TestSchedulerService.getInstance();
