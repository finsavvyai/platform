/**
 * NotificationRouterService — Multi-Channel QA Notification Router (P1)
 * 
 * Intelligent routing of QA events to the right people on the right channels
 * based on severity, event type, and team configuration.
 * 
 * Channels supported via OpenClaw:
 *   WhatsApp, Telegram, Slack, Discord, Signal, iMessage, MS Teams
 * 
 * Architecture:
 *   Qestro Event → NotificationRouter → OpenClaw Bridge → Gateway → Channels
 * 
 * @see docs/research/OPENCLAW_INTEGRATION.md (Strategy #3)
 */

import {
    OpenClawBridgeService,
    type OpenClawChannel,
    type OpenClawHookResponse,
} from './OpenClawBridgeService.js';

// ─── Types ─────────────────────────────────────────────────────────────

export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type NotificationEventType =
    | 'test_failure'
    | 'suite_completed'
    | 'security_alert'
    | 'self_healing'
    | 'deployment_gate'
    | 'daily_summary'
    | 'coverage_drop'
    | 'flaky_test_detected'
    | 'custom';

export interface NotificationRecipient {
    id: string;
    name: string;
    role: 'qa_lead' | 'qa_engineer' | 'developer' | 'security' | 'release_manager' | 'stakeholder';
    channels: OpenClawChannel[];
    contactId?: string; // OpenClaw contact ID or phone/email
}

export interface NotificationRule {
    id: string;
    eventType: NotificationEventType;
    severity: NotificationSeverity[];
    channels: OpenClawChannel[];
    recipients: string[]; // recipient IDs
    enabled: boolean;
    quietHours?: {
        start: string; // HH:mm format
        end: string;
        timezone: string;
        fallbackChannel?: OpenClawChannel;
    };
    throttle?: {
        maxPerHour: number;
        groupBy?: string; // e.g., 'testId', 'suiteId'
    };
    template?: string; // Custom message template
}

export interface NotificationEvent {
    type: NotificationEventType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    dashboardUrl?: string;
    timestamp?: string;
}

export interface NotificationResult {
    eventType: NotificationEventType;
    severity: NotificationSeverity;
    dispatched: Array<{
        channel: OpenClawChannel;
        recipientId?: string;
        success: boolean;
        error?: string;
    }>;
    throttled: boolean;
    quietHoursActive: boolean;
}

interface ThrottleEntry {
    count: number;
    firstSent: number;
    lastSent: number;
}

// ─── Default Rules ─────────────────────────────────────────────────────

const DEFAULT_RULES: NotificationRule[] = [
    {
        id: 'rule_critical_failure',
        eventType: 'test_failure',
        severity: ['critical', 'high'],
        channels: ['slack', 'whatsapp'],
        recipients: ['qa_lead'],
        enabled: true,
        throttle: { maxPerHour: 10, groupBy: 'testId' },
    },
    {
        id: 'rule_minor_failure',
        eventType: 'test_failure',
        severity: ['medium', 'low'],
        channels: ['slack'],
        recipients: ['qa_team'],
        enabled: true,
        throttle: { maxPerHour: 20 },
    },
    {
        id: 'rule_suite_complete',
        eventType: 'suite_completed',
        severity: ['info', 'low', 'medium', 'high', 'critical'],
        channels: ['slack'],
        recipients: ['qa_team'],
        enabled: true,
    },
    {
        id: 'rule_security_critical',
        eventType: 'security_alert',
        severity: ['critical', 'high'],
        channels: ['slack', 'telegram'],
        recipients: ['security_team', 'qa_lead'],
        enabled: true,
    },
    {
        id: 'rule_security_low',
        eventType: 'security_alert',
        severity: ['medium', 'low'],
        channels: ['slack'],
        recipients: ['security_team'],
        enabled: true,
    },
    {
        id: 'rule_self_healing',
        eventType: 'self_healing',
        severity: ['info', 'low', 'medium', 'high', 'critical'],
        channels: ['slack'],
        recipients: ['dev_team'],
        enabled: true,
        throttle: { maxPerHour: 10 },
    },
    {
        id: 'rule_deployment_gate',
        eventType: 'deployment_gate',
        severity: ['info', 'low', 'medium', 'high', 'critical'],
        channels: ['slack', 'whatsapp'],
        recipients: ['release_manager'],
        enabled: true,
    },
    {
        id: 'rule_daily_summary',
        eventType: 'daily_summary',
        severity: ['info', 'low', 'medium', 'high', 'critical'],
        channels: ['telegram'],
        recipients: ['stakeholders'],
        enabled: true,
    },
    {
        id: 'rule_coverage_drop',
        eventType: 'coverage_drop',
        severity: ['high', 'critical'],
        channels: ['slack'],
        recipients: ['qa_lead', 'qa_team'],
        enabled: true,
    },
    {
        id: 'rule_flaky_test',
        eventType: 'flaky_test_detected',
        severity: ['medium', 'high'],
        channels: ['slack'],
        recipients: ['dev_team'],
        enabled: true,
        throttle: { maxPerHour: 5, groupBy: 'testId' },
    },
];

// ─── Service ───────────────────────────────────────────────────────────

export class NotificationRouterService {
    private static instance: NotificationRouterService;
    private bridge: OpenClawBridgeService;
    private rules: NotificationRule[];
    private recipients: Map<string, NotificationRecipient> = new Map();
    private throttleMap: Map<string, ThrottleEntry> = new Map();
    private notificationLog: Array<{
        timestamp: string;
        eventType: string;
        severity: string;
        channels: string[];
        throttled: boolean;
    }> = [];
    private readonly MAX_LOG = 200;

    private constructor() {
        this.bridge = OpenClawBridgeService.getInstance();
        this.rules = [...DEFAULT_RULES];

        // Seed default recipient groups
        this.seedDefaultRecipients();

        console.log('📨 [NotificationRouter] Service initialized');
        console.log(`   Rules: ${this.rules.length} active`);
        console.log(`   Recipients: ${this.recipients.size} configured`);
    }

    public static getInstance(): NotificationRouterService {
        if (!NotificationRouterService.instance) {
            NotificationRouterService.instance = new NotificationRouterService();
        }
        return NotificationRouterService.instance;
    }

    // ─── Core Routing ────────────────────────────────────────────────

    /**
     * Route a notification event to appropriate channels based on rules
     */
    public async dispatch(event: NotificationEvent): Promise<NotificationResult> {
        const result: NotificationResult = {
            eventType: event.type,
            severity: event.severity,
            dispatched: [],
            throttled: false,
            quietHoursActive: false,
        };

        // Find matching rules
        const matchingRules = this.rules.filter(
            (rule) =>
                rule.enabled &&
                rule.eventType === event.type &&
                rule.severity.includes(event.severity)
        );

        if (matchingRules.length === 0) {
            console.log(`📨 [NotificationRouter] No matching rules for ${event.type}:${event.severity}`);
            return result;
        }

        // Collect unique channel dispatches
        const dispatches: Array<{ channel: OpenClawChannel; recipientId?: string }> = [];

        for (const rule of matchingRules) {
            // Check throttle
            if (rule.throttle) {
                const throttleKey = this.getThrottleKey(rule, event);
                if (this.isThrottled(throttleKey, rule.throttle.maxPerHour)) {
                    result.throttled = true;
                    continue;
                }
                this.recordThrottle(throttleKey);
            }

            // Check quiet hours
            if (rule.quietHours) {
                if (this.isQuietHours(rule.quietHours)) {
                    result.quietHoursActive = true;
                    // Use fallback channel if configured, otherwise skip
                    if (rule.quietHours.fallbackChannel) {
                        dispatches.push({ channel: rule.quietHours.fallbackChannel });
                    }
                    continue;
                }
            }

            // Add channels from rule
            for (const channel of rule.channels) {
                for (const recipientId of rule.recipients) {
                    const exists = dispatches.some(
                        (d) => d.channel === channel && d.recipientId === recipientId
                    );
                    if (!exists) {
                        dispatches.push({ channel, recipientId });
                    }
                }
            }
        }

        // Execute dispatches
        for (const dispatch of dispatches) {
            try {
                const formattedMessage = this.formatMessage(event, dispatch.channel);

                const hookResult = await this.bridge.sendMessage(formattedMessage, {
                    name: `Qestro-${this.capitalizeEventType(event.type)}`,
                    channel: dispatch.channel,
                    thinking: this.getThinkingLevel(event.severity),
                });

                result.dispatched.push({
                    channel: dispatch.channel,
                    recipientId: dispatch.recipientId,
                    success: hookResult.success,
                    error: hookResult.error,
                });
            } catch (error: any) {
                result.dispatched.push({
                    channel: dispatch.channel,
                    recipientId: dispatch.recipientId,
                    success: false,
                    error: error.message,
                });
            }
        }

        // Log the notification
        this.logNotification(event, result);

        return result;
    }

    // ─── Convenience Dispatchers ──────────────────────────────────────

    /**
     * Dispatch a critical test failure
     */
    public async notifyTestFailure(
        testName: string,
        error: string,
        options?: {
            severity?: NotificationSeverity;
            suiteName?: string;
            runId?: string;
            dashboardUrl?: string;
        }
    ): Promise<NotificationResult> {
        return this.dispatch({
            type: 'test_failure',
            severity: options?.severity || 'high',
            title: `Test Failed: ${testName}`,
            message: error,
            metadata: {
                testName,
                suiteName: options?.suiteName,
                runId: options?.runId,
            },
            dashboardUrl: options?.dashboardUrl,
        });
    }

    /**
     * Dispatch a deployment gate result
     */
    public async notifyDeploymentGate(
        passed: boolean,
        stats: { totalTests: number; passed: number; failed: number; coverage: number }
    ): Promise<NotificationResult> {
        return this.dispatch({
            type: 'deployment_gate',
            severity: passed ? 'info' : 'critical',
            title: passed ? '✅ Deployment Gate PASSED' : '🚫 Deployment Gate BLOCKED',
            message: `Tests: ${stats.passed}/${stats.totalTests} passed | Coverage: ${stats.coverage}% | ${stats.failed} failures`,
            metadata: stats,
        });
    }

    /**
     * Dispatch a coverage drop alert
     */
    public async notifyCoverageDrop(
        previousCoverage: number,
        currentCoverage: number,
        threshold: number
    ): Promise<NotificationResult> {
        const drop = previousCoverage - currentCoverage;
        return this.dispatch({
            type: 'coverage_drop',
            severity: drop > 10 ? 'critical' : drop > 5 ? 'high' : 'medium',
            title: `📉 Coverage dropped ${drop.toFixed(1)}%`,
            message: `Coverage went from ${previousCoverage}% to ${currentCoverage}% (threshold: ${threshold}%)`,
            metadata: { previousCoverage, currentCoverage, threshold, drop },
        });
    }

    /**
     * Dispatch a flaky test detection
     */
    public async notifyFlakyTest(
        testName: string,
        flakinessScore: number,
        recentResults: Array<{ status: 'passed' | 'failed'; timestamp: string }>
    ): Promise<NotificationResult> {
        return this.dispatch({
            type: 'flaky_test_detected',
            severity: flakinessScore > 0.5 ? 'high' : 'medium',
            title: `🎲 Flaky Test Detected: ${testName}`,
            message: `Flakiness score: ${(flakinessScore * 100).toFixed(0)}% | Recent: ${recentResults.map(r => r.status === 'passed' ? '✅' : '❌').join('')}`,
            metadata: { testName, flakinessScore, recentResults },
        });
    }

    // ─── Rule Management ──────────────────────────────────────────────

    public getRules(): NotificationRule[] {
        return [...this.rules];
    }

    public addRule(rule: NotificationRule): void {
        const existingIdx = this.rules.findIndex((r) => r.id === rule.id);
        if (existingIdx >= 0) {
            this.rules[existingIdx] = rule;
        } else {
            this.rules.push(rule);
        }
    }

    public removeRule(ruleId: string): boolean {
        const idx = this.rules.findIndex((r) => r.id === ruleId);
        if (idx >= 0) {
            this.rules.splice(idx, 1);
            return true;
        }
        return false;
    }

    public toggleRule(ruleId: string, enabled: boolean): boolean {
        const rule = this.rules.find((r) => r.id === ruleId);
        if (rule) {
            rule.enabled = enabled;
            return true;
        }
        return false;
    }

    // ─── Recipient Management ─────────────────────────────────────────

    public getRecipients(): NotificationRecipient[] {
        return Array.from(this.recipients.values());
    }

    public addRecipient(recipient: NotificationRecipient): void {
        this.recipients.set(recipient.id, recipient);
    }

    public removeRecipient(id: string): boolean {
        return this.recipients.delete(id);
    }

    // ─── Status & Diagnostics ─────────────────────────────────────────

    public getStatus(): {
        rulesCount: number;
        enabledRules: number;
        recipientsCount: number;
        recentNotifications: typeof this.notificationLog;
        throttleEntries: number;
    } {
        return {
            rulesCount: this.rules.length,
            enabledRules: this.rules.filter((r) => r.enabled).length,
            recipientsCount: this.recipients.size,
            recentNotifications: [...this.notificationLog].reverse().slice(0, 30),
            throttleEntries: this.throttleMap.size,
        };
    }

    // ─── Internal ─────────────────────────────────────────────────────

    private formatMessage(event: NotificationEvent, channel: OpenClawChannel): string {
        const timestamp = event.timestamp || new Date().toISOString();
        const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });

        const severityIcon: Record<NotificationSeverity, string> = {
            critical: '🚨',
            high: '🔴',
            medium: '🟡',
            low: '🔵',
            info: 'ℹ️',
        };

        const icon = severityIcon[event.severity] || '📢';

        // Short format for WhatsApp/Telegram (character limits)
        const isCompact = ['whatsapp', 'telegram', 'signal', 'imessage'].includes(channel);

        if (isCompact) {
            let msg = `${icon} ${event.title}\n${event.message}`;
            if (event.dashboardUrl) {
                msg += `\n📎 ${event.dashboardUrl}`;
            }
            msg += `\n⏱️ ${timeStr}`;
            return msg.slice(0, 1000); // WhatsApp limit ~4096 but keep concise
        }

        // Rich format for Slack/Discord/Teams
        return `${icon} **${event.title}**

${event.message}

**Severity:** ${event.severity.toUpperCase()}
**Time:** ${timeStr}
${event.dashboardUrl ? `**Dashboard:** ${event.dashboardUrl}` : ''}
${event.metadata ? `**Details:** ${JSON.stringify(event.metadata).slice(0, 300)}` : ''}

_Routed by Qestro Notification Engine_`;
    }

    private getThinkingLevel(severity: NotificationSeverity): 'low' | 'medium' | 'high' {
        switch (severity) {
            case 'critical':
                return 'high';
            case 'high':
                return 'medium';
            default:
                return 'low';
        }
    }

    private capitalizeEventType(type: string): string {
        return type
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
    }

    private getThrottleKey(rule: NotificationRule, event: NotificationEvent): string {
        const groupKey = rule.throttle?.groupBy
            ? event.metadata?.[rule.throttle.groupBy] || 'default'
            : 'default';
        return `${rule.id}:${groupKey}`;
    }

    private isThrottled(key: string, maxPerHour: number): boolean {
        const entry = this.throttleMap.get(key);
        if (!entry) return false;

        const hourAgo = Date.now() - 3600000;
        if (entry.firstSent < hourAgo) {
            // Reset window
            this.throttleMap.delete(key);
            return false;
        }

        return entry.count >= maxPerHour;
    }

    private recordThrottle(key: string): void {
        const existing = this.throttleMap.get(key);
        if (existing) {
            existing.count++;
            existing.lastSent = Date.now();
        } else {
            this.throttleMap.set(key, {
                count: 1,
                firstSent: Date.now(),
                lastSent: Date.now(),
            });
        }
    }

    private isQuietHours(config: { start: string; end: string; timezone: string }): boolean {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: config.timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            const currentTime = formatter.format(now);

            const [startH, startM] = config.start.split(':').map(Number);
            const [endH, endM] = config.end.split(':').map(Number);
            const [currentH, currentM] = currentTime.split(':').map(Number);

            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            const currentMinutes = currentH * 60 + currentM;

            // Handle overnight quiet hours (e.g., 22:00 - 07:00)
            if (startMinutes > endMinutes) {
                return currentMinutes >= startMinutes || currentMinutes < endMinutes;
            }

            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        } catch {
            return false; // If timezone parsing fails, don't suppress
        }
    }

    private logNotification(event: NotificationEvent, result: NotificationResult): void {
        this.notificationLog.push({
            timestamp: new Date().toISOString(),
            eventType: event.type,
            severity: event.severity,
            channels: result.dispatched.filter((d) => d.success).map((d) => d.channel),
            throttled: result.throttled,
        });

        if (this.notificationLog.length > this.MAX_LOG) {
            this.notificationLog = this.notificationLog.slice(-this.MAX_LOG);
        }
    }

    private seedDefaultRecipients(): void {
        // Default recipient groups (can be overridden via config)
        const defaults: NotificationRecipient[] = [
            { id: 'qa_lead', name: 'QA Lead', role: 'qa_lead', channels: ['slack', 'whatsapp'] },
            { id: 'qa_team', name: 'QA Team', role: 'qa_engineer', channels: ['slack'] },
            { id: 'dev_team', name: 'Dev Team', role: 'developer', channels: ['slack'] },
            { id: 'security_team', name: 'Security Team', role: 'security', channels: ['slack', 'telegram'] },
            { id: 'release_manager', name: 'Release Manager', role: 'release_manager', channels: ['slack', 'whatsapp'] },
            { id: 'stakeholders', name: 'Stakeholders', role: 'stakeholder', channels: ['telegram'] },
        ];

        for (const r of defaults) {
            this.recipients.set(r.id, r);
        }
    }
}

export const notificationRouter = NotificationRouterService.getInstance();
