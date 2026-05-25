'use client';

import { useEffect, useState, useCallback } from 'react';
import { chainsApi, type PresetChain, type ChainExecution } from '@/lib/api';

export interface StreamEvent {
    event: string;
    data: string;
}

export interface UseChainsDataReturn {
    presets: PresetChain[];
    history: ChainExecution[];
    loading: boolean;
    executing: string | null;
    activeChain: string | null;
    context: string;
    output: string;
    streamEvents: StreamEvent[];
    setActiveChain: (slug: string | null) => void;
    setContext: (value: string) => void;
    setOutput: (value: string) => void;
    setStreamEvents: React.Dispatch<React.SetStateAction<StreamEvent[]>>;
    handleExecute: (slug: string) => Promise<void>;
}

export function useChainsData(): UseChainsDataReturn {
    const [presets, setPresets] = useState<PresetChain[]>([]);
    const [history, setHistory] = useState<ChainExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState<string | null>(null);
    const [activeChain, setActiveChain] = useState<string | null>(null);
    const [context, setContext] = useState('');
    const [output, setOutput] = useState('');
    const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [presetData, historyData] = await Promise.all([
                    chainsApi.listPresets().catch(() => ({ presets: [], total: 0 })),
                    chainsApi.history().catch(() => ({ executions: [], count: 0 })),
                ]);
                setPresets(presetData.presets || []);
                setHistory(historyData.executions || []);
            } catch (err) {
                // Error loading chains data - will display empty state
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleExecute = useCallback(async (slug: string) => {
        if (!context.trim()) return;
        setExecuting(slug);
        setOutput('');
        setStreamEvents([]);

        try {
            const response = await chainsApi.execute(slug, context);

            if (!response.body) {
                setOutput('Error: No response stream received');
                setExecuting(null);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        try {
                            const parsed = JSON.parse(data);
                            setStreamEvents(prev => [
                                ...prev,
                                { event: parsed.event || 'data', data },
                            ]);
                            appendParsedOutput(parsed, setOutput);
                        } catch {
                            // Non-JSON SSE line
                        }
                    }
                }
            }

            const historyData = await chainsApi
                .history()
                .catch(() => ({ executions: [], count: 0 }));
            setHistory(historyData.executions || []);
        } catch {
            setOutput(
                'Failed to execute chain. Check your connection and try again.',
            );
        } finally {
            setExecuting(null);
        }
    }, [context]);

    return {
        presets,
        history,
        loading,
        executing,
        activeChain,
        context,
        output,
        streamEvents,
        setActiveChain,
        setContext,
        setOutput,
        setStreamEvents,
        handleExecute,
    };
}

function appendParsedOutput(
    parsed: Record<string, string>,
    setOutput: React.Dispatch<React.SetStateAction<string>>,
): void {
    if (parsed.event === 'node_complete' && parsed.output) {
        const label = parsed.label || parsed.nodeId;
        setOutput(prev =>
            prev
                ? `${prev}\n\n---\n\n### ${label}\n\n${parsed.output}`
                : `### ${label}\n\n${parsed.output}`,
        );
    } else if (parsed.event === 'chain_complete' && parsed.finalOutput) {
        setOutput(prev => prev || parsed.finalOutput);
    } else if (parsed.event === 'error') {
        setOutput(prev => `${prev}\n\n Error: ${parsed.error}`);
    }
}
