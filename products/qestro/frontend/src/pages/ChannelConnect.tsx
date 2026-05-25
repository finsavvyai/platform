import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChatBubbleLeftRightIcon, CheckCircleIcon, XCircleIcon,
    Cog6ToothIcon, ArrowPathIcon,
    ChevronDownIcon, PaperAirplaneIcon, LinkIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/atoms';
import { api } from '../lib/api';
import '../styles/ai-features.css';

interface Channel {
    id: string;
    name: string;
    emoji: string;
    description: string;
    connected: boolean;
    lastMessage?: string;
    messageCount: number;
    healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
    brandColor: string;
    setupSteps: string[];
    configFields: { key: string; label: string; placeholder: string; type: string }[];
}

const CHANNELS: Channel[] = [
    {
        id: 'slack',
        name: 'Slack',
        emoji: '💬',
        description: 'Send QA notifications and AI insights to your Slack workspace channels',
        connected: true,
        lastMessage: '3 min ago',
        messageCount: 1247,
        healthStatus: 'healthy',
        brandColor: '#4A154B',
        setupSteps: [
            'Go to api.slack.com/apps and create a new app',
            'Enable Incoming Webhooks',
            'Install the app to your workspace',
            'Copy the Webhook URL and paste below',
        ],
        configFields: [
            { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...', type: 'url' },
            { key: 'channel', label: 'Default Channel', placeholder: '#qa-notifications', type: 'text' },
        ],
    },
    {
        id: 'discord',
        name: 'Discord',
        emoji: '🎮',
        description: 'Push real-time test results and alerts to Discord channels via webhooks',
        connected: true,
        lastMessage: '1 hour ago',
        messageCount: 483,
        healthStatus: 'healthy',
        brandColor: '#5865F2',
        setupSteps: [
            'Open Discord and go to Server Settings → Integrations',
            'Click "New Webhook" and configure the channel',
            'Copy the Webhook URL',
            'Paste the URL below to connect',
        ],
        configFields: [
            { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', type: 'url' },
        ],
    },
    {
        id: 'telegram',
        name: 'Telegram',
        emoji: '📱',
        description: 'Get instant QA alerts and daily summaries via Telegram bot messages',
        connected: false,
        messageCount: 0,
        healthStatus: 'unknown',
        brandColor: '#26A5E4',
        setupSteps: [
            'Open Telegram and search for @BotFather',
            'Create a new bot with /newbot command',
            'Copy the bot token provided',
            'Add the bot to your group/channel and get the chat ID',
        ],
        configFields: [
            { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v...', type: 'password' },
            { key: 'chat_id', label: 'Chat ID', placeholder: '-1001234567890', type: 'text' },
        ],
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp',
        emoji: '📲',
        description: 'Receive critical alerts and on-call notifications via WhatsApp Business API',
        connected: false,
        messageCount: 0,
        healthStatus: 'unknown',
        brandColor: '#25D366',
        setupSteps: [
            'Set up a WhatsApp Business API account via Meta Business Suite',
            'Register your phone number and get API credentials',
            'Configure the webhook endpoint in your WhatsApp dashboard',
            'Enter the API token and phone number ID below',
        ],
        configFields: [
            { key: 'api_token', label: 'API Token', placeholder: 'EAABsbCS...', type: 'password' },
            { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', type: 'text' },
        ],
    },
    {
        id: 'teams',
        name: 'Microsoft Teams',
        emoji: '🏢',
        description: 'Integrate with Microsoft Teams for enterprise QA communication workflows',
        connected: false,
        messageCount: 0,
        healthStatus: 'unknown',
        brandColor: '#6264A7',
        setupSteps: [
            'In Teams, go to the target channel → Connectors',
            'Find "Incoming Webhook" and click Configure',
            'Name it "Qestro AI" and upload an icon',
            'Copy the connector URL and paste below',
        ],
        configFields: [
            { key: 'webhook_url', label: 'Connector URL', placeholder: 'https://outlook.office.com/webhook/...', type: 'url' },
        ],
    },
    {
        id: 'email',
        name: 'Email',
        emoji: '📧',
        description: 'Send digest summaries, reports, and critical alerts via email notifications',
        connected: true,
        lastMessage: '6 hours ago',
        messageCount: 89,
        healthStatus: 'healthy',
        brandColor: '#EA4335',
        setupSteps: [
            'Configure your SMTP server or use a service like SendGrid/Mailgun',
            'Enter the SMTP credentials below',
            'Add recipient email addresses',
            'Test the connection to verify delivery',
        ],
        configFields: [
            { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.sendgrid.net', type: 'text' },
            { key: 'smtp_port', label: 'SMTP Port', placeholder: '587', type: 'text' },
            { key: 'smtp_user', label: 'Username', placeholder: 'apikey', type: 'text' },
            { key: 'smtp_pass', label: 'Password', placeholder: '••••••••', type: 'password' },
        ],
    },
    {
        id: 'webhook',
        name: 'Custom Webhook',
        emoji: '🔗',
        description: 'Send structured JSON payloads to any HTTP endpoint for custom integrations',
        connected: false,
        messageCount: 0,
        healthStatus: 'unknown',
        brandColor: '#FF6B35',
        setupSteps: [
            'Set up an HTTP endpoint that accepts POST requests',
            'Ensure it handles JSON payloads with the Qestro event schema',
            'Enter the endpoint URL and any auth headers below',
        ],
        configFields: [
            { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://your-service.com/qestro-webhook', type: 'url' },
            { key: 'auth_header', label: 'Authorization Header', placeholder: 'Bearer your-token', type: 'password' },
        ],
    },
];

export default function ChannelConnect() {
    const [channels, setChannels] = useState<Channel[]>(CHANNELS);
    const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
    const [configValues, setConfigValues] = useState<Record<string, Record<string, string>>>({});
    const [connecting, setConnecting] = useState<string | null>(null);
    const [testingSend, setTestingSend] = useState<string | null>(null);

    const connectedCount = channels.filter(c => c.connected).length;

    const handleConnect = async (channelId: string) => {
        setConnecting(channelId);
        // Simulate connection
        setTimeout(() => {
            setChannels(prev => prev.map(c =>
                c.id === channelId ? { ...c, connected: true, healthStatus: 'healthy' as const } : c
            ));
            setConnecting(null);
            setExpandedChannel(null);
        }, 2000);
    };

    const handleDisconnect = (channelId: string) => {
        setChannels(prev => prev.map(c =>
            c.id === channelId ? { ...c, connected: false, healthStatus: 'unknown' as const, messageCount: 0, lastMessage: undefined } : c
        ));
    };

    const handleTestMessage = async (channelId: string) => {
        setTestingSend(channelId);
        try {
            await api.testNotification({ channel: channelId, message: 'Test from Qestro AI Engine ✅' });
        } catch { /* ok */ }
        setTimeout(() => setTestingSend(null), 2000);
    };

    const updateConfig = (channelId: string, key: string, value: string) => {
        setConfigValues(prev => ({
            ...prev,
            [channelId]: { ...(prev[channelId] || {}), [key]: value },
        }));
    };

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

    return (
        <motion.div className="p-6 space-y-6 max-w-[1600px] mx-auto" variants={containerVariants} initial="hidden" animate="visible">
            {/* Header */}
            <motion.div variants={itemVariants} className="ai-hero-banner">
                <div className="relative z-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                                <ChatBubbleLeftRightIcon className="h-7 w-7 text-cyan-400" />
                                Connect Your Channels
                            </h1>
                            <p className="text-gray-400 mt-1">
                                Route AI test results, alerts, and summaries to your team's preferred channels
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                            <span className="text-sm text-gray-400">Connected</span>
                            <span className="text-lg font-bold ai-gradient-text">{connectedCount}</span>
                            <span className="text-sm text-gray-600">/ {channels.length}</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Connected Summary */}
            {connectedCount > 0 && (
                <motion.div variants={itemVariants}>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                        Active Channels
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {channels.filter(c => c.connected).map(channel => (
                            <div key={channel.id} className="flex items-center gap-3 ai-glass-card p-3">
                                <span className="text-xl">{channel.emoji}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-200">{channel.name}</span>
                                        <span className={`ai-status-dot ${channel.healthStatus === 'healthy' ? 'active' : channel.healthStatus === 'degraded' ? 'processing' : 'error'}`} />
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {channel.messageCount.toLocaleString()} messages • Last: {channel.lastMessage}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleTestMessage(channel.id)}
                                    className={`p-2 rounded-lg transition-all ${testingSend === channel.id
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                                        }`}
                                    title="Send test message"
                                >
                                    {testingSend === channel.id ? <CheckCircleIcon className="h-4 w-4" /> : <PaperAirplaneIcon className="h-4 w-4" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* All Channels Grid */}
            <motion.div variants={itemVariants}>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    All Channels
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {channels.map((channel) => (
                        <motion.div
                            key={channel.id}
                            variants={itemVariants}
                            className={`channel-card ${channel.id}`}
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                        style={{ backgroundColor: `${channel.brandColor}20` }}
                                    >
                                        {channel.emoji}
                                    </div>
                                    <div>
                                        <div className="text-base font-semibold text-gray-200">{channel.name}</div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {channel.connected ? (
                                                <span className="flex items-center gap-1 text-xs text-emerald-400">
                                                    <CheckCircleIcon className="h-3.5 w-3.5" /> Connected
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-gray-600">
                                                    <XCircleIcon className="h-3.5 w-3.5" /> Not connected
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 mb-4 leading-relaxed">{channel.description}</p>

                            {/* Connect/Manage Button */}
                            <div className="flex gap-2">
                                {channel.connected ? (
                                    <>
                                        <button
                                            onClick={() => setExpandedChannel(expandedChannel === channel.id ? null : channel.id)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all"
                                        >
                                            <Cog6ToothIcon className="h-4 w-4" />
                                            Configure
                                        </button>
                                        <button
                                            onClick={() => handleDisconnect(channel.id)}
                                            className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all"
                                        >
                                            Disconnect
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setExpandedChannel(expandedChannel === channel.id ? null : channel.id)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                        style={{
                                            background: `${channel.brandColor}20`,
                                            borderColor: `${channel.brandColor}40`,
                                            border: `1px solid ${channel.brandColor}40`,
                                            color: channel.brandColor === '#4A154B' ? '#E8D5E8' : '#E2E8F0',
                                        }}
                                    >
                                        <LinkIcon className="h-4 w-4" />
                                        Connect
                                        <ChevronDownIcon className={`h-4 w-4 transition-transform ${expandedChannel === channel.id ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </div>

                            {/* Expanded Setup */}
                            <AnimatePresence>
                                {expandedChannel === channel.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                                            {/* Setup Steps */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                                                    <InformationCircleIcon className="h-3.5 w-3.5" />
                                                    Setup Guide
                                                </h4>
                                                <ol className="space-y-1.5">
                                                    {channel.setupSteps.map((step, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                                                            <span className="text-violet-400 font-semibold mt-0.5">{i + 1}.</span>
                                                            {step}
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>

                                            {/* Config Fields */}
                                            <div className="space-y-2">
                                                {channel.configFields.map(field => (
                                                    <div key={field.key}>
                                                        <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                                                        <input
                                                            type={field.type === 'password' ? 'password' : 'text'}
                                                            value={configValues[channel.id]?.[field.key] || ''}
                                                            onChange={e => updateConfig(channel.id, field.key, e.target.value)}
                                                            placeholder={field.placeholder}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40 transition-colors"
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Save/Connect Button */}
                                            <Button
                                                onClick={() => handleConnect(channel.id)}
                                                disabled={connecting === channel.id}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-violet-600 to-cyan-500 text-white disabled:opacity-60 hover:shadow-lg hover:shadow-violet-500/25"
                                            >
                                                {connecting === channel.id ? (
                                                    <>
                                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircleIcon className="h-4 w-4" />
                                                        {channel.connected ? 'Save Configuration' : 'Connect Channel'}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}
