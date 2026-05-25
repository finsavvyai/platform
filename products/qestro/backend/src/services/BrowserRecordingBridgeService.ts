/**
 * BrowserRecordingBridgeService — CDP-Based Test Recording via OpenClaw (P1)
 * 
 * Integrates OpenClaw's Browser Control (CDP-powered Chrome/Chromium) with
 * Qestro's AI Step Recorder to enable conversational test recording:
 * 
 * Flow:
 *   1. User messages OpenClaw: "Record a test for the checkout flow"
 *   2. OpenClaw launches managed browser → navigates to target URL
 *   3. Browser interactions captured via CDP snapshots 
 *   4. Interactions sent to Qestro's AI endpoint for code generation
 *   5. Generated Playwright test returned to user via messaging
 *   6. Test saved to Qestro's test case library
 * 
 * @see docs/research/OPENCLAW_INTEGRATION.md (Strategy #4)
 */

import { OpenClawBridgeService, type OpenClawHookResponse } from './OpenClawBridgeService.js';

// ─── Types ─────────────────────────────────────────────────────────────

export interface RecordingSession {
    id: string;
    status: 'pending' | 'recording' | 'processing' | 'completed' | 'failed';
    url: string;
    name: string;
    startedAt: string;
    completedAt?: string;
    interactions: BrowserInteraction[];
    generatedTest?: GeneratedTest;
    error?: string;
}

export interface BrowserInteraction {
    id: string;
    type: 'click' | 'type' | 'navigate' | 'scroll' | 'hover' | 'select' | 'assert' | 'wait';
    timestamp: string;
    selector?: string;
    value?: string;
    url?: string;
    description: string;
    screenshot?: string;
    elementInfo?: {
        tag: string;
        text?: string;
        attributes?: Record<string, string>;
        boundingBox?: { x: number; y: number; width: number; height: number };
    };
}

export interface GeneratedTest {
    code: string;
    framework: 'playwright' | 'cypress';
    language: 'typescript' | 'javascript';
    testName: string;
    stepsCount: number;
    estimatedDuration: number;
    confidence: number;
}

export interface RecordingRequest {
    url: string;
    name?: string;
    description?: string;
    framework?: 'playwright' | 'cypress';
    notifyChannel?: string;
    viewport?: { width: number; height: number };
}

// ─── Service ───────────────────────────────────────────────────────────

export class BrowserRecordingBridgeService {
    private static instance: BrowserRecordingBridgeService;
    private bridge: OpenClawBridgeService;
    private sessions: Map<string, RecordingSession> = new Map();
    private readonly MAX_SESSIONS = 50;

    private constructor() {
        this.bridge = OpenClawBridgeService.getInstance();
        console.log('🎬 [BrowserRecording] Bridge service initialized');
    }

    public static getInstance(): BrowserRecordingBridgeService {
        if (!BrowserRecordingBridgeService.instance) {
            BrowserRecordingBridgeService.instance = new BrowserRecordingBridgeService();
        }
        return BrowserRecordingBridgeService.instance;
    }

    // ─── Recording Management ─────────────────────────────────────────

    /**
     * Start a new browser recording session via OpenClaw
     * Tells the OpenClaw agent to launch a browser and begin capturing interactions
     */
    public async startRecording(request: RecordingRequest): Promise<{
        session: RecordingSession;
        hookResult: OpenClawHookResponse;
    }> {
        const sessionId = this.generateSessionId();
        const session: RecordingSession = {
            id: sessionId,
            status: 'pending',
            url: request.url,
            name: request.name || `Recording ${new Date().toLocaleTimeString()}`,
            startedAt: new Date().toISOString(),
            interactions: [],
        };

        this.sessions.set(sessionId, session);
        this.pruneOldSessions();

        const viewport = request.viewport || { width: 1920, height: 1080 };

        // Send recording request to OpenClaw agent
        const hookResult = await this.bridge.sendMessage(
            `🎬 **START BROWSER RECORDING** — Qestro Session

**Session ID:** ${sessionId}
**URL:** ${request.url}
**Name:** ${session.name}
${request.description ? `**Description:** ${request.description}` : ''}
**Viewport:** ${viewport.width}x${viewport.height}
**Framework:** ${request.framework || 'playwright'}

**Instructions:**
1. Open a new browser tab to: ${request.url}
2. Set viewport to ${viewport.width}x${viewport.height}
3. Begin recording all user interactions (clicks, typing, navigation)
4. Take a screenshot after each significant interaction
5. When the user says "stop recording" or the flow is complete, compile all interactions
6. Send the compiled interaction data back to Qestro using:
   POST ${process.env.FRONTEND_URL || 'http://localhost:3020'}/api/openclaw/incoming
   Body: { "action": "recording-complete", "params": { "sessionId": "${sessionId}", "interactions": [...] } }

Start the browser now and confirm when ready.`,
            {
                name: 'Qestro-Recording',
                channel: request.notifyChannel as any || undefined,
                thinking: 'medium',
            }
        );

        if (hookResult.success) {
            session.status = 'recording';
        } else {
            session.status = 'failed';
            session.error = hookResult.error || 'Failed to reach OpenClaw Gateway';
        }

        return { session, hookResult };
    }

    /**
     * Stop an active recording session
     */
    public async stopRecording(sessionId: string): Promise<{
        session: RecordingSession;
        hookResult: OpenClawHookResponse;
    }> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        if (session.status !== 'recording') {
            throw new Error(`Session ${sessionId} is not actively recording (status: ${session.status})`);
        }

        session.status = 'processing';

        const hookResult = await this.bridge.sendMessage(
            `🛑 **STOP RECORDING** — Session ${sessionId}

Stop the browser recording for session **${sessionId}** ("${session.name}").

1. Close the browser tab
2. Compile all captured interactions
3. Send interaction data to Qestro for test generation

If you have the interaction data, POST it to:
${process.env.FRONTEND_URL || 'http://localhost:3020'}/api/openclaw/incoming
Body: { "action": "recording-complete", "params": { "sessionId": "${sessionId}", "interactions": [...] } }`,
            {
                name: 'Qestro-Recording',
                thinking: 'low',
            }
        );

        return { session, hookResult };
    }

    /**
     * Handle incoming interaction data from OpenClaw
     * Called when OpenClaw posts back the captured interactions
     */
    public async processRecordingData(
        sessionId: string,
        interactions: BrowserInteraction[]
    ): Promise<RecordingSession> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        session.interactions = interactions;
        session.status = 'processing';

        // Generate Playwright test code from interactions
        try {
            const generatedTest = this.generateTestFromInteractions(session);
            session.generatedTest = generatedTest;
            session.status = 'completed';
            session.completedAt = new Date().toISOString();

            // Notify user via OpenClaw
            await this.bridge.sendMessage(
                `✅ **RECORDING COMPLETE** — ${session.name}

**Session:** ${sessionId}
**Interactions Captured:** ${interactions.length}
**Test Generated:** ${generatedTest.testName}
**Framework:** ${generatedTest.framework}
**Steps:** ${generatedTest.stepsCount}
**Confidence:** ${(generatedTest.confidence * 100).toFixed(0)}%

\`\`\`typescript
${generatedTest.code.slice(0, 1500)}${generatedTest.code.length > 1500 ? '\n// ... truncated for messaging' : ''}
\`\`\`

📎 Full test available in Qestro Dashboard.
Shall I save this to your test library?`,
                {
                    name: 'Qestro-Recording',
                    thinking: 'low',
                }
            );

            return session;
        } catch (error: any) {
            session.status = 'failed';
            session.error = error.message;
            return session;
        }
    }

    // ─── Session Queries ──────────────────────────────────────────────

    public getSession(sessionId: string): RecordingSession | undefined {
        return this.sessions.get(sessionId);
    }

    public getActiveSessions(): RecordingSession[] {
        return Array.from(this.sessions.values()).filter(
            (s) => s.status === 'pending' || s.status === 'recording' || s.status === 'processing'
        );
    }

    public getAllSessions(): RecordingSession[] {
        return Array.from(this.sessions.values())
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }

    public getSessionStats(): {
        total: number;
        active: number;
        completed: number;
        failed: number;
        totalInteractions: number;
    } {
        const sessions = Array.from(this.sessions.values());
        return {
            total: sessions.length,
            active: sessions.filter((s) => ['pending', 'recording', 'processing'].includes(s.status)).length,
            completed: sessions.filter((s) => s.status === 'completed').length,
            failed: sessions.filter((s) => s.status === 'failed').length,
            totalInteractions: sessions.reduce((sum, s) => sum + s.interactions.length, 0),
        };
    }

    // ─── Test Generation ──────────────────────────────────────────────

    /**
     * Generate Playwright test code from recorded browser interactions
     */
    private generateTestFromInteractions(session: RecordingSession): GeneratedTest {
        const interactions = session.interactions;
        const testName = this.sanitizeTestName(session.name);

        let code = `import { test, expect } from '@playwright/test';\n\n`;
        code += `test('${testName}', async ({ page }) => {\n`;

        // Navigate to starting URL
        code += `  // Navigate to target URL\n`;
        code += `  await page.goto('${session.url}');\n\n`;

        let stepCount = 0;

        for (const interaction of interactions) {
            stepCount++;
            const comment = interaction.description
                ? `  // Step ${stepCount}: ${interaction.description}\n`
                : '';

            switch (interaction.type) {
                case 'click':
                    code += comment;
                    code += `  await page.locator('${interaction.selector}').click();\n\n`;
                    break;

                case 'type':
                    code += comment;
                    code += `  await page.locator('${interaction.selector}').fill('${this.escapeString(interaction.value || '')}');\n\n`;
                    break;

                case 'navigate':
                    code += comment;
                    code += `  await page.goto('${interaction.url || interaction.value}');\n\n`;
                    break;

                case 'select':
                    code += comment;
                    code += `  await page.locator('${interaction.selector}').selectOption('${interaction.value}');\n\n`;
                    break;

                case 'hover':
                    code += comment;
                    code += `  await page.locator('${interaction.selector}').hover();\n\n`;
                    break;

                case 'scroll':
                    code += comment;
                    code += `  await page.mouse.wheel(0, ${interaction.value || 300});\n\n`;
                    break;

                case 'assert':
                    code += comment;
                    if (interaction.value) {
                        code += `  await expect(page.locator('${interaction.selector}')).toContainText('${this.escapeString(interaction.value)}');\n\n`;
                    } else {
                        code += `  await expect(page.locator('${interaction.selector}')).toBeVisible();\n\n`;
                    }
                    break;

                case 'wait':
                    code += comment;
                    code += `  await page.waitForTimeout(${interaction.value || 1000});\n\n`;
                    break;

                default:
                    code += `  // Unknown interaction type: ${interaction.type}\n\n`;
            }
        }

        code += `});\n`;

        return {
            code,
            framework: 'playwright',
            language: 'typescript',
            testName,
            stepsCount: stepCount,
            estimatedDuration: interactions.length * 2000, // rough estimate: 2s per step
            confidence: this.calculateConfidence(interactions),
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private generateSessionId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `rec_${timestamp}_${random}`;
    }

    private sanitizeTestName(name: string): string {
        return name
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
            || 'Recorded Test';
    }

    private escapeString(str: string): string {
        return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    }

    private calculateConfidence(interactions: BrowserInteraction[]): number {
        if (interactions.length === 0) return 0;

        let confidence = 0.7; // Base confidence

        // Boost for having descriptions
        const withDescriptions = interactions.filter((i) => i.description).length;
        confidence += (withDescriptions / interactions.length) * 0.1;

        // Boost for using data-testid selectors
        const withTestIds = interactions.filter((i) =>
            i.selector?.includes('data-testid') || i.selector?.includes('data-test')
        ).length;
        confidence += (withTestIds / interactions.length) * 0.15;

        // Penalty for too many interactions (might indicate noise)
        if (interactions.length > 30) confidence -= 0.05;
        if (interactions.length > 50) confidence -= 0.1;

        // Boost for having assertions
        const assertions = interactions.filter((i) => i.type === 'assert').length;
        if (assertions > 0) confidence += 0.05;

        return Math.min(Math.max(confidence, 0.3), 0.99);
    }

    private pruneOldSessions(): void {
        if (this.sessions.size <= this.MAX_SESSIONS) return;

        const sorted = Array.from(this.sessions.entries())
            .sort((a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime());

        const toRemove = sorted.slice(0, this.sessions.size - this.MAX_SESSIONS);
        for (const [key] of toRemove) {
            // Only prune completed/failed sessions, never active ones
            const session = this.sessions.get(key);
            if (session && !['pending', 'recording', 'processing'].includes(session.status)) {
                this.sessions.delete(key);
            }
        }
    }
}

export const browserRecordingBridge = BrowserRecordingBridgeService.getInstance();
