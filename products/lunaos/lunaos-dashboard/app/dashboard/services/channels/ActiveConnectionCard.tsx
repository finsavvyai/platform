'use client';

import { type ChannelConnection } from '../../../../lib/api';
import { CHANNEL_TYPES, colorMap } from './channel-constants';

interface ActiveConnectionCardProps {
    connection: ChannelConnection;
    testing: string | null;
    onTest: (id: string) => void;
    onDisconnect: (id: string) => void;
}

export default function ActiveConnectionCard({
    connection,
    testing,
    onTest,
    onDisconnect,
}: ActiveConnectionCardProps) {
    const typeInfo = CHANNEL_TYPES.find(t => t.id === connection.channel_type) || CHANNEL_TYPES[4];
    const colors = colorMap[typeInfo.color] || colorMap.violet;

    return (
        <div className={`neon-card p-5 ${colors.border}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                        <h3 className="text-sm font-semibold text-white">
                            {connection.label || typeInfo.name}
                        </h3>
                        <p className="text-xs text-neutral-500">
                            {connection.external_name || connection.channel_type} · {connection.status}
                        </p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${connection.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30'
                    }`}>
                    {connection.status}
                </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-neutral-400 mb-4">
                <span>📨 {connection.message_count} messages</span>
                {connection.last_message_at && (
                    <span>Last: {new Date(connection.last_message_at).toLocaleDateString()}</span>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onTest(connection.id)}
                    disabled={testing === connection.id}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.03] text-neutral-300 border border-white/[0.06] hover:bg-white/[0.06] transition-all disabled:opacity-50"
                >
                    {testing === connection.id ? 'Testing...' : '🧪 Test'}
                </button>
                <button
                    onClick={() => onDisconnect(connection.id)}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                    Disconnect
                </button>
            </div>
        </div>
    );
}
