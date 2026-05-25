'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock data - in production, fetch from API
const mockUsageData = {
    totalCalls: 15420,
    monthlyLimit: 100000,
    fraudAlertsTriggered: 23,
    avgResponseTime: 45,
    lastUpdated: new Date().toISOString(),
};

const mockApiKeys = [
    { id: '1', name: 'Production Key', prefix: 'fs_live_...x8f2', status: 'active', lastUsed: '2 hours ago' },
    { id: '2', name: 'Development Key', prefix: 'fs_test_...k9a1', status: 'active', lastUsed: '5 minutes ago' },
];

const mockRecentAlerts = [
    { id: '1', type: 'Fraud Ring Detected', severity: 'high', time: '10 minutes ago', transactionId: 'txn_8x92k' },
    { id: '2', type: 'Suspicious Pattern', severity: 'medium', time: '1 hour ago', transactionId: 'txn_k2m4x' },
    { id: '3', type: 'Rate Limit Warning', severity: 'low', time: '3 hours ago', transactionId: 'txn_p9q2r' },
];

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'apikeys' | 'billing' | 'alerts'>('overview');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 p-0.5">
                                <div className="flex h-full w-full items-center justify-center rounded-xl bg-black text-lg font-bold">
                                    ⚡
                                </div>
                            </div>
                            <span className="text-xl font-bold text-white">FinSavvy Shield</span>
                        </Link>

                        <nav className="flex items-center gap-6">
                            <Link href="/api-docs" className="text-sm text-gray-400 hover:text-white transition-colors">
                                API Docs
                            </Link>
                            <button className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors">
                                Sign Out
                            </button>
                        </nav>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-7xl px-6 py-8">
                {/* Welcome Banner */}
                <div className="mb-8 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 p-6 backdrop-blur-sm border border-white/10">
                    <h1 className="text-2xl font-bold text-white">Welcome back! 👋</h1>
                    <p className="mt-1 text-gray-300">Your fraud detection dashboard is running smoothly.</p>
                </div>

                {/* Tab Navigation */}
                <div className="mb-8 flex gap-2 rounded-xl bg-white/5 p-1">
                    {(['overview', 'apikeys', 'billing', 'alerts'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${activeTab === tab
                                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab === 'overview' && '📊 Overview'}
                            {tab === 'apikeys' && '🔑 API Keys'}
                            {tab === 'billing' && '💳 Billing'}
                            {tab === 'alerts' && '🚨 Alerts'}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid gap-4 md:grid-cols-4">
                            <StatCard
                                title="API Calls"
                                value={mockUsageData.totalCalls.toLocaleString()}
                                subtitle={`of ${mockUsageData.monthlyLimit.toLocaleString()} monthly`}
                                progress={(mockUsageData.totalCalls / mockUsageData.monthlyLimit) * 100}
                                icon="📡"
                            />
                            <StatCard
                                title="Fraud Alerts"
                                value={mockUsageData.fraudAlertsTriggered.toString()}
                                subtitle="this month"
                                icon="🛡️"
                                highlight
                            />
                            <StatCard
                                title="Avg Response"
                                value={`${mockUsageData.avgResponseTime}ms`}
                                subtitle="across all endpoints"
                                icon="⚡"
                            />
                            <StatCard
                                title="Active Keys"
                                value={mockApiKeys.length.toString()}
                                subtitle="API keys in use"
                                icon="🔑"
                            />
                        </div>

                        {/* Recent Activity */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-white mb-4">Recent Fraud Alerts</h3>
                            <div className="space-y-3">
                                {mockRecentAlerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="flex items-center justify-between rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`h-3 w-3 rounded-full ${alert.severity === 'high' ? 'bg-red-500' :
                                                    alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                                }`} />
                                            <div>
                                                <p className="font-medium text-white">{alert.type}</p>
                                                <p className="text-sm text-gray-400">{alert.transactionId}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-400">{alert.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* API Keys Tab */}
                {activeTab === 'apikeys' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Your API Keys</h2>
                            <button className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-sm font-medium text-white hover:shadow-lg transition-shadow">
                                + Create New Key
                            </button>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Name</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Key</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Last Used</th>
                                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {mockApiKeys.map((key) => (
                                        <tr key={key.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-white font-medium">{key.name}</td>
                                            <td className="px-6 py-4 font-mono text-gray-400">{key.prefix}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
                                                    Active
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">{key.lastUsed}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-gray-400 hover:text-white transition-colors text-sm">
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Billing Tab */}
                {activeTab === 'billing' && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-white">Billing & Subscription</h2>

                        {/* Current Plan */}
                        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm text-gray-400">Current Plan</span>
                                    <h3 className="text-2xl font-bold text-white mt-1">Growth</h3>
                                    <p className="text-gray-400 mt-1">$399/month • 100K transactions</p>
                                </div>
                                <button className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors">
                                    Upgrade to Enterprise
                                </button>
                            </div>
                        </div>

                        {/* Usage this Month */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Usage This Month</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-400">API Calls</span>
                                        <span className="text-white">{mockUsageData.totalCalls.toLocaleString()} / 100,000</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                                            style={{ width: `${(mockUsageData.totalCalls / 100000) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Invoices */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Recent Invoices</h3>
                            <div className="space-y-3">
                                {[
                                    { date: 'Dec 2025', amount: '$399.00', status: 'Paid' },
                                    { date: 'Nov 2025', amount: '$399.00', status: 'Paid' },
                                    { date: 'Oct 2025', amount: '$399.00', status: 'Paid' },
                                ].map((invoice, i) => (
                                    <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                                        <span className="text-white">{invoice.date}</span>
                                        <span className="text-gray-400">{invoice.amount}</span>
                                        <span className="text-green-400 text-sm">{invoice.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Alerts Tab */}
                {activeTab === 'alerts' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">Fraud Alerts</h2>
                            <div className="flex gap-2">
                                <select className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white border border-white/10">
                                    <option>All Severities</option>
                                    <option>High</option>
                                    <option>Medium</option>
                                    <option>Low</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {mockRecentAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-1 h-4 w-4 rounded-full ${alert.severity === 'high' ? 'bg-red-500 animate-pulse' :
                                                    alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                                }`} />
                                            <div>
                                                <h3 className="font-semibold text-white">{alert.type}</h3>
                                                <p className="text-sm text-gray-400 mt-1">Transaction ID: {alert.transactionId}</p>
                                                <p className="text-sm text-gray-500 mt-2">{alert.time}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors">
                                                View Details
                                            </button>
                                            <button className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/30 transition-colors">
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({
    title,
    value,
    subtitle,
    icon,
    progress,
    highlight
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: string;
    progress?: number;
    highlight?: boolean;
}) {
    return (
        <div className={`rounded-2xl border p-6 backdrop-blur-sm transition-all hover:scale-[1.02] ${highlight
                ? 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/10'
                : 'border-white/10 bg-white/5'
            }`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                {highlight && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <h3 className="text-3xl font-bold text-white">{value}</h3>
            <p className="text-sm text-gray-400 mt-1">{title}</p>
            {progress !== undefined && (
                <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
                </div>
            )}
            {progress === undefined && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
    );
}
