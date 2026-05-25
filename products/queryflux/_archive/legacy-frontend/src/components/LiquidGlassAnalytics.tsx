import React, { useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Users,
    Database,
    Zap,
    Clock,
    BarChart3,
    PieChart,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Sparkles,
    Globe,
    Server,
    Cpu,
    HardDrive,
} from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    change: number;
    icon: React.ElementType;
    gradient: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon: Icon, gradient }) => (
    <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer',
    }}>
        {/* Glow Effect */}
        <div style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            background: gradient,
            filter: 'blur(60px)',
            opacity: 0.3,
            borderRadius: '50%',
        }} />

        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 16,
            position: 'relative',
        }}>
            <div style={{
                width: 48,
                height: 48,
                background: gradient,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 24px ${gradient.includes('#22c55e') ? 'rgba(34, 197, 94, 0.3)'
                    : gradient.includes('#6366f1') ? 'rgba(99, 102, 241, 0.3)'
                        : gradient.includes('#f59e0b') ? 'rgba(245, 158, 11, 0.3)'
                            : 'rgba(236, 72, 153, 0.3)'}`,
            }}>
                <Icon size={22} color="white" />
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                background: change >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${change >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                borderRadius: 20,
            }}>
                {change >= 0 ? <ArrowUpRight size={14} color="#4ade80" /> : <ArrowDownRight size={14} color="#f87171" />}
                <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: change >= 0 ? '#4ade80' : '#f87171',
                }}>
                    {Math.abs(change)}%
                </span>
            </div>
        </div>

        <div style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 4,
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
        }}>
            {value}
        </div>
        <div style={{
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.5)',
        }}>
            {title}
        </div>
    </div>
);

interface ChartBarProps {
    height: number;
    label: string;
    value: number;
    color: string;
}

const ChartBar: React.FC<ChartBarProps> = ({ height, label, value, color }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{
            width: 32,
            height: 180,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'flex-end',
            overflow: 'hidden',
        }}>
            <div style={{
                width: '100%',
                height: `${height}%`,
                background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                borderRadius: 8,
                transition: 'height 0.5s ease-out',
                boxShadow: `0 0 20px ${color}55`,
            }} />
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{value}k</span>
    </div>
);

export const LiquidGlassAnalytics: React.FC = () => {
    const metrics = [
        { title: 'Total Queries', value: '2.4M', change: 12.5, icon: Database, gradient: 'linear-gradient(135deg, #6366f1, #a855f7)' },
        { title: 'Active Users', value: '12,847', change: 8.2, icon: Users, gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
        { title: 'Avg Response', value: '23ms', change: -15.3, icon: Zap, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
        { title: 'Data Processed', value: '847 TB', change: 24.1, icon: HardDrive, gradient: 'linear-gradient(135deg, #ec4899, #db2777)' },
    ];

    const chartData = [
        { label: 'Mon', value: 45, height: 60 },
        { label: 'Tue', value: 62, height: 82 },
        { label: 'Wed', value: 38, height: 50 },
        { label: 'Thu', value: 71, height: 94 },
        { label: 'Fri', value: 55, height: 73 },
        { label: 'Sat', value: 28, height: 37 },
        { label: 'Sun', value: 42, height: 56 },
    ];

    const topQueries = [
        { query: 'SELECT * FROM users...', executions: 12453, avgTime: '12ms' },
        { query: 'SELECT COUNT(*) FROM...', executions: 8921, avgTime: '3ms' },
        { query: 'UPDATE orders SET...', executions: 6234, avgTime: '45ms' },
        { query: 'INSERT INTO logs...', executions: 5102, avgTime: '8ms' },
    ];

    return (
        <div style={{
            padding: 32,
            background: 'linear-gradient(135deg, #0c0c1e 0%, #1a1a2e 50%, #16162a 100%)',
            minHeight: '100vh',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            color: 'white',
            position: 'relative',
        }}>
            {/* Background Mesh */}
            <div style={{
                position: 'fixed',
                inset: 0,
                background: `
          radial-gradient(at 20% 30%, hsla(246, 80%, 45%, 0.2) 0px, transparent 50%),
          radial-gradient(at 80% 20%, hsla(280, 70%, 50%, 0.15) 0px, transparent 50%),
          radial-gradient(at 40% 80%, hsla(320, 70%, 50%, 0.1) 0px, transparent 50%)
        `,
                pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ marginBottom: 32, position: 'relative' }}>
                <h1 style={{
                    fontSize: 36,
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: 8,
                    background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    Analytics Dashboard
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
                    Real-time insights into your database performance
                </p>
            </div>

            {/* Metrics Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 20,
                marginBottom: 32,
                position: 'relative',
            }}>
                {metrics.map((metric, i) => (
                    <MetricCard key={i} {...metric} />
                ))}
            </div>

            {/* Charts Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 20,
                marginBottom: 32,
                position: 'relative',
            }}>
                {/* Bar Chart */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 24,
                    padding: 28,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 24,
                    }}>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>
                                Query Volume
                            </h3>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                                Last 7 days
                            </p>
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: 8,
                        }}>
                            {['Day', 'Week', 'Month'].map((period, i) => (
                                <button key={period} style={{
                                    padding: '8px 16px',
                                    background: i === 0 ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.08)',
                                    border: 'none',
                                    borderRadius: 10,
                                    color: 'white',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}>
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        paddingTop: 20,
                    }}>
                        {chartData.map((bar, i) => (
                            <ChartBar
                                key={i}
                                height={bar.height}
                                label={bar.label}
                                value={bar.value}
                                color="#6366f1"
                            />
                        ))}
                    </div>
                </div>

                {/* Pie Chart / Distribution */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 24,
                    padding: 28,
                }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 24 }}>
                        Database Distribution
                    </h3>

                    {/* Circular Chart Placeholder */}
                    <div style={{
                        width: 180,
                        height: 180,
                        margin: '0 auto 24px',
                        borderRadius: '50%',
                        background: `conic-gradient(
              #6366f1 0deg 144deg,
              #22c55e 144deg 216deg,
              #f59e0b 216deg 288deg,
              #ec4899 288deg 360deg
            )`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                    }}>
                        <div style={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            background: '#1a1a2e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                        }}>
                            <span style={{ fontSize: 28, fontWeight: 700 }}>100%</span>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Total</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                            { name: 'PostgreSQL', value: '40%', color: '#6366f1' },
                            { name: 'MongoDB', value: '20%', color: '#22c55e' },
                            { name: 'Redis', value: '20%', color: '#f59e0b' },
                            { name: 'Snowflake', value: '20%', color: '#ec4899' },
                        ].map((item, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 4,
                                        background: item.color,
                                    }} />
                                    <span style={{ fontSize: 14 }}>{item.name}</span>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Queries Table */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 24,
                padding: 28,
                position: 'relative',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 24,
                }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 4 }}>
                            Top Queries
                        </h3>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                            Most executed queries this week
                        </p>
                    </div>
                    <button style={{
                        padding: '10px 20px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 12,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <Sparkles size={16} />
                        AI Optimize All
                    </button>
                </div>

                {/* Table */}
                <div style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 16,
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 120px',
                        padding: '14px 20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Query</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Executions</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Avg Time</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Action</span>
                    </div>

                    {/* Rows */}
                    {topQueries.map((query, i) => (
                        <div key={i} style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 120px',
                            padding: '16px 20px',
                            borderBottom: i < topQueries.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                            alignItems: 'center',
                        }}>
                            <span style={{
                                fontFamily: '"SF Mono", Monaco, monospace',
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.8)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {query.query}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>
                                {query.executions.toLocaleString()}
                            </span>
                            <span style={{
                                fontSize: 14,
                                color: parseInt(query.avgTime) < 20 ? '#4ade80' : parseInt(query.avgTime) < 50 ? '#fbbf24' : '#f87171',
                            }}>
                                {query.avgTime}
                            </span>
                            <button style={{
                                padding: '8px 14px',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: 8,
                                color: '#a5b4fc',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}>
                                Optimize
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiquidGlassAnalytics;
