'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    telemetryApi,
    billingApi,
    type OverviewMetrics,
    type AgentStats,
    type ProviderStats,
    type Usage,
} from '@/lib/api';
import { sinceFromRange, type TimeRange } from './analytics-utils';

export interface AnalyticsData {
    overview: OverviewMetrics | null;
    agents: AgentStats[];
    providers: ProviderStats[];
    usage: Usage | null;
    range: TimeRange;
    setRange: (r: TimeRange) => void;
    loading: boolean;
}

export function useAnalyticsData(): AnalyticsData {
    const [overview, setOverview] = useState<OverviewMetrics | null>(null);
    const [agents, setAgents] = useState<AgentStats[]>([]);
    const [providers, setProviders] = useState<ProviderStats[]>([]);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [range, setRange] = useState<TimeRange>('7d');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        const since = sinceFromRange(range);
        try {
            const [ov, ag, pr, us] = await Promise.all([
                telemetryApi.overview(since).catch(() => null),
                telemetryApi.agents(since).catch(() => [] as AgentStats[]),
                telemetryApi.providers(since).catch(() => [] as ProviderStats[]),
                billingApi.usage().catch(() => null),
            ]);
            setOverview(ov);
            setAgents(ag);
            setProviders(pr);
            setUsage(us);
        } catch {
            // best effort
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { loadData(); }, [loadData]);

    return { overview, agents, providers, usage, range, setRange, loading };
}
