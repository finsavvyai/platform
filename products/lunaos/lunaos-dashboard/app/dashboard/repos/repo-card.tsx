'use client';

import type { GitHubRepo } from '@/lib/api';
import { LANGUAGE_COLORS } from './repos-constants';
import { Lock, FolderOpen, Star, RefreshCw, Zap } from 'lucide-react';

interface RepoCardProps {
    repo: GitHubRepo;
    indexingRepo: string | null;
    onIndex: (fullName: string) => void;
}

export function RepoCard({ repo, indexingRepo, onIndex }: RepoCardProps) {
    const isIndexing = indexingRepo === repo.fullName;

    return (
        <div className="neon-card p-5 flex flex-col h-full group hover:border-violet-500/20 transition-all">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    {repo.private ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                    ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-hidden="true" />
                    )}
                    <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-white hover:text-violet-300 truncate transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none rounded"
                    >
                        {repo.name}
                    </a>
                </div>
                {repo.indexed && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap">
                        Indexed
                    </span>
                )}
            </div>

            <p className="text-xs text-neutral-500 line-clamp-2 mb-3 flex-1">
                {repo.description || 'No description'}
            </p>

            <RepoMeta repo={repo} />

            <IndexButton
                isIndexing={isIndexing}
                isIndexed={repo.indexed}
                onClick={() => onIndex(repo.fullName)}
            />
        </div>
    );
}

function RepoMeta({ repo }: { repo: GitHubRepo }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            {repo.language && (
                <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${LANGUAGE_COLORS[repo.language] || 'bg-neutral-500'}`} aria-hidden="true" />
                    <span className="text-xs text-neutral-400">{repo.language}</span>
                </div>
            )}
            {repo.starCount > 0 && (
                <span className="text-xs text-neutral-500 flex items-center gap-1">
                    <Star className="w-3 h-3" aria-hidden="true" /> {repo.starCount}
                </span>
            )}
            <span className="text-xs text-neutral-600">
                {new Date(repo.updatedAt).toLocaleDateString()}
            </span>
        </div>
    );
}

interface IndexButtonProps {
    isIndexing: boolean;
    isIndexed: boolean;
    onClick: () => void;
}

function IndexButton({ isIndexing, isIndexed, onClick }: IndexButtonProps) {
    const baseClasses = 'w-full py-2 rounded-lg text-sm font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

    const stateClasses = isIndexing
        ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
        : isIndexed
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15'
            : 'bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/20';

    return (
        <button
            onClick={onClick}
            disabled={isIndexing}
            className={`${baseClasses} ${stateClasses}`}
        >
            {isIndexing ? (
                <span className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-violet-300/30 border-t-violet-300 rounded-full animate-spin" />
                    Indexing...
                </span>
            ) : isIndexed ? (
                <span className="flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Re-index
                </span>
            ) : (
                <span className="flex items-center justify-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Index for RAG
                </span>
            )}
        </button>
    );
}
