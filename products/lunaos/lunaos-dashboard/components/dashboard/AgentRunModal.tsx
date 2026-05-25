'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { agentsApi, type Agent } from '../../lib/api';

interface AgentRunModalProps {
    agent: Agent;
    onClose: () => void;
}

export default function AgentRunModal({ agent, onClose }: AgentRunModalProps) {
    const [context, setContext] = useState('');
    const [output, setOutput] = useState('');
    const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [elapsed, setElapsed] = useState(0);
    const outputRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval>>();

    useEffect(() => {
        if (status === 'running') {
            const start = Date.now();
            timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [status]);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    const handleRun = async (e: FormEvent) => {
        e.preventDefault();
        if (!context.trim() || status === 'running') return;

        setOutput('');
        setStatus('running');
        setElapsed(0);

        try {
            const response = await agentsApi.execute(agent.slug, context);

            if (!response.ok) {
                const err = await response.text();
                setOutput(`Error: ${err}`);
                setStatus('error');
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                setOutput('Error: No response stream');
                setStatus('error');
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.token) {
                            setOutput(prev => prev + parsed.token);
                        } else if (parsed.error) {
                            setOutput(prev => prev + `\n\nError: ${parsed.error}`);
                            setStatus('error');
                            return;
                        }
                    } catch { /* skip */ }
                }
            }

            setStatus('done');
        } catch (err: any) {
            setOutput(`Connection error: ${err.message}`);
            setStatus('error');
        }
    };

    const statusBadge = {
        idle: { text: 'Ready', cls: 'badge-muted' },
        running: { text: `Running ${(elapsed / 1000).toFixed(1)}s`, cls: 'badge-running' },
        done: { text: `Done (${(elapsed / 1000).toFixed(1)}s)`, cls: 'badge-success' },
        error: { text: 'Error', cls: 'badge-error' },
    }[status];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content agent-run-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>{agent.name}</h2>
                        <p className="modal-subtitle">{agent.category} · {agent.tier}</p>
                    </div>
                    <div className="modal-header-right">
                        <span className={`status-badge ${statusBadge.cls}`}>{statusBadge.text}</span>
                        <button className="modal-close" onClick={onClose}>✕</button>
                    </div>
                </div>

                <form onSubmit={handleRun}>
                    <div className="run-input-group">
                        <label htmlFor="agent-context">Input</label>
                        <textarea
                            id="agent-context"
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            placeholder={`Paste code, text, or describe what you want ${agent.name} to analyze...`}
                            rows={6}
                            disabled={status === 'running'}
                        />
                    </div>

                    <div className="run-actions">
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!context.trim() || status === 'running'}
                        >
                            {status === 'running' ? '⏳ Running...' : '▶ Run Agent'}
                        </button>
                    </div>
                </form>

                {output && (
                    <div className="run-output" ref={outputRef}>
                        <div className="output-header">
                            <span>Output</span>
                            <button
                                className="btn-ghost btn-sm"
                                onClick={() => navigator.clipboard.writeText(output)}
                                title="Copy output"
                            >
                                📋 Copy
                            </button>
                        </div>
                        <pre className="output-content">{output}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
