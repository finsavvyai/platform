import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ServerStackIcon,
    CommandLineIcon,
    PlusIcon,
    ClockIcon,
    ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import type { ConnectionConfig } from '@shared/types';

export function Dashboard() {
    const navigate = useNavigate();
    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [recentQueries, setRecentQueries] = useState<{ query: string; timestamp: number }[]>([]);

    useEffect(() => {
        async function loadData() {
            if (window.api) {
                const conns = await window.api.connection.getAll();
                setConnections(conns);

                const recent = await window.api.settings.get<{ query: string; timestamp: number }[]>('recentQueries');
                if (recent) {
                    setRecentQueries(recent.slice(0, 5));
                }
            }
        }
        loadData();
    }, []);

    const stats = [
        { label: 'Active Connections', value: connections.length, icon: ServerStackIcon, color: '#10b981' },
        { label: 'Queries Today', value: 0, icon: CommandLineIcon, color: '#6366f1' },
        { label: 'Avg Response Time', value: '32ms', icon: ClockIcon, color: '#f59e0b' },
        { label: 'Performance', value: '+12%', icon: ArrowTrendingUpIcon, color: '#3b82f6' },
    ];

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                    Welcome to QueryFlux
                </h1>
                <p className="text-secondary" style={{ fontSize: 15 }}>
                    AI-powered database management at your fingertips
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 20,
                marginBottom: 32
            }}>
                {stats.map((stat) => (
                    <div key={stat.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: `${stat.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <stat.icon style={{ width: 24, height: 24, color: stat.color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{stat.value}</div>
                            <div className="text-muted" style={{ fontSize: 13 }}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary" onClick={() => navigate('/query')}>
                        <CommandLineIcon style={{ width: 18, height: 18 }} />
                        New Query
                    </button>
                    <button className="btn btn-secondary" onClick={() => navigate('/connections')}>
                        <PlusIcon style={{ width: 18, height: 18 }} />
                        Add Connection
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                {/* Recent Connections */}
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Connections</h2>
                    {connections.length > 0 ? (
                        <div className="connection-grid">
                            {connections.slice(0, 4).map((conn) => (
                                <div
                                    key={conn.id}
                                    className="connection-card"
                                    onClick={() => navigate(`/query/${conn.id}`)}
                                >
                                    <div className="connection-icon">
                                        <ServerStackIcon style={{ width: 24, height: 24, color: 'var(--color-accent)' }} />
                                    </div>
                                    <div className="connection-info">
                                        <div className="connection-name">{conn.name}</div>
                                        <div className="connection-meta">
                                            {conn.type} • {conn.host}:{conn.port}
                                        </div>
                                    </div>
                                    <div className="connection-status connected" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                            <ServerStackIcon style={{ width: 48, height: 48, color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
                            <p className="text-secondary" style={{ marginBottom: 16 }}>No connections yet</p>
                            <button className="btn btn-primary" onClick={() => navigate('/connections')}>
                                Add Your First Connection
                            </button>
                        </div>
                    )}
                </div>

                {/* Recent Queries */}
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Queries</h2>
                    <div className="card" style={{ padding: 0 }}>
                        {recentQueries.length > 0 ? (
                            recentQueries.map((item, i) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: i < recentQueries.length - 1 ? '1px solid var(--color-border)' : 'none',
                                        cursor: 'pointer'
                                    }}
                                    className="hover:bg-tertiary"
                                >
                                    <code style={{
                                        fontSize: 12,
                                        fontFamily: 'var(--font-mono)',
                                        color: 'var(--color-text-secondary)',
                                        display: 'block',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.query}
                                    </code>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: 32, textAlign: 'center' }}>
                                <ClockIcon style={{ width: 32, height: 32, color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
                                <p className="text-muted" style={{ fontSize: 13 }}>No recent queries</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
