'use client';

import { type CustomAgent } from '@/lib/api';
import { GitFork } from 'lucide-react';

interface CommunityGalleryProps {
    agents: CustomAgent[];
    forkingId: string | null;
    onFork: (id: string, e: React.MouseEvent) => void;
}

export default function CommunityGallery({ agents, forkingId, onFork }: CommunityGalleryProps) {
    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.map(agent => (
                    <div key={agent.id} className="neon-card agent-card h-full flex flex-col">
                        <div className="agent-card-header">
                            <span className="agent-category text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                Community
                            </span>
                            <span className="text-xs text-neutral-500" title={agent.created_at}>
                                {new Date(agent.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mt-1 mb-1 truncate" title={agent.name}>
                            {agent.name}
                        </h3>
                        <p className="text-xs text-neutral-400 mb-2 truncate">
                            by @{agent.author_name || 'Anonymous'}
                        </p>
                        <p className="text-sm text-neutral-400 mb-4 line-clamp-2 min-h-[40px]">
                            {agent.description || 'No description provided.'}
                        </p>
                        <div className="mt-auto">
                            <button
                                onClick={(e) => onFork(agent.id, e)}
                                disabled={forkingId === agent.id}
                                className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {forkingId === agent.id ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <GitFork className="w-4 h-4" aria-hidden="true" />
                                        Fork to Workspace
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
