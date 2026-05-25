'use client';

import type { GitHubStatus, IndexedRepo } from '@/lib/api';
import type { IndexResult } from './use-repos-data';
import { GitHubIcon } from './github-icon';

interface ConnectedHeaderProps {
    ghStatus: GitHubStatus;
    disconnecting: boolean;
    onDisconnect: () => void;
}

export function ConnectedHeader({ ghStatus, disconnecting, onDisconnect }: ConnectedHeaderProps) {
    return (
        <div className="neon-card p-4 mb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center">
                        <GitHubIcon size={20} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="status-dot online" />
                            <span className="text-sm font-semibold text-white">@{ghStatus.username}</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Connected {ghStatus.connectedAt ? new Date(ghStatus.connectedAt).toLocaleDateString() : ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onDisconnect}
                    disabled={disconnecting}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
            </div>
        </div>
    );
}

interface IndexResultBannerProps {
    indexResult: IndexResult;
    onDismiss: () => void;
}

export function IndexResultBanner({ indexResult, onDismiss }: IndexResultBannerProps) {
    return (
        <div className="neon-card p-4 mb-6 border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-3">
                <span className="text-2xl">{'\u2705'}</span>
                <div>
                    <p className="text-sm font-semibold text-emerald-300">
                        Indexed {indexResult.files} files from {indexResult.repo}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                        Processing time: {(indexResult.time / 1000).toFixed(1)}s — Your agents now have codebase context
                    </p>
                </div>
                <button onClick={onDismiss} className="ml-auto text-neutral-500 hover:text-neutral-300">
                    {'\u2715'}
                </button>
            </div>
        </div>
    );
}

interface IndexedReposListProps {
    indexedRepos: IndexedRepo[];
}

export function IndexedReposList({ indexedRepos }: IndexedReposListProps) {
    if (indexedRepos.length === 0) return null;

    return (
        <div className="neon-card p-6 mb-6">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <span>{'\uD83D\uDD0D'}</span> Indexed Repositories
                <span className="text-xs text-neutral-500 font-normal">({indexedRepos.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {indexedRepos.map(repo => (
                    <div
                        key={repo.fullName}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
                    >
                        <span className="text-emerald-400 text-sm">{'\u2726'}</span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-neutral-200 truncate">{repo.fullName}</p>
                            <p className="text-xs text-neutral-500">
                                {repo.fileCount} files · indexed {new Date(repo.indexedAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
