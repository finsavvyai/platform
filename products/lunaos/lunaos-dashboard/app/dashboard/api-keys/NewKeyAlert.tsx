'use client';

import { useState } from 'react';

interface NewKeyAlertProps {
    keyValue: string;
    onDismiss: () => void;
}

export default function NewKeyAlert({ keyValue, onDismiss }: NewKeyAlertProps) {
    const [copied, setCopied] = useState(false);

    async function copyKey() {
        await navigator.clipboard.writeText(keyValue);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="neon-card p-4 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-start gap-3">
                <span className="text-emerald-400 text-xl">🔑</span>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-300 mb-1">
                        Your API key was created
                    </p>
                    <p className="text-xs text-neutral-400 mb-3">
                        Copy it now — you won&apos;t be able to see it again.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-neutral-900 rounded-lg text-sm text-emerald-300 font-mono overflow-x-auto">
                            {keyValue}
                        </code>
                        <button
                            onClick={copyKey}
                            className="btn btn-secondary text-xs px-3 py-2"
                        >
                            {copied ? '✓ Copied' : 'Copy'}
                        </button>
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    className="text-neutral-500 hover:text-neutral-300"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
