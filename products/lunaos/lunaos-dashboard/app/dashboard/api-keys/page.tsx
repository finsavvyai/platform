'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiKeysApi, type ApiKey } from '@/lib/api';
import NewKeyAlert from './NewKeyAlert';
import KeysTable from './KeysTable';
import UsageGuide from './UsageGuide';

export default function ApiKeysPage() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const loadKeys = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiKeysApi.list();
            setKeys(data.keys || []);
        } catch (e) {
            // Error loading API keys - will display empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        setCreating(true);
        try {
            const result = await apiKeysApi.create(newKeyName.trim());
            setNewKeyValue(result.key);
            setNewKeyName('');
            await loadKeys();
        } catch (e) {
            // Error creating API key - user will see error state
        } finally {
            setCreating(false);
        }
    }

    async function handleRevoke(id: string, name: string) {
        if (!confirm(`Revoke API key "${name}"? This action cannot be undone.`)) return;

        setRevokingId(id);
        try {
            await apiKeysApi.revoke(id);
            await loadKeys();
        } catch (e) {
            // Error revoking API key - user will see error state
        } finally {
            setRevokingId(null);
        }
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">API Keys</h1>
                    <p className="text-neutral-400 mt-1">Manage API keys for programmatic access</p>
                </div>
                <button
                    onClick={() => { setShowCreateForm(true); setNewKeyValue(null); }}
                    className="btn btn-primary text-sm"
                    disabled={keys.length >= 5}
                >
                    + Create Key
                </button>
            </div>

            {newKeyValue && (
                <NewKeyAlert keyValue={newKeyValue} onDismiss={() => setNewKeyValue(null)} />
            )}

            {/* Create Form */}
            {showCreateForm && !newKeyValue && (
                <div className="neon-card p-4">
                    <form onSubmit={handleCreate} className="flex items-end gap-3">
                        <div className="flex-1">
                            <label className="text-sm text-neutral-400 block mb-1">Key Name</label>
                            <input
                                type="text"
                                value={newKeyName}
                                onChange={e => setNewKeyName(e.target.value)}
                                placeholder="e.g., ci-pipeline, local-dev"
                                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={creating || !newKeyName.trim()}
                            className="btn btn-primary text-sm"
                        >
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            className="btn btn-secondary text-sm"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Keys List */}
            {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <div className="animate-pulse text-neutral-400">Loading keys...</div>
                </div>
            ) : (
                <KeysTable keys={keys} revokingId={revokingId} onRevoke={handleRevoke} />
            )}

            <UsageGuide />
        </div>
    );
}
