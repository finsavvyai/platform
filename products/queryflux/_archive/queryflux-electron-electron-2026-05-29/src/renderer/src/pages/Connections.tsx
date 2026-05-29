import { useState, useEffect } from 'react';
import {
    PlusIcon,
    ServerStackIcon,
    TrashIcon,
    PencilIcon,
    CheckCircleIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';
import type { ConnectionConfig, DatabaseType } from '@shared/types';

const DATABASE_TYPES: { value: DatabaseType; label: string; defaultPort: number }[] = [
    { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
    { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
    { value: 'mariadb', label: 'MariaDB', defaultPort: 3306 },
    { value: 'mongodb', label: 'MongoDB', defaultPort: 27017 },
    { value: 'redis', label: 'Redis', defaultPort: 6379 },
    { value: 'sqlite', label: 'SQLite', defaultPort: 0 },
    { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433 },
    { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
    { value: 'clickhouse', label: 'ClickHouse', defaultPort: 8123 },
    { value: 'snowflake', label: 'Snowflake', defaultPort: 443 },
];

export function Connections() {
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<{ [key: string]: 'testing' | 'success' | 'error' }>({});

    const [formData, setFormData] = useState<Partial<ConnectionConfig>>({
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        ssl: false
    });

    useEffect(() => {
        loadConnections();
    }, []);

    async function loadConnections() {
        if (window.api) {
            const conns = await window.api.connection.getAll();
            setConnections(conns);
        }
    }

    function handleTypeChange(type: DatabaseType) {
        const dbType = DATABASE_TYPES.find(t => t.value === type);
        setFormData({
            ...formData,
            type,
            port: dbType?.defaultPort || formData.port
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!window.api) return;

        const config: ConnectionConfig = {
            id: editingId || crypto.randomUUID(),
            name: formData.name || '',
            type: formData.type as DatabaseType,
            host: formData.host || '',
            port: formData.port || 5432,
            database: formData.database || '',
            username: formData.username,
            password: formData.password,
            ssl: formData.ssl,
            createdAt: editingId ? undefined : Date.now(),
            updatedAt: Date.now()
        };

        await window.api.connection.save(config);
        await loadConnections();
        resetForm();
    }

    async function handleDelete(id: string) {
        if (!window.api) return;

        const result = await window.api.dialog.message({
            type: 'warning',
            title: 'Delete Connection',
            message: 'Are you sure you want to delete this connection?',
            buttons: ['Cancel', 'Delete'],
            defaultId: 0
        });

        if ((result as { response: number }).response === 1) {
            await window.api.connection.delete(id);
            await loadConnections();
        }
    }

    async function handleTest(config: ConnectionConfig) {
        if (!window.api) return;

        setTestStatus({ ...testStatus, [config.id]: 'testing' });

        const result = await window.api.connection.test(config);
        setTestStatus({
            ...testStatus,
            [config.id]: result.success ? 'success' : 'error'
        });

        setTimeout(() => {
            setTestStatus(prev => {
                const next = { ...prev };
                delete next[config.id];
                return next;
            });
        }, 3000);
    }

    function handleEdit(conn: ConnectionConfig) {
        setFormData(conn);
        setEditingId(conn.id);
        setShowForm(true);
    }

    function resetForm() {
        setFormData({
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            ssl: false
        });
        setEditingId(null);
        setShowForm(false);
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Connections</h1>
                    <p className="text-secondary">Manage your database connections</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <PlusIcon style={{ width: 18, height: 18 }} />
                    Add Connection
                </button>
            </div>

            {/* Connection Form Modal */}
            {showForm && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card animate-slide-up" style={{ width: 500, maxHeight: '80vh', overflow: 'auto' }}>
                        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
                            {editingId ? 'Edit Connection' : 'New Connection'}
                        </h2>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Connection Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="My Database"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Database Type</label>
                                <select
                                    className="form-select"
                                    value={formData.type}
                                    onChange={e => handleTypeChange(e.target.value as DatabaseType)}
                                >
                                    {DATABASE_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Host</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="localhost"
                                        value={formData.host || ''}
                                        onChange={e => setFormData({ ...formData, host: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Port</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={formData.port || ''}
                                        onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Database</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="mydb"
                                    value={formData.database || ''}
                                    onChange={e => setFormData({ ...formData, database: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Username</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="postgres"
                                        value={formData.username || ''}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="••••••••"
                                        value={formData.password || ''}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.ssl || false}
                                        onChange={e => setFormData({ ...formData, ssl: e.target.checked })}
                                    />
                                    <span className="form-label" style={{ margin: 0 }}>Use SSL</span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Save Changes' : 'Create Connection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Connections Grid */}
            {connections.length > 0 ? (
                <div className="connection-grid">
                    {connections.map((conn) => (
                        <div key={conn.id} className="connection-card" style={{ cursor: 'default' }}>
                            <div className="connection-icon">
                                <ServerStackIcon style={{ width: 24, height: 24, color: 'var(--color-accent)' }} />
                            </div>
                            <div className="connection-info">
                                <div className="connection-name">{conn.name}</div>
                                <div className="connection-meta">
                                    {conn.type} • {conn.host}:{conn.port}/{conn.database}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: '6px 10px', fontSize: 12 }}
                                        onClick={() => handleTest(conn)}
                                        disabled={testStatus[conn.id] === 'testing'}
                                    >
                                        {testStatus[conn.id] === 'testing' ? (
                                            'Testing...'
                                        ) : testStatus[conn.id] === 'success' ? (
                                            <><CheckCircleIcon style={{ width: 14, height: 14, color: 'var(--color-success)' }} /> Connected</>
                                        ) : testStatus[conn.id] === 'error' ? (
                                            <><XCircleIcon style={{ width: 14, height: 14, color: 'var(--color-error)' }} /> Failed</>
                                        ) : (
                                            'Test'
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: '6px 10px', fontSize: 12 }}
                                        onClick={() => handleEdit(conn)}
                                    >
                                        <PencilIcon style={{ width: 14, height: 14 }} />
                                    </button>
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: '6px 10px', fontSize: 12, color: 'var(--color-error)' }}
                                        onClick={() => handleDelete(conn.id)}
                                    >
                                        <TrashIcon style={{ width: 14, height: 14 }} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <ServerStackIcon style={{ width: 64, height: 64, color: 'var(--color-text-muted)', margin: '0 auto 24px' }} />
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No connections yet</h3>
                    <p className="text-secondary" style={{ marginBottom: 24 }}>
                        Add your first database connection to get started
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        <PlusIcon style={{ width: 18, height: 18 }} />
                        Add Connection
                    </button>
                </div>
            )}
        </div>
    );
}
