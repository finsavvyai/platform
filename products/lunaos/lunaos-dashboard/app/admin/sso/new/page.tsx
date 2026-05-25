/**
 * /admin/sso/new — Create a new identity provider.
 * Client component: react-hook-form + Zod resolver (both in deps).
 *
 * SECURITY (FIND-005): Auth via HttpOnly `sso_session` cookie. Parent layout
 * (`app/admin/sso/layout.tsx`) gates access server-side. The client-side
 * `ssoApi.create` POST uses `credentials: 'include'` and does NOT attach a
 * Bearer header.
 */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ssoApi } from '@/lib/api/sso';
import { idpFormSchema, type IdpFormValues } from '@/lib/sso-schema';
import { IdpForm } from '@/components/sso/IdpForm';
import { Button } from '@/components/ui/button';

export default function NewSsoProviderPage() {
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);

    const methods = useForm<IdpFormValues>({
        resolver: zodResolver(idpFormSchema),
        defaultValues: {
            name: '',
            type: 'oidc',
            emailDomain: '',
            defaultRole: 'member',
            jitEnabled: true,
            oidcScopes: 'openid email profile',
        },
    });

    const {
        handleSubmit,
        setError,
        formState: { isSubmitting },
    } = methods;

    async function onSubmit(values: IdpFormValues) {
        setServerError(null);
        try {
            await ssoApi.create(values);
            router.push('/admin/sso');
        } catch (err: unknown) {
            const e = err as { data?: Record<string, string[]>; message?: string };
            if (e?.data && typeof e.data === 'object') {
                // Map field-level errors from server response
                for (const [field, msgs] of Object.entries(e.data)) {
                    const msg = Array.isArray(msgs) ? msgs[0] : String(msgs);
                    setError(field as keyof IdpFormValues, { message: msg });
                }
            } else {
                setServerError(e?.message ?? 'Something went wrong. Please try again.');
            }
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-12 px-6">
            {/* Page header */}
            <div className="mb-8">
                <Link
                    href="/admin/sso"
                    className="text-sm text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                    ← Back to SSO
                </Link>
                <h1 className="mt-3 text-2xl font-bold text-white">Add identity provider</h1>
                <p className="mt-1 text-sm text-neutral-400">
                    Connect Okta, Azure AD, Google Workspace, or any SAML/OIDC provider.
                </p>
            </div>

            {/* Server-level error */}
            {serverError && (
                <div
                    className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400"
                    role="alert"
                    aria-live="polite"
                >
                    {serverError}
                </div>
            )}

            {/* Form */}
            <FormProvider {...methods}>
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="space-y-8"
                >
                    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6">
                        <IdpForm isEditing={false} />
                    </div>

                    {/* Actions — one primary action per HIG */}
                    <div className="flex items-center justify-between pt-2">
                        <Link
                            href="/admin/sso"
                            className="text-sm text-neutral-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                        >
                            Cancel
                        </Link>
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            isLoading={isSubmitting}
                        >
                            Create provider
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </div>
    );
}
