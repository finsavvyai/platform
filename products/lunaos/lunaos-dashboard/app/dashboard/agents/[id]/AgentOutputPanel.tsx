'use client';

import { useEffect, useRef } from 'react';

interface AgentOutputPanelProps {
    output: string;
    done: boolean;
}

export default function AgentOutputPanel({ output, done }: AgentOutputPanelProps) {
    const outputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    if (!output && !done) return null;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-neutral-200">Output</h2>
                <div className="flex items-center gap-2">
                    {done && (
                        <>
                            <span className="px-2 py-0.5 bg-emerald-900/50 text-emerald-400 rounded text-xs font-medium">
                                Complete
                            </span>
                            <button
                                onClick={() => navigator.clipboard.writeText(output)}
                                className="px-3 py-1 text-xs bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors"
                            >
                                📋 Copy
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div
                ref={outputRef}
                className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 max-h-[600px] overflow-y-auto font-mono text-sm text-neutral-300 whitespace-pre-wrap"
            >
                {output}
            </div>
        </div>
    );
}
