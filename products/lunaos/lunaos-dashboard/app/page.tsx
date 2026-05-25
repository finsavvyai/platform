'use client';

import Link from 'next/link';
import { CursorTracker, Counter, features, stats } from './landing-components';

export default function LandingPage() {
    return (
        <div className="min-h-screen">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/[0.06]">
                <div className="container flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2 text-lg font-bold">
                        <span>🌙</span>
                        <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                            LunaOS
                        </span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <a href="https://docs.lunaos.ai" className="nav-link hidden sm:block">Docs</a>
                        <a href="https://github.com/lunaos-ai" className="nav-link hidden sm:block">GitHub</a>
                        <Link href="/auth/login" className="nav-link">Login</Link>
                        <Link href="/auth/signup" className="btn btn-primary btn-sm">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-violet-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
                <div className="container text-center relative">
                    <div className="mb-8 animate-fade-in">
                        <CursorTracker />
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6 animate-fade-in-up">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span>28 AI agents · Now in beta</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold leading-tight text-balance mb-6 animate-fade-in-up delay-100">
                        <span className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                            AI agents that watch
                        </span>
                        <br />
                        <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                            your code
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 text-balance animate-fade-in-up delay-200">
                        28 specialized AI agents for code review, testing, security, planning,
                        and more — from your CLI or browser. Like having Luna the cat 🐱
                        watching your cursor, but she&apos;s actually fixing bugs.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
                        <Link href="/auth/signup" className="btn btn-primary btn-lg">
                            Start for Free
                            <span className="text-violet-200">→</span>
                        </Link>
                        <a href="https://docs.lunaos.ai" className="btn btn-secondary btn-lg">
                            Read the Docs
                        </a>
                    </div>
                    <div className="mt-16 max-w-2xl mx-auto animate-fade-in-up delay-400">
                        <div className="neon-card overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500/60" />
                                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                                <span className="w-3 h-3 rounded-full bg-green-500/60" />
                                <span className="ml-3 text-xs text-neutral-600 font-mono">terminal</span>
                            </div>
                            <div className="p-6 font-mono text-sm">
                                <p className="text-neutral-400">$ npx luna-agents run code-review .</p>
                                <p className="mt-2 text-neutral-400">
                                    <span className="text-violet-400">🌙 LunaOS</span> · code-review agent · deepseek-chat
                                </p>
                                <p className="mt-1 text-emerald-400/80">✓ Scanning 47 files...</p>
                                <p className="mt-1 text-neutral-300">Found 3 issues: 1 critical, 2 suggestions</p>
                                <p className="mt-3 text-yellow-400/80">⚠ Critical: SQL injection in auth.ts:42</p>
                                <p className="text-neutral-400 text-xs mt-1 ml-4">
                                    Unsanitized user input passed to SQL query. Use parameterized queries instead.
                                </p>
                                <p className="mt-2 text-neutral-400">
                                    <span className="text-neutral-600">───</span>{' '}
                                    <span className="text-emerald-400">Review complete in 3.2s</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-12 border-y border-white/[0.04]">
                <div className="container">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map(stat => (
                            <div key={stat.label} className="text-center">
                                <div className="text-3xl md:text-4xl font-bold text-white">
                                    <Counter target={stat.value} suffix={stat.suffix} />
                                </div>
                                <div className="text-sm text-neutral-400 mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="section">
                <div className="container">
                    <div className="section-header">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Every stage of development, covered
                        </h2>
                        <p className="text-neutral-400 text-lg">
                            Specialized AI agents built for real engineering workflows — not generic chatbots.
                        </p>
                    </div>
                    <div className="grid grid-2 lg:grid-3 gap-6">
                        {features.map(feature => (
                            <div key={feature.title} className="neon-card feature-card">
                                <div className="feature-icon">
                                    <span className="text-xl">{feature.icon}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                                <p className="text-neutral-400 text-sm leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Luna's Story */}
            <section className="section border-t border-white/[0.04]">
                <div className="container text-center max-w-2xl mx-auto">
                    <div className="text-5xl mb-6">🐱</div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                        Why &quot;Luna&quot;?
                    </h2>
                    <p className="text-neutral-400 leading-relaxed text-lg">
                        LunaOS is named after Luna — a one-eyed cat adopted at 2 months old.
                        After receiving medical treatment, she found her forever home with a developer
                        who takes care of her. Luna loves sitting close while code is being written,
                        and she traces the mouse cursor across the screen.
                    </p>
                    <p className="text-neutral-400 mt-4 text-base italic">
                        An AI that watches your code — just like Luna watches the cursor.
                    </p>
                </div>
            </section>

            {/* CTA */}
            <section className="section">
                <div className="container text-center">
                    <div className="neon-card p-12 max-w-3xl mx-auto bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                            Ready to let Luna watch your code?
                        </h2>
                        <p className="text-neutral-400 mb-8 max-w-lg mx-auto">
                            Free tier: Unlimited commands. No credit card required.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/auth/signup" className="btn btn-primary btn-lg">
                                Create Free Account
                            </Link>
                            <code className="px-4 py-2.5 bg-black/40 rounded-xl border border-white/[0.06] text-sm text-violet-400 font-mono whitespace-nowrap">
                                npx luna-agents run code-review
                            </code>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/[0.04] py-8">
                <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-400">
                    <div className="flex items-center gap-2">
                        <span>🌙</span>
                        <span>LunaOS © 2026</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <a href="https://docs.lunaos.ai" className="hover:text-neutral-300 transition-colors">Docs</a>
                        <a href="https://github.com/lunaos-ai" className="hover:text-neutral-300 transition-colors">GitHub</a>
                        <a href="mailto:hello@lunaos.ai" className="hover:text-neutral-300 transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
