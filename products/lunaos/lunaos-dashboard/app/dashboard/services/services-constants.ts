// ---- Status badge colors ----

export const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
    partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const statusDot: Record<string, string> = {
    active: 'bg-emerald-400',
    inactive: 'bg-neutral-500',
    partial: 'bg-amber-400',
    error: 'bg-red-400',
};

// ---- Tier badge styling ----

export const tierStyle: Record<string, string> = {
    core: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    integration: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    premium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
};

// ---- Service detail routes ----

export const serviceRoutes: Record<string, string> = {
    agents: '/dashboard/agents',
    chains: '/dashboard/chains',
    rag: '/dashboard/repos',
    channels: '/dashboard/services/channels',
    gateways: '/dashboard/services/gateways',
    analytics: '/dashboard/analytics',
    providers: '/dashboard/services/providers',
    'api-keys': '/dashboard/api-keys',
    bridge: '/dashboard/services/bridge',
};
