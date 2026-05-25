/**
 * IntegrationEventBus — Enterprise Event Distribution Layer
 *
 * Centralized event bus that subscribes to ALL Qestro internal service events
 * and dispatches them to external integrations (OpenClaw, Qestro AI, Webhooks).
 *
 * Architecture:
 *   AutomationRunService ──╮
 *   PlaywrightExecutorService ──┤── IntegrationEventBus ──┬── OpenClawBridgeService
 *   AITestMaintenanceEngine ──╯                           ├── QestroAIBridgeService
 *   SecurityService ──────────╯                           └── WebhookService (future)
 *
 * @example
 *   import { integrationEventBus } from './IntegrationEventBus';
 *   integrationEventBus.initialize(); // Call once at server startup
 */

import { logger } from '../utils/logger.js';
import { OpenClawBridgeService } from './OpenClawBridgeService.js';
import type { TestFailureEvent, SuiteCompletionEvent, SecurityAlertEvent, SelfHealingEvent } from './OpenClawBridgeService.js';
import { QestroAIBridgeService } from './QestroAIBridgeService.js';

// ─── Configuration ─────────────────────────────────────────────────────

interface IntegrationConfig {
    enabled: boolean;
    openClawEnabled: boolean;
    qestroAIEnabled: boolean;
    throttleMs: number;
    batchWindowMs: number;
    retryAttempts: number;
    retryDelayMs: number;
    silentMode: boolean;
    eventFilter: {
        testFailures: boolean;
        suiteCompletions: boolean;
        securityAlerts: boolean;
        selfHealing: boolean;
        maintenanceEvents: boolean;
        coverageAlerts: boolean;
        dailySummary: boolean;
    };
}

const DEFAULT_CONFIG: IntegrationConfig = {
    enabled: true,
    openClawEnabled: true,
    qestroAIEnabled: true,
    throttleMs: 5000,
    batchWindowMs: 10000,
    retryAttempts: 3,
    retryDelayMs: 2000,
    silentMode: false,
    eventFilter: {
        testFailures: true,
        suiteCompletions: true,
        securityAlerts: true,
        selfHealing: true,
        maintenanceEvents: true,
        coverageAlerts: true,
        dailySummary: true,
    },
};

// ─── Event Types ───────────────────────────────────────────────────────

interface IntegrationEvent {
    id: string;
    type: string;
    source: string;
    timestamp: string;
    data: any;
    priority: 'low' | 'normal' | 'high' | 'critical';
}

// ─── Main Service ──────────────────────────────────────────────────────

export class IntegrationEventBus {
    private static instance: IntegrationEventBus;
    private config: IntegrationConfig;
    private openClawBridge: OpenClawBridgeService;
    private qestroAIBridge: QestroAIBridgeService;
    private eventLog: IntegrationEvent[] = [];
    private throttleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private initialized = false;
    private metrics = {
        eventsReceived: 0,
        eventsDispatched: 0,
        eventsFailed: 0,
        eventsThrottled: 0,
        lastEventTimestamp: '',
    };

    private constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.openClawBridge = OpenClawBridgeService.getInstance();
        this.qestroAIBridge = QestroAIBridgeService.getInstance();
    }

    static getInstance(): IntegrationEventBus {
        if (!IntegrationEventBus.instance) {
            IntegrationEventBus.instance = new IntegrationEventBus();
        }
        return IntegrationEventBus.instance;
    }

    // ── Initialization ─────────────────────────────────────────────

    /**
     * Initialize the event bus and wire into all service event emitters.
     * Call this ONCE at server startup after all services are instantiated.
     */
    initialize(): void {
        if (this.initialized) {
            logger.warn('[IntegrationEventBus] Already initialized');
            return;
        }

        if (!this.config.enabled) {
            logger.info('[IntegrationEventBus] Disabled via config');
            return;
        }

        logger.info('[IntegrationEventBus] Initializing enterprise integration layer...');

        this.wireAutomationRunService();
        this.wirePlaywrightExecutorService();
        this.wireAITestMaintenanceEngine();
        this.startDailySummarySchedule();

        this.initialized = true;
        logger.info('[IntegrationEventBus] ✅ Enterprise integration layer active');
        logger.info(`[IntegrationEventBus]   OpenClaw: ${this.config.openClawEnabled ? '✅' : '❌'}`);
        logger.info(`[IntegrationEventBus]   Qestro AI: ${this.config.qestroAIEnabled ? '✅' : '❌'}`);
    }

    // ── Service Wiring ─────────────────────────────────────────────

    private wireAutomationRunService(): void {
        try {
            // Dynamic import to avoid circular deps at module level
            const { automationRunService } = require('./AutomationRunService.js');

            // Test failures — individual test case failures
            automationRunService.on('test:completed', ({ run, result }: any) => {
                if (result.status === 'failed' && this.config.eventFilter.testFailures) {
                    this.dispatchTestFailure(run, result);
                }
            });

            // Suite completions — entire run finished
            automationRunService.on('run:completed', (run: any) => {
                if (this.config.eventFilter.suiteCompletions) {
                    this.dispatchSuiteCompletion(run);
                }
            });

            // Run failures — catastrophic run failure
            automationRunService.on('run:failed', (run: any) => {
                if (this.config.eventFilter.testFailures) {
                    this.dispatchRunFailure(run);
                }
            });

            logger.info('[IntegrationEventBus]   ✅ AutomationRunService wired');
        } catch (err) {
            logger.warn('[IntegrationEventBus]   ⚠️ AutomationRunService not available:', err);
        }
    }

    private wirePlaywrightExecutorService(): void {
        try {
            const { PlaywrightExecutorService } = require('./PlaywrightExecutorService.js');
            const executor = PlaywrightExecutorService.getInstance();

            executor.on('test:completed', (result: any) => {
                if (result.status === 'failed' && this.config.eventFilter.testFailures) {
                    this.dispatchPlaywrightFailure(result);
                }
            });

            logger.info('[IntegrationEventBus]   ✅ PlaywrightExecutorService wired');
        } catch (err) {
            logger.warn('[IntegrationEventBus]   ⚠️ PlaywrightExecutorService not available:', err);
        }
    }

    private wireAITestMaintenanceEngine(): void {
        try {
            const { aiTestMaintenanceEngine } = require('./AITestMaintenanceEngine.js');

            aiTestMaintenanceEngine.on('maintenance:completed', (event: any) => {
                if (this.config.eventFilter.selfHealing) {
                    this.dispatchMaintenanceComplete(event);
                }
            });

            aiTestMaintenanceEngine.on('maintenance:failed', (event: any) => {
                if (this.config.eventFilter.maintenanceEvents) {
                    this.dispatchMaintenanceFailed(event);
                }
            });

            logger.info('[IntegrationEventBus]   ✅ AITestMaintenanceEngine wired');
        } catch (err) {
            logger.warn('[IntegrationEventBus]   ⚠️ AITestMaintenanceEngine not available:', err);
        }
    }

    // ── Event Dispatchers ──────────────────────────────────────────

    private async dispatchTestFailure(run: any, result: any): Promise<void> {
        const eventId = `test_fail_${result.id}`;
        if (this.isThrottled(eventId)) return;

        this.metrics.eventsReceived++;
        this.recordEvent(eventId, 'test:failure', 'AutomationRunService', result, 'high');

        // → OpenClaw: Notify team about failure
        if (this.config.openClawEnabled) {
            try {
                const event: TestFailureEvent = {
                    testName: result.testCaseName,
                    testId: result.testCaseId,
                    suiteName: run.name,
                    error: result.error?.message || 'Unknown error',
                    stackTrace: result.error?.stack,
                    runId: run.id,
                    platform: 'web',
                    duration: result.duration,
                    screenshotUrl: result.artifacts?.screenshots?.[0],
                    dashboardUrl: `https://qestro.app/runs/${run.id}`,
                };
                await this.openClawBridge.onTestFailed(event);
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
                logger.error('[IntegrationEventBus] OpenClaw dispatch failed:', err);
            }
        }

        // → Qestro AI: Request AI failure analysis
        if (this.config.qestroAIEnabled && result.error) {
            try {
                const analysis = await this.qestroAIBridge.analyzeFailure({
                    testName: result.testCaseName,
                    errorMessage: result.error.message,
                    stackTrace: result.error.stack || '',
                    testCode: '',
                    screenshots: result.artifacts?.screenshots,
                });
                logger.info(`[IntegrationEventBus] Qestro AI analysis: ${analysis.rootCause}`);
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
                logger.error('[IntegrationEventBus] Qestro AI analysis failed:', err);
            }
        }

        this.throttle(eventId);
    }

    private async dispatchSuiteCompletion(run: any): Promise<void> {
        const eventId = `suite_complete_${run.id}`;
        if (this.isThrottled(eventId)) return;

        this.metrics.eventsReceived++;
        this.recordEvent(eventId, 'suite:completed', 'AutomationRunService', run, 'normal');

        if (this.config.openClawEnabled) {
            try {
                const event: SuiteCompletionEvent = {
                    suiteName: run.name,
                    suiteId: run.testPlanId || run.id,
                    runId: run.id,
                    totalTests: run.totalTests,
                    passed: run.passedTests,
                    failed: run.failedTests,
                    skipped: run.skippedTests,
                    duration: run.duration || 0,
                    coverage: run.metadata?.coverage,
                    selfHealed: run.metadata?.selfHealed,
                    dashboardUrl: `https://qestro.app/runs/${run.id}`,
                };
                await this.openClawBridge.onSuiteCompleted(event);
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
                logger.error('[IntegrationEventBus] OpenClaw suite dispatch failed:', err);
            }
        }

        // Auto-trigger coverage drop alerts
        if (this.config.eventFilter.coverageAlerts && run.metadata?.previousCoverage) {
            const drop = run.metadata.previousCoverage - (run.metadata.coverage || 0);
            if (drop > 5) {
                await this.dispatchCoverageDrop(run.metadata.previousCoverage, run.metadata.coverage);
            }
        }

        this.throttle(eventId);
    }

    private async dispatchRunFailure(run: any): Promise<void> {
        const eventId = `run_fail_${run.id}`;
        if (this.isThrottled(eventId)) return;

        this.metrics.eventsReceived++;
        this.recordEvent(eventId, 'run:failure', 'AutomationRunService', run, 'critical');

        if (this.config.openClawEnabled) {
            try {
                await this.openClawBridge.sendMessage(
                    `🚨 CRITICAL: Test run "${run.name}" CRASHED\n\n` +
                    `Error: ${run.metadata?.error || 'Unknown'}\n` +
                    `Tests completed: ${run.passedTests + run.failedTests}/${run.totalTests}\n` +
                    `Duration: ${run.duration ? (run.duration / 1000).toFixed(1) + 's' : 'N/A'}\n\n` +
                    `Dashboard: https://qestro.app/runs/${run.id}`,
                    { name: 'Qestro-RunCrash', channel: 'slack', thinking: 'high' as any }
                );
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
            }
        }

        this.throttle(eventId);
    }

    private async dispatchPlaywrightFailure(result: any): Promise<void> {
        const eventId = `pw_fail_${result.testId}`;
        if (this.isThrottled(eventId)) return;

        this.metrics.eventsReceived++;

        if (this.config.qestroAIEnabled && result.error) {
            try {
                await this.qestroAIBridge.healFailedTest({
                    failedTest: result.testId,
                    errorLog: result.error.message,
                    stackTrace: result.error.stack || '',
                    screenshots: result.artifacts?.screenshots,
                });
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
            }
        }

        this.throttle(eventId);
    }

    private async dispatchMaintenanceComplete(event: any): Promise<void> {
        const eventId = `maint_${event.maintenanceId}`;
        this.metrics.eventsReceived++;
        this.recordEvent(eventId, 'maintenance:completed', 'AITestMaintenanceEngine', event, 'normal');

        if (this.config.openClawEnabled && event.summary) {
            try {
                const selfHealEvent: SelfHealingEvent = {
                    testName: `Maintenance batch: ${event.type}`,
                    testId: event.maintenanceId,
                    healingType: 'locator_update',
                    originalError: `${event.summary.fixedIssues} issues detected`,
                    fixApplied: `${event.summary.modifiedTests} tests modified, ${event.summary.optimizations} optimized`,
                    confidence: 85,
                };
                await this.openClawBridge.onSelfHealing(selfHealEvent);
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
            }
        }
    }

    private async dispatchMaintenanceFailed(event: any): Promise<void> {
        this.metrics.eventsReceived++;

        if (this.config.openClawEnabled) {
            try {
                await this.openClawBridge.sendMessage(
                    `⚠️ AI Maintenance Failed\n\nUser: ${event.userId}\nType: ${event.request?.maintenanceType}\nError: ${event.error}\n\nManual intervention may be needed.`,
                    { name: 'Qestro-MaintenanceFail', channel: 'slack' }
                );
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
            }
        }
    }

    private async dispatchCoverageDrop(before: number, after: number): Promise<void> {
        if (this.config.openClawEnabled) {
            try {
                await this.openClawBridge.sendMessage(
                    `📉 Coverage Drop Alert\n\nBefore: ${before}%\nAfter: ${after}%\nDelta: -${(before - after).toFixed(1)}%\n\nInvestigate recent changes.`,
                    { name: 'Qestro-CoverageDrop', channel: 'slack', thinking: 'medium' as any }
                );
            } catch (err) { /* silent */ }
        }
    }

    // ── Security Alerts (can be called directly) ───────────────────

    async dispatchSecurityAlert(alert: SecurityAlertEvent): Promise<void> {
        this.metrics.eventsReceived++;
        this.recordEvent(`sec_${Date.now()}`, 'security:alert', 'SecurityService', alert, 'critical');

        if (this.config.openClawEnabled && this.config.eventFilter.securityAlerts) {
            try {
                await this.openClawBridge.onSecurityAlert(alert);
                this.metrics.eventsDispatched++;
            } catch (err) {
                this.metrics.eventsFailed++;
            }
        }
    }

    // ── Daily Summary ──────────────────────────────────────────────

    private startDailySummarySchedule(): void {
        if (!this.config.eventFilter.dailySummary) return;

        // Run daily at midnight UTC
        const runDaily = () => {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setUTCHours(24, 0, 0, 0);
            const msUntilMidnight = midnight.getTime() - now.getTime();

            setTimeout(async () => {
                await this.sendDailySummary();
                runDaily(); // Schedule next
            }, msUntilMidnight);
        };

        runDaily();
        logger.info('[IntegrationEventBus]   ✅ Daily summary scheduled');
    }

    private async sendDailySummary(): Promise<void> {
        if (!this.config.openClawEnabled) return;

        try {
            const stats = this.compileDailyStats();
            await this.openClawBridge.sendDailySummary(stats);
            logger.info('[IntegrationEventBus] Daily summary sent');
        } catch (err) {
            logger.error('[IntegrationEventBus] Daily summary failed:', err);
        }
    }

    private compileDailyStats(): any {
        const today = new Date().toISOString().split('T')[0];
        const todayEvents = this.eventLog.filter(e => e.timestamp.startsWith(today));
        const failures = todayEvents.filter(e => e.type.includes('failure'));

        return {
            totalRuns: todayEvents.filter(e => e.type === 'suite:completed').length,
            passed: todayEvents.filter(e => e.priority === 'normal').length,
            failed: failures.length,
            coverage: 85,
            selfHealed: todayEvents.filter(e => e.type === 'maintenance:completed').length,
            topFailures: [],
        };
    }

    // ── Throttling ─────────────────────────────────────────────────

    private isThrottled(eventId: string): boolean {
        if (this.throttleTimers.has(eventId)) {
            this.metrics.eventsThrottled++;
            return true;
        }
        return false;
    }

    private throttle(eventId: string): void {
        const timer = setTimeout(() => {
            this.throttleTimers.delete(eventId);
        }, this.config.throttleMs);
        this.throttleTimers.set(eventId, timer);
    }

    // ── Event Logging ──────────────────────────────────────────────

    private recordEvent(id: string, type: string, source: string, data: any, priority: IntegrationEvent['priority']): void {
        const event: IntegrationEvent = {
            id,
            type,
            source,
            timestamp: new Date().toISOString(),
            data,
            priority,
        };
        this.eventLog.push(event);
        this.metrics.lastEventTimestamp = event.timestamp;

        // Keep only last 1000 events in memory
        if (this.eventLog.length > 1000) {
            this.eventLog = this.eventLog.slice(-500);
        }
    }

    // ── Public API ─────────────────────────────────────────────────

    getMetrics(): typeof this.metrics {
        return { ...this.metrics };
    }

    getRecentEvents(limit = 20): IntegrationEvent[] {
        return this.eventLog.slice(-limit);
    }

    getConfig(): IntegrationConfig {
        return { ...this.config };
    }

    updateConfig(updates: Partial<IntegrationConfig> & { openHandsEnabled?: boolean }): void {
        const normalizedUpdates: Partial<IntegrationConfig> = { ...updates };

        if (updates.openHandsEnabled !== undefined && normalizedUpdates.qestroAIEnabled === undefined) {
            normalizedUpdates.qestroAIEnabled = updates.openHandsEnabled;
        }

        delete (normalizedUpdates as { openHandsEnabled?: boolean }).openHandsEnabled;
        this.config = { ...this.config, ...normalizedUpdates };
        logger.info('[IntegrationEventBus] Config updated:', { updates });
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}

// ── Singleton Export ────────────────────────────────────────────────────

export const integrationEventBus = IntegrationEventBus.getInstance();
