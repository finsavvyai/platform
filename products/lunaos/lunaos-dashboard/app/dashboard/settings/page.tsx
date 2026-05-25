'use client';

import { useEffect, useState } from 'react';
import { authApi, healthApi, type User } from '../../../lib/api';

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [health, setHealth] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [me, healthData] = await Promise.all([
                    authApi.me(),
                    healthApi.check().catch(() => null),
                ]);
                setUser(me);
                setHealth(healthData);
            } catch (err) {
                // Error loading settings data - will display empty state
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Settings
                </h1>
                <p>Manage your account and preferences</p>
            </div>

            {/* Account Info */}
            <div className="neon-card p-6 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <span>👤</span> Account
                </h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                        <div>
                            <p className="text-sm text-neutral-400">Name</p>
                            <p className="text-sm font-medium text-neutral-200">{user?.name || '--'}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                        <div>
                            <p className="text-sm text-neutral-400">Email</p>
                            <p className="text-sm font-medium text-neutral-200">{user?.email || '--'}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-white/[0.04]">
                        <div>
                            <p className="text-sm text-neutral-400">Plan</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`agent-tier-badge ${user?.tier || 'free'}`}>
                                    {user?.tier || 'free'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div>
                            <p className="text-sm text-neutral-400">User ID</p>
                            <code className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5 rounded font-mono">
                                {user?.id || '--'}
                            </code>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Status */}
            <div className="neon-card p-6 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <span>🔗</span> API Status
                </h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Endpoint</span>
                        <code className="text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
                            api.lunaos.ai
                        </code>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">Status</span>
                        <div className="flex items-center gap-2">
                            <span className={`status-dot ${health ? 'online' : 'offline'}`} />
                            <span className="text-sm text-neutral-200">
                                {health ? 'Connected' : 'Unreachable'}
                            </span>
                        </div>
                    </div>
                    {health && (
                        <>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-400">Version</span>
                                <span className="text-sm text-neutral-200">{String(health.version || '--')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-400">Latency</span>
                                <span className="text-sm text-neutral-200">{String(health.latency || '--')}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* CLI Setup */}
            <div className="neon-card p-6 mb-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <span>💻</span> CLI Setup
                </h2>
                <div className="space-y-3">
                    <p className="text-sm text-neutral-400">
                        Install the LunaOS CLI to run agents from your terminal:
                    </p>
                    <code className="block px-4 py-3 bg-black/40 rounded-xl border border-white/[0.06] text-sm text-violet-400 font-mono">
                        npm install -g luna-agents
                    </code>
                    <p className="text-sm text-neutral-400 mt-3">
                        Connect your CLI to this account:
                    </p>
                    <code className="block px-4 py-3 bg-black/40 rounded-xl border border-white/[0.06] text-sm text-violet-400 font-mono">
                        luna init --cloud
                    </code>
                </div>
            </div>

            {/* About Luna & Nippy */}
            <div className="neon-card p-6">
                <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                    <span>🐱</span> About Luna &amp; Nippy
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                    LunaOS is named after Luna — a one-eyed cat adopted at 2 months old. She received medical treatment
                    and now lives with her developer, always sitting close during coding sessions.
                    Luna loves to trace the mouse cursor across the screen, which made her the perfect namesake
                    for an AI that <em className="text-neutral-300">watches your code</em> and helps you build better software.
                </p>
                <p className="text-sm text-neutral-400 leading-relaxed mt-3">
                    Luna&apos;s best friend is Nippy — a grey cat rescued from an open-air mall, named after the cat
                    from <em className="text-neutral-300">Better Call Saul</em>. While Luna watches the cursor,
                    Nippy keeps an eye on the keyboard. Together they supervise every coding session 🐾
                </p>
            </div>
        </div>
    );
}
