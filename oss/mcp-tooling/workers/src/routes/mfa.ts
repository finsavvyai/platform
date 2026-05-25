/**
 * MFA API Routes
 * Endpoints for setting up and managing multi-factor authentication
 */

import { Hono } from 'hono';
import type { Env } from '../middleware/auth';
import { MFAService } from '../middleware/mfa';

export const mfaRouter = new Hono<{ Bindings: Env }>();

// Get MFA status
mfaRouter.get('/status', async (c) => {
    const user = c.get('user');
    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);

    const enabled = await mfaService.isMFAEnabled(user.id);

    return c.json({
        enabled,
        methods: enabled ? ['totp'] : []
    });
});

// Setup MFA - returns secret and otpauth URL
mfaRouter.post('/setup', async (c) => {
    const user = c.get('user');
    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);

    // Check if already enabled
    const isEnabled = await mfaService.isMFAEnabled(user.id);
    if (isEnabled) {
        return c.json({ error: 'MFA is already enabled' }, 400);
    }

    const { secret, otpAuthUrl } = await mfaService.setupMFA(user.id, user.email);

    return c.json({
        secret,
        otpAuthUrl,
        instructions: 'Scan the QR code or manually enter the secret in your authenticator app. Then verify with a code.'
    });
});

// Verify and enable MFA
mfaRouter.post('/enable', async (c) => {
    const user = c.get('user');
    const { token } = await c.req.json<{ token: string }>();

    if (!token || token.length !== 6) {
        return c.json({ error: 'Invalid token format' }, 400);
    }

    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);

    try {
        const success = await mfaService.enableMFA(user.id, token);

        if (!success) {
            return c.json({ error: 'Invalid verification code' }, 400);
        }

        // Generate backup codes
        const backupCodes = await mfaService.generateBackupCodes(user.id);

        return c.json({
            success: true,
            message: 'MFA has been enabled successfully',
            backupCodes,
            warning: 'Save these backup codes securely. They can only be shown once.'
        });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Disable MFA
mfaRouter.post('/disable', async (c) => {
    const user = c.get('user');
    const { token } = await c.req.json<{ token: string }>();

    if (!token || token.length !== 6) {
        return c.json({ error: 'Invalid token format' }, 400);
    }

    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);

    try {
        const success = await mfaService.disableMFA(user.id, token);

        if (!success) {
            return c.json({ error: 'Invalid verification code' }, 400);
        }

        return c.json({
            success: true,
            message: 'MFA has been disabled'
        });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 400);
    }
});

// Verify MFA token (during login)
mfaRouter.post('/verify', async (c) => {
    const user = c.get('user');
    const { token } = await c.req.json<{ token: string }>();

    if (!token || token.length !== 6) {
        return c.json({ error: 'Invalid token format' }, 400);
    }

    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);

    const success = await mfaService.verifyMFAToken(user.id, token);

    if (!success) {
        return c.json({ error: 'Invalid verification code' }, 401);
    }

    // Mark session as MFA verified (1 hour expiry)
    await c.env.MCP_KV.put(`mfa:verified:${user.id}`, 'true', { expirationTtl: 3600 });

    return c.json({
        success: true,
        message: 'MFA verification successful'
    });
});

// Regenerate backup codes
mfaRouter.post('/backup-codes/regenerate', async (c) => {
    const user = c.get('user');
    const { token } = await c.req.json<{ token: string }>();

    if (!token || token.length !== 6) {
        return c.json({ error: 'Invalid token format' }, 400);
    }

    const mfaService = new MFAService(c.env.MCP_DB, c.env.MCP_KV);

    // Verify current MFA token first
    const isValid = await mfaService.verifyMFAToken(user.id, token);
    if (!isValid) {
        return c.json({ error: 'Invalid verification code' }, 401);
    }

    const backupCodes = await mfaService.generateBackupCodes(user.id);

    return c.json({
        success: true,
        backupCodes,
        warning: 'Previous backup codes have been invalidated. Save these new codes securely.'
    });
});
