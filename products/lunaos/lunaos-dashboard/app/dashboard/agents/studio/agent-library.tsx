'use client';

import { useRouter } from 'next/navigation';
import { agentsApi, type CustomAgent } from '../../../../lib/api';

interface AgentLibraryProps {
    agents: CustomAgent[];
    loading: boolean;
    onDeleted: () => void;
}

export function AgentLibrary({ agents, loading, onDeleted }: AgentLibraryProps) {
    const router = useRouter();

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this agent?')) return;
        try {
            await agentsApi.deleteCustom(id);
            onDeleted();
        } catch {
            alert('Delete failed');
        }
    };

    if (loading) {
        return <div className="text-neutral-400">Loading library...</div>;
    }

    if (agents.length === 0) {
        return (
            <div className="border border-white/10 border-dashed rounded-xl p-8 text-center bg-black/20">
                <span className="text-3xl block mb-2">🎭</span>
                <p className="text-neutral-300 font-medium">No custom agents found.</p>
                <p className="text-neutral-500 text-sm mt-1">Create your first persona on the left.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {agents.map(agent => (
                <div key={agent.id} className="border border-white/10 rounded-xl bg-black/40 p-5 group hover:bg-black/60 transition-colors relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-white font-medium text-lg">{agent.name}</h3>
                                <span className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-400 font-mono">
                                    @{agent.slug}
                                </span>
                            </div>
                            <p className="text-sm text-neutral-400 mt-1 line-clamp-1">{agent.description}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-neutral-500 font-mono">
                        <div>
                            ⚙️ {agent.model || 'Auto'} • {agent.temperature} temp • {agent.promptVariants?.length || 1} prompts
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => router.push(`/dashboard/agents?agent=${agent.slug}`)}
                                className="hover:text-violet-400 transition-colors px-2 py-1">
                                Run Test
                            </button>
                            <button
                                onClick={() => handleDelete(agent.id)}
                                className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300 px-2 py-1">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
