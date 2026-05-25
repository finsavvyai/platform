import React, { useState } from 'react';
import { Database, X } from 'lucide-react';
import { useCreateConnection } from '../hooks/useConnections';
import type { ConnectionConfig } from '../types/api';

const DB_TYPES = [
    'postgresql', 'mysql', 'sqlite', 'mariadb', 'mssql',
    'mongodb', 'redis', 'cockroachdb', 'timescaledb',
] as const;

const DEFAULT_PORTS: Record<string, number> = {
    postgresql: 5432, mysql: 3306, mariadb: 3306,
    mssql: 1433, mongodb: 27017, redis: 6379,
    cockroachdb: 26257, timescaledb: 5432,
};

const EMPTY_FORM = {
    name: '', type: 'postgresql' as string,
    host: 'localhost', port: 5432,
    database: '', username: '', password: '', ssl: false,
};

function inputCls() {
    return 'premium-input w-full rounded-2xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground';
}

export function CreateConnectionModal({ onClose }: { onClose: () => void }) {
    const createConnection = useCreateConnection();
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');

    function set(field: string, value: unknown) {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'type' && typeof value === 'string') {
                next.port = DEFAULT_PORTS[value] ?? 5432;
            }
            return next;
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        try {
            await createConnection.mutateAsync({
                name: form.name,
                type: form.type as ConnectionConfig['type'],
                host: form.host || undefined,
                port: form.port || undefined,
                database: form.database || undefined,
                username: form.username || undefined,
                password: form.password || undefined,
                ssl: form.ssl,
            });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create connection');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
            <div className="premium-card w-full max-w-lg rounded-[2rem] shadow-2xl">
                <div className="flex items-center justify-between border-b border-border/70 p-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                            <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black">Create Connection</h2>
                            <p className="text-xs text-muted-foreground">Add a secure source to your workspace.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-primary/10" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1">
                            <label className="text-sm font-bold">Name</label>
                            <input required placeholder="My Postgres DB" value={form.name}
                                onChange={(e) => set('name', e.target.value)} className={inputCls()} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-sm font-bold">Type</label>
                            <select value={form.type} onChange={(e) => set('type', e.target.value)}
                                className={inputCls()}>
                                {DB_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold">Host</label>
                            <input placeholder="localhost" value={form.host}
                                onChange={(e) => set('host', e.target.value)} className={inputCls()} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold">Port</label>
                            <input type="number" value={form.port}
                                onChange={(e) => set('port', Number(e.target.value))} className={inputCls()} />
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-sm font-bold">Database</label>
                            <input placeholder="my_database" value={form.database}
                                onChange={(e) => set('database', e.target.value)} className={inputCls()} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold">Username</label>
                            <input placeholder="postgres" value={form.username}
                                onChange={(e) => set('username', e.target.value)} className={inputCls()} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold">Password</label>
                            <input type="password" value={form.password}
                                onChange={(e) => set('password', e.target.value)} className={inputCls()} />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                            <input id="ssl" type="checkbox" checked={form.ssl}
                                onChange={(e) => set('ssl', e.target.checked)}
                                className="w-4 h-4 accent-primary" />
                            <label htmlFor="ssl" className="text-sm font-bold">Use SSL</label>
                        </div>
                    </div>

                    {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 cursor-pointer rounded-2xl border border-border py-2 text-sm font-bold transition-colors hover:bg-primary/10">
                            Cancel
                        </button>
                        <button type="submit" disabled={createConnection.isPending}
                            className="premium-button flex-1 cursor-pointer rounded-2xl py-2 text-sm font-black transition-colors disabled:opacity-50">
                            {createConnection.isPending ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
