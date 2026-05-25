'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { agentsApi, healthApi, servicesApi, type Agent, type Execution, type ServicesCatalog } from '../../lib/api';
import UsageWidget from '../../components/UsageWidget';
import { DashboardSkeleton } from '../../components/dashboard/SkeletonScreens';
import { Onboarding } from '../../components/dashboard/Onboarding';
import { useAuth } from '../../components/auth/AuthProvider';
import AgentRunModal from '../../components/dashboard/AgentRunModal';

const TIER_LIMITS: Record<string, string> = {
    free: 'Unlimited commands',
    pro: 'Unlimited commands + managed keys',
    team: 'Unlimited commands + team features',
};

export default function DashboardPage() {
    const { user } = useAuth();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [health, setHealth] = useState<{ status: string; latency: string } | null>(null);
    const [servicesCatalog, setServicesCatalog] = useState<ServicesCatalog | null>(null);
    const [loading, setLoading] = useState(true);
    const [runAgent, setRunAgent] = useState<Agent | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [agentData, execData, healthData, catalogData] = await Promise.all([
                    agentsApi.list(),
                    agentsApi.executions().catch(() => ({ executions: [], count: 0 })),
                    healthApi.check().catch(() => null),
                    servicesApi.catalog().catch(() => null),
                ]);
                setAgents(agentData.agents || []);
                setExecutions(execData.executions || []);
                setHealth(healthData);
                setServicesCatalog(catalogData);
            } catch (err) {
                // Error loading dashboard data - will show defaults
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const freeAgents = agents.filter(a => a.tier === 'free');
    const recentExecs = executions.slice(0, 5);

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="max-w-6xl mx-auto">
            <Onboarding />

            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Dashboard
                </h1>
                <p>Your AI agent command center</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="neon-card stat-card">
                    <div className="stat-label">Total Agents</div>
                    <div className="stat-value">{agents.length}</div>
                    <div className="stat-sub">{freeAgents.length} free · {agents.length - freeAgents.length} pro</div>
                </div>

                <div className="neon-card stat-card">
                    <div className="stat-label">Executions</div>
                    <div className="stat-value">{executions.length}</div>
                    <div className="stat-sub">this month</div>
                </div>

                <div className="neon-card stat-card">
                    <div className="stat-label">API Status</div>
                    <div className="stat-value flex items-center gap-3">
                        <span className={`status-dot ${health?.status === 'ok' ? 'online' : 'offline'}`} />
                        <span className="text-lg">{health?.status === 'ok' ? 'Online' : 'Offline'}</span>
                    </div>
                    <div className="stat-sub">{health?.latency || '--'} latency</div>
                </div>

                <div className="neon-card stat-card">
                    <div className="stat-label">Plan</div>
                    <div className="stat-value capitalize">{user?.tier || 'Free'}</div>
                    <div className="stat-sub">{TIER_LIMITS[user?.tier || 'free']}</div>
                </div>
            </div>

            <div className="mb-8"><UsageWidget /></div>
            <div className="mb-8">
                <Link href="/dashboard/services" className="block neon-card p-5 group hover:border-violet-500/30 transition-all">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-2xl">🔮</span>
                            <div>
                                <h2 className="text-base font-semibold text-white group-hover:text-violet-300 transition-colors">
                                    Services Hub
                                </h2>
                                <p className="text-sm text-neutral-400">
                                    {servicesCatalog
                                        ? `${servicesCatalog.services.filter(s => s.status === 'active').length}/${servicesCatalog.total} services active`
                                        : 'Manage all OpenClaw services'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {servicesCatalog && (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${servicesCatalog.services.some(s => s.status === 'error')
                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    }`}>
                                    {servicesCatalog.services.some(s => s.status === 'error') ? 'Issues' : 'Healthy'}
                                </span>
                            )}
                            <span className="text-neutral-400 group-hover:text-violet-400 transition-colors">→</span>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="neon-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Quick Run</h2>
                            <Link href="/dashboard/agents" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                                View all agents →
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {freeAgents.slice(0, 6).map((agent) => (
                                <button
                                    key={agent.slug}
                                    onClick={() => setRunAgent(agent)}
                                    className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all text-left w-full"
                                >
                                    <span className="text-xl">🤖</span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white truncate transition-colors">
                                            {agent.name}
                                        </p>
                                        <p className="text-xs text-neutral-400">{agent.category}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="neon-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Recent Runs</h2>
                            <Link href="/dashboard/history" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                                All →
                            </Link>
                        </div>
                        {recentExecs.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-neutral-400 text-sm">No executions yet</p>
                                <p className="text-neutral-600 text-xs mt-1">Run your first agent to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {recentExecs.map((exec) => (
                                    <div key={exec.id} className="execution-row rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-neutral-200 truncate">{exec.agent}</p>
                                            <p className="text-xs text-neutral-400">
                                                {new Date(exec.created_at).toLocaleDateString()} · {exec.provider}
                                            </p>
                                        </div>
                                        <span className="text-xs text-neutral-400">
                                            {exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(1)}s` : '--'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 neon-card p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-white mb-1">Prefer the terminal?</h3>
                        <p className="text-sm text-neutral-400">
                            Run agents from your CLI with a single command. Luna watches your cursor while you code 🐱
                        </p>
                    </div>
                    <code className="px-4 py-2.5 bg-black/40 rounded-xl border border-white/[0.06] text-sm text-violet-400 font-mono whitespace-nowrap">
                        npx luna-agents run code-review
                    </code>
                </div>
            </div>

            {runAgent && (
                <AgentRunModal
                    agent={runAgent}
                    onClose={() => setRunAgent(null)}
                />
            )}
        </div>
    );
}
