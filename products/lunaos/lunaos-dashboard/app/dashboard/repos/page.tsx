'use client';

import type { GitHubRepo } from '@/lib/api';
import { useReposData } from './use-repos-data';
import { ToastNotification } from './toast-notification';
import { ConnectGitHub } from './connect-github';
import { ConnectedHeader, IndexResultBanner, IndexedReposList } from './connected-header';
import { RepoCard } from './repo-card';

export default function ReposPage() {
    const {
        ghStatus,
        filteredRepos,
        indexedRepos,
        loading,
        connecting,
        indexingRepo,
        indexResult,
        disconnecting,
        search,
        toast,
        setSearch,
        setToast,
        setIndexResult,
        handleConnect,
        handleDisconnect,
        handleIndex,
    } = useReposData();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-neutral-400 text-sm">Loading repositories...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}

            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Repositories
                </h1>
                <p>Connect GitHub repos for AI-powered codebase understanding</p>
            </div>

            {!ghStatus?.connected ? (
                <ConnectGitHub connecting={connecting} onConnect={handleConnect} />
            ) : (
                <>
                    <ConnectedHeader
                        ghStatus={ghStatus}
                        disconnecting={disconnecting}
                        onDisconnect={handleDisconnect}
                    />
                    {indexResult && (
                        <IndexResultBanner
                            indexResult={indexResult}
                            onDismiss={() => setIndexResult(null)}
                        />
                    )}
                    <IndexedReposList indexedRepos={indexedRepos} />
                    <SearchBar search={search} onSearchChange={setSearch} />
                    <RepoGrid
                        repos={filteredRepos}
                        indexingRepo={indexingRepo}
                        onIndex={handleIndex}
                    />
                    <EmptyState visible={filteredRepos.length === 0} hasSearch={search !== ''} />
                </>
            )}

            <RagInfoBanner />
        </div>
    );
}

function SearchBar({ search, onSearchChange }: { search: string; onSearchChange: (v: string) => void }) {
    return (
        <div className="mb-6">
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">
                    {'\uD83D\uDD0E'}
                </span>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all text-sm"
                />
            </div>
        </div>
    );
}

function RepoGrid({
    repos,
    indexingRepo,
    onIndex,
}: {
    repos: GitHubRepo[];
    indexingRepo: string | null;
    onIndex: (fullName: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map(repo => (
                <RepoCard key={repo.id} repo={repo} indexingRepo={indexingRepo} onIndex={onIndex} />
            ))}
        </div>
    );
}

function EmptyState({ visible, hasSearch }: { visible: boolean; hasSearch: boolean }) {
    if (!visible) return null;

    return (
        <div className="text-center py-16">
            <p className="text-neutral-400 text-lg">No repos found</p>
            <p className="text-neutral-600 text-sm mt-2">
                {hasSearch ? 'Try different search terms' : 'No repositories found in your GitHub account'}
            </p>
        </div>
    );
}

function RagInfoBanner() {
    return (
        <div className="mt-8 neon-card p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-white mb-1">How RAG indexing works</h3>
                    <p className="text-sm text-neutral-400">
                        LunaOS scans your repo, chunks source files, generates embeddings via Cloudflare AI,
                        and stores vectors in Vectorize. When you run an agent, relevant code is automatically
                        injected into the prompt for context-aware results.
                    </p>
                </div>
                <code className="px-4 py-2.5 bg-black/40 rounded-xl border border-white/[0.06] text-sm text-violet-400 font-mono whitespace-nowrap">
                    luna index --cloud
                </code>
            </div>
        </div>
    );
}
