/**
 * /admin/sso/[id] — Edit or delete an identity provider.
 * Client component: pre-fills form, supports enable toggle and name-confirmation delete.
 *
 * SECURITY (FIND-005): Authenticates via the HttpOnly `sso_session` cookie.
 * The parent server-component layout (`app/admin/sso/layout.tsx`) gates access
 * via `cookies().get('sso_session')`. Client-side `ssoApi.*` calls use
 * `credentials: 'include'` (no Bearer header). On 401, redirect to /login.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { ssoApi, type IdentityProvider } from '@/lib/api/sso';
import { idpEditSchema, type IdpFormValues } from '@/lib/sso-schema';
import { IdpForm } from '@/components/sso/IdpForm';
import { DeleteConfirmModal } from '@/components/sso/DeleteConfirmModal';
import { EnableToggle } from '@/components/sso/EnableToggle';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui';

export default function EditSsoProviderPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();

    const [idp, setIdp] = useState<IdentityProvider | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [togglingEnabled, setTogglingEnabled] = useState(false);

    const methods = useForm<IdpFormValues>({
        resolver: zodResolver(idpEditSchema),
        defaultValues: {
            name: '', type: 'oidc', emailDomain: '',
            defaultRole: 'member', jitEnabled: true,
            oidcScopes: 'openid email profile',
        },
    });

    const { handleSubmit, reset, setError, formState: { isSubmitting } } = methods;

    useEffect(() => {
        if (!id) return;
        ssoApi.get(id)
            .then(({ idp: data }) => {
                setIdp(data);
                reset({
                    name: data.name, type: data.type,
                    emailDomain: data.emailDomain, defaultRole: data.defaultRole,
                    jitEnabled: data.jitEnabled,
                    oidcIssuer: data.oidcIssuer ?? '',
                    oidcClientId: data.oidcClientId ?? '',
                    oidcClientSecret: '',
                    oidcDiscoveryUrl: data.oidcDiscoveryUrl ?? '',
                    oidcScopes: data.oidcScopes ?? 'openid email profile',
                    samlEntityId: data.samlEntityId ?? '',
                    samlSsoUrl: data.samlSsoUrl ?? '',
                    samlCertificate: '',
                    samlSloUrl: data.samlSloUrl ?? '',
                });
            })
            .catch((err: unknown) => {
                const e = err as { status?: number };
                if (e?.status === 401) { router.push('/login'); return; }
                if (e?.status === 403) { router.push('/403'); return; }
                setLoadError('Could not load provider. Please try again.');
            });
    }, [id, reset, router]);

    async function onSubmit(values: IdpFormValues) {
        if (!id) return;
        setServerError(null);
        const payload = { ...values };
        if (!payload.oidcClientSecret) delete payload.oidcClientSecret;
        if (!payload.samlCertificate) delete payload.samlCertificate;
        try {
            await ssoApi.update(id, payload);
            router.push('/admin/sso');
        } catch (err: unknown) {
            const e = err as { data?: Record<string, string[]>; message?: string };
            if (e?.data && typeof e.data === 'object') {
                for (const [field, msgs] of Object.entries(e.data)) {
                    setError(field as keyof IdpFormValues, { message: Array.isArray(msgs) ? msgs[0] : String(msgs) });
                }
            } else {
                setServerError(e?.message ?? 'Something went wrong. Please try again.');
            }
        }
    }

    async function handleToggleEnabled() {
        if (!id || !idp) return;
        setTogglingEnabled(true);
        try {
            const { idp: updated } = await ssoApi.update(id, { enabled: !idp.enabled });
            setIdp(updated);
        } catch {
            setServerError('Failed to toggle provider status.');
        } finally {
            setTogglingEnabled(false);
        }
    }

    async function handleDelete() {
        if (!id) return;
        setDeleting(true);
        try {
            await ssoApi.remove(id);
            setShowDelete(false);
            router.push('/admin/sso');
        } catch {
            setDeleting(false);
            setServerError('Failed to delete provider. Please try again.');
        }
    }

    if (loadError) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-6">
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400" role="alert">{loadError}</div>
            </div>
        );
    }

    if (!idp) {
        return <div className="max-w-3xl mx-auto py-20 flex justify-center"><Spinner size="lg" /></div>;
    }

    return (
        <div className="max-w-3xl mx-auto py-12 px-6">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <Link href="/admin/sso" className="text-sm text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
                        ← Back to SSO
                    </Link>
                    <h1 className="mt-3 text-2xl font-bold text-white">{idp.name}</h1>
                    <p className="mt-1 text-sm text-neutral-400">Edit provider settings below.</p>
                </div>
                <EnableToggle enabled={idp.enabled} isLoading={togglingEnabled} onToggle={handleToggleEnabled} />
            </div>

            {serverError && (
                <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400" role="alert" aria-live="polite">
                    {serverError}
                </div>
            )}

            <FormProvider {...methods}>
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
                    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
                        <IdpForm isEditing />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <Button
                            type="button" variant="ghost" size="md"
                            onClick={() => setShowDelete(true)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            aria-label="Delete identity provider"
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                            Delete provider
                        </Button>
                        <div className="flex items-center gap-3">
                            <Link href="/admin/sso" className="text-sm text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
                                Cancel
                            </Link>
                            <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
                                Save changes
                            </Button>
                        </div>
                    </div>
                </form>
            </FormProvider>

            {showDelete && (
                <DeleteConfirmModal
                    providerName={idp.name}
                    isLoading={deleting}
                    onConfirm={handleDelete}
                    onClose={() => setShowDelete(false)}
                />
            )}
        </div>
    );
}
