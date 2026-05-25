'use client';

import { useState, useRef } from 'react';
import { agentsApi } from '../../../../lib/api';

interface ExecutionState {
    output: string;
    streaming: boolean;
    done: boolean;
    error: string;
    elapsed: number;
}

interface UseAgentExecutionReturn extends ExecutionState {
    run: (agentId: string, context: string, provider: string) => Promise<void>;
}

export function useAgentExecution(): UseAgentExecutionReturn {
    const [output, setOutput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    async function run(agentId: string, context: string, provider: string) {
        setStreaming(true);
        setDone(false);
        setOutput('');
        setError('');
        setElapsed(0);

        const start = Date.now();
        timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);

        try {
            const response = await agentsApi.execute(agentId, context, { provider });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                setError(err.error || `Execution failed: ${response.status}`);
                return;
            }

            if (!response.body) {
                setError('No response body');
                return;
            }

            const reader = response.body.getReader();
            if (!reader) {
                setError('No response stream');
                return;
            }

            await processStream(reader);
            setDone(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(`Execution failed: ${message}`);
        } finally {
            setStreaming(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }

    async function processStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
        const decoder = new TextDecoder();

        while (true) {
            const { done: streamDone, value } = await reader.read();
            if (streamDone) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        setDone(true);
                        continue;
                    }
                    parseStreamData(data);
                }
            }
        }
    }

    function parseStreamData(data: string) {
        try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || parsed.delta || parsed.content;
            if (content) {
                setOutput((prev) => prev + content);
            }
        } catch {
            if (data.trim()) {
                setOutput((prev) => prev + data + '\n');
            }
        }
    }

    return { output, streaming, done, error, elapsed, run };
}
