/**
 * /login — Email-first SSO discovery.
 * Step 1: enter email + Continue.
 * - SSO found → POST initiate, redirect to IdP.
 * - SSO not found (404) → fall through to existing password form inline.
 * The existing form at /auth/login is preserved as canonical; this page
 * augments with SSO discovery before falling back to password auth.
 */
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Moon } from 'lucide-react';
import { ssoApi } from '@/lib/api/sso';
import { authApi } from '@/lib/api';
import { OAuthButtons, OAuthDivider } from '@/components/auth/OAuthButtons';
import { SsoRedirectingState } from '@/components/auth/SsoRedirectingState';

type Step = 'email' | 'password' | 'redirecting';

async function handleSsoInitiate(idpId: string, type: 'saml' | 'oidc') {
    const result = type === 'oidc'
        ? await ssoApi.initiateOidc(idpId)
        : await ssoApi.initiateSaml(idpId);

    if (result.method === 'POST' && result.url && result.params) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.url;
        Object.entries(result.params).forEach(([k, v]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = k;
            input.value = v;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    } else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
    }
}

export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const passwordRef = useRef<HTMLInputElement>(null);

    async function handleContinue(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim()) return;
        setError('');
        setLoading(true);
        try {
            const discovery = await ssoApi.discover(email.trim());
            if (discovery) {
                setStep('redirecting');
                await handleSsoInitiate(discovery.idpId, discovery.type);
                return;
            }
            setStep('password');
            setTimeout(() => passwordRef.current?.focus(), 50);
        } catch {
            setError('Something went wrong. Please try again.');
            setStep('email');
        } finally {
            setLoading(false);
        }
    }

    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await authApi.login(email.trim(), password);
            if (result.ok) {
                router.push('/dashboard');
            } else {
                setError(result.data?.error || 'Invalid email or password');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Moon className="h-7 w-7 text-violet-400" aria-hidden="true" />
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                            LunaOS
                        </h1>
                    </div>
                    <p className="text-neutral-400 text-sm">Sign in to your account</p>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
                    {step !== 'redirecting' && <><OAuthButtons /><OAuthDivider /></>}

                    {error && (
                        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm" role="alert" aria-live="polite">
                            {error}
                        </div>
                    )}

                    {step === 'redirecting' ? <SsoRedirectingState /> : (
                        <form
                            onSubmit={step === 'password' ? handlePasswordSubmit : handleContinue}
                            className="space-y-5"
                            aria-label="Sign in form"
                            noValidate
                        >
                            <div>
                                <label htmlFor="login-email" className="block text-sm font-medium text-neutral-300 mb-1.5">
                                    Work email
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required autoFocus autoComplete="email"
                                    className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                                    placeholder="you@company.com"
                                />
                            </div>

                            {step === 'password' && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label htmlFor="login-password" className="block text-sm font-medium text-neutral-300">Password</label>
                                        <Link href="/auth/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <input
                                        id="login-password" ref={passwordRef}
                                        type="password" value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required minLength={8} autoComplete="current-password"
                                        className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !email.trim()}
                                className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                        {step === 'password' ? 'Signing in…' : 'Checking…'}
                                    </span>
                                ) : step === 'password' ? 'Sign In' : 'Continue'}
                            </button>

                            {step === 'password' && (
                                <button
                                    type="button"
                                    onClick={() => { setStep('email'); setError(''); setPassword(''); }}
                                    className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                                >
                                    ← Use a different email
                                </button>
                            )}
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <p className="text-neutral-400 text-sm">
                            Don&apos;t have an account?{' '}
                            <Link href="/auth/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
                                Sign Up
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-neutral-500 text-xs">Or use the CLI:{' '}
                        <code className="bg-neutral-800 px-2 py-0.5 rounded text-violet-400">luna init --cloud</code></p>
                </div>
            </div>
        </div>
    );
}
