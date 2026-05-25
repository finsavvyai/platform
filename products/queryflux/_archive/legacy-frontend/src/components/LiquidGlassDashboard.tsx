import React, { useState, useRef, useEffect } from 'react';
import {
    Database,
    MessageSquare,
    Send,
    Sparkles,
    Code,
    BarChart3,
    Settings,
    Folder,
    Search,
    Plus,
    X,
    Check,
    ChevronRight,
    Zap,
    Brain,
    Moon,
    Sun,
    Mic,
    Command,
    Table,
    ArrowRight,
    Play,
    Copy,
    Download,
    Share,
    Star,
    Clock,
    Filter,
    MoreHorizontal,
} from 'lucide-react';
import '../styles/liquid-glass.css';

// ============ TYPES ============
interface DatabaseConnection {
    id: string;
    name: string;
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'snowflake';
    host: string;
    status: 'connected' | 'disconnected' | 'error';
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
    sql?: string;
}

// ============ LIQUID GLASS DASHBOARD ============
export const LiquidGlassDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'connections' | 'query' | 'visualize' | 'ai'>('ai');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'ai',
            content: 'Hello! I\'m your AI database assistant. Ask me anything about your data, or describe what you\'d like to query in plain English.',
            timestamp: new Date(),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [connections] = useState<DatabaseConnection[]>([
        { id: '1', name: 'Production DB', type: 'postgres', host: 'prod.db.example.com', status: 'connected' },
        { id: '2', name: 'Analytics', type: 'snowflake', host: 'analytics.snowflake.com', status: 'connected' },
        { id: '3', name: 'Cache Layer', type: 'redis', host: 'cache.example.com', status: 'disconnected' },
    ]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        // Simulate AI response
        setTimeout(() => {
            const aiResponse: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: `I've analyzed your request. Here's a SQL query that will get you the data you need:`,
                timestamp: new Date(),
                sql: `SELECT 
  u.name,
  COUNT(o.id) as order_count,
  SUM(o.total) as total_revenue
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.name
ORDER BY total_revenue DESC
LIMIT 10;`,
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1000);
    };

    const getDbIcon = (type: string) => {
        const icons: Record<string, string> = {
            postgres: '🐘',
            mysql: '🐬',
            mongodb: '🍃',
            redis: '🔴',
            snowflake: '❄️',
        };
        return icons[type] || '💾';
    };

    return (
        <div className="liquid-glass-app" style={{
            display: 'flex',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0c0c1e 0%, #1a1a2e 50%, #16162a 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        }}>
            {/* Mesh Gradient Background */}
            <div style={{
                position: 'fixed',
                inset: 0,
                background: `
          radial-gradient(at 40% 20%, hsla(246, 80%, 45%, 0.15) 0px, transparent 50%),
          radial-gradient(at 80% 0%, hsla(280, 70%, 50%, 0.12) 0px, transparent 50%),
          radial-gradient(at 0% 50%, hsla(320, 70%, 50%, 0.08) 0px, transparent 50%),
          radial-gradient(at 80% 100%, hsla(220, 80%, 50%, 0.1) 0px, transparent 50%)
        `,
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Sidebar */}
            <aside style={{
                width: sidebarCollapsed ? 72 : 280,
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '24px 16px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                zIndex: 10,
            }}>
                {/* Logo */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 32,
                    paddingLeft: 4,
                }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 18,
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                    }}>
                        Q
                    </div>
                    {!sidebarCollapsed && (
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 16 }}>QueryFlux</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>AI Database</div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1 }}>
                    {[
                        { id: 'ai', icon: Brain, label: 'AI Assistant' },
                        { id: 'connections', icon: Database, label: 'Connections' },
                        { id: 'query', icon: Code, label: 'Query Editor' },
                        { id: 'visualize', icon: BarChart3, label: 'Visualizations' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as typeof activeTab)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 16px',
                                marginBottom: 4,
                                background: activeTab === item.id
                                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.15))'
                                    : 'transparent',
                                border: activeTab === item.id
                                    ? '1px solid rgba(99, 102, 241, 0.3)'
                                    : '1px solid transparent',
                                borderRadius: 12,
                                color: activeTab === item.id ? 'white' : 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: 14,
                                fontWeight: 500,
                            }}
                        >
                            <item.icon size={20} />
                            {!sidebarCollapsed && item.label}
                        </button>
                    ))}
                </nav>

                {/* Connections Quick Access */}
                {!sidebarCollapsed && (
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.4)',
                            marginBottom: 12,
                            paddingLeft: 16,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            Quick Access
                        </div>
                        {connections.slice(0, 2).map(conn => (
                            <div key={conn.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '10px 16px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                            }}>
                                <span style={{ fontSize: 18 }}>{getDbIcon(conn.type)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                                        {conn.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                                        {conn.host}
                                    </div>
                                </div>
                                <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: conn.status === 'connected' ? '#22c55e' : '#ef4444',
                                    boxShadow: conn.status === 'connected'
                                        ? '0 0 8px rgba(34, 197, 94, 0.8)'
                                        : '0 0 8px rgba(239, 68, 68, 0.8)',
                                }} />
                            </div>
                        ))}
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden',
            }}>
                {/* Header */}
                <header style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 24,
                }}>
                    <div>
                        <h1 style={{
                            fontSize: 28,
                            fontWeight: 700,
                            margin: 0,
                            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {activeTab === 'ai' && 'AI Assistant'}
                            {activeTab === 'connections' && 'Database Connections'}
                            {activeTab === 'query' && 'Query Editor'}
                            {activeTab === 'visualize' && 'Visualizations'}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>
                            {activeTab === 'ai' && 'Natural language to SQL, powered by AI'}
                            {activeTab === 'connections' && 'Manage your database connections'}
                            {activeTab === 'query' && 'Write and execute SQL queries'}
                            {activeTab === 'visualize' && 'Create stunning data visualizations'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 20px',
                            background: 'rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 12,
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}>
                            <Command size={16} />
                            <span>⌘K</span>
                        </button>
                        <button style={{
                            width: 44,
                            height: 44,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 12,
                            color: 'rgba(255,255,255,0.8)',
                            cursor: 'pointer',
                        }}>
                            <Settings size={20} />
                        </button>
                    </div>
                </header>

                {/* AI Chat Interface */}
                {activeTab === 'ai' && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        gap: 24,
                        minHeight: 0,
                    }}>
                        {/* Chat Panel */}
                        <div style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(40px) saturate(180%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 0 rgba(255,255,255,0.1)',
                        }}>
                            {/* Messages */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: 24,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16,
                            }}>
                                {messages.map(msg => (
                                    <div key={msg.id} style={{
                                        maxWidth: '80%',
                                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    }}>
                                        <div style={{
                                            padding: '14px 18px',
                                            background: msg.role === 'user'
                                                ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                                                : 'rgba(255,255,255,0.1)',
                                            border: msg.role === 'ai' ? '1px solid rgba(255,255,255,0.15)' : 'none',
                                            borderRadius: 16,
                                            borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                                            borderBottomLeftRadius: msg.role === 'ai' ? 4 : 16,
                                            color: 'white',
                                            fontSize: 15,
                                            lineHeight: 1.5,
                                        }}>
                                            {msg.content}
                                        </div>

                                        {/* SQL Code Block */}
                                        {msg.sql && (
                                            <div style={{
                                                marginTop: 12,
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: 12,
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '10px 16px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                                }}>
                                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>SQL</span>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            padding: '6px 12px',
                                                            background: 'rgba(255,255,255,0.1)',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            color: 'rgba(255,255,255,0.8)',
                                                            fontSize: 12,
                                                            cursor: 'pointer',
                                                        }}>
                                                            <Copy size={14} />
                                                            Copy
                                                        </button>
                                                        <button style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            padding: '6px 12px',
                                                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                            border: 'none',
                                                            borderRadius: 8,
                                                            color: 'white',
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            cursor: 'pointer',
                                                        }}>
                                                            <Play size={14} />
                                                            Run
                                                        </button>
                                                    </div>
                                                </div>
                                                <pre style={{
                                                    margin: 0,
                                                    padding: 16,
                                                    fontFamily: '"SF Mono", Monaco, monospace',
                                                    fontSize: 13,
                                                    lineHeight: 1.6,
                                                    color: 'rgba(255,255,255,0.85)',
                                                    whiteSpace: 'pre-wrap',
                                                }}>
                                                    {msg.sql}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div style={{
                                padding: 16,
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                            }}>
                                <button style={{
                                    width: 44,
                                    height: 44,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                    color: 'rgba(255,255,255,0.6)',
                                    cursor: 'pointer',
                                }}>
                                    <Mic size={20} />
                                </button>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Ask anything about your data..."
                                        style={{
                                            width: '100%',
                                            padding: '14px 50px 14px 18px',
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            borderRadius: 14,
                                            color: 'white',
                                            fontSize: 15,
                                            outline: 'none',
                                        }}
                                    />
                                    <Sparkles
                                        size={18}
                                        style={{
                                            position: 'absolute',
                                            right: 16,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'rgba(255,255,255,0.3)',
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={handleSendMessage}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        border: 'none',
                                        borderRadius: 12,
                                        color: 'white',
                                        cursor: 'pointer',
                                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                                    }}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Side Panel */}
                        <div style={{
                            width: 320,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                        }}>
                            {/* Suggestions */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                backdropFilter: 'blur(40px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 20,
                                padding: 20,
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginBottom: 16,
                                }}>
                                    <Sparkles size={18} style={{ color: '#a855f7' }} />
                                    <span style={{ fontWeight: 600, fontSize: 15 }}>Quick Actions</span>
                                </div>
                                {[
                                    'Show top 10 customers by revenue',
                                    'Recent orders from last 7 days',
                                    'Active users this month',
                                    'Products low in stock',
                                ].map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInputValue(suggestion)}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            marginBottom: 8,
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 12,
                                            color: 'rgba(255,255,255,0.8)',
                                            fontSize: 13,
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {suggestion}
                                        <ArrowRight size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                                    </button>
                                ))}
                            </div>

                            {/* Recent Queries */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                backdropFilter: 'blur(40px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 20,
                                padding: 20,
                                flex: 1,
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginBottom: 16,
                                }}>
                                    <Clock size={18} style={{ color: '#6366f1' }} />
                                    <span style={{ fontWeight: 600, fontSize: 15 }}>Recent Queries</span>
                                </div>
                                {[
                                    { query: 'SELECT * FROM users...', time: '2m ago' },
                                    { query: 'SELECT COUNT(*) FROM...', time: '15m ago' },
                                    { query: 'INSERT INTO orders...', time: '1h ago' },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            padding: '12px 14px',
                                            marginBottom: 8,
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 12,
                                        }}
                                    >
                                        <div style={{
                                            fontFamily: '"SF Mono", monospace',
                                            fontSize: 12,
                                            color: 'rgba(255,255,255,0.7)',
                                            marginBottom: 4,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {item.query}
                                        </div>
                                        <div style={{
                                            fontSize: 11,
                                            color: 'rgba(255,255,255,0.4)',
                                        }}>
                                            {item.time}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Connections View */}
                {activeTab === 'connections' && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: 20,
                    }}>
                        {/* Add New Connection Card */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            backdropFilter: 'blur(40px)',
                            border: '2px dashed rgba(255,255,255,0.15)',
                            borderRadius: 20,
                            padding: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            minHeight: 180,
                        }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                                border: '1px solid rgba(99,102,241,0.3)',
                                borderRadius: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                            }}>
                                <Plus size={24} style={{ color: '#a855f7' }} />
                            </div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>New Connection</div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                                Add a database
                            </div>
                        </div>

                        {/* Connection Cards */}
                        {connections.map(conn => (
                            <div key={conn.id} style={{
                                background: 'rgba(255,255,255,0.05)',
                                backdropFilter: 'blur(40px) saturate(180%)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 20,
                                padding: 24,
                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                cursor: 'pointer',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    marginBottom: 20,
                                }}>
                                    <div style={{
                                        width: 52,
                                        height: 52,
                                        background: conn.type === 'postgres' ? 'linear-gradient(135deg, #336791, #4A90D9)'
                                            : conn.type === 'snowflake' ? 'linear-gradient(135deg, #29B5E8, #00A3E0)'
                                                : conn.type === 'redis' ? 'linear-gradient(135deg, #DC382D, #E74C3C)'
                                                    : 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        borderRadius: 14,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 24,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    }}>
                                        {getDbIcon(conn.type)}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '6px 12px',
                                        background: conn.status === 'connected'
                                            ? 'rgba(34, 197, 94, 0.15)'
                                            : 'rgba(239, 68, 68, 0.15)',
                                        border: `1px solid ${conn.status === 'connected'
                                            ? 'rgba(34, 197, 94, 0.3)'
                                            : 'rgba(239, 68, 68, 0.3)'}`,
                                        borderRadius: 20,
                                    }}>
                                        <div style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            background: conn.status === 'connected' ? '#22c55e' : '#ef4444',
                                            boxShadow: `0 0 8px ${conn.status === 'connected'
                                                ? 'rgba(34, 197, 94, 0.8)'
                                                : 'rgba(239, 68, 68, 0.8)'}`,
                                        }} />
                                        <span style={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            color: conn.status === 'connected' ? '#4ade80' : '#f87171',
                                        }}>
                                            {conn.status === 'connected' ? 'Connected' : 'Disconnected'}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>
                                    {conn.name}
                                </div>
                                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
                                    {conn.host}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: 10,
                                }}>
                                    <button style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 10,
                                        color: 'white',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                    }}>
                                        <Table size={14} />
                                        Browse
                                    </button>
                                    <button style={{
                                        flex: 1,
                                        padding: '10px 16px',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        border: 'none',
                                        borderRadius: 10,
                                        color: 'white',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    }}>
                                        <Code size={14} />
                                        Query
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default LiquidGlassDashboard;
