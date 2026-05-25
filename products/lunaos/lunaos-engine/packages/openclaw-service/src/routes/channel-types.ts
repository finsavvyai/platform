/**
 * Channel Types — Type definitions and channel type registry
 */

import type { ServiceEnv } from '../types';

// ─── Channel Type Registry ──────────────────────────────────────────────────

export interface ChannelTypeInfo {
    type: string;
    name: string;
    icon: string;
    description: string;
    authMethod: 'oauth' | 'api_key' | 'webhook_url';
    setupSteps: string[];
    docsUrl: string;
    features: string[];
}

export interface IncomingMessage {
    text: string;
    agent?: string;
    senderId?: string;
    senderName?: string;
    channelId?: string;
    platform?: string;
    replyUrl?: string;
}

export interface ProcessResult {
    response: string;
    agent: string;
    executionId: string;
    durationMs: number;
    error?: string;
}

export const CHANNEL_TYPES: ChannelTypeInfo[] = [
    {
        type: 'slack',
        name: 'Slack',
        icon: '\u{1F4AC}',
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
        icon: '\u{1F3AE}',
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
        icon: '\u{1F4F1}',
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
        icon: '\u{2708}\u{FE0F}',
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
        icon: '\u{1F517}',
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
