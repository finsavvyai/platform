import express from 'express';
import cors from 'cors';
import { chromium, Browser, BrowserContext } from 'playwright-core';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// In-memory store of active browser contexts
interface Session {
    id: string;
    browser: Browser;
    context: BrowserContext;
    wsEndpoint: string;
    cdpUrl: string;
    status: 'active' | 'completed' | 'error';
}

const activeSessions = new Map<string, Session>();

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', activeSessions: activeSessions.size });
});

app.post('/sessions', async (req, res) => {
    try {
        const { url, viewport, name } = req.body;

        // Launch Chrome with remote debugging port enabled so clients can connect via CDP
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--remote-debugging-port=0',
                '--disable-gpu',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        // Extract the debug port mapped by Chromium
        const cdpUrl = (browser as any)._channel?.connection?.url() || ''; // internal CDP mapping fallback

        // In production, we'd pipe the actual WS endpoint out. For now, getting the generic connection.
        // For external connectivity we need the actual generated ws endpoint.
        let wsEndpoint = '';
        // This is a simplification; in a real container, we'd start playwright as a server
        // e.g. `chromium.launchServer()` to get the true websocket endpoint.

        const browserServer = await chromium.launchServer({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        wsEndpoint = browserServer.wsEndpoint();

        // Use the persistent server browser context
        const serverBrowser = await chromium.connect(wsEndpoint);
        const context = await serverBrowser.newContext({
            viewport: viewport || { width: 1920, height: 1080 }
        });

        const page = await context.newPage();
        if (url) {
            await page.goto(url, { waitUntil: 'networkidle' });
        }

        const sessionId = `pw_${Date.now()}`;

        activeSessions.set(sessionId, {
            id: sessionId,
            browser: serverBrowser,
            context,
            wsEndpoint,
            cdpUrl,
            status: 'active'
        });

        console.log(`[PlaywrightService] Started session ${sessionId} - WS: ${wsEndpoint}`);

        res.status(201).json({
            sessionId,
            wsEndpoint,
            status: 'active',
            cdpUrl
        });

    } catch (error: any) {
        console.error('Failed to start session:', error);
        res.status(500).json({ error: 'Failed to launch Playwright browser' });
    }
});

app.post('/sessions/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const session = activeSessions.get(id);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Close the browser tab and context
        await session.context.close();
        await session.browser.close();

        activeSessions.delete(id);

        // Generate a mock code snippet for the Qestro test generator since
        // true code generation requires a CDP event listener running throughout the session
        const generatedCode = `import { test, expect } from '@playwright/test';\n\ntest('Auto-generated flow for ${id}', async ({ page }) => {\n  // Generated script\n  await page.goto('/');\n  await expect(page).toHaveTitle(/Qestro/);\n});`;

        console.log(`[PlaywrightService] Stopped session ${id}`);

        res.json({
            success: true,
            generatedCode
        });

    } catch (error: any) {
        console.error(`Failed to stop session ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to close Playwright browser' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Playwright remote controller running on port ${PORT}`);
});
