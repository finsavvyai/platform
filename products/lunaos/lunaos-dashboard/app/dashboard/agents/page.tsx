'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentsApi, type Agent, type CustomAgent } from '@/lib/api';
import { Search, Wrench, Play, Star, Lock, Globe } from 'lucide-react';
import { categoryIcons, defaultCategoryIcon } from './agent-constants';
import { AgentSkeletonGrid } from './AgentSkeletons';
import CommunityGallery from './CommunityGallery';
import FilterBar from './FilterBar';

export default function AgentsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'official' | 'community'>('official');
    const [agents, setAgents] = useState<Agent[]>([]);
    const [communityAgents, setCommunityAgents] = useState<CustomAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forkingId, setForkingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'free' | 'pro'>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                if (activeTab === 'official') {
                    if (agents.length === 0) {
                        const data = await agentsApi.list();
                        setAgents(data.agents || []);
                    }
                } else {
                    if (communityAgents.length === 0) {
                        const data = await agentsApi.getGallery();
                        setCommunityAgents(data.agents || []);
                    }
                }
            } catch {
                setError('Failed to load agents. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [activeTab, agents.length, communityAgents.length]);

    const handleFork = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (forkingId) return;
        setForkingId(id);
        try {
            const res = await agentsApi.forkCustom(id);
            if (res.success) {
                router.push(`/dashboard/agents/studio?id=${res.id}`);
            } else {
                setError(res.error || 'Failed to fork agent');
            }
        } catch {
            setError('Failed to fork agent');
        } finally {
            setForkingId(null);
        }
    };

    const filteredAgents = agents
        .filter(a => filter === 'all' || a.tier === filter)
        .filter(a =>
            search === '' ||
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.slug.includes(search.toLowerCase()) ||
            a.category.toLowerCase().includes(search.toLowerCase())
        );

    const filteredCommunity = communityAgents.filter(a =>
        search === '' ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.slug.includes(search.toLowerCase()) ||
        a.description?.toLowerCase().includes(search.toLowerCase())
    );

    const categories = [...new Set(agents.map(a => a.category))].sort();

    if (loading) {
        return <AgentSkeletonGrid />;
    }

    return (
        <div className="max-w-6xl mx-auto">
            <PageHeader agentCount={agents.length} />
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
            <FilterBar
                activeTab={activeTab} setActiveTab={setActiveTab}
                search={search} setSearch={setSearch}
                filter={filter} setFilter={setFilter}
                agents={agents}
            />
            {activeTab === 'official' && categories.map(cat => {
                const catAgents = filteredAgents.filter(a => a.category === cat);
                if (catAgents.length === 0) return null;
                const CatIcon = categoryIcons[cat] || defaultCategoryIcon;
                return (
                    <div key={cat} className="mb-8">
                        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-300 mb-3 px-1">
                            <CatIcon className="w-4 h-4" aria-hidden="true" />
                            <span className="capitalize">{cat}</span>
                            <span className="text-xs text-neutral-600 font-normal">({catAgents.length})</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {catAgents.map(agent => (
                                <Link key={agent.slug} href={`/dashboard/agents/${agent.slug}`}>
                                    <div className="neon-card agent-card h-full">
                                        <div className="agent-card-header">
                                            <span className="agent-category">{agent.category}</span>
                                            <span className={`agent-tier-badge ${agent.tier}`}>
                                                {agent.tier === 'free' ? (
                                                    <><Star className="w-3 h-3 inline" aria-hidden="true" /> Free</>
                                                ) : (
                                                    <><Lock className="w-3 h-3 inline" aria-hidden="true" /> Pro</>
                                                )}
                                            </span>
                                        </div>
                                        <h3>{agent.name}</h3>
                                        <p className="description">Click to run this agent with your project context.</p>
                                        <div className="run-btn">
                                            <Play className="w-3.5 h-3.5 inline" aria-hidden="true" /> Run Agent
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })}
            {activeTab === 'community' && (
                <CommunityGallery agents={filteredCommunity} forkingId={forkingId} onFork={handleFork} />
            )}
            {((activeTab === 'official' && filteredAgents.length === 0) ||
                (activeTab === 'community' && filteredCommunity.length === 0)) && !loading && (
                <div className="text-center py-16">
                    <p className="text-neutral-400 text-lg">No agents match your search</p>
                    <p className="text-neutral-600 text-sm mt-2">Try different keywords or clear filters</p>
                </div>
            )}
        </div>
    );
}

function PageHeader({ agentCount }: { agentCount: number }) {
    return (
        <div className="page-header flex justify-between items-center">
            <div>
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Agent Catalog
                </h1>
                <p>{agentCount} specialized AI agents for every stage of development</p>
            </div>
            <Link
                href="/dashboard/agents/studio"
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors border border-white/10"
            >
                <Wrench className="w-4 h-4" aria-hidden="true" /> Build Custom Agent
            </Link>
        </div>
    );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300 flex justify-between items-center">
            <span>{message}</span>
            <button onClick={onDismiss} className="text-red-400 hover:text-red-200 cursor-pointer ml-4">Dismiss</button>
        </div>
    );
}
