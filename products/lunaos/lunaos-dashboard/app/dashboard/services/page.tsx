'use client';

import { type ServiceHealth } from '../../../lib/api';
import { ServiceCard } from './ServiceCard';
import { QuickActions } from './QuickActions';
import { useServicesData } from './useServicesData';

export default function ServicesHubPage() {
    const { catalog, health, loading, testing, testResults, handleTest } =
        useServicesData();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-neutral-400 text-sm">Loading Services Hub...</p>
                </div>
            </div>
        );
    }

    const services = catalog?.services || [];
    const coreServices = services.filter((s) => s.tier === 'core');
    const integrationServices = services.filter((s) => s.tier === 'integration');
    const activeCount = services.filter((s) => s.status === 'active').length;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Services Hub
                </h1>
                <p>Manage all OpenClaw-powered services from one place</p>
            </div>

            <HealthBanner health={health} activeCount={activeCount} totalCount={services.length} />

            <StatsRow
                totalCount={services.length}
                activeCount={activeCount}
                coreCount={catalog?.byTier.core || 0}
                integrationCount={catalog?.byTier.integration || 0}
            />

            <ServiceSection title="Core Services" badgeClass="bg-violet-500/15 text-violet-400 border-violet-500/25" services={coreServices}>
                {coreServices.map((service) => (
                    <ServiceCard
                        key={service.id}
                        service={service}
                        testing={testing === service.id}
                        testResult={testResults[service.id]}
                        onTest={() => handleTest(service.id)}
                    />
                ))}
            </ServiceSection>

            <ServiceSection title="Integrations" badgeClass="bg-sky-500/15 text-sky-400 border-sky-500/25" services={integrationServices}>
                {integrationServices.map((service) => (
                    <ServiceCard
                        key={service.id}
                        service={service}
                        testing={testing === service.id}
                        testResult={testResults[service.id]}
                        onTest={() => handleTest(service.id)}
                    />
                ))}
            </ServiceSection>

            <QuickActions />
        </div>
    );
}

function HealthBanner({
    health,
    activeCount,
    totalCount,
}: {
    health: ServiceHealth | null;
    activeCount: number;
    totalCount: number;
}) {
    const dotColor =
        health?.status === 'healthy'
            ? 'bg-emerald-400 shadow-lg shadow-emerald-400/30'
            : health?.status === 'degraded'
                ? 'bg-amber-400 shadow-lg shadow-amber-400/30'
                : 'bg-neutral-500';

    const label =
        health?.status === 'healthy'
            ? 'All Systems Operational'
            : health?.status === 'degraded'
                ? 'Degraded Performance'
                : 'Checking...';

    return (
        <div className="neon-card p-5 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${dotColor} animate-pulse`} />
                    <div>
                        <h2 className="text-base font-semibold text-white">System Status: {label}</h2>
                        <p className="text-sm text-neutral-400">
                            {activeCount}/{totalCount} services active &middot; {health?.latency || '--'} latency
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {health?.checks &&
                        Object.entries(health.checks).map(([key, check]) => (
                            <div
                                key={key}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${check.ok
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}
                            >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${check.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                {key}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

function StatsRow({
    totalCount,
    activeCount,
    coreCount,
    integrationCount,
}: {
    totalCount: number;
    activeCount: number;
    coreCount: number;
    integrationCount: number;
}) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="neon-card stat-card">
                <div className="stat-label">Total Services</div>
                <div className="stat-value">{totalCount}</div>
                <div className="stat-sub">powered by OpenClaw</div>
            </div>
            <div className="neon-card stat-card">
                <div className="stat-label">Active</div>
                <div className="stat-value text-emerald-400">{activeCount}</div>
                <div className="stat-sub">configured &amp; running</div>
            </div>
            <div className="neon-card stat-card">
                <div className="stat-label">Core</div>
                <div className="stat-value">{coreCount}</div>
                <div className="stat-sub">agents, chains, RAG, analytics</div>
            </div>
            <div className="neon-card stat-card">
                <div className="stat-label">Integrations</div>
                <div className="stat-value">{integrationCount}</div>
                <div className="stat-sub">channels, gateways, bridge</div>
            </div>
        </div>
    );
}

function ServiceSection({
    title,
    badgeClass,
    services,
    children,
}: {
    title: string;
    badgeClass: string;
    services: { id: string }[];
    children: React.ReactNode;
}) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                    {services.length}
                </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {children}
            </div>
        </div>
    );
}

