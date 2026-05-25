/**
 * Channel Routes — /channels/*
 *
 * Self-service channel connection system. Users connect their own
 * Slack workspaces, WhatsApp numbers, Discord servers, and Telegram
 * bots through OAuth flows or API key configuration.
 *
 * Architecture:
 *   ┌───────────────────────────────────────────────────┐
 *   │              User's OpenClaw Dashboard             │
 *   │                                                   │
 *   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
 *   │  │ + Slack   │ │+WhatsApp │ │+ Discord │ │+ TG  │ │
 *   │  │ Connect   │ │ Connect  │ │ Connect  │ │Connect│ │
 *   │  └──────────┘ └──────────┘ └──────────┘ └──────┘ │
 *   └───────────────────┬───────────────────────────────┘
 *                       ▼
 *               POST /channels/connect
 *                       │
 *          ┌────────────┼──────────────┐
 *          ▼            ▼              ▼
 *     OAuth Flow   Webhook URL    API Key
 *     (Slack,      (Custom)       (WhatsApp,
 *      Discord)                    Telegram)
 *                       │
 *                       ▼
 *          channel_connections table (per-user)
 *                       │
 *                       ▼
 *          Incoming webhook → lookup connection
 *          → find user → run user's agent → reply
 *
 * Endpoints:
 *   GET    /channels              — list available channel types
 *   GET    /channels/connections  — list user's connected channels
 *   POST   /channels/connect     — start connecting a channel
 *   DELETE /channels/:id         — disconnect a channel
 *   PATCH  /channels/:id         — update channel config
 *   POST   /channels/:id/test    — send test message
 *   GET    /channels/:id/stats   — channel usage stats
 *
 *   OAuth callbacks:
 *   GET  /channels/oauth/slack/callback    — Slack OAuth redirect
 *   GET  /channels/oauth/discord/callback  — Discord OAuth redirect
 *
 *   Incoming webhooks (per-connection):
 *   POST /channels/incoming/:connectionId  — receive messages from connected channels
 *   POST /channels/incoming/slack          — Slack Events API (shared endpoint)
 *   POST /channels/incoming/whatsapp       — WhatsApp webhook
 *   POST /channels/incoming/discord        — Discord interactions
 *   POST /channels/incoming/telegram/:botId — Telegram updates
 */

import { Hono } from 'hono';
import type { AppEnv, ServiceEnv } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';

export const channelRoutes = new Hono<AppEnv>();

// ─── Channel Type Registry ──────────────────────────────────────────────────

interface ChannelTypeInfo {
    type: string;
    name: string;
    icon: string;
    description: string;
    authMethod: 'oauth' | 'api_key' | 'webhook_url';
    setupSteps: string[];
    docsUrl: string;
    features: string[];
}

const CHANNEL_TYPES: ChannelTypeInfo[] = [
    {
        type: 'slack',
        name: 'Slack',
        icon: '💬',
        description: 'Connect your Slack workspace to run Luna agents from any channel. Mention @Luna to get AI-powered code reviews, security audits, and more.',
        authMethod: 'oauth',
        setupSteps: [
            'Click "Connect Slack"',
            'Authorize LunaOS in your Slack workspace',
            'Choose a default agent',
            'Start using @Luna in any channel!',
        ],
        docsUrl: 'https://docs.lunaos.ai/channels/slack',
        features: ['Slash commands', 'Mentions', 'Thread replies', 'File analysis'],
    },
    {
        type: 'discord',
        name: 'Discord',
        icon: '🎮',
        description: 'Add Luna bot to your Discord server. Use /luna commands for code reviews, test generation, and agent chains.',
        authMethod: 'oauth',
        setupSteps: [
            'Click "Connect Discord"',
            'Add Luna bot to your server',
            'Choose allowed channels',
            'Use /luna commands!',
        ],
        docsUrl: 'https://docs.lunaos.ai/channels/discord',
        features: ['Slash commands', 'Embeds', 'Thread support', 'Role-based access'],
    },
    {
        type: 'whatsapp',
        name: 'WhatsApp',
        icon: '📱',
        description: 'Connect WhatsApp Business to get AI assistance via chat. Perfect for mobile code reviews and quick agent queries.',
        authMethod: 'api_key',
        setupSteps: [
            'Enter your WhatsApp Business API credentials',
            'Verify your phone number',
            'Set webhook URL in Meta dashboard',
            'Send a message to start!',
        ],
        docsUrl: 'https://docs.lunaos.ai/channels/whatsapp',
        features: ['Text messages', 'Code snippets', 'Image analysis', 'Voice notes'],
    },
    {
        type: 'telegram',
        name: 'Telegram',
        icon: '✈️',
        description: 'Create a Telegram bot connected to your Luna agents. Use it for personal or group code assistance.',
        authMethod: 'api_key',
        setupSteps: [
            'Create a bot via @BotFather',
            'Paste your bot token',
            'We\'ll configure the webhook automatically',
            'Chat with your bot!',
        ],
        docsUrl: 'https://docs.lunaos.ai/channels/telegram',
        features: ['Bot commands', 'Inline queries', 'Group chats', 'Markdown responses'],
    },
    {
        type: 'webhook',
        name: 'Custom Webhook',
        icon: '🔗',
        description: 'Connect any platform with a simple webhook. Send JSON, get AI responses back. Perfect for custom integrations.',
        authMethod: 'webhook_url',
        setupSteps: [
            'Click "Create Webhook"',
            'Copy your unique webhook URL and secret',
            'POST messages to the URL',
            'Receive responses!',
        ],
        docsUrl: 'https://docs.lunaos.ai/channels/webhook',
        features: ['Any platform', 'JSON API', 'Webhook secret', 'Custom headers'],
    },
];

// ─── GET /channels — List available channel types ───────────────────────────

channelRoutes.get('/', (c) => {
    return c.json({
        channelTypes: CHANNEL_TYPES,
        total: CHANNEL_TYPES.length,
        docs: 'https://docs.lunaos.ai/channels',
    });
});

// ─── GET /channels/connections — List user's connected channels ─────────────

channelRoutes.get('/connections', requireAuth, async (c) => {
    const userId = c.get('userId') as string;

    const result = await c.env.DB.prepare(`
        SELECT id, channel_type, label, status, external_id, external_name,
               default_agent, config, message_count, last_message_at,
               webhook_url, connected_at, created_at
        FROM channel_connections
        WHERE user_id = ? AND status != 'revoked'
        ORDER BY created_at DESC
    `).bind(userId).all();

    const connections = (result.results || []).map((r: any) => ({
        id: r.id,
        channelType: r.channel_type,
        label: r.label,
        status: r.status,
        externalId: r.external_id,
        externalName: r.external_name,
        defaultAgent: r.default_agent,
        config: r.config ? JSON.parse(r.config) : {},
        messageCount: r.message_count,
        lastMessageAt: r.last_message_at,
        webhookUrl: r.webhook_url,
        connectedAt: r.connected_at,
        createdAt: r.created_at,
    }));

    return c.json({ connections, total: connections.length });
});

// ─── POST /channels/connect — Start connecting a channel ────────────────────

channelRoutes.post('/connect', requireAuth, rateLimit, async (c) => {
    const userId = c.get('userId') as string;
    const body = await c.req.json<{
        channelType: string;
        label?: string;
        config?: Record<string, any>;
        // For API key-based channels:
        credentials?: {
            accessToken?: string;
            botToken?: string;
            phoneNumberId?: string;
            verifyToken?: string;
        };
    }>();

    if (!body.channelType) {
        return c.json({ error: 'Missing required field: channelType' }, 400);
    }

    const channelDef = CHANNEL_TYPES.find(ct => ct.type === body.channelType);
    if (!channelDef) {
        return c.json({
            error: `Unknown channel type: ${body.channelType}`,
            available: CHANNEL_TYPES.map(ct => ct.type),
        }, 400);
    }

    const connectionId = crypto.randomUUID();
    const webhookSecret = crypto.randomUUID();
    const baseUrl = c.req.url.split('/channels')[0];
    const webhookUrl = `${baseUrl}/channels/incoming/${connectionId}`;

    // ── OAuth channels (Slack, Discord) ─────────────────────────────────
    if (channelDef.authMethod === 'oauth') {
        const state = crypto.randomUUID();

        // Store OAuth state for CSRF protection
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
        await c.env.DB.prepare(`
            INSERT INTO oauth_states (state, user_id, channel_type, redirect_uri, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(state, userId, body.channelType, webhookUrl, expiresAt).run();

        // Create pending connection
        await c.env.DB.prepare(`
            INSERT INTO channel_connections (id, user_id, channel_type, label, status, webhook_url, webhook_secret, config, default_agent)
            VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        `).bind(
            connectionId, userId, body.channelType,
            body.label || `My ${channelDef.name}`,
            webhookUrl, webhookSecret,
            JSON.stringify(body.config || {}),
            body.config?.defaultAgent || 'run',
        ).run();

        // Generate OAuth URL
        let oauthUrl: string;

        if (body.channelType === 'slack') {
            const clientId = await c.env.KV.get('slack_client_id') || '';
            const redirectUri = `${baseUrl}/channels/oauth/slack/callback`;
            const scopes = 'app_mentions:read,chat:write,commands,channels:history,groups:history,im:history,im:read,users:read';
            oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
        } else if (body.channelType === 'discord') {
            const clientId = await c.env.KV.get('discord_client_id') || '';
            const redirectUri = `${baseUrl}/channels/oauth/discord/callback`;
            const permissions = '2147483648'; // Use Applications Commands
            oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
        } else {
            return c.json({ error: 'OAuth not supported for this channel type' }, 400);
        }

        return c.json({
            connectionId,
            status: 'pending',
            authMethod: 'oauth',
            oauthUrl,
            message: `Click the URL to authorize ${channelDef.name}. You'll be redirected back after granting access.`,
            webhookUrl,
        }, 201);
    }

    // ── API Key channels (WhatsApp, Telegram) ───────────────────────────
    if (channelDef.authMethod === 'api_key') {
        if (!body.credentials) {
            return c.json({
                error: 'API key channels require credentials',
                required: body.channelType === 'telegram'
                    ? { botToken: 'Your Telegram bot token from @BotFather' }
                    : { accessToken: 'WhatsApp Business API access token', phoneNumberId: 'WhatsApp phone number ID' },
            }, 400);
        }

        let externalId = '';
        let externalName = '';

        if (body.channelType === 'telegram' && body.credentials.botToken) {
            // Verify bot token and get bot info
            try {
                const botInfo = await fetch(`https://api.telegram.org/bot${body.credentials.botToken}/getMe`);
                const botData = await botInfo.json() as any;

                if (!botData.ok) {
                    return c.json({ error: 'Invalid Telegram bot token' }, 400);
                }

                externalId = String(botData.result.id);
                externalName = `@${botData.result.username}`;

                // Set webhook automatically
                const hookUrl = `${baseUrl}/channels/incoming/telegram/${connectionId}`;
                await fetch(`https://api.telegram.org/bot${body.credentials.botToken}/setWebhook`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: hookUrl,
                        secret_token: webhookSecret,
                    }),
                });
            } catch (err: any) {
                return c.json({ error: `Telegram verification failed: ${err.message}` }, 400);
            }
        }

        if (body.channelType === 'whatsapp') {
            externalId = body.credentials.phoneNumberId || '';
            externalName = 'WhatsApp Business';

            if (!body.credentials.accessToken || !body.credentials.phoneNumberId) {
                return c.json({
                    error: 'WhatsApp requires accessToken and phoneNumberId',
                    instructions: 'Get these from your Meta Business Suite → WhatsApp → API Setup',
                }, 400);
            }
        }

        // Store connection
        await c.env.DB.prepare(`
            INSERT INTO channel_connections
            (id, user_id, channel_type, label, status, external_id, external_name,
             access_token, webhook_url, webhook_secret, config, default_agent, connected_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
            connectionId, userId, body.channelType,
            body.label || `My ${channelDef.name}`,
            externalId, externalName,
            body.credentials.botToken || body.credentials.accessToken || '',
            webhookUrl, webhookSecret,
            JSON.stringify({
                ...body.config,
                phoneNumberId: body.credentials.phoneNumberId,
                verifyToken: body.credentials.verifyToken,
            }),
            body.config?.defaultAgent || 'run',
        ).run();

        return c.json({
            connectionId,
            status: 'active',
            channelType: body.channelType,
            externalName,
            webhookUrl,
            message: `${channelDef.name} connected successfully! ${body.channelType === 'telegram' ? 'Webhook configured automatically.' : 'Set your webhook URL in Meta Business Suite.'}`,
            nextSteps: body.channelType === 'whatsapp' ? [
                `Set this webhook URL in Meta Business Suite: ${webhookUrl}`,
                `Use verify token: ${body.credentials.verifyToken || webhookSecret}`,
            ] : undefined,
        }, 201);
    }

    // ── Custom Webhook ──────────────────────────────────────────────────
    if (channelDef.authMethod === 'webhook_url') {
        await c.env.DB.prepare(`
            INSERT INTO channel_connections
            (id, user_id, channel_type, label, status, webhook_url, webhook_secret, config, default_agent, connected_at)
            VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'))
        `).bind(
            connectionId, userId, 'webhook',
            body.label || 'Custom Webhook',
            webhookUrl, webhookSecret,
            JSON.stringify(body.config || {}),
            body.config?.defaultAgent || 'run',
        ).run();

        return c.json({
            connectionId,
            status: 'active',
            channelType: 'webhook',
            webhookUrl,
            webhookSecret,
            usage: {
                method: 'POST',
                url: webhookUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': webhookSecret,
                },
                body: {
                    text: 'Your message or code to analyze',
                    agent: 'code-review (optional, defaults to connection default)',
                    replyUrl: 'https://your-app.com/webhook-reply (optional)',
                },
            },
            message: 'Custom webhook created! POST messages to the webhook URL above.',
        }, 201);
    }

    return c.json({ error: 'Unsupported auth method' }, 400);
});

// ─── DELETE /channels/:id — Disconnect a channel ────────────────────────────

channelRoutes.delete('/:id', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const connectionId = c.req.param('id');

    // Get connection to clean up external resources
    const connection = await c.env.DB.prepare(`
        SELECT channel_type, access_token, external_id
        FROM channel_connections WHERE id = ? AND user_id = ?
    `).bind(connectionId, userId).first<any>();

    if (!connection) {
        return c.json({ error: 'Connection not found' }, 404);
    }

    // Clean up external webhooks
    if (connection.channel_type === 'telegram' && connection.access_token) {
        try {
            await fetch(`https://api.telegram.org/bot${connection.access_token}/deleteWebhook`);
        } catch { /* best effort */ }
    }

    // Soft delete
    await c.env.DB.prepare(`
        UPDATE channel_connections SET status = 'revoked', access_token = NULL, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
    `).bind(connectionId, userId).run();

    return c.json({ deleted: true, id: connectionId });
});

// ─── PATCH /channels/:id — Update channel config ────────────────────────────

channelRoutes.patch('/:id', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const connectionId = c.req.param('id');
    const body = await c.req.json<{
        label?: string;
        defaultAgent?: string;
        config?: Record<string, any>;
        status?: 'active' | 'paused';
    }>();

    const updates: string[] = [];
    const values: any[] = [];

    if (body.label) { updates.push('label = ?'); values.push(body.label); }
    if (body.defaultAgent) { updates.push('default_agent = ?'); values.push(body.defaultAgent); }
    if (body.config) { updates.push('config = ?'); values.push(JSON.stringify(body.config)); }
    if (body.status) { updates.push('status = ?'); values.push(body.status); }

    if (updates.length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    values.push(connectionId, userId);

    const result = await c.env.DB.prepare(
        `UPDATE channel_connections SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();

    if ((result.meta?.changes ?? 0) === 0) {
        return c.json({ error: 'Connection not found' }, 404);
    }

    return c.json({ updated: true, id: connectionId });
});

// ─── POST /channels/:id/test — Send test message ───────────────────────────

channelRoutes.post('/:id/test', requireAuth, rateLimit, async (c) => {
    const userId = c.get('userId') as string;
    const connectionId = c.req.param('id');

    const connection = await c.env.DB.prepare(`
        SELECT channel_type, access_token, external_id, config, status
        FROM channel_connections WHERE id = ? AND user_id = ? AND status = 'active'
    `).bind(connectionId, userId).first<any>();

    if (!connection) {
        return c.json({ error: 'Active connection not found' }, 404);
    }

    const testMessage = '🤖 **Luna Test** — Your channel connection is working! Try sending a code snippet to get an AI review.';
    let delivered = false;
    let detail = '';

    try {
        if (connection.channel_type === 'slack' && connection.access_token) {
            const config = JSON.parse(connection.config || '{}');
            const channel = config.defaultChannel || connection.external_id;

            const res = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${connection.access_token}`,
                },
                body: JSON.stringify({ channel, text: testMessage }),
            });
            const data = await res.json() as any;
            delivered = data.ok;
            detail = data.ok ? `Sent to #${data.channel}` : data.error;
        }

        if (connection.channel_type === 'telegram' && connection.access_token) {
            const config = JSON.parse(connection.config || '{}');
            const chatId = config.testChatId || connection.external_id;

            if (!chatId) {
                return c.json({
                    error: 'No chat ID configured. Send a message to your bot first, then we can reply.',
                    hint: 'Set config.testChatId to your Telegram chat ID',
                });
            }

            const res = await fetch(`https://api.telegram.org/bot${connection.access_token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: testMessage, parse_mode: 'Markdown' }),
            });
            const data = await res.json() as any;
            delivered = data.ok;
            detail = data.ok ? `Sent to chat ${chatId}` : data.description;
        }

        if (connection.channel_type === 'whatsapp' && connection.access_token) {
            const config = JSON.parse(connection.config || '{}');
            const to = config.testNumber;

            if (!to) {
                return c.json({
                    error: 'No test number configured',
                    hint: 'Set config.testNumber to a WhatsApp number (with country code)',
                });
            }

            const res = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${connection.access_token}`,
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to,
                    type: 'text',
                    text: { body: testMessage },
                }),
            });
            const data = await res.json() as any;
            delivered = !data.error;
            detail = data.error?.message || 'Sent';
        }

        if (connection.channel_type === 'discord') {
            delivered = false;
            detail = 'Discord test requires sending a slash command from your server';
        }

        if (connection.channel_type === 'webhook') {
            delivered = true;
            detail = 'Webhook is ready — POST a message to test';
        }

    } catch (err: any) {
        return c.json({ delivered: false, error: err.message }, 500);
    }

    return c.json({ delivered, detail, connectionId });
});

// ─── GET /channels/:id/stats — Channel usage stats ─────────────────────────

channelRoutes.get('/:id/stats', requireAuth, async (c) => {
    const userId = c.get('userId') as string;
    const connectionId = c.req.param('id');
    const days = parseInt(c.req.query('days') || '30');

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const [connection, messageCount, agentBreakdown, statusBreakdown] = await Promise.all([
        c.env.DB.prepare(`
            SELECT label, channel_type, status, message_count, last_message_at, connected_at
            FROM channel_connections WHERE id = ? AND user_id = ?
        `).bind(connectionId, userId).first<any>(),

        c.env.DB.prepare(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
                   SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
                   AVG(duration_ms) as avg_duration
            FROM channel_messages WHERE connection_id = ? AND user_id = ? AND created_at >= ?
        `).bind(connectionId, userId, sinceStr).first<any>(),

        c.env.DB.prepare(`
            SELECT agent_slug, COUNT(*) as count
            FROM channel_messages WHERE connection_id = ? AND user_id = ? AND created_at >= ? AND agent_slug IS NOT NULL
            GROUP BY agent_slug ORDER BY count DESC LIMIT 10
        `).bind(connectionId, userId, sinceStr).all(),

        c.env.DB.prepare(`
            SELECT status, COUNT(*) as count
            FROM channel_messages WHERE connection_id = ? AND user_id = ? AND created_at >= ?
            GROUP BY status
        `).bind(connectionId, userId, sinceStr).all(),
    ]);

    if (!connection) {
        return c.json({ error: 'Connection not found' }, 404);
    }

    return c.json({
        connection: {
            label: connection.label,
            channelType: connection.channel_type,
            status: connection.status,
            connectedAt: connection.connected_at,
        },
        period: `${days}d`,
        messages: {
            total: messageCount?.total || 0,
            inbound: messageCount?.inbound || 0,
            outbound: messageCount?.outbound || 0,
            avgDurationMs: Math.round(messageCount?.avg_duration || 0),
        },
        topAgents: (agentBreakdown.results || []).map((r: any) => ({
            agent: r.agent_slug,
            count: r.count,
        })),
        byStatus: (statusBreakdown.results || []).map((r: any) => ({
            status: r.status,
            count: r.count,
        })),
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// OAuth Callbacks
// ═══════════════════════════════════════════════════════════════════════════

// ─── Slack OAuth Callback ───────────────────────────────────────────────────

channelRoutes.get('/oauth/slack/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=missing_params`);
    }

    // Validate state
    const oauthState = await c.env.DB.prepare(`
        SELECT user_id, channel_type, redirect_uri
        FROM oauth_states WHERE state = ? AND expires_at > datetime('now')
    `).bind(state).first<any>();

    if (!oauthState) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=invalid_state`);
    }

    // Clean up state
    await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

    try {
        // Exchange code for token
        const clientId = await c.env.KV.get('slack_client_id') || '';
        const clientSecret = await c.env.KV.get('slack_client_secret') || '';
        const redirectUri = c.req.url.split('?')[0];

        const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenRes.json() as any;

        if (!tokenData.ok) {
            return c.redirect(`${getDashboardUrl(c.env)}/channels?error=${encodeURIComponent(tokenData.error)}`);
        }

        // Update connection with token and workspace info
        await c.env.DB.prepare(`
            UPDATE channel_connections
            SET status = 'active',
                access_token = ?,
                external_id = ?,
                external_name = ?,
                scopes = ?,
                connected_at = datetime('now'),
                updated_at = datetime('now')
            WHERE user_id = ? AND channel_type = 'slack' AND status = 'pending'
        `).bind(
            tokenData.access_token,
            tokenData.team?.id,
            tokenData.team?.name,
            tokenData.scope,
            oauthState.user_id,
        ).run();

        return c.redirect(`${getDashboardUrl(c.env)}/channels?connected=slack&workspace=${encodeURIComponent(tokenData.team?.name || '')}`);

    } catch (err: any) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=${encodeURIComponent(err.message)}`);
    }
});

// ─── Discord OAuth Callback ─────────────────────────────────────────────────

channelRoutes.get('/oauth/discord/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=missing_params`);
    }

    const oauthState = await c.env.DB.prepare(`
        SELECT user_id FROM oauth_states WHERE state = ? AND expires_at > datetime('now')
    `).bind(state).first<any>();

    if (!oauthState) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=invalid_state`);
    }

    await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

    try {
        const clientId = await c.env.KV.get('discord_client_id') || '';
        const clientSecret = await c.env.KV.get('discord_client_secret') || '';
        const redirectUri = c.req.url.split('?')[0];

        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenRes.json() as any;

        if (tokenData.error) {
            return c.redirect(`${getDashboardUrl(c.env)}/channels?error=${encodeURIComponent(tokenData.error)}`);
        }

        // Get guild info
        const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        const guilds = await guildRes.json() as any[];
        const guild = guilds?.[0]; // Most recently authorized

        await c.env.DB.prepare(`
            UPDATE channel_connections
            SET status = 'active',
                access_token = ?,
                external_id = ?,
                external_name = ?,
                scopes = ?,
                connected_at = datetime('now'),
                updated_at = datetime('now')
            WHERE user_id = ? AND channel_type = 'discord' AND status = 'pending'
        `).bind(
            tokenData.access_token,
            guild?.id || '',
            guild?.name || 'Discord Server',
            tokenData.scope,
            oauthState.user_id,
        ).run();

        return c.redirect(`${getDashboardUrl(c.env)}/channels?connected=discord&server=${encodeURIComponent(guild?.name || '')}`);

    } catch (err: any) {
        return c.redirect(`${getDashboardUrl(c.env)}/channels?error=${encodeURIComponent(err.message)}`);
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// Incoming Webhooks — Process messages from connected channels
// ═══════════════════════════════════════════════════════════════════════════

// ─── Generic per-connection webhook ─────────────────────────────────────────

channelRoutes.post('/incoming/:connectionId', async (c) => {
    const connectionId = c.req.param('connectionId');

    const connection = await c.env.DB.prepare(`
        SELECT id, user_id, channel_type, access_token, default_agent, config, webhook_secret, status
        FROM channel_connections WHERE id = ? AND status = 'active'
    `).bind(connectionId).first<any>();

    if (!connection) {
        return c.json({ error: 'Connection not found or inactive' }, 404);
    }

    // Verify webhook secret
    const providedSecret = c.req.header('X-Webhook-Secret');
    if (connection.webhook_secret && providedSecret !== connection.webhook_secret) {
        return c.json({ error: 'Invalid webhook secret' }, 403);
    }

    const body = await c.req.json<{
        text: string;
        agent?: string;
        senderId?: string;
        senderName?: string;
        channelId?: string;
        replyUrl?: string;
    }>();

    if (!body.text) {
        return c.json({ error: 'Missing required field: text' }, 400);
    }

    const result = await processMessage(c.env, connection, {
        text: body.text,
        agent: body.agent,
        senderId: body.senderId,
        senderName: body.senderName,
        channelId: body.channelId,
        replyUrl: body.replyUrl,
    });

    return c.json(result);
});

// ─── Slack Events webhook (shared endpoint for all Slack connections) ────────

channelRoutes.post('/incoming/slack', async (c) => {
    const body = await c.req.json<any>();

    // URL verification challenge
    if (body.type === 'url_verification') {
        return c.json({ challenge: body.challenge });
    }

    if (body.type !== 'event_callback' || !body.event) {
        return c.json({ ok: true });
    }

    const event = body.event;
    const teamId = body.team_id;

    // Only handle app_mention or DM messages
    if (event.type !== 'app_mention' && (event.type !== 'message' || event.channel_type !== 'im')) {
        return c.json({ ok: true });
    }

    // Skip bot messages
    if (event.bot_id || event.subtype) {
        return c.json({ ok: true });
    }

    // Find the connection by workspace ID
    const connection = await c.env.DB.prepare(`
        SELECT id, user_id, channel_type, access_token, default_agent, config
        FROM channel_connections
        WHERE channel_type = 'slack' AND external_id = ? AND status = 'active'
    `).bind(teamId).first<any>();

    if (!connection) {
        return c.json({ ok: true }); // No connection for this workspace
    }

    // Strip bot mention from text
    const text = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
    if (!text) {
        return c.json({ ok: true });
    }

    // Process message (non-blocking)
    const result = await processMessage(c.env, connection, {
        text,
        senderId: event.user,
        channelId: event.channel,
        platform: 'slack',
    });

    // Reply in Slack thread
    if (connection.access_token && result.response) {
        try {
            await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${connection.access_token}`,
                },
                body: JSON.stringify({
                    channel: event.channel,
                    text: `🤖 *${result.agent}*:\n${result.response.substring(0, 39000)}`,
                    thread_ts: event.ts,
                }),
            });
        } catch { /* best effort */ }
    }

    return c.json({ ok: true });
});

// ─── WhatsApp webhook ───────────────────────────────────────────────────────

channelRoutes.get('/incoming/whatsapp', (c) => {
    // WhatsApp verification
    const mode = c.req.query('hub.mode');
    const challenge = c.req.query('hub.challenge');
    if (mode === 'subscribe' && challenge) {
        return c.text(challenge);
    }
    return c.json({ error: 'Verification failed' }, 403);
});

channelRoutes.post('/incoming/whatsapp', async (c) => {
    const body = await c.req.json<any>();

    if (body.object !== 'whatsapp_business_account') {
        return c.json({ ok: true });
    }

    for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
            if (change.field !== 'messages') continue;

            const messages = change.value?.messages || [];
            const phoneNumberId = change.value?.metadata?.phone_number_id;

            // Find connection by phone number ID
            const connection = await c.env.DB.prepare(`
                SELECT id, user_id, channel_type, access_token, default_agent, config
                FROM channel_connections
                WHERE channel_type = 'whatsapp' AND status = 'active'
                AND config LIKE ?
            `).bind(`%${phoneNumberId}%`).first<any>();

            if (!connection) continue;

            for (const msg of messages) {
                if (msg.type !== 'text') continue;

                const text = msg.text?.body || '';
                const from = msg.from;

                const result = await processMessage(c.env, connection, {
                    text,
                    senderId: from,
                    platform: 'whatsapp',
                });

                // Reply via WhatsApp
                if (connection.access_token && result.response) {
                    const config = JSON.parse(connection.config || '{}');
                    try {
                        await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${connection.access_token}`,
                            },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                to: from,
                                type: 'text',
                                text: { body: result.response.substring(0, 4000) },
                            }),
                        });
                    } catch { /* best effort */ }
                }
            }
        }
    }

    return c.json({ ok: true });
});

// ─── Telegram webhook (per-connection) ──────────────────────────────────────

channelRoutes.post('/incoming/telegram/:connectionId', async (c) => {
    const connectionId = c.req.param('connectionId');

    const connection = await c.env.DB.prepare(`
        SELECT id, user_id, channel_type, access_token, default_agent, config, webhook_secret
        FROM channel_connections WHERE id = ? AND channel_type = 'telegram' AND status = 'active'
    `).bind(connectionId).first<any>();

    if (!connection) {
        return c.json({ ok: true });
    }

    // Verify secret token from Telegram
    const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
    if (connection.webhook_secret && secretToken !== connection.webhook_secret) {
        return c.json({ ok: true }); // Silent reject
    }

    const body = await c.req.json<any>();
    const message = body.message;
    if (!message?.text) return c.json({ ok: true });

    const text = message.text.replace(/^\/\w+\s*/, '').trim(); // Strip /commands
    if (!text) return c.json({ ok: true });

    const chatId = message.chat?.id;
    const result = await processMessage(c.env, connection, {
        text,
        senderId: String(message.from?.id || ''),
        senderName: message.from?.first_name,
        channelId: String(chatId),
        platform: 'telegram',
    });

    // Reply in Telegram
    if (connection.access_token && result.response && chatId) {
        try {
            await fetch(`https://api.telegram.org/bot${connection.access_token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: result.response.substring(0, 4000),
                    parse_mode: 'Markdown',
                    reply_to_message_id: message.message_id,
                }),
            });
        } catch { /* best effort */ }
    }

    return c.json({ ok: true });
});

// ─── Discord interactions ───────────────────────────────────────────────────

channelRoutes.post('/incoming/discord', async (c) => {
    const body = await c.req.json<any>();

    // Discord ping verification
    if (body.type === 1) {
        return c.json({ type: 1 });
    }

    // Slash command
    if (body.type === 2 && body.data?.name === 'luna') {
        const guildId = body.guild_id;
        const userId = body.member?.user?.id || body.user?.id;

        const connection = await c.env.DB.prepare(`
            SELECT id, user_id, channel_type, access_token, default_agent, config
            FROM channel_connections
            WHERE channel_type = 'discord' AND external_id = ? AND status = 'active'
        `).bind(guildId).first<any>();

        if (!connection) {
            return c.json({
                type: 4,
                data: { content: '❌ No Luna connection configured for this server. Ask your admin to connect at https://lunaos.ai/channels' },
            });
        }

        const options = body.data?.options || [];
        const agent = options.find((o: any) => o.name === 'agent')?.value || connection.default_agent || 'run';
        const context = options.find((o: any) => o.name === 'context')?.value || '';

        if (!context) {
            return c.json({
                type: 4,
                data: { content: 'Usage: `/luna agent:code-review context:Review this function...`' },
            });
        }

        const result = await processMessage(c.env, connection, {
            text: context,
            agent,
            senderId: userId,
            platform: 'discord',
        });

        return c.json({
            type: 4,
            data: {
                content: result.response
                    ? `🤖 **${agent}**:\n${result.response.substring(0, 2000)}`
                    : `❌ ${result.error || 'Processing failed'}`,
            },
        });
    }

    return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// Core Message Processor
// ═══════════════════════════════════════════════════════════════════════════

interface IncomingMessage {
    text: string;
    agent?: string;
    senderId?: string;
    senderName?: string;
    channelId?: string;
    platform?: string;
    replyUrl?: string;
}

interface ProcessResult {
    response: string;
    agent: string;
    executionId: string;
    durationMs: number;
    error?: string;
}

async function processMessage(
    env: ServiceEnv,
    connection: any,
    msg: IncomingMessage,
): Promise<ProcessResult> {
    const startTime = Date.now();
    const messageId = crypto.randomUUID();
    const agentSlug = msg.agent || connection.default_agent || 'run';

    // Log inbound message
    try {
        await env.DB.prepare(`
            INSERT INTO channel_messages
            (id, connection_id, user_id, direction, sender_id, sender_name, channel_id, message_text, agent_slug, status)
            VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?, 'processing')
        `).bind(
            messageId, connection.id, connection.user_id,
            msg.senderId || '', msg.senderName || '',
            msg.channelId || '', msg.text, agentSlug,
        ).run();
    } catch { /* non-blocking */ }

    try {
        // Resolve provider and API key
        const config = JSON.parse(connection.config || '{}');
        const provider = config.provider || 'deepseek';
        const apiKey = resolveApiKey(env, provider);

        if (!apiKey) {
            const err = `No API key configured for ${provider}`;
            await updateMessageStatus(env, messageId, 'failed', err);
            return { response: '', agent: agentSlug, executionId: messageId, durationMs: Date.now() - startTime, error: err };
        }

        // Call LLM
        const systemPrompt = `You are a specialized AI coding agent (${agentSlug}) from LunaOS, responding via ${msg.platform || connection.channel_type}. Be concise but thorough. Format for messaging platforms (no huge code blocks).`;

        const llmRes = await fetch(getLLMEndpoint(provider), {
            method: 'POST',
            headers: getLLMHeaders(provider, apiKey),
            body: JSON.stringify(
                provider === 'anthropic'
                    ? {
                        model: 'claude-sonnet-4-20250514', max_tokens: 4096,
                        system: systemPrompt,
                        messages: [{ role: 'user', content: msg.text }],
                    }
                    : {
                        model: provider === 'openai' ? 'gpt-4o' : 'deepseek-chat',
                        max_tokens: 4096,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: msg.text },
                        ],
                    }
            ),
        });

        if (!llmRes.ok) {
            const errText = await llmRes.text();
            throw new Error(`LLM error (${llmRes.status}): ${errText.substring(0, 200)}`);
        }

        const llmData = await llmRes.json() as any;
        let response = '';

        if (provider === 'anthropic') {
            response = llmData.content?.[0]?.text || '';
        } else {
            response = llmData.choices?.[0]?.message?.content || '';
        }

        const duration = Date.now() - startTime;

        // Update message log
        await updateMessageStatus(env, messageId, 'responded', undefined, response, duration);

        // Update connection stats
        try {
            await env.DB.prepare(`
                UPDATE channel_connections
                SET message_count = message_count + 1, last_message_at = datetime('now'), updated_at = datetime('now')
                WHERE id = ?
            `).bind(connection.id).run();
        } catch { /* non-blocking */ }

        // Track in analytics
        try {
            await env.DB.prepare(`
                INSERT INTO openclaw_skill_executions
                (id, user_id, skill_name, agent_slug, provider, input_length, output_length, duration_ms, status, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                crypto.randomUUID(), connection.user_id, 'channel_message',
                agentSlug, provider, msg.text.length, response.length,
                duration, 'completed', `channel:${connection.channel_type}`,
            ).run();
        } catch { /* non-blocking */ }

        // Send to reply URL if provided
        if (msg.replyUrl) {
            try {
                await fetch(msg.replyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: response, agent: agentSlug, executionId: messageId }),
                });
            } catch { /* non-blocking */ }
        }

        return { response, agent: agentSlug, executionId: messageId, durationMs: duration };

    } catch (err: any) {
        await updateMessageStatus(env, messageId, 'failed', err.message);
        return {
            response: '',
            agent: agentSlug,
            executionId: messageId,
            durationMs: Date.now() - startTime,
            error: err.message,
        };
    }
}

async function updateMessageStatus(
    env: ServiceEnv,
    messageId: string,
    status: string,
    error?: string,
    response?: string,
    durationMs?: number,
): Promise<void> {
    try {
        const sets = ['status = ?'];
        const vals: any[] = [status];

        if (error) { sets.push('error = ?'); vals.push(error); }
        if (response) { sets.push('response_text = ?'); vals.push(response); }
        if (durationMs) { sets.push('duration_ms = ?'); vals.push(durationMs); }

        vals.push(messageId);
        await env.DB.prepare(`UPDATE channel_messages SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    } catch { /* non-blocking */ }
}

// ─── LLM Helpers ────────────────────────────────────────────────────────────

function resolveApiKey(env: ServiceEnv, provider: string): string | undefined {
    return ({
        deepseek: env.DEEPSEEK_API_KEY,
        anthropic: env.ANTHROPIC_API_KEY,
        openai: env.OPENAI_API_KEY,
    } as Record<string, string | undefined>)[provider];
}

function getLLMEndpoint(provider: string): string {
    return ({
        deepseek: 'https://api.deepseek.com/v1/chat/completions',
        anthropic: 'https://api.anthropic.com/v1/messages',
        openai: 'https://api.openai.com/v1/chat/completions',
    } as Record<string, string>)[provider] || 'https://api.deepseek.com/v1/chat/completions';
}

function getLLMHeaders(provider: string, apiKey: string): Record<string, string> {
    if (provider === 'anthropic') {
        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        };
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
}

function getDashboardUrl(env: ServiceEnv): string {
    return env.ENVIRONMENT === 'production'
        ? 'https://dash.lunaos.ai'
        : 'http://localhost:5173';
}
