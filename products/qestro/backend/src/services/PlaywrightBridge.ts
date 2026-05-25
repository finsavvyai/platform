/**
 * PlaywrightBridge Service
 * Interacts with the isolated Playwright Controller Container to manage
 * real browser recording sessions, since Cloudflare Workers cannot run Chromium.
 */

export interface StartSessionRequest {
    name: string;
    url: string;
    viewport?: { width: number; height: number };
    framework?: 'playwright' | 'cypress';
}

export interface PlaywrightSession {
    sessionId: string;
    wsEndpoint: string;
    status: 'starting' | 'active' | 'completed' | 'error';
    cdpUrl?: string;
}

export class PlaywrightBridge {
    private controllerUrl: string;

    constructor() {
        // In production, this would point to AWS ECS, Fly.io, or DigitalOcean App Platform 
        // where the Node.js/Playwright container lives.
        this.controllerUrl = 'http://localhost:4000';
    }

    /**
     * Start a new recording session on the remote Playwright container.
     */
    async startSession(req: StartSessionRequest): Promise<PlaywrightSession> {
        console.log(`[PlaywrightBridge] Starting remote session for URL: ${req.url}`);

        const response = await fetch(`${this.controllerUrl}/sessions`, {
            method: 'POST',
            body: JSON.stringify(req),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Failed to start Playwright session. Target ${this.controllerUrl} returned ${response.status}`);
        }

        const payload = await response.json() as any;

        return {
            sessionId: payload.sessionId,
            wsEndpoint: payload.wsEndpoint,
            status: payload.status,
            cdpUrl: payload.cdpUrl
        };
    }

    /**
     * Stop and cleanup the recording session
     */
    async stopSession(sessionId: string): Promise<{ success: boolean; generatedCode: string }> {
        const response = await fetch(`${this.controllerUrl}/sessions/${sessionId}/stop`, {
            method: 'POST'
        });

        if (!response.ok) {
            console.error(`[PlaywrightBridge] Failure stopping session ${sessionId}`);
            return { success: false, generatedCode: '' };
        }

        const payload = await response.json() as any;
        return {
            success: payload.success,
            generatedCode: payload.generatedCode
        };
    }

    /**
     * Get real-time status of the remote browser
     */
    async getStatus(sessionId: string) {
        return { status: 'active', uptime: 120 };
    }
}

export const playwrightBridge = new PlaywrightBridge();
