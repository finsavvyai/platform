import { useState } from 'react';
import { CircleCheck, Database, Plus, Server, ShieldCheck, TestTube, Trash2 } from 'lucide-react';
import { useConnections, useDeleteConnection, useTestConnection } from '../hooks/useConnections';
import type { ConnectionConfig } from '../types/api';
import { CreateConnectionModal } from './CreateConnectionModal';

export function ConnectionsPage() {
    const { data: connections, isLoading } = useConnections();
    const deleteConnection = useDeleteConnection();
    const testConnection = useTestConnection();
    const [testingId, setTestingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const handleTest = async (connection: ConnectionConfig) => {
        if (!connection.id) return;
        setTestingId(connection.id);
        try {
            await testConnection.mutateAsync(connection);
        } finally {
            setTestingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this connection?')) return;
        deleteConnection.mutate(id);
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="premium-panel rounded-2xl px-5 py-4 text-muted-foreground">Loading connections…</div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-4 md:p-6">
            {showCreate && <CreateConnectionModal onClose={() => setShowCreate(false)} />}

            <div className="mx-auto max-w-7xl space-y-6">
                <section className="premium-card rounded-[2rem] p-6 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-primary">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Encrypted connection vault
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-gradient-data md:text-5xl">
                                Database Connections
                            </h1>
                            <p className="mt-3 max-w-2xl text-muted-foreground">
                                Manage your database connections
                            </p>
                            <p className="mt-1 max-w-2xl text-sm text-muted-foreground/80">
                                Clear environment status, safe tests, and production-ready connection metadata.
                            </p>
                        </div>
                        <button onClick={() => setShowCreate(true)}
                            className="premium-button inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-all">
                            <Plus size={18} />
                            New Connection
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="premium-pill rounded-2xl p-4">
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total sources</span>
                        <div className="mt-2 text-3xl font-black tabular-nums">{connections?.length ?? 0}</div>
                    </div>
                    <div className="premium-pill rounded-2xl p-4">
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Default host</span>
                        <div className="mt-2 truncate font-mono text-lg font-bold">localhost</div>
                    </div>
                    <div className="premium-pill rounded-2xl p-4">
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Policy</span>
                        <div className="mt-2 flex items-center gap-2 text-lg font-bold text-success">
                            <CircleCheck className="h-4 w-4" />
                            Test before query
                        </div>
                    </div>
                </div>

                {connections && connections.length > 0 ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {connections.map((connection) => (
                            <div key={connection.id ?? `${connection.name}-${connection.type}`}
                                className="premium-card group rounded-[1.75rem] p-6 transition-all hover:-translate-y-0.5 hover:border-primary/45">
                                <div className="mb-5 flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                                            <Database className="text-primary" size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="truncate font-black">{connection.name}</h3>
                                            <p className="text-sm font-medium text-muted-foreground">{connection.type}</p>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                                        Ready
                                    </span>
                                </div>

                                <div className="mb-5 space-y-2 rounded-2xl border border-border/70 bg-background/35 p-4 text-sm">
                                    {connection.host && (
                                        <div className="flex justify-between gap-4">
                                            <span className="text-muted-foreground">Host</span>
                                            <span className="truncate font-mono">{connection.host}:{connection.port}</span>
                                        </div>
                                    )}
                                    {connection.database && (
                                        <div className="flex justify-between gap-4">
                                            <span className="text-muted-foreground">Database</span>
                                            <span className="truncate font-mono">{connection.database}</span>
                                        </div>
                                    )}
                                    {!connection.host && !connection.database && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Server className="h-4 w-4" />
                                            File or local runtime connection
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => handleTest(connection)}
                                        disabled={testingId === connection.id}
                                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-success/25 bg-success/10 px-3 py-2 text-sm font-bold text-success transition-colors hover:bg-success/15 disabled:opacity-50">
                                        <TestTube size={15} />
                                        {testingId === connection.id ? 'Testing…' : 'Test'}
                                    </button>
                                    <button onClick={() => connection.id && handleDelete(connection.id)}
                                        className="cursor-pointer rounded-xl border border-destructive/25 bg-destructive/10 p-2 text-destructive transition-colors hover:bg-destructive/20"
                                        aria-label={`Delete ${connection.name}`}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="premium-card rounded-[2rem] p-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15">
                            <Database className="text-primary" size={34} />
                        </div>
                        <h3 className="mb-2 text-2xl font-black">No connections yet</h3>
                        <p className="mx-auto mb-6 max-w-md text-muted-foreground">
                            Get started by creating your first database connection
                        </p>
                        <button onClick={() => setShowCreate(true)}
                            className="premium-button inline-flex cursor-pointer items-center justify-center rounded-2xl px-6 py-3 text-sm font-black transition-all">
                            Create Connection
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
