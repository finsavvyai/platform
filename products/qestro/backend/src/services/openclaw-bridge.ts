/**
 * OpenClaw Bridge Service
 *
 * Sends Qestro events TO the OpenClaw Gateway so the AI agent
 * can notify users on their messaging channels (WhatsApp, Slack, etc).
 *
 * This is the "outward push" — Qestro events flowing INTO OpenClaw.
 *
 * Usage:
 *   import { openClawBridge } from './openclaw-bridge';
 *   await openClawBridge.onSuiteCompleted('Login Flow', { passed: 11, failed: 1 });
 */

interface OpenClawHookPayload {
    message: string;
    name: string;
    agentId?: string;
    sessionKey?: string;
    wakeMode?: 'now' | 'next-heartbeat';
    deliver?: boolean;
    channel?: 'last' | 'whatsapp' | 'telegram' | 'slack' | 'discord';
    to?: string;
    model?: string;
    thinking?: 'low' | 'medium' | 'high';
    timeoutSeconds?: number;
}

export class OpenClawBridgeService {
    private gatewayUrl: string;
    private hookToken: string;

    constructor(env?: { OPENCLAW_GATEWAY_URL?: string; OPENCLAW_HOOK_TOKEN?: string }) {
        this.gatewayUrl = env?.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
        this.hookToken = env?.OPENCLAW_HOOK_TOKEN || '';
    }

    /**
     * Send a hook to OpenClaw Gateway
     */
    async sendHook(payload: OpenClawHookPayload): Promise<void> {
        try {
            const response = await fetch(`${this.gatewayUrl}/hooks/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.hookToken}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                console.error(`[OpenClaw Bridge] Hook failed: ${response.status}`);
            }
        } catch (err) {
            console.error('[OpenClaw Bridge] Gateway unreachable:', err);
        }
    }

    /* ── Event Handlers ─────────────────────────────────────────── */

    async onTestFailed(testName: string, error: string, runId: string): Promise<void> {
        await this.sendHook({
            message: `🚨 Test Failed on Qestro\n\nTEST: ${testName}\nERROR: ${error}\nRUN: ${runId}\n\nAnalyze the root cause and notify the team.`,
            name: 'Qestro-TestFailure',
            wakeMode: 'now',
            deliver: true,
            channel: 'slack',
            thinking: 'medium',
        });
    }

    async onSuiteCompleted(suiteName: string, stats: { passed: number; failed: number; total: number }): Promise<void> {
        const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
        await this.sendHook({
            message: `✅ Suite Completed: ${suiteName}\n\n• ${stats.passed}/${stats.total} passed (${passRate}%)\n• ${stats.failed} failed\n\nSummarize the results and flag any concerns.`,
            name: 'Qestro-SuiteComplete',
            wakeMode: 'now',
            deliver: true,
            channel: 'last',
        });
    }

    async onSecurityAlert(findings: { critical: number; high: number; details: string }): Promise<void> {
        await this.sendHook({
            message: `🔒 Security Alert from Qestro\n\n• Critical: ${findings.critical}\n• High: ${findings.high}\n\n${findings.details}\n\nAssess severity and create tickets for critical items.`,
            name: 'Qestro-Security',
            wakeMode: 'now',
            deliver: true,
            channel: 'slack',
            thinking: 'high',
        });
    }

    async onSelfHealingApplied(fixes: { count: number; details: string }): Promise<void> {
        await this.sendHook({
            message: `🔧 Self-Healing Applied\n\n${fixes.count} tests auto-fixed:\n${fixes.details}`,
            name: 'Qestro-SelfHeal',
            wakeMode: 'now',
            deliver: true,
            channel: 'slack',
        });
    }

    async onCoverageDrop(before: number, after: number): Promise<void> {
        await this.sendHook({
            message: `📉 Coverage Drop Detected\n\nBefore: ${before}%\nAfter: ${after}%\nDelta: ${(after - before).toFixed(1)}%\n\nInvestigate which changes caused the drop.`,
            name: 'Qestro-CoverageDrop',
            wakeMode: 'now',
            deliver: true,
            channel: 'slack',
            thinking: 'medium',
        });
    }
}

export const openClawBridge = new OpenClawBridgeService();
