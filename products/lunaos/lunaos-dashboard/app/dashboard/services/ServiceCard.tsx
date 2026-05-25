'use client';

import Link from 'next/link';
import { type ServiceInfo } from '../../../lib/api';
import { statusColors, statusDot, tierStyle, serviceRoutes } from './services-constants';
import { type TestResult } from './useServicesData';

interface ServiceCardProps {
    service: ServiceInfo;
    testing: boolean;
    testResult?: TestResult;
    onTest: () => void;
}

export function ServiceCard({ service, testing, testResult, onTest }: ServiceCardProps) {
    const route = serviceRoutes[service.id] || '/dashboard/services';

    return (
        <div className="neon-card group hover:border-violet-500/20 transition-all duration-300">
            <div className="p-5">
                <ServiceCardHeader service={service} />

                <p className="text-xs text-neutral-400 mb-3 line-clamp-2">
                    {service.description}
                </p>

                <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-4">
                    <p className="text-xs text-neutral-300 font-medium">{service.quickInfo}</p>
                </div>

                {testResult && (
                    <div className={`px-3 py-2 rounded-lg mb-3 text-xs font-medium border ${testResult.healthy
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        {testResult.healthy ? '\u2713 Healthy' : '\u2717 Issue detected'} &middot; {testResult.latency}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <Link
                        href={route}
                        className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 hover:border-violet-500/30 transition-all"
                    >
                        {service.status === 'inactive' ? 'Configure' : 'Manage'}
                    </Link>
                    <button
                        onClick={onTest}
                        disabled={testing}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.03] text-neutral-400 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
                    >
                        {testing ? (
                            <span className="inline-block w-3 h-3 border border-neutral-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            'Test'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ServiceCardHeader({ service }: { service: ServiceInfo }) {
    return (
        <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
                <span className="text-2xl group-hover:scale-110 transition-transform duration-300">
                    {service.icon}
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-violet-200 transition-colors">
                        {service.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${tierStyle[service.tier]}`}>
                        {service.tier}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDot[service.status]} ${service.status === 'active' ? 'animate-pulse' : ''}`} />
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusColors[service.status]}`}>
                    {service.status}
                </span>
            </div>
        </div>
    );
}
