/**
 * IdpForm — shared form fields used by both /admin/sso/new and /admin/sso/[id].
 * Relies on react-hook-form (present in deps) + Zod resolver.
 */
'use client';

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { IdpFormValues } from '@/lib/sso-schema';

interface IdpFormProps {
    /** If true, secret fields render as masked read-only with placeholder hint */
    isEditing?: boolean;
}

export function IdpForm({ isEditing = false }: IdpFormProps) {
    const {
        register,
        control,
        watch,
        formState: { errors },
    } = useFormContext<IdpFormValues>();

    const type = watch('type');

    return (
        <div className="space-y-6">
            {/* Name */}
            <Input
                label="Provider name"
                placeholder="e.g. Okta Production"
                error={errors.name?.message}
                aria-describedby={errors.name ? 'name-error' : undefined}
                aria-invalid={!!errors.name}
                {...register('name')}
            />

            {/* Type radio */}
            <fieldset>
                <legend className="block text-sm font-medium text-neutral-300 mb-2">
                    Provider type
                </legend>
                <div className="flex gap-4" role="radiogroup">
                    {(['saml', 'oidc'] as const).map((t) => (
                        <label
                            key={t}
                            className="flex items-center gap-2 cursor-pointer text-sm text-neutral-300"
                        >
                            <input
                                type="radio"
                                value={t}
                                {...register('type')}
                                className="accent-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500"
                            />
                            <span className="uppercase font-semibold tracking-wide">{t}</span>
                        </label>
                    ))}
                </div>
                {errors.type && (
                    <p className="mt-1.5 text-sm text-red-400" role="alert">{errors.type.message}</p>
                )}
            </fieldset>

            {/* Email domain */}
            <Input
                label="Email domain"
                placeholder="acme.com"
                hint="Users with this email domain will be redirected to SSO."
                error={errors.emailDomain?.message}
                aria-describedby={errors.emailDomain ? 'emailDomain-error' : 'emailDomain-hint'}
                aria-invalid={!!errors.emailDomain}
                {...register('emailDomain')}
            />

            {/* Default role */}
            <div>
                <label
                    htmlFor="defaultRole"
                    className="block text-sm font-medium text-neutral-300 mb-1.5"
                >
                    Default role for JIT-provisioned users
                </label>
                <select
                    id="defaultRole"
                    {...register('defaultRole')}
                    className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            {/* JIT toggle */}
            <Controller
                name="jitEnabled"
                control={control}
                render={({ field }) => (
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <span className="text-sm font-medium text-neutral-300">Just-in-time provisioning</span>
                            <p className="text-xs text-neutral-500 mt-0.5">
                                Automatically create accounts on first SSO login.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={field.value}
                            onClick={() => field.onChange(!field.value)}
                            className={`relative h-6 w-11 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none ${field.value ? 'bg-primary-600' : 'bg-neutral-700'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </label>
                )}
            />

            {/* OIDC conditional fields */}
            {type === 'oidc' && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">OIDC Configuration</p>
                    <Input label="Issuer URL" placeholder="https://accounts.google.com" error={errors.oidcIssuer?.message} aria-invalid={!!errors.oidcIssuer} {...register('oidcIssuer')} />
                    <Input label="Client ID" placeholder="client_id" error={errors.oidcClientId?.message} aria-invalid={!!errors.oidcClientId} {...register('oidcClientId')} />
                    <Input
                        label={isEditing ? 'Client Secret (leave empty to keep current)' : 'Client Secret'}
                        type="password"
                        placeholder={isEditing ? '••••XXXX' : 'client_secret'}
                        error={errors.oidcClientSecret?.message}
                        aria-invalid={!!errors.oidcClientSecret}
                        {...register('oidcClientSecret')}
                    />
                    <Input label="Discovery URL" placeholder="https://accounts.google.com/.well-known/openid-configuration" error={errors.oidcDiscoveryUrl?.message} aria-invalid={!!errors.oidcDiscoveryUrl} {...register('oidcDiscoveryUrl')} />
                    <Input label="Scopes" placeholder="openid email profile" hint="Space-separated OAuth scopes." error={errors.oidcScopes?.message} aria-invalid={!!errors.oidcScopes} {...register('oidcScopes')} />
                </div>
            )}

            {/* SAML conditional fields */}
            {type === 'saml' && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">SAML Configuration</p>
                    <Input label="Entity ID" placeholder="https://app.lunaos.ai/saml/metadata" error={errors.samlEntityId?.message} aria-invalid={!!errors.samlEntityId} {...register('samlEntityId')} />
                    <Input label="SSO URL" placeholder="https://idp.example.com/sso/saml" error={errors.samlSsoUrl?.message} aria-invalid={!!errors.samlSsoUrl} {...register('samlSsoUrl')} />
                    <div>
                        <label htmlFor="samlCertificate" className="block text-sm font-medium text-neutral-300 mb-1.5">
                            {isEditing ? 'X.509 Certificate (leave empty to keep current)' : 'X.509 Certificate'}
                        </label>
                        <textarea
                            id="samlCertificate"
                            rows={5}
                            placeholder={isEditing ? '••••XXXX' : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                            aria-invalid={!!errors.samlCertificate}
                            aria-describedby={errors.samlCertificate ? 'samlCert-error' : undefined}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-y"
                            {...register('samlCertificate')}
                        />
                        {errors.samlCertificate && (
                            <p id="samlCert-error" className="mt-1.5 text-sm text-red-400" role="alert">{errors.samlCertificate.message}</p>
                        )}
                        <p className="mt-1 text-xs text-neutral-500">PEM format, including header/footer lines.</p>
                    </div>
                    <Input label="SLO URL (optional)" placeholder="https://idp.example.com/slo/saml" error={errors.samlSloUrl?.message} aria-invalid={!!errors.samlSloUrl} {...register('samlSloUrl')} />
                </div>
            )}
        </div>
    );
}
