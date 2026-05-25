'use client';

import { useEffect, useState, useCallback } from 'react';
import { servicesApi, type ChannelConnection } from '../../../../lib/api';
import { CHANNEL_TYPES, colorMap } from './channel-constants';
import ActiveConnectionCard from './ActiveConnectionCard';
import ChannelTypeCard from './ChannelTypeCard';

export default function ChannelsPage() {
    const [connections, setConnections] = useState<ChannelConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectingType, setConnectingType] = useState<string | null>(null);
    const [configInput, setConfigInput] = useState('');
    const [showConnect, setShowConnect] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);

    const fetchConnections = useCallback(async () => {
        try {
            const data = await servicesApi.channels.connections().catch(() => ({ connections: [] }));
            setConnections(data.connections || []);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    const handleConnect = async (channelType: string) => {
        if (!configInput.trim() && ['whatsapp', 'telegram'].includes(channelType)) return;
        setConnectingType(channelType);
        try {
            const config: Record<string, string> = {};
            if (channelType === 'telegram') config.botToken = configInput;
            if (channelType === 'whatsapp') {
                config.accessToken = configInput;
                config.phoneNumberId = 'default';
            }

            await servicesApi.channels.connect(channelType, config);
            setShowConnect(null);
            setConfigInput('');
            await fetchConnections();
        } catch (err) {
            // Error connecting channel - user will see error state
        } finally {
            setConnectingType(null);
        }
    };

    const handleDisconnect = async (id: string) => {
        if (!confirm('Disconnect this channel?')) return;
        try {
            await servicesApi.channels.disconnect(id);
            await fetchConnections();
        } catch (err) {
            // Error disconnecting channel - user will see error state
        }
    };

    const handleTest = async (id: string) => {
        setTesting(id);
        try {
            await servicesApi.channels.test(id);
        } catch { /* ignore */ } finally {
            setTesting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const activeCount = connections.filter(c => c.status === 'active').length;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Channel Connections
                </h1>
                <p>Connect your team channels — AI agents respond directly in Slack, Discord, and more</p>
            </div>

            {connections.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Active Connections
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            {activeCount}
                        </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {connections.map(conn => (
                            <ActiveConnectionCard
                                key={conn.id}
                                connection={conn}
                                testing={testing}
                                onTest={handleTest}
                                onDisconnect={handleDisconnect}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Connect a Channel</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {CHANNEL_TYPES.map(type => (
                        <ChannelTypeCard
                            key={type.id}
                            type={type}
                            colors={colorMap[type.color]}
                            isConnected={connections.some(c => c.channel_type === type.id && c.status === 'active')}
                            isExpanded={showConnect === type.id}
                            connectingType={connectingType}
                            configInput={configInput}
                            onConfigInputChange={setConfigInput}
                            onConnect={handleConnect}
                            onExpand={setShowConnect}
                            onCollapse={() => { setShowConnect(null); setConfigInput(''); }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
