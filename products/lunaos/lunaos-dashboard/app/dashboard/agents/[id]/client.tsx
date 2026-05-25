'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useAgentExecution } from './useAgentExecution';
import AgentOutputPanel from './AgentOutputPanel';

export default function AgentExecutionClient({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [context, setContext] = useState('');
    const [provider, setProvider] = useState('deepseek');
    const { output, streaming, done, error, elapsed, run } = useAgentExecution();

    const agentName = id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    async function handleRun() {
        if (!context.trim()) return;
        await run(id, context, provider);
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Link href="/dashboard/agents" className="hover:text-violet-400 transition-colors">
                    ← Agents
                </Link>
                <span>/</span>
                <span className="text-neutral-200">{agentName}</span>
            </div>

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-100">{agentName}</h1>
                <p className="text-neutral-400 mt-1">
                    Enter your code context and run the agent to get AI-powered insights
                </p>
            </div>

            {/* Provider Selection */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-neutral-400">Provider:</span>
                {['deepseek', 'anthropic', 'openai'].map((p) => (
                    <button
                        key={p}
                        onClick={() => setProvider(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${provider === p
                            ? 'bg-violet-600 text-white'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                            }`}
                    >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>

            {/* Context Input */}
            <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Context / Code to Analyze
                </label>
                <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder={`Paste your code, repo structure, or description for ${agentName}...`}
                    className="w-full h-48 px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-y font-mono text-sm"
                    disabled={streaming}
                />
            </div>

            {/* Run Button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleRun}
                    disabled={streaming || !context.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {streaming ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Running...
                        </>
                    ) : (
                        <>▶ Run Agent</>
                    )}
                </button>
                {streaming && (
                    <span className="text-sm text-neutral-400">{elapsed}s elapsed</span>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">
                    {error}
                </div>
            )}

            <AgentOutputPanel output={output} done={done} />
        </div>
    );
}
