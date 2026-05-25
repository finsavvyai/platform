'use client';

import { Search, Globe } from 'lucide-react';
import type { Agent } from '@/lib/api';

interface FilterBarProps {
    activeTab: 'official' | 'community';
    setActiveTab: (tab: 'official' | 'community') => void;
    search: string;
    setSearch: (s: string) => void;
    filter: 'all' | 'free' | 'pro';
    setFilter: (f: 'all' | 'free' | 'pro') => void;
    agents: Agent[];
}

const tabBtnBase = 'px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const filterBtnBase = 'px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

export default function FilterBar({
    activeTab, setActiveTab, search, setSearch, filter, setFilter, agents,
}: FilterBarProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
            <div className="flex bg-neutral-900/50 p-1 rounded-xl border border-neutral-800 shrink-0">
                <button
                    onClick={() => setActiveTab('official')}
                    className={`${tabBtnBase} ${activeTab === 'official' ? 'bg-violet-500 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                    Official Agents
                </button>
                <button
                    onClick={() => setActiveTab('community')}
                    className={`${tabBtnBase} ${activeTab === 'community' ? 'bg-violet-500 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                    <Globe className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    Community Gallery
                </button>
            </div>

            <div className="flex-1 relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" aria-hidden="true" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search agents..."
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all text-sm"
                />
            </div>

            {activeTab === 'official' && (
                <div className="flex gap-2">
                    {(['all', 'free', 'pro'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`${filterBtnBase} ${filter === f
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                : 'bg-neutral-900/50 text-neutral-400 border border-neutral-800 hover:bg-neutral-800/50 hover:text-neutral-300'
                                }`}
                        >
                            {f === 'all'
                                ? `All (${agents.length})`
                                : f === 'free'
                                    ? `Free (${agents.filter(a => a.tier === 'free').length})`
                                    : `Pro (${agents.filter(a => a.tier === 'pro').length})`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
