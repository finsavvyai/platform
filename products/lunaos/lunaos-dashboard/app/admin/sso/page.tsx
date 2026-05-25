/**
 * /admin/sso — IdP list page (client component for static export).
 *
 * SECURITY: Auth enforced by the engine API via the HttpOnly `sso_session`
 * cookie. Client calls `ssoApi.list()` with credentials: 'include'.
 * On 401/403 the user is redirected to /login or /403.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Plus } from 'lucide-react';
import { ssoApi, type IdentityProvider } from '@/lib/api/sso';
import { formatRelativeTime } from '@/lib/utils';
import { IdpTypeBadge } from '@/components/sso/IdpTypeBadge';
import { Spinner } from '@/components/ui';

export default function SsoAdminPage() {
    const router = useRouter();
    const [idps, setIdps] = useState<IdentityProvider[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        ssoApi.list()
            .then(({ idps: list }) => setIdps(list))
            .catch((err: unknown) => {
                const e = err as { status?: number };
                if (e?.status === 401) { router.push('/login'); return; }
                if (e?.status === 403) { router.push('/403'); return; }
                setLoadError('Could not load identity providers. Please try again.');
            });
    }, [router]);

    if (loadError) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-6">
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400" role="alert">{loadError}</div>
            </div>
        );
    }

    if (!idps) {
        return <div className="max-w-3xl mx-auto py-20 flex justify-center"><Spinner size="lg" /></div>;
    }

    return (
        <div className="max-w-3xl mx-auto py-12 px-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Single Sign-On</h1>
                    <p className="mt-1 text-neutral-400 text-sm">
                        Configure identity providers for your organisation.
                    </p>
                </div>
                <Link
                    href="/admin/sso/new"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-primary-600 to-accent-500 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add provider
                </Link>
            </div>

            {idps.length === 0 ? <EmptyState /> : <IdpTable idps={idps} />}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary-500/10 mb-4">
                <KeyRound className="h-8 w-8 text-primary-400" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
                Connect an identity provider
            </h2>
            <p className="text-sm text-neutral-400 max-w-sm mb-6">
                Set up Okta, Azure AD, Google Workspace, or any SAML/OIDC IdP to enable Single
                Sign-On for your team.
            </p>
            <Link
                href="/admin/sso/new"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-primary-600 to-accent-500 text-white text-sm font-semibold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add provider
            </Link>
        </div>
    );
}

function IdpTable({ idps }: { idps: IdentityProvider[] }) {
    return (
        <div className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
            <table className="w-full text-sm" role="table" aria-label="Identity providers">
                <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                        {['Name', 'Type', 'Email Domain', 'Status', 'Created'].map((h) => (
                            <th
                                key={h}
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {idps.map((idp, i) => (
                        <tr
                            key={idp.id}
                            className={`group transition-colors hover:bg-white/[0.04] cursor-pointer ${i !== 0 ? 'border-t border-white/5' : ''}`}
                        >
                            <td className="px-4 py-3">
                                <Link
                                    href={`/admin/sso/${idp.id}`}
                                    className="font-medium text-white group-hover:text-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                                    aria-label={`Edit ${idp.name}`}
                                >
                                    {idp.name}
                                </Link>
                            </td>
                            <td className="px-4 py-3">
                                <IdpTypeBadge type={idp.type} />
                            </td>
                            <td className="px-4 py-3 text-neutral-400 font-mono text-xs">
                                {idp.emailDomain}
                            </td>
                            <td className="px-4 py-3">
                                <EnabledChip enabled={idp.enabled} />
                            </td>
                            <td className="px-4 py-3 text-neutral-500 text-xs">
                                {formatRelativeTime(idp.createdAt)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EnabledChip({ enabled }: { enabled: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${enabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                }`}
            aria-label={enabled ? 'Enabled' : 'Disabled'}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-green-400' : 'bg-neutral-500'}`} aria-hidden="true" />
            {enabled ? 'Enabled' : 'Disabled'}
        </span>
    );
}
