export interface ChannelTypeInfo {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    auth: string;
}

export const CHANNEL_TYPES: ChannelTypeInfo[] = [
    { id: 'slack', name: 'Slack', icon: '💬', color: 'violet', description: 'Connect your Slack workspace. AI agents respond directly in channels.', auth: 'OAuth' },
    { id: 'discord', name: 'Discord', icon: '🎮', color: 'indigo', description: 'Add bot to your Discord server. Slash commands and auto-replies.', auth: 'OAuth' },
    { id: 'whatsapp', name: 'WhatsApp', icon: '📱', color: 'emerald', description: 'Connect WhatsApp Business. AI agents respond to customer messages.', auth: 'API Key' },
    { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'sky', description: 'Connect your Telegram bot. Webhook auto-configured.', auth: 'Bot Token' },
    { id: 'webhook', name: 'Custom Webhook', icon: '🔗', color: 'amber', description: 'Get a unique webhook URL. POST messages, get AI responses.', auth: 'Secret' },
];

export interface ColorSet {
    border: string;
    bg: string;
    text: string;
    hover: string;
}

export const colorMap: Record<string, ColorSet> = {
    violet: { border: 'border-violet-500/20', bg: 'bg-violet-500/5', text: 'text-violet-400', hover: 'hover:border-violet-500/40 hover:bg-violet-500/10' },
    indigo: { border: 'border-indigo-500/20', bg: 'bg-indigo-500/5', text: 'text-indigo-400', hover: 'hover:border-indigo-500/40 hover:bg-indigo-500/10' },
    emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', hover: 'hover:border-emerald-500/40 hover:bg-emerald-500/10' },
    sky: { border: 'border-sky-500/20', bg: 'bg-sky-500/5', text: 'text-sky-400', hover: 'hover:border-sky-500/40 hover:bg-sky-500/10' },
    amber: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', text: 'text-amber-400', hover: 'hover:border-amber-500/40 hover:bg-amber-500/10' },
};
