'use client';

import { useEffect, useState, useCallback } from 'react';
import { servicesApi, type ProviderInfo } from '../../../../lib/api';

export default function ProvidersPage() {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [defaultProvider, setDefaultProvider] = useState('none');
    const [loading, setLoading] = useState(true);

    const fetchProviders = useCallback(async () => {
        try {
            const data = await servicesApi.providers().catch(() => ({
                providers: [],
                defaultProvider: 'none',
            }));
            setProviders(data.providers || []);
            setDefaultProvider(data.defaultProvider || 'none');
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProviders();
    }, [fetchProviders]);

    const providerColors: Record<string, { gradient: string; border: string; bg: string; icon: string }> = {
        deepseek: { gradient: 'from-blue-500 to-cyan-400', border: 'border-blue-500/25', bg: 'bg-blue-500/5', icon: '🔷' },
        anthropic: { gradient: 'from-orange-500 to-amber-400', border: 'border-orange-500/25', bg: 'bg-orange-500/5', icon: '🟠' },
        openai: { gradient: 'from-emerald-500 to-green-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/5', icon: '🟢' },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const configuredCount = providers.filter(p => p.configured).length;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    LLM Providers
                </h1>
                <p>Configure AI model providers powering your agents</p>
            </div>

            {/* Status Banner */}
            <div className="neon-card p-5 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">🧠</span>
                        <div>
                            <h2 className="text-base font-semibold text-white">
                                {configuredCount}/{providers.length} Providers Configured
                            </h2>
                            <p className="text-sm text-neutral-400">
                                Default: <span className="text-violet-400 font-medium">{defaultProvider}</span>
                            </p>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${configuredCount > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        {configuredCount > 0 ? '✓ Ready' : '✗ No Providers'}
                    </div>
                </div>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {providers.map(provider => {
                    const colors = providerColors[provider.id] || providerColors.deepseek;
                    const isDefault = provider.id === defaultProvider;

                    return (
                        <div key={provider.id} className={`neon-card ${colors.border} transition-all duration-300 hover:border-violet-500/30`}>
                            <div className="p-6">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{colors.icon}</span>
                                        <div>
                                            <h3 className="text-base font-semibold text-white">{provider.name}</h3>
                                            <code className="text-xs text-neutral-500 font-mono">{provider.model}</code>
                                        </div>
                                    </div>
                                    {isDefault && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-violet-500/20 text-violet-400 border border-violet-500/30">
                                            DEFAULT
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                <p className="text-xs text-neutral-400 mb-4">{provider.description}</p>

                                {/* Status */}
                                <div className={`p-3 rounded-lg mb-4 ${colors.bg} border ${colors.border}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${provider.configured ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                                            }`} />
                                        <span className={`text-sm font-medium ${provider.configured ? 'text-emerald-400' : 'text-neutral-500'
                                            }`}>
                                            {provider.configured ? 'API Key Configured' : 'Not Configured'}
                                        </span>
                                    </div>
                                </div>

                                {/* Endpoint */}
                                <div className="text-xs text-neutral-500 font-mono truncate">
                                    {provider.endpoint}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info */}
            <div className="neon-card p-6 mt-8">
                <h3 className="text-base font-semibold text-white mb-3">How to Configure</h3>
                <div className="space-y-3 text-sm text-neutral-400">
                    <p>LLM provider API keys are configured in your OpenClaw service environment:</p>
                    <div className="p-4 rounded-lg bg-black/30 border border-white/[0.06]">
                        <code className="text-xs text-violet-400 font-mono block space-y-1">
                            <span className="block">DEEPSEEK_API_KEY=sk-...</span>
                            <span className="block">ANTHROPIC_API_KEY=sk-ant-...</span>
                            <span className="block">OPENAI_API_KEY=sk-...</span>
                        </code>
                    </div>
                    <p className="text-xs text-neutral-500">
                        Set these as Cloudflare Worker secrets via <code className="text-violet-400">wrangler secret put</code> or in the Cloudflare dashboard.
                    </p>
                </div>
            </div>
        </div>
    );
}
