'use client';

import { useState, useEffect } from 'react';
import { agentsApi, type CustomAgent } from '../../../../lib/api';
import { AgentForm } from './agent-form';
import { AgentLibrary } from './agent-library';

export default function CustomAgentStudio() {
    const [agents, setAgents] = useState<CustomAgent[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAgents = async () => {
        try {
            const data = await agentsApi.listCustom();
            setAgents(data.agents || []);
        } catch (err) {
            // Error loading custom agents - will display empty state
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAgents();
    }, []);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Custom Agent Studio</h1>
                    <p className="text-neutral-400">Build, test, and deploy specialized agents tailored to your workflow.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AgentForm onSaved={loadAgents} />
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white mb-4">Your Library</h2>
                    <AgentLibrary agents={agents} loading={loading} onDeleted={loadAgents} />
                </div>
            </div>
        </div>
    );
}
