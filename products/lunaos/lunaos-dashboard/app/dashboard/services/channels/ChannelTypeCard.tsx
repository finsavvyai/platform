'use client';

import { type ChannelTypeInfo, type ColorSet } from './channel-constants';

interface ChannelTypeCardProps {
    type: ChannelTypeInfo;
    colors: ColorSet;
    isConnected: boolean;
    isExpanded: boolean;
    connectingType: string | null;
    configInput: string;
    onConfigInputChange: (value: string) => void;
    onConnect: (channelType: string) => void;
    onExpand: (typeId: string) => void;
    onCollapse: () => void;
}

export default function ChannelTypeCard({
    type,
    colors,
    isConnected,
    isExpanded,
    connectingType,
    configInput,
    onConfigInputChange,
    onConnect,
    onExpand,
    onCollapse,
}: ChannelTypeCardProps) {
    return (
        <div className={`neon-card ${colors.border} transition-all duration-300`}>
            <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                        <h3 className="text-sm font-semibold text-white">{type.name}</h3>
                        <span className={`text-[10px] font-medium ${colors.text}`}>{type.auth}</span>
                    </div>
                    {isConnected && (
                        <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ✓ Connected
                        </span>
                    )}
                </div>

                <p className="text-xs text-neutral-400 mb-4">{type.description}</p>

                {isExpanded ? (
                    <div className="space-y-3">
                        {['whatsapp', 'telegram'].includes(type.id) && (
                            <input
                                type="text"
                                value={configInput}
                                onChange={e => onConfigInputChange(e.target.value)}
                                placeholder={type.id === 'telegram' ? 'Bot token from @BotFather' : 'WhatsApp access token'}
                                className="w-full px-3 py-2 rounded-lg text-xs bg-black/30 border border-white/[0.08] text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500/40"
                            />
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => onConnect(type.id)}
                                disabled={connectingType === type.id}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} ${colors.hover} transition-all disabled:opacity-50`}
                            >
                                {connectingType === type.id ? 'Connecting...' : 'Connect'}
                            </button>
                            <button
                                onClick={onCollapse}
                                className="px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.03] text-neutral-400 border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => onExpand(type.id)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} ${colors.hover} transition-all`}
                    >
                        {isConnected ? '+ Add Another' : `Connect ${type.name}`}
                    </button>
                )}
            </div>
        </div>
    );
}
