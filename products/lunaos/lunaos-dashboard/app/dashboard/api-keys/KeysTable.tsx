'use client';

import { type ApiKey } from '@/lib/api';
import { KeyRound } from 'lucide-react';

interface KeysTableProps {
    keys: ApiKey[];
    revokingId: string | null;
    onRevoke: (id: string, name: string) => void;
}

export default function KeysTable({ keys, revokingId, onRevoke }: KeysTableProps) {
    if (keys.length === 0) {
        return (
            <div className="neon-card p-12 text-center">
                <KeyRound className="w-10 h-10 text-neutral-600 mx-auto mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-white mb-2">No API keys yet</h3>
                <p className="text-neutral-400 text-sm max-w-md mx-auto">
                    Create an API key to use LunaOS in your CI/CD pipelines, scripts, and integrations.
                </p>
            </div>
        );
    }

    return (
        <div className="neon-card overflow-hidden">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-neutral-800">
                        <th scope="col" className="text-left text-xs text-neutral-500 font-medium px-4 py-3">Name</th>
                        <th scope="col" className="text-left text-xs text-neutral-500 font-medium px-4 py-3">Key</th>
                        <th scope="col" className="text-left text-xs text-neutral-500 font-medium px-4 py-3">Created</th>
                        <th scope="col" className="text-left text-xs text-neutral-500 font-medium px-4 py-3">Last Used</th>
                        <th scope="col" className="text-right text-xs text-neutral-500 font-medium px-4 py-3">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {keys.map(key => (
                        <tr key={key.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-white font-medium">{key.name}</td>
                            <td className="px-4 py-3">
                                <code className="text-xs text-neutral-400 font-mono bg-neutral-900 px-2 py-1 rounded">
                                    {key.prefix}...
                                </code>
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-400">
                                {new Date(key.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-400">
                                {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    onClick={() => onRevoke(key.id, key.name)}
                                    disabled={revokingId === key.id}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none rounded"
                                >
                                    {revokingId === key.id ? 'Revoking...' : 'Revoke'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="px-4 py-3 bg-neutral-900/50 text-xs text-neutral-500">
                {keys.length} / 5 keys used
            </div>
        </div>
    );
}
