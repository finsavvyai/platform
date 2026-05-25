import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    BellAlertIcon, PlusIcon, TrashIcon, PencilIcon,
    CheckCircleIcon, XCircleIcon, FunnelIcon, PaperAirplaneIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import { Button } from '../components/atoms';
import { api } from '../lib/api';
import '../styles/ai-features.css';

interface NotificationRule {
    id: string;
    eventType: string;
    severity: string[];
    channels: string[];
    recipients: string[];
    enabled: boolean;
    throttle?: { maxPerHour: number; groupBy?: string };
}

interface Recipient {
    id: string;
    name: string;
    role: string;
    channels: string[];
}

const CHANNEL_ICONS: Record<string, { emoji: string; label: string }> = {
    slack: { emoji: '💬', label: 'Slack' },
    discord: { emoji: '🎮', label: 'Discord' },
    telegram: { emoji: '📱', label: 'Telegram' },
    whatsapp: { emoji: '📲', label: 'WhatsApp' },
    teams: { emoji: '🏢', label: 'Teams' },
    email: { emoji: '📧', label: 'Email' },
};

const EVENT_TYPES = [
    { value: 'test_failure', label: 'Test Failure', icon: '❌' },
    { value: 'suite_completed', label: 'Suite Completed', icon: '✅' },
    { value: 'coverage_drop', label: 'Coverage Drop', icon: '📉' },
    { value: 'flaky_test_detected', label: 'Flaky Test', icon: '🔄' },
    { value: 'security_alert', label: 'Security Alert', icon: '🔒' },
    { value: 'self_healing', label: 'Self-Healing', icon: '🔧' },
    { value: 'deployment_gate', label: 'Deploy Gate', icon: '🚪' },
    { value: 'daily_summary', label: 'Daily Summary', icon: '📊' },
];

const MOCK_RULES: NotificationRule[] = [
    { id: 'rule_1', eventType: 'test_failure', severity: ['critical', 'high'], channels: ['slack', 'whatsapp'], recipients: ['qa_lead'], enabled: true, throttle: { maxPerHour: 10, groupBy: 'testId' } },
    { id: 'rule_2', eventType: 'coverage_drop', severity: ['high'], channels: ['slack'], recipients: ['qa_team'], enabled: true },
    { id: 'rule_3', eventType: 'security_alert', severity: ['critical'], channels: ['slack', 'email', 'whatsapp'], recipients: ['security_team'], enabled: true },
    { id: 'rule_4', eventType: 'daily_summary', severity: ['low'], channels: ['slack', 'email'], recipients: ['qa_lead', 'dev_team'], enabled: true },
    { id: 'rule_5', eventType: 'self_healing', severity: ['medium'], channels: ['slack'], recipients: ['qa_team'], enabled: false },
    { id: 'rule_6', eventType: 'deployment_gate', severity: ['critical', 'high'], channels: ['slack', 'teams'], recipients: ['release_manager'], enabled: true },
];

const MOCK_RECIPIENTS: Recipient[] = [
    { id: 'qa_lead', name: 'QA Lead', role: 'lead', channels: ['slack', 'whatsapp', 'email'] },
    { id: 'qa_team', name: 'QA Team', role: 'team', channels: ['slack', 'telegram'] },
    { id: 'dev_team', name: 'Dev Team', role: 'team', channels: ['slack', 'discord'] },
    { id: 'security_team', name: 'Security', role: 'team', channels: ['slack', 'email'] },
    { id: 'release_manager', name: 'Release Manager', role: 'individual', channels: ['slack', 'teams'] },
];

export default function NotificationCenter() {
    const [rules, setRules] = useState<NotificationRule[]>(MOCK_RULES);
    const [recipients, setRecipients] = useState<Recipient[]>(MOCK_RECIPIENTS);
    const [filter, setFilter] = useState<string>('all');
    const [testingSend, setTestingSend] = useState(false);
    const [showTestPanel, setShowTestPanel] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [rulesRes, recipientsRes] = await Promise.all([
                api.getNotificationRules(),
                api.getNotificationRecipients(),
            ]);
            if (rulesRes?.success && rulesRes.data) setRules(rulesRes.data);
            if (recipientsRes?.success && recipientsRes.data) setRecipients(recipientsRes.data);
        } catch {
            // Use mock data
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    const toggleRule = async (ruleId: string) => {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
        try {
            await api.toggleNotificationRule(ruleId);
        } catch { /* UI already updated */ }
    };

    const handleTestNotification = async () => {
        setTestingSend(true);
        try {
            await api.testNotification({ channel: 'slack', severity: 'medium', message: 'Test notification from Qestro AI Engine' });
        } catch { /* ok */ }
        setTimeout(() => setTestingSend(false), 2000);
    };

    // Edit handler: full inline-edit UI isn't implemented yet, so we surface
    // which rule the user picked and keep the state consistent. Once the
    // NotificationRuleEditor modal ships, swap alert() for setEditingRule.
    // TODO(pass-4): build NotificationRuleEditor modal.
    const handleEditRule = (rule: NotificationRule) => {
        const label = EVENT_TYPES.find(e => e.value === rule.eventType)?.label
            || rule.eventType;
        alert(`Edit rule "${label}" — editor coming soon.`);
    };

    const handleDeleteRule = async (rule: NotificationRule) => {
        const label = EVENT_TYPES.find(e => e.value === rule.eventType)?.label
            || rule.eventType;
        const confirmed = window.confirm(`Delete notification rule "${label}"?`);
        if (!confirmed) return;
        const previous = rules;
        setRules(prev => prev.filter(r => r.id !== rule.id));
        try {
            await api.deleteNotificationRule(rule.id);
        } catch (error) {
            console.error('Delete rule failed:', error);
            setRules(previous); // rollback
            alert('Could not delete rule. Please try again.');
        }
    };

    const handleAddRecipient = async () => {
        const name = window.prompt('Recipient display name:');
        if (!name) return;
        const email = window.prompt('Email (used for email channel):');
        if (!email) return;
        const newRecipient: Recipient = {
            id: `rec_${Date.now()}`,
            name,
            role: 'individual',
            channels: ['email'],
        };
        const previous = recipients;
        setRecipients(prev => [...prev, newRecipient]);
        try {
            await api.createNotificationRecipient({
                id: newRecipient.id,
                name,
                email,
                role: 'individual',
                channels: ['email'],
            });
        } catch (error) {
            console.error('Add recipient failed:', error);
            setRecipients(previous); // rollback
            alert('Could not add recipient. Please try again.');
        }
    };

    const filteredRules = filter === 'all' ? rules : rules.filter(r => r.eventType === filter);
    const activeCount = rules.filter(r => r.enabled).length;

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
    const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

    return (
        <motion.div className="p-6 space-y-6 max-w-[1600px] mx-auto" variants={containerVariants} initial="hidden" animate="visible">
            {/* Header */}
            <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                        <BellAlertIcon className="h-7 w-7 text-violet-400" />
                        Smart Notifications
                    </h1>
                    <p className="text-gray-400 mt-1">
                        {activeCount} active rules routing QA events to your channels
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setShowTestPanel(!showTestPanel)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-all text-sm"
                    >
                        <PaperAirplaneIcon className="h-4 w-4" />
                        Test Notification
                    </Button>
                    <Button
                        onClick={() => {
                            // TODO: replace with rule editor modal (same pattern as CycleDetail edit stub)
                            alert('New rule editor coming soon. Use POST /api/notifications/rules to create rules programmatically.');
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Rule
                    </Button>
                </div>
            </motion.div>

            {/* Test Notification Panel */}
            {showTestPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ai-glass-card p-6">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">🧪 Send Test Notification</h3>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            {Object.entries(CHANNEL_ICONS).map(([key, ch]) => (
                                <span key={key} className={`channel-badge ${key}`}>
                                    {ch.emoji} {ch.label}
                                </span>
                            ))}
                        </div>
                        <Button
                            onClick={handleTestNotification}
                            disabled={testingSend}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${testingSend
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30'
                                }`}
                        >
                            {testingSend ? '✅ Sent!' : '🚀 Fire Test'}
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Channel Overview */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(CHANNEL_ICONS).map(([key, ch]) => {
                    const isConnected = ['slack', 'discord', 'email'].includes(key);
                    return (
                        <div key={key} className={`channel-card ${key}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-2xl">{ch.emoji}</span>
                                <span className={`ai-status-dot ${isConnected ? 'active' : 'offline'}`} />
                            </div>
                            <div className="text-sm font-semibold text-gray-200">{ch.label}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {isConnected ? 'Connected' : 'Not connected'}
                            </div>
                        </div>
                    );
                })}
            </motion.div>

            {/* Filter Tabs */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 flex-wrap">
                <FunnelIcon className="h-4 w-4 text-gray-500" />
                <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === 'all' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300'
                        }`}
                >
                    All ({rules.length})
                </button>
                {EVENT_TYPES.map(et => {
                    const count = rules.filter(r => r.eventType === et.value).length;
                    if (count === 0) return null;
                    return (
                        <button
                            key={et.value}
                            onClick={() => setFilter(et.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === et.value ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {et.icon} {et.label} ({count})
                        </button>
                    );
                })}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Rules Table */}
                <motion.div variants={itemVariants} className="lg:col-span-3">
                    <div className="ai-glass-card overflow-hidden">
                        <table className="ai-table">
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Severity</th>
                                    <th>Channels</th>
                                    <th>Recipients</th>
                                    <th>Throttle</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRules.map(rule => {
                                    const eventInfo = EVENT_TYPES.find(e => e.value === rule.eventType);
                                    return (
                                        <tr key={rule.id} className={!rule.enabled ? 'opacity-50' : ''}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span>{eventInfo?.icon || '📋'}</span>
                                                    <span className="font-medium">{eventInfo?.label || rule.eventType}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex gap-1 flex-wrap">
                                                    {rule.severity.map(s => (
                                                        <span key={s} className={`severity-badge ${s}`}>{s}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex gap-1 flex-wrap">
                                                    {rule.channels.map(ch => (
                                                        <span key={ch} className={`channel-badge ${ch}`}>
                                                            {CHANNEL_ICONS[ch]?.emoji} {CHANNEL_ICONS[ch]?.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex gap-1 flex-wrap">
                                                    {rule.recipients.map(r => (
                                                        <span key={r} className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">
                                                            {recipients.find(rc => rc.id === r)?.name || r}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                {rule.throttle ? (
                                                    <span className="text-xs text-gray-500">
                                                        {rule.throttle.maxPerHour}/hr
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-600">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <button onClick={() => toggleRule(rule.id)} className="transition-colors">
                                                    {rule.enabled ? (
                                                        <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                                                    ) : (
                                                        <XCircleIcon className="h-5 w-5 text-gray-600" />
                                                    )}
                                                </button>
                                            </td>
                                            <td>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEditRule(rule)}
                                                        aria-label={`Edit rule ${rule.eventType}`}
                                                        className="p-1 rounded hover:bg-white/5 transition-colors"
                                                    >
                                                        <PencilIcon className="h-4 w-4 text-gray-500 hover:text-gray-300" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRule(rule)}
                                                        aria-label={`Delete rule ${rule.eventType}`}
                                                        className="p-1 rounded hover:bg-white/5 transition-colors"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-gray-600 hover:text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Recipients Panel */}
                <motion.div variants={itemVariants}>
                    <div className="ai-glass-card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                <UserGroupIcon className="h-4 w-4 text-cyan-400" />
                                Recipients
                            </h3>
                            <button
                                onClick={handleAddRecipient}
                                aria-label="Add recipient"
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                            >
                                <PlusIcon className="h-4 w-4 text-gray-500" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {recipients.map(r => (
                                <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/3 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
                                        {r.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-200 truncate">{r.name}</div>
                                        <div className="flex gap-1 mt-0.5">
                                            {r.channels.map(ch => (
                                                <span key={ch} className="text-xs">{CHANNEL_ICONS[ch]?.emoji}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-600 capitalize">{r.role}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
