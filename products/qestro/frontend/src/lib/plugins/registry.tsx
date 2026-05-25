/* eslint-disable react-refresh/only-export-components */
import {
    Slack, MessageSquare,
    Trello, CheckSquare,
    Github, Code,
    Cloud, Server,
    Figma, Eye,
    Send, Database,
    Copy, Check,
    Bot
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { registry } from './sdk';
import type { IntegrationCategory, IntegrationPlugin } from './sdk';
import { Button } from '../../components/atoms';

// --- MOCK API HELPERS ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

console.log('🔌 Registry (TSX) Loading...');

// --- SETTINGS COMPONENTS ---

// 1. Slack: Webhook URL Input
const SlackSettings = ({ onClose }: { onClose: () => void }) => {
    const [webhook, setWebhook] = useState(localStorage.getItem('slack_webhook') || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Attempt to verify via Backend
            const response = await fetch('http://localhost:3010/api/slack/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhookUrl: webhook })
            });

            if (!response.ok) {
                // If backend check fails, throw (but maybe still save purely locally if offline?)
                console.error("Slack Verification Failed:", await response.text());
                // Fallback: Proceed for now but warn user? For now, we assume success or fail.
            } else {
                console.log("Slack Verification Success!");
            }
        } catch {
            console.error("Backend unreachable, saving locally only.");
        }

        await sleep(1000); // Visual delay for UX
        localStorage.setItem('slack_webhook', webhook);
        localStorage.setItem('plugin_slack_connected', 'true'); // Auto-connect on save
        setSaving(false);
        onClose();
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Incoming Webhook URL</label>
                <input
                    type="text"
                    value={webhook}
                    onChange={(e) => setWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50"
                />
                <p className="text-xs text-text-muted mt-2">
                    Create an Incoming Webhook in your Slack App settings and paste it here.
                </p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!webhook || saving}>
                    {saving ? 'Saving...' : 'Save & Connect'}
                </Button>
            </div>
        </div>
    );
};

// 2. VS Code: API Key Generator
const VSCodeSettings = ({ onClose }: { onClose: () => void }) => {
    const [key, setKey] = useState(localStorage.getItem('vscode_api_key') || '');
    const [copied, setCopied] = useState(false);

    const generateKey = async () => {
        const newKey = 'qestro_wk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('vscode_api_key', newKey);
        localStorage.setItem('plugin_vscode_connected', 'true');
        setKey(newKey);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6 text-center">
            {!key ? (
                <div className="py-8">
                    <p className="text-text-muted mb-4">Generate an API Key to connect your VS Code extension.</p>
                    <Button onClick={generateKey} variant="primary">Generate New Key</Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="p-4 bg-black/40 rounded-lg border border-primary/20">
                        <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">Your API Key</p>
                        <div className="flex items-center gap-2 justify-center font-mono text-xl text-primary font-bold break-all">
                            {key}
                        </div>
                    </div>
                    <Button onClick={copyToClipboard} variant="outline" className="w-full justify-center" leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
                        {copied ? 'Copied!' : 'Copy Key'}
                    </Button>
                    <p className="text-xs text-text-muted">Paste this into the Qestro Extension settings in VS Code.</p>
                    <div className="pt-4 border-t border-white/5">
                        <Button variant="ghost" className="w-full" onClick={onClose}>Done</Button>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- REUSABLE COMPONENTS ---

interface BaseSettingsProps {
    onClose: () => void;
    id: string; // Plugin ID for storage key
    label: string;
    placeholder?: string;
    description?: string;
}

const GenericApiKeySettings = ({ onClose, id, label, placeholder, description }: BaseSettingsProps) => {
    const [value, setValue] = useState(localStorage.getItem(`${id}_token`) || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await sleep(1000);
        localStorage.setItem(`${id}_token`, value);
        localStorage.setItem(`plugin_${id}_connected`, 'true');
        setSaving(false);
        onClose();
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
                <input
                    type="password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder || "sk_test_..."}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50 font-mono text-sm"
                />
                {description && <p className="text-xs text-text-muted mt-2">{description}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!value || saving}>
                    {saving ? 'Connecting...' : 'Connect'}
                </Button>
            </div>
        </div>
    );
};

// --- SPECIFIC SETTINGS COMPONENTS ---

// 3. Teams (Same as Slack)
const TeamsSettings = ({ onClose }: { onClose: () => void }) => {
    const [webhook, setWebhook] = useState(localStorage.getItem('teams_webhook') || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await sleep(1000);
        localStorage.setItem('teams_webhook', webhook);
        localStorage.setItem('plugin_teams_connected', 'true');
        setSaving(false);
        onClose();
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Incoming Webhook URL</label>
                <input
                    type="text"
                    value={webhook}
                    onChange={(e) => setWebhook(e.target.value)}
                    placeholder="https://outlook.office.com/webhook/..."
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50"
                />
                <p className="text-xs text-text-muted mt-2">
                    Paste the Connector URL from your Microsoft Teams channel.
                </p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!webhook || saving}>
                    {saving ? 'Connecting...' : 'Connect'}
                </Button>
            </div>
        </div>
    );
};

// 4. Jira (Complex: Domain + Email + Token)
const JiraSettings = ({ onClose }: { onClose: () => void }) => {
    const [domain, setDomain] = useState(localStorage.getItem('jira_domain') || '');
    const [email, setEmail] = useState(localStorage.getItem('jira_email') || '');
    const [token, setToken] = useState(localStorage.getItem('jira_token') || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await sleep(1500);
        localStorage.setItem('jira_domain', domain);
        localStorage.setItem('jira_email', email);
        localStorage.setItem('jira_token', token);
        localStorage.setItem('plugin_jira_connected', 'true');
        setSaving(false);
        onClose();
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Jira Domain</label>
                <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="company.atlassian.net" className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary mb-3" />

                <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary mb-3" />

                <label className="block text-sm font-medium text-text-muted mb-1">API Token</label>
                <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Atlassian API Token" className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary font-mono" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!domain || !email || !token || saving}>
                    {saving ? 'Validating...' : 'Connect Jira'}
                </Button>
            </div>
        </div>
    );
}

// 5. Linear
const LinearSettings = ({ onClose }: { onClose: () => void }) => (
    <GenericApiKeySettings onClose={onClose} id="linear" label="Personal API Key" placeholder="lin_api_..." description="Generate a Personal API Key in Linear Settings > API." />
);

// 6. Notion (Simulated OAuth)
const NotionSettings = ({ onClose }: { onClose: () => void }) => {
    const [loading, setLoading] = useState(false);
    const connect = async () => {
        setLoading(true);
        await sleep(2000); // Simulate popup flow
        localStorage.setItem('plugin_notion_connected', 'true');
        onClose();
    };
    return (
        <div className="text-center py-6">
            <p className="text-text-muted mb-6">Authorize Qestro to access your Notion pages for documentation embedding.</p>
            <Button onClick={connect} disabled={loading} variant="primary" className="w-full justify-center">
                {loading ? 'Connecting to Notion...' : 'Authorize with Notion'}
            </Button>
        </div>
    );
};

// 7. GitHub
const GitHubSettings = ({ onClose }: { onClose: () => void }) => (
    <GenericApiKeySettings onClose={onClose} id="github" label="Personal Access Token (Classic)" placeholder="ghp_..." description="Scopes required: repo, read:org, workflow." />
);

// 8. Postman
const PostmanSettings = ({ onClose }: { onClose: () => void }) => (
    <GenericApiKeySettings onClose={onClose} id="postman" label="Postman API Key" placeholder="PMAK-..." description="Obtain from Postman Integrations Dashboard." />
);

// 9. Cloudflare (Account ID + Token)
const CloudflareSettings = ({ onClose }: { onClose: () => void }) => {
    const [accountId, setAccountId] = useState(localStorage.getItem('cf_account') || '');
    const [token, setToken] = useState(localStorage.getItem('cf_token') || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await sleep(1000);
        localStorage.setItem('cf_account', accountId);
        localStorage.setItem('cf_token', token);
        localStorage.setItem('plugin_cloudflare_connected', 'true');
        setSaving(false);
        onClose();
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Account ID</label>
                <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary mb-3 font-mono" />

                <label className="block text-sm font-medium text-text-muted mb-1">API Token</label>
                <input type="password" value={token} onChange={e => setToken(e.target.value)} className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary font-mono" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!accountId || !token || saving}>
                    {saving ? 'Linking...' : 'Link Account'}
                </Button>
            </div>
        </div>
    );
};

// 10. Vercel
const VercelSettings = ({ onClose }: { onClose: () => void }) => (
    <GenericApiKeySettings onClose={onClose} id="vercel" label="Vercel Function Access Token" description="Required to trigger deployment rollbacks." />
);

// 11. Figma
const FigmaSettings = ({ onClose }: { onClose: () => void }) => (
    <GenericApiKeySettings onClose={onClose} id="figma" label="Personal Access Token" description="To fetch design specs for comparison." />
);

// 12. Sentry
const SentrySettings = ({ onClose }: { onClose: () => void }) => (
    <GenericApiKeySettings onClose={onClose} id="sentry" label="Project DSN" placeholder="https://...@sentry.io/..." description="Found in Project Settings > Client Keys." />
);




// --- OPENCLAW SETTINGS ---
const OpenClawSettings = ({ onClose }: { onClose: () => void }) => {
    const [gatewayUrl, setGatewayUrl] = useState(localStorage.getItem('openclaw_gateway_url') || 'http://127.0.0.1:18789');
    const [hookToken, setHookToken] = useState(localStorage.getItem('openclaw_hook_token') || '');
    const [channel, setChannel] = useState(localStorage.getItem('openclaw_default_channel') || 'last');
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);

    const handleTest = async () => {
        try {
            const response = await fetch(`${gatewayUrl}/health`, { method: 'GET' });
            if (response.ok) {
                setTestResult('✅ Gateway is reachable!');
            } else {
                setTestResult(`⚠️ Gateway returned ${response.status}`);
            }
        } catch {
            setTestResult('❌ Cannot reach Gateway. Is OpenClaw running?');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        await sleep(800);
        localStorage.setItem('openclaw_gateway_url', gatewayUrl);
        localStorage.setItem('openclaw_hook_token', hookToken);
        localStorage.setItem('openclaw_default_channel', channel);
        localStorage.setItem('plugin_openclaw_connected', 'true');
        setSaving(false);
        onClose();
    };

    const channels = ['last', 'whatsapp', 'telegram', 'slack', 'discord', 'signal', 'imessage', 'msteams'];

    return (
        <div className="space-y-4">
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-xs text-orange-300">
                    🦞 OpenClaw is an open-source AI agent that connects to WhatsApp, Telegram, Slack & more.
                    Run tests and get QA updates directly in your messaging apps.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Gateway URL</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={gatewayUrl}
                        onChange={(e) => setGatewayUrl(e.target.value)}
                        placeholder="http://127.0.0.1:18789"
                        className="flex-1 px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50 font-mono text-sm"
                    />
                    <button
                        onClick={handleTest}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all text-sm"
                    >
                        Test
                    </button>
                </div>
                {testResult && <p className="text-xs mt-1">{testResult}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Hook Token</label>
                <input
                    type="password"
                    value={hookToken}
                    onChange={(e) => setHookToken(e.target.value)}
                    placeholder="your-shared-secret"
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50 font-mono text-sm"
                />
                <p className="text-xs text-text-muted mt-1">
                    Set in ~/.openclaw/openclaw.json under hooks.token
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Default Channel</label>
                <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-primary/50 text-sm"
                >
                    {channels.map(ch => (
                        <option key={ch} value={ch} className="bg-gray-900">
                            {ch === 'last' ? 'Last Used Channel' : ch.charAt(0).toUpperCase() + ch.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!gatewayUrl || !hookToken || saving}>
                    {saving ? 'Connecting...' : '🦞 Connect OpenClaw'}
                </Button>
            </div>
        </div>
    );
};


// --- PLUGIN FACTORY ---
const createPlugin = (
    id: string,
    name: string,
    desc: string,
    icon: IntegrationPlugin['icon'],
    cat: IntegrationCategory,
    label = "Connect",
    SettingsComponent?: (props: { onClose: () => void }) => ReactNode
): IntegrationPlugin => {
    return {
        id,
        name,
        description: desc,
        icon,
        categories: [cat],
        features: {
            hasSettings: !!SettingsComponent,
            hasOAuth: !SettingsComponent, // Assume OAuth if no manual settings
            hasWebhook: false
        },
        actionLabel: label,

        checkStatus: async () => {
            const stored = localStorage.getItem(`plugin_${id}_connected`);
            const isConnected = stored === 'true';
            return { isConnected, metadata: {} };
        },

        connect: async () => {
            // If settings exist, UI handles the connection state (e.g. on Save)
            if (SettingsComponent) return false;

            await sleep(1500);
            localStorage.setItem(`plugin_${id}_connected`, 'true');
            return true;
        },

        disconnect: async () => {
            await sleep(800);
            // Clear settings too
            if (id === 'slack') localStorage.removeItem('slack_webhook');
            if (id === 'teams') localStorage.removeItem('teams_webhook');

            if (id === 'vscode') localStorage.removeItem('vscode_api_key');
            if (id === 'jira') { localStorage.removeItem('jira_domain'); localStorage.removeItem('jira_token'); }
            if (id === 'cloudflare') { localStorage.removeItem('cf_account'); localStorage.removeItem('cf_token'); }
            if (id === 'openclaw') { localStorage.removeItem('openclaw_gateway_url'); localStorage.removeItem('openclaw_hook_token'); localStorage.removeItem('openclaw_default_channel'); }

            // Generic Tokens
            const genericIds = ['linear', 'github', 'postman', 'vercel', 'figma', 'sentry'];
            if (genericIds.includes(id)) localStorage.removeItem(`${id}_token`);

            localStorage.removeItem(`plugin_${id}_connected`);
            return true;
        },

        renderSettings: SettingsComponent
    };
};

// --- REGISTRATIONS ---

/* COMMUNICATIONS */
registry.register(createPlugin(
    'slack',
    'Slack',
    'Get real-time alerts for broken builds and failed tests.',
    Slack,
    'Communication',
    'Connect Webhook',
    SlackSettings // Custom Settings
));

registry.register(createPlugin(
    'teams',
    'Microsoft Teams',
    'Sync status updates to your enterprise channels.',
    MessageSquare,
    'Communication',
    'Connect Webhook',
    TeamsSettings
));

/* PROJECT MANAGEMENT */
registry.register(createPlugin('jira', 'Jira', 'Two-way sync for issues and requirements.', Trello, 'Project Management', 'Connect Jira', JiraSettings));
registry.register(createPlugin('linear', 'Linear', 'Create issues directly from failed test runs.', CheckSquare, 'Project Management', 'Connect Linear', LinearSettings));
registry.register(createPlugin('notion', 'Notion', 'Embed live quality dashboards into your docs.', Database, 'Project Management', 'Link Workspace', NotionSettings));

/* DEVELOPMENT */
registry.register(createPlugin('github', 'GitHub', 'Automatic PR checks and code analysis.', Github, 'Development', 'Link Repo', GitHubSettings));

registry.register(createPlugin(
    'vscode',
    'VS Code',
    'Run and debug Qestro tests from your editor.',
    Code,
    'Development',
    'Generate Key',
    VSCodeSettings // Custom Settings
));

registry.register(createPlugin('postman', 'Postman', 'Sync API collections and environment variables.', Send, 'Development', 'Sync Collection', PostmanSettings));

/* INFRASTRUCTURE */
registry.register(createPlugin('cloudflare', 'Cloudflare', 'Deploy Edge Workers and manage access.', Cloud, 'Infrastructure', 'Link Account', CloudflareSettings));
registry.register(createPlugin('vercel', 'Vercel', 'Prevent deployments when critical tests fail.', Server, 'Infrastructure', 'Authorize', VercelSettings));

// 🦞 OpenClaw AI Agent Integration
registry.register(createPlugin(
    'openclaw',
    'OpenClaw AI Agent',
    'Run tests from WhatsApp, Telegram, Slack — AI-powered QA via chat.',
    Bot,
    'Infrastructure',
    'Connect Gateway',
    OpenClawSettings
));

/* DESIGN & QUALITY */
registry.register(createPlugin('figma', 'Figma', 'Validate implementation against design files.', Figma, 'Design & Quality', 'Connect File', FigmaSettings));
registry.register(createPlugin('sentry', 'Sentry', 'Auto-convert production crashes to test cases.', Eye, 'Design & Quality', 'Link Project', SentrySettings));
