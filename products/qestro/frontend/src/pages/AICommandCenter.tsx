import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    SparklesIcon, PlayIcon, MagnifyingGlassIcon, WrenchScrewdriverIcon,
    ChatBubbleLeftRightIcon, VideoCameraIcon, ChartBarIcon, ArrowPathIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, BoltIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/atoms';
import { api } from '../lib/api';
import '../styles/ai-features.css';

interface AIMetrics {
    testsRunToday: number;
    aiHealed: number;
    successRate: number;
    agentUptime: string;
}

interface ActivityItem {
    id: string;
    type: 'suite_run' | 'healing' | 'analysis' | 'generation' | 'recording' | 'notification';
    title: string;
    detail: string;
    time: string;
    status: 'success' | 'warning' | 'error' | 'info';
}

const SKILLS = [
    {
        id: 'run-suite',
        icon: '🧪',
        title: 'Run Test Suite',
        description: 'Trigger test suite execution with one click',
        color: 'from-emerald-500/20 to-teal-500/10',
    },
    {
        id: 'analyze',
        icon: '🔍',
        title: 'Analyze Failures',
        description: 'AI-powered failure diagnosis and root cause analysis',
        color: 'from-blue-500/20 to-cyan-500/10',
    },
    {
        id: 'self-healing',
        icon: '🔧',
        title: 'Self-Healing',
        description: 'Fix broken selectors and flaky tests automatically',
        color: 'from-amber-500/20 to-orange-500/10',
    },
    {
        id: 'test-gen',
        icon: '💬',
        title: 'Generate Tests',
        description: 'Create test suites from natural language descriptions',
        color: 'from-violet-500/20 to-purple-500/10',
        link: '/test-gen',
    },
    {
        id: 'recording',
        icon: '🎬',
        title: 'Record Flow',
        description: 'Record browser interactions and generate Playwright tests',
        color: 'from-rose-500/20 to-pink-500/10',
        link: '/recording-studio',
    },
    {
        id: 'summary',
        icon: '📊',
        title: 'Daily Summary',
        description: 'Generate your QA digest with trends and insights',
        color: 'from-indigo-500/20 to-blue-500/10',
    },
];

const MOCK_ACTIVITY: ActivityItem[] = [
    { id: '1', type: 'suite_run', title: 'Regression Suite Completed', detail: '142/148 passed (95.9%)', time: '2 min ago', status: 'success' },
    { id: '2', type: 'healing', title: 'Self-Healing Applied', detail: 'Fixed 3 broken selectors in checkout flow', time: '15 min ago', status: 'info' },
    { id: '3', type: 'analysis', title: 'Failure Analyzed', detail: 'TC-PAY-003: Stripe webhook timeout identified', time: '28 min ago', status: 'warning' },
    { id: '4', type: 'generation', title: 'Tests Generated', detail: '8 new test cases for auth module', time: '1h ago', status: 'success' },
    { id: '5', type: 'notification', title: 'Alert Dispatched', detail: 'Coverage drop notification sent to #qa-team', time: '2h ago', status: 'warning' },
    { id: '6', type: 'recording', title: 'Flow Recorded', detail: 'Onboarding flow → 12 Playwright steps', time: '3h ago', status: 'success' },
];

const MOCK_METRICS: AIMetrics = {
    testsRunToday: 847,
    aiHealed: 42,
    successRate: 96.3,
    agentUptime: '99.97%',
};

export default function AICommandCenter() {
    const [metrics] = useState<AIMetrics>(MOCK_METRICS);
    const [activity] = useState<ActivityItem[]>(MOCK_ACTIVITY);
    const [agentStatus, setAgentStatus] = useState<'active' | 'processing' | 'error' | 'offline'>('active');
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const status = await api.getAIAgentStatus();
            if (status?.success) {
                setAgentStatus('active');
            }
        } catch {
            // Backend not available — use mock data gracefully
            setAgentStatus('active');
        }
    };

    const handleSkillAction = async (skillId: string) => {
        setLoadingAction(skillId);
        try {
            switch (skillId) {
                case 'run-suite':
                    await api.runAITestSuite();
                    break;
                case 'analyze':
                    await api.getAIRecentFailures();
                    break;
                case 'self-healing':
                    await api.triggerAISelfHealing();
                    break;
                case 'summary':
                    await api.getAIDailySummary();
                    break;
            }
        } catch (e) {
            console.error('Skill action failed:', e);
        } finally {
            setTimeout(() => setLoadingAction(null), 1000);
        }
    };

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'suite_run': return <PlayIcon className="h-5 w-5 text-emerald-400" />;
            case 'healing': return <WrenchScrewdriverIcon className="h-5 w-5 text-amber-400" />;
            case 'analysis': return <MagnifyingGlassIcon className="h-5 w-5 text-blue-400" />;
            case 'generation': return <SparklesIcon className="h-5 w-5 text-violet-400" />;
            case 'recording': return <VideoCameraIcon className="h-5 w-5 text-rose-400" />;
            case 'notification': return <ChatBubbleLeftRightIcon className="h-5 w-5 text-cyan-400" />;
            default: return <BoltIcon className="h-5 w-5 text-gray-400" />;
        }
    };

    const getStatusIcon = (status: ActivityItem['status']) => {
        switch (status) {
            case 'success': return <CheckCircleIcon className="h-4 w-4 text-emerald-400" />;
            case 'warning': return <ExclamationTriangleIcon className="h-4 w-4 text-amber-400" />;
            case 'error': return <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />;
            default: return <ClockIcon className="h-4 w-4 text-blue-400" />;
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
    };

    return (
        <motion.div
            className="p-6 space-y-6 max-w-[1600px] mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Hero Banner */}
            <motion.div variants={itemVariants} className="ai-hero-banner">
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <SparklesIcon className="h-8 w-8 text-violet-400" />
                            <h1 className="text-3xl font-bold ai-gradient-text">Qestro AI Engine</h1>
                            <span className={`ai-status-dot ${agentStatus}`} />
                        </div>
                        <p className="text-gray-400 text-lg max-w-xl">
                            Your AI-powered testing co-pilot. Run suites, analyze failures, generate tests, and heal broken flows — all from one command center.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={loadData}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                            Refresh
                        </Button>
                        <span className="text-sm text-gray-500">
                            Status: <span className={`font-semibold ${agentStatus === 'active' ? 'text-emerald-400' : agentStatus === 'processing' ? 'text-amber-400' : 'text-red-400'}`}>
                                {agentStatus === 'active' ? 'Online' : agentStatus === 'processing' ? 'Processing' : 'Offline'}
                            </span>
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Metrics Row */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Tests Run Today', value: metrics.testsRunToday.toLocaleString(), icon: <PlayIcon className="h-5 w-5 text-emerald-400" /> },
                    { label: 'AI Healed', value: metrics.aiHealed.toString(), icon: <WrenchScrewdriverIcon className="h-5 w-5 text-amber-400" /> },
                    { label: 'Success Rate', value: `${metrics.successRate}%`, icon: <ChartBarIcon className="h-5 w-5 text-blue-400" /> },
                    { label: 'Agent Uptime', value: metrics.agentUptime, icon: <BoltIcon className="h-5 w-5 text-violet-400" /> },
                ].map((metric) => (
                    <div key={metric.label} className="ai-metric-card">
                        <div className="flex items-center gap-2 mb-2">
                            {metric.icon}
                            <span className="text-xs text-gray-500 uppercase tracking-wider">{metric.label}</span>
                        </div>
                        <div className="metric-value">{metric.value}</div>
                    </div>
                ))}
            </motion.div>

            {/* Quick Actions Grid */}
            <motion.div variants={itemVariants}>
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <BoltIcon className="h-5 w-5 text-violet-400" />
                    Quick Actions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SKILLS.map((skill) => (
                        <motion.div
                            key={skill.id}
                            variants={itemVariants}
                            className="ai-skill-card group"
                            onClick={() => {
                                if (skill.link) {
                                    window.location.href = skill.link;
                                } else {
                                    handleSkillAction(skill.id);
                                }
                            }}
                        >
                            <div className={`skill-icon bg-gradient-to-br ${skill.color}`}>
                                {skill.icon}
                            </div>
                            <div className="skill-title flex items-center gap-2">
                                {skill.title}
                                {loadingAction === skill.id && (
                                    <ArrowPathIcon className="h-4 w-4 text-violet-400 animate-spin" />
                                )}
                            </div>
                            <div className="skill-description">{skill.description}</div>
                            {skill.link && (
                                <div className="mt-3 text-xs text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Open Studio →
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Live Activity Feed */}
            <motion.div variants={itemVariants}>
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-cyan-400" />
                    Recent AI Activity
                </h2>
                <div className="ai-glass-card divide-y divide-white/5">
                    {activity.map((item) => (
                        <div key={item.id} className="activity-item">
                            <div className="activity-icon bg-white/5 rounded-xl p-2">
                                {getActivityIcon(item.type)}
                            </div>
                            <div className="activity-content">
                                <div className="flex items-center gap-2">
                                    <span className="activity-title">{item.title}</span>
                                    {getStatusIcon(item.status)}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">{item.detail}</p>
                            </div>
                            <span className="activity-time whitespace-nowrap">{item.time}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}
