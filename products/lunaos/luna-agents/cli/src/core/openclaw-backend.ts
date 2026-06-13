/**
 * OpenClaw Gateway — backend detection helpers.
 *
 * Extracted from openclaw-client.ts to keep each module under the
 * portfolio 200-line cap. Re-exported by openclaw-client.ts so the
 * public import surface is unchanged.
 */

// @ts-ignore — ws types may not be installed
import WebSocket from 'ws';
import type { ExecutionBackend } from './openclaw-types.js';

// ─── Helper: Check if OpenClaw is running ───────────────────────────

export async function isOpenClawRunning(
    gatewayUrl = 'ws://127.0.0.1:18789'
): Promise<boolean> {
    return new Promise((resolve) => {
        const ws = new WebSocket(gatewayUrl);
        const timer = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 2000);

        ws.on('open', () => {
            clearTimeout(timer);
            ws.close();
            resolve(true);
        });

        ws.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });
}

// ─── Helper: Auto-detect execution backend ──────────────────────────

export async function detectBackend(): Promise<ExecutionBackend> {
    // 1. Check if OpenClaw is running locally
    if (await isOpenClawRunning()) {
        return 'openclaw';
    }

    // 2. Check for cloud token
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const credPath = path.join(os.homedir(), '.luna', 'credentials.yaml');

    if (fs.existsSync(credPath)) {
        try {
            const yaml = await import('yaml');
            const creds = yaml.parse(fs.readFileSync(credPath, 'utf-8'));
            if (creds?.cloud_token) return 'cloud';
        } catch { /* ignore */ }
    }

    // 3. Default to local
    return 'local';
}
