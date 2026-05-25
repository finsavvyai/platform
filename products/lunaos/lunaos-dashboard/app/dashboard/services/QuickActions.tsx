'use client';

import Link from 'next/link';

export function QuickActions() {
    return (
        <div className="neon-card p-6 mb-8">
            <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Link
                    href="/dashboard/agents"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/5 border border-violet-500/15 hover:border-violet-500/40 hover:bg-violet-500/10 transition-all group"
                >
                    <span className="text-xl">{'\uD83E\uDD16'}</span>
                    <div>
                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white">Run Agent</p>
                        <p className="text-xs text-neutral-500">Execute a code review</p>
                    </div>
                </Link>
                <Link
                    href="/dashboard/services/channels"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/5 border border-sky-500/15 hover:border-sky-500/40 hover:bg-sky-500/10 transition-all group"
                >
                    <span className="text-xl">{'\uD83D\uDCAC'}</span>
                    <div>
                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white">Connect Channel</p>
                        <p className="text-xs text-neutral-500">Slack, Discord, Telegram</p>
                    </div>
                </Link>
                <Link
                    href="/dashboard/repos"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group"
                >
                    <span className="text-xl">{'\uD83D\uDD0D'}</span>
                    <div>
                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white">Index Repo</p>
                        <p className="text-xs text-neutral-500">Enable RAG search</p>
                    </div>
                </Link>
                <Link
                    href="/dashboard/api-keys"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all group"
                >
                    <span className="text-xl">{'\uD83D\uDD11'}</span>
                    <div>
                        <p className="text-sm font-medium text-neutral-200 group-hover:text-white">Create API Key</p>
                        <p className="text-xs text-neutral-500">Programmatic access</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
