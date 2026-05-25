'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.lunaos.ai'}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            // Always show success to prevent email enumeration
            setSent(true);
        } catch {
            setSent(true);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                        🌙 LunaOS
                    </h1>
                    <p className="mt-2 text-neutral-400">Reset your password</p>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl shadow-violet-500/5">
                    {sent ? (
                        <div className="text-center space-y-4">
                            <div className="text-4xl">📧</div>
                            <h2 className="text-lg font-semibold text-white">Check your email</h2>
                            <p className="text-neutral-400 text-sm">
                                If an account exists for <strong className="text-white">{email}</strong>,
                                we&apos;ve sent a password reset link.
                            </p>
                            <Link
                                href="/auth/login"
                                className="inline-block mt-4 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
                            >
                                Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <p className="text-neutral-400 text-sm">
                                Enter your email and we&apos;ll send you a link to reset your password.
                            </p>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1.5">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                                    placeholder="you@company.com"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>

                            <div className="text-center">
                                <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
                                    Back to sign in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
