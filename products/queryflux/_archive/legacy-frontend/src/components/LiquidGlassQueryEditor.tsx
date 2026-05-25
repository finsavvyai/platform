import React, { useState } from 'react';
import {
    Play,
    Save,
    Copy,
    Download,
    Share,
    Clock,
    Sparkles,
    X,
    Plus,
    ChevronDown,
    Table,
    CheckCircle,
    AlertCircle,
    Loader2,
    Code,
    FileCode,
    Database,
    Zap,
} from 'lucide-react';

interface QueryTab {
    id: string;
    name: string;
    content: string;
    status: 'idle' | 'running' | 'success' | 'error';
}

export const LiquidGlassQueryEditor: React.FC = () => {
    const [tabs, setTabs] = useState<QueryTab[]>([
        {
            id: '1', name: 'Query 1', content: `SELECT 
  u.id,
  u.name,
  u.email,
  COUNT(o.id) as order_count,
  SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, u.email
ORDER BY total_spent DESC
LIMIT 100;`, status: 'idle'
        },
        { id: '2', name: 'Analytics', content: 'SELECT * FROM analytics;', status: 'success' },
    ]);
    const [activeTab, setActiveTab] = useState('1');
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<any[] | null>(null);

    const activeQuery = tabs.find(t => t.id === activeTab);

    const handleRun = () => {
        setIsRunning(true);
        setTabs(prev => prev.map(t =>
            t.id === activeTab ? { ...t, status: 'running' } : t
        ));

        setTimeout(() => {
            setIsRunning(false);
            setTabs(prev => prev.map(t =>
                t.id === activeTab ? { ...t, status: 'success' } : t
            ));
            setResults([
                { id: 1, name: 'John Doe', email: 'john@example.com', order_count: 15, total_spent: 2450.00 },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com', order_count: 23, total_spent: 4120.50 },
                { id: 3, name: 'Bob Johnson', email: 'bob@example.com', order_count: 8, total_spent: 890.25 },
                { id: 4, name: 'Alice Brown', email: 'alice@example.com', order_count: 31, total_spent: 5670.00 },
                { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', order_count: 12, total_spent: 1890.75 },
            ]);
        }, 1500);
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0c0c1e 0%, #1a1a2e 50%, #16162a 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            color: 'white',
            position: 'relative',
        }}>
            {/* Background */}
            <div style={{
                position: 'fixed',
                inset: 0,
                background: `
          radial-gradient(at 30% 20%, hsla(246, 80%, 45%, 0.15) 0px, transparent 50%),
          radial-gradient(at 70% 80%, hsla(280, 70%, 50%, 0.1) 0px, transparent 50%)
        `,
                pointerEvents: 'none',
            }} />

            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative',
                zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 14px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 10,
                    }}>
                        <Database size={16} style={{ color: '#a855f7' }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>Production DB</span>
                        <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: 20,
                    }}>
                        <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
                        }} />
                        <span style={{ fontSize: 12, color: '#4ade80' }}>Connected</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 10,
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}>
                        <Sparkles size={16} style={{ color: '#a855f7' }} />
                        AI Assist
                    </button>
                    <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 18px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 10,
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}>
                        <Save size={16} />
                        Save
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 24px',
                            background: isRunning
                                ? 'rgba(99, 102, 241, 0.3)'
                                : 'linear-gradient(135deg, #6366f1, #a855f7)',
                            border: 'none',
                            borderRadius: 10,
                            color: 'white',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            boxShadow: isRunning ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.4)',
                        }}
                    >
                        {isRunning ? (
                            <>
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                Run Query
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                position: 'relative',
                zIndex: 10,
            }}>
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            background: activeTab === tab.id
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'transparent',
                            border: activeTab === tab.id
                                ? '1px solid rgba(255, 255, 255, 0.15)'
                                : '1px solid transparent',
                            borderRadius: 10,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <FileCode size={14} style={{
                            color: activeTab === tab.id ? '#a855f7' : 'rgba(255,255,255,0.5)'
                        }} />
                        <span style={{
                            fontSize: 13,
                            color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.6)',
                        }}>
                            {tab.name}
                        </span>
                        {tab.status === 'success' && (
                            <CheckCircle size={14} style={{ color: '#22c55e' }} />
                        )}
                        {tab.status === 'error' && (
                            <AlertCircle size={14} style={{ color: '#ef4444' }} />
                        )}
                        {tab.status === 'running' && (
                            <Loader2 size={14} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
                        )}
                        <X size={14} style={{
                            color: 'rgba(255,255,255,0.3)',
                            marginLeft: 4,
                        }} />
                    </div>
                ))}
                <button style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                }}>
                    <Plus size={16} />
                </button>
            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Query Editor */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    position: 'relative',
                }}>
                    {/* Line Numbers */}
                    <div style={{
                        width: 50,
                        padding: '20px 12px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                        fontFamily: '"SF Mono", Monaco, monospace',
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: 'rgba(255, 255, 255, 0.25)',
                        textAlign: 'right',
                        userSelect: 'none',
                    }}>
                        {activeQuery?.content.split('\n').map((_, i) => (
                            <div key={i}>{i + 1}</div>
                        ))}
                    </div>

                    {/* Code Area */}
                    <div style={{
                        flex: 1,
                        padding: 20,
                        background: 'rgba(0, 0, 0, 0.15)',
                        overflow: 'auto',
                    }}>
                        <pre style={{
                            margin: 0,
                            fontFamily: '"SF Mono", Monaco, monospace',
                            fontSize: 14,
                            lineHeight: 1.7,
                            color: 'rgba(255, 255, 255, 0.85)',
                        }}>
                            <code>
                                {activeQuery?.content.split('\n').map((line, i) => (
                                    <div key={i}>
                                        {line.split(/(\b(?:SELECT|FROM|LEFT JOIN|ON|WHERE|GROUP BY|ORDER BY|LIMIT|AND|OR|AS|COUNT|SUM|NOW|INTERVAL|DESC)\b)/gi).map((part, j) => {
                                            if (/^(SELECT|FROM|LEFT JOIN|ON|WHERE|GROUP BY|ORDER BY|LIMIT|AND|OR|AS|DESC)$/i.test(part)) {
                                                return <span key={j} style={{ color: '#c792ea', fontWeight: 500 }}>{part}</span>;
                                            }
                                            if (/^(COUNT|SUM|NOW|INTERVAL)$/i.test(part)) {
                                                return <span key={j} style={{ color: '#82aaff' }}>{part}</span>;
                                            }
                                            return part;
                                        })}
                                    </div>
                                ))}
                            </code>
                        </pre>
                    </div>

                    {/* Schema Sidebar */}
                    <div style={{
                        width: 280,
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: 20,
                        overflow: 'auto',
                    }}>
                        <div style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            marginBottom: 16,
                        }}>
                            Schema Explorer
                        </div>

                        {[
                            { name: 'users', columns: ['id', 'name', 'email', 'created_at'] },
                            { name: 'orders', columns: ['id', 'user_id', 'total', 'status'] },
                            { name: 'products', columns: ['id', 'name', 'price', 'stock'] },
                        ].map((table, i) => (
                            <div key={i} style={{ marginBottom: 16 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    cursor: 'pointer',
                                }}>
                                    <Table size={14} style={{ color: '#6366f1' }} />
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{table.name}</span>
                                </div>
                                {table.columns.map((col, j) => (
                                    <div key={j} style={{
                                        padding: '6px 12px 6px 32px',
                                        fontSize: 12,
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                    }}>
                                        {col}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Results Panel */}
                {results && (
                    <div style={{
                        height: 300,
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                        {/* Results Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 20px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 14, fontWeight: 500 }}>Results</span>
                                <span style={{
                                    padding: '4px 10px',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: '#4ade80',
                                }}>
                                    {results.length} rows
                                </span>
                                <span style={{
                                    padding: '4px 10px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    borderRadius: 12,
                                    fontSize: 12,
                                    color: '#a5b4fc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}>
                                    <Zap size={12} />
                                    23ms
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button style={{
                                    padding: '6px 12px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}>
                                    <Copy size={12} />
                                    Copy
                                </button>
                                <button style={{
                                    padding: '6px 12px',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}>
                                    <Download size={12} />
                                    Export
                                </button>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div style={{ overflow: 'auto', height: 'calc(100% - 50px)' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 13,
                            }}>
                                <thead>
                                    <tr style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        position: 'sticky',
                                        top: 0,
                                    }}>
                                        {results.length > 0 && Object.keys(results[0]).map((key, i) => (
                                            <th key={i} style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                fontWeight: 500,
                                                color: 'rgba(255,255,255,0.6)',
                                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                            }}>
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, i) => (
                                        <tr key={i} style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                            {Object.values(row).map((val: any, j) => (
                                                <td key={j} style={{
                                                    padding: '12px 16px',
                                                    color: 'rgba(255,255,255,0.85)',
                                                }}>
                                                    {typeof val === 'number' && j > 2
                                                        ? val.toLocaleString('en-US', {
                                                            style: j === 4 ? 'currency' : 'decimal',
                                                            currency: 'USD',
                                                        })
                                                        : val}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Keyframes */}
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default LiquidGlassQueryEditor;
