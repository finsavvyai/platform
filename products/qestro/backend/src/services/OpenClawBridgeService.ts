/**
 * OpenClawBridgeService - Qestro ↔ OpenClaw AI Agent Integration
 * 
 * Enables bidirectional communication between Qestro's testing platform
 * and the OpenClaw AI agent ecosystem. OpenClaw users can manage QA
 * workflows via WhatsApp, Telegram, Slack, Discord, and other channels.
 * 
 * Integration Points:
 * - POST /hooks/agent  → Send events to OpenClaw for AI processing
 * - POST /hooks/wake   → Wake OpenClaw agent with system events
 * - Skills System      → Qestro skill installed in OpenClaw workspace
 * 
 * @see https://docs.openclaw.ai/automation/webhook
 * @see https://docs.openclaw.ai/tools/skills
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface OpenClawConfig {
    gatewayUrl: string;
    hookToken: string;
    enabled: boolean;
    defaultChannel: OpenClawChannel;
    defaultThinking: 'low' | 'medium' | 'high';
    timeoutSeconds: number;
}

export type OpenClawChannel = 'last' | 'whatsapp' | 'telegram' | 'slack' | 'discord' | 'signal' | 'imessage' | 'msteams';

export interface OpenClawHookPayload {
    message: string;
    name: string;
    agentId?: string;
    sessionKey?: string;
    wakeMode?: 'now' | 'next-heartbeat';
    deliver?: boolean;
    channel?: OpenClawChannel;
    to?: string;
    model?: string;
    thinking?: 'low' | 'medium' | 'high';
    timeoutSeconds?: number;
}

export interface OpenClawWakePayload {
    text: string;
    mode: 'now' | 'next-heartbeat';
}

export interface OpenClawHookResponse {
    success: boolean;
    status: number;
    error?: string;
}

export interface TestFailureEvent {
    testName: string;
    testId: string;
    suiteName?: string;
    error: string;
    stackTrace?: string;
    runId: string;
    platform: 'web' | 'mobile' | 'api';
    duration?: number;
    screenshotUrl?: string;
    dashboardUrl?: string;
}

export interface SuiteCompletionEvent {
    suiteName: string;
    suiteId: string;
    runId: string;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: number;
    selfHealed?: number;
    dashboardUrl?: string;
}

export interface SecurityAlertEvent {
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    description: string;
    affectedEndpoints?: string[];
    recommendation: string;
    scanId?: string;
}

export interface SelfHealingEvent {
    testName: string;
    testId: string;
    healingType: 'locator_update' | 'wait_added' | 'retry_logic' | 'assertion_fix';
    originalError: string;
    fixApplied: string;
    confidence: number;
}

// ─── Service ───────────────────────────────────────────────────────────

export class OpenClawBridgeService {
    private static instance: OpenClawBridgeService;
    private config: OpenClawConfig;
    private eventLog: Array<{ timestamp: string; type: string; status: string; error?: string }> = [];
    private readonly MAX_LOG_SIZE = 100;

    private constructor() {
        this.config = {
            gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789',
            hookToken: process.env.OPENCLAW_HOOK_TOKEN || '',
            enabled: process.env.OPENCLAW_ENABLED === 'true',
            defaultChannel: (process.env.OPENCLAW_DEFAULT_CHANNEL as OpenClawChannel) || 'last',
            defaultThinking: (process.env.OPENCLAW_DEFAULT_THINKING as 'low' | 'medium' | 'high') || 'medium',
            timeoutSeconds: parseInt(process.env.OPENCLAW_TIMEOUT_SECONDS || '120', 10),
        };

        if (this.config.enabled) {
            console.log('🦞 [OpenClaw] Bridge service initialized');
            console.log(`   Gateway: ${this.config.gatewayUrl}`);
            console.log(`   Channel: ${this.config.defaultChannel}`);
        }
    }

    public static getInstance(): OpenClawBridgeService {
        if (!OpenClawBridgeService.instance) {
            OpenClawBridgeService.instance = new OpenClawBridgeService();
        }
        return OpenClawBridgeService.instance;
    }

    // ─── Core Webhook Methods ────────────────────────────────────────

    /**
     * Send a hook to OpenClaw's /hooks/agent endpoint
     * Triggers an isolated agent turn with the given message
     */
    public async sendAgentHook(payload: OpenClawHookPayload): Promise<OpenClawHookResponse> {
        if (!this.config.enabled) {
            return { success: false, status: 0, error: 'OpenClaw integration is disabled' };
        }

        if (!this.config.hookToken) {
            return { success: false, status: 0, error: 'OpenClaw hook token not configured' };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for the HTTP call itself

            const response = await fetch(`${this.config.gatewayUrl}/hooks/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.hookToken}`,
                },
                body: JSON.stringify({
                    ...payload,
                    channel: payload.channel || this.config.defaultChannel,
                    thinking: payload.thinking || this.config.defaultThinking,
                    timeoutSeconds: payload.timeoutSeconds || this.config.timeoutSeconds,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const result: OpenClawHookResponse = {
                success: response.status === 202 || response.status === 200,
                status: response.status,
            };

            if (!result.success) {
                result.error = `HTTP ${response.status}: ${response.statusText}`;
            }

            this.logEvent('agent_hook', result.success ? 'success' : 'failed', result.error);
            return result;

        } catch (error: any) {
            const errorMsg = error.name === 'AbortError' ? 'Request timeout' : error.message;
            this.logEvent('agent_hook', 'error', errorMsg);
            return { success: false, status: 0, error: errorMsg };
        }
    }

    /**
     * Send a wake event to OpenClaw's /hooks/wake endpoint
     * Enqueues a system event and optionally triggers immediate heartbeat
     */
    public async sendWake(text: string, mode: 'now' | 'next-heartbeat' = 'now'): Promise<OpenClawHookResponse> {
        if (!this.config.enabled) {
            return { success: false, status: 0, error: 'OpenClaw integration is disabled' };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.config.gatewayUrl}/hooks/wake`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.hookToken}`,
                },
                body: JSON.stringify({ text, mode } as OpenClawWakePayload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const result: OpenClawHookResponse = {
                success: response.status === 200,
                status: response.status,
            };

            this.logEvent('wake', result.success ? 'success' : 'failed');
            return result;

        } catch (error: any) {
            const errorMsg = error.name === 'AbortError' ? 'Request timeout' : error.message;
            this.logEvent('wake', 'error', errorMsg);
            return { success: false, status: 0, error: errorMsg };
        }
    }

    // ─── Event Handlers (Called by Qestro services) ──────────────────

    /**
     * Notify OpenClaw when a test fails - triggers AI analysis + team notification
     */
    public async onTestFailed(event: TestFailureEvent): Promise<OpenClawHookResponse> {
        const message = `🔴 **TEST FAILURE** on Qestro

**Test:** ${event.testName}
**Suite:** ${event.suiteName || 'N/A'}
**Platform:** ${event.platform}
**Run ID:** ${event.runId}

**Error:**
\`\`\`
${event.error}
\`\`\`
${event.stackTrace ? `\n**Stack Trace (excerpt):**\n\`\`\`\n${event.stackTrace.slice(0, 500)}\n\`\`\`` : ''}
${event.screenshotUrl ? `\n**Screenshot:** ${event.screenshotUrl}` : ''}
${event.dashboardUrl ? `\n**Dashboard:** ${event.dashboardUrl}` : ''}

**Please:**
1. Analyze the root cause of this failure
2. Determine if this is a known flaky test or a genuine regression
3. Suggest a fix or self-healing action
4. Notify the team with a concise summary`;

        return this.sendAgentHook({
            message,
            name: 'Qestro-TestFailure',
            sessionKey: `qestro:failure:${event.runId}:${event.testId}`,
            wakeMode: 'now',
            deliver: true,
            thinking: 'medium',
        });
    }

    /**
     * Notify OpenClaw when a test suite completes
     */
    public async onSuiteCompleted(event: SuiteCompletionEvent): Promise<OpenClawHookResponse> {
        const passRate = event.totalTests > 0
            ? ((event.passed / event.totalTests) * 100).toFixed(1)
            : '0';
        const duration = (event.duration / 1000).toFixed(1);
        const status = event.failed === 0 ? '✅ ALL PASSED' : `⚠️ ${event.failed} FAILED`;

        const message = `📊 **SUITE COMPLETED** on Qestro

**Suite:** ${event.suiteName}  
**Status:** ${status}
**Run ID:** ${event.runId}

**Results:**
• ✅ Passed: ${event.passed}/${event.totalTests} (${passRate}%)
• ❌ Failed: ${event.failed}
• ⏭️ Skipped: ${event.skipped}
• ⏱️ Duration: ${duration}s
${event.coverage ? `• 📈 Coverage: ${event.coverage}%` : ''}
${event.selfHealed ? `• 🔧 Self-Healed: ${event.selfHealed} tests` : ''}
${event.dashboardUrl ? `\n**Full Report:** ${event.dashboardUrl}` : ''}

Provide a brief summary of the results and highlight any concerns or trends.`;

        return this.sendAgentHook({
            message,
            name: 'Qestro-SuiteComplete',
            sessionKey: `qestro:suite:${event.runId}`,
            wakeMode: event.failed > 0 ? 'now' : 'next-heartbeat',
            deliver: true,
            thinking: event.failed > 0 ? 'medium' : 'low',
        });
    }

    /**
     * Alert OpenClaw about security scan findings
     */
    public async onSecurityAlert(event: SecurityAlertEvent): Promise<OpenClawHookResponse> {
        const severityEmoji: Record<string, string> = {
            critical: '🚨',
            high: '🔴',
            medium: '🟡',
            low: '🔵',
        };

        const message = `${severityEmoji[event.severity] || '⚠️'} **SECURITY ALERT** from Qestro

**Severity:** ${event.severity.toUpperCase()}
**Category:** ${event.category}

**Description:**
${event.description}

${event.affectedEndpoints?.length ? `**Affected Endpoints:**\n${event.affectedEndpoints.map(e => `• ${e}`).join('\n')}` : ''}

**Recommendation:**
${event.recommendation}

Please assess the urgency, recommend immediate actions, and determine if any tests need to be blocked until this is resolved.`;

        return this.sendAgentHook({
            message,
            name: 'Qestro-Security',
            sessionKey: event.scanId ? `qestro:security:${event.scanId}` : undefined,
            wakeMode: 'now',
            deliver: true,
            thinking: event.severity === 'critical' ? 'high' : 'medium',
        });
    }

    /**
     * Notify OpenClaw when self-healing is applied
     */
    public async onSelfHealing(event: SelfHealingEvent): Promise<OpenClawHookResponse> {
        const message = `🔧 **SELF-HEALING APPLIED** on Qestro

**Test:** ${event.testName}
**Healing Type:** ${event.healingType.replace(/_/g, ' ')}
**Confidence:** ${(event.confidence * 100).toFixed(0)}%

**Original Error:**
\`\`\`
${event.originalError}
\`\`\`

**Fix Applied:**
\`\`\`
${event.fixApplied}
\`\`\`

Log this self-healing action and notify the team if the confidence is below 80%.`;

        return this.sendAgentHook({
            message,
            name: 'Qestro-SelfHeal',
            sessionKey: `qestro:heal:${event.testId}`,
            wakeMode: event.confidence < 0.8 ? 'now' : 'next-heartbeat',
            deliver: event.confidence < 0.8, // Only notify team for low-confidence heals
            thinking: 'low',
        });
    }

    // ─── Convenience Methods ──────────────────────────────────────────

    /**
     * Send a custom message to OpenClaw (for flexible use cases)
     */
    public async sendMessage(
        message: string,
        options?: Partial<Omit<OpenClawHookPayload, 'message'>>
    ): Promise<OpenClawHookResponse> {
        return this.sendAgentHook({
            message,
            name: options?.name || 'Qestro',
            ...options,
        });
    }

    /**
     * Send a daily summary to OpenClaw
     */
    public async sendDailySummary(stats: {
        totalRuns: number;
        passed: number;
        failed: number;
        coverage: number;
        selfHealed: number;
        topFailures: Array<{ name: string; count: number }>;
    }): Promise<OpenClawHookResponse> {
        const passRate = stats.totalRuns > 0
            ? ((stats.passed / stats.totalRuns) * 100).toFixed(1)
            : '0';

        const message = `📋 **DAILY QA SUMMARY** from Qestro

**Date:** ${new Date().toISOString().split('T')[0]}

**Overview:**
• 🧪 Total Runs: ${stats.totalRuns}
• ✅ Passed: ${stats.passed} (${passRate}%)
• ❌ Failed: ${stats.failed}
• 📈 Coverage: ${stats.coverage}%
• 🔧 Self-Healed: ${stats.selfHealed}

${stats.topFailures.length > 0 ? `**Top Failures:**\n${stats.topFailures.map((f, i) => `${i + 1}. ${f.name} (${f.count}x)`).join('\n')}` : '✅ No recurring failures!'}

Summarize today's QA health and flag any trends that need attention.`;

        return this.sendAgentHook({
            message,
            name: 'Qestro-DailySummary',
            wakeMode: 'now',
            deliver: true,
            thinking: 'low',
        });
    }

    // ─── Health & Status ──────────────────────────────────────────────

    /**
     * Check if OpenClaw Gateway is reachable
     */
    public async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
        if (!this.config.enabled) {
            return { healthy: false, latencyMs: 0, error: 'OpenClaw integration is disabled' };
        }

        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${this.config.gatewayUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            return {
                healthy: response.ok,
                latencyMs: Date.now() - start,
            };
        } catch (error: any) {
            return {
                healthy: false,
                latencyMs: Date.now() - start,
                error: error.message,
            };
        }
    }

    /**
     * Get integration status and recent event log
     */
    public getStatus(): {
        enabled: boolean;
        config: Omit<OpenClawConfig, 'hookToken'> & { hookToken: string };
        recentEvents: typeof this.eventLog;
    } {
        return {
            enabled: this.config.enabled,
            config: {
                gatewayUrl: this.config.gatewayUrl,
                hookToken: this.config.hookToken ? '***configured***' : '***not set***',
                enabled: this.config.enabled,
                defaultChannel: this.config.defaultChannel,
                defaultThinking: this.config.defaultThinking,
                timeoutSeconds: this.config.timeoutSeconds,
            },
            recentEvents: [...this.eventLog].reverse().slice(0, 20),
        };
    }

    /**
     * Update configuration at runtime
     */
    public updateConfig(updates: Partial<OpenClawConfig>): void {
        this.config = { ...this.config, ...updates };
        console.log('🦞 [OpenClaw] Configuration updated');
    }

    // ─── Internal ─────────────────────────────────────────────────────

    private logEvent(type: string, status: string, error?: string): void {
        this.eventLog.push({
            timestamp: new Date().toISOString(),
            type,
            status,
            error,
        });

        // Keep log bounded
        if (this.eventLog.length > this.MAX_LOG_SIZE) {
            this.eventLog = this.eventLog.slice(-this.MAX_LOG_SIZE);
        }

        // Console log for debugging
        if (status === 'error' || status === 'failed') {
            console.error(`🦞 [OpenClaw] ${type} ${status}: ${error || 'unknown'}`);
        } else {
            console.log(`🦞 [OpenClaw] ${type} → ${status}`);
        }
    }
}

export const openClawBridge = OpenClawBridgeService.getInstance();
