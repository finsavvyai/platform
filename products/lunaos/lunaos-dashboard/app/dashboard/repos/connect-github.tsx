'use client';

import { GitHubIcon } from './github-icon';

interface ConnectGitHubProps {
    connecting: boolean;
    onConnect: () => void;
}

export function ConnectGitHub({ connecting, onConnect }: ConnectGitHubProps) {
    return (
        <div className="neon-card p-12 text-center">
            <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center mx-auto mb-6">
                    <GitHubIcon size={32} className="text-neutral-300" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Connect GitHub</h2>
                <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                    Link your GitHub account to let LunaOS agents understand your codebase.
                    We&apos;ll index your code so agents like Code Review, Testing, and Security
                    can give you context-aware results.
                </p>
                <button
                    onClick={onConnect}
                    disabled={connecting}
                    className="btn btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2"
                >
                    {connecting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Redirecting...
                        </>
                    ) : (
                        <>
                            <GitHubIcon size={16} />
                            Connect with GitHub
                        </>
                    )}
                </button>
                <p className="text-xs text-neutral-600 mt-4">
                    We request <code className="text-violet-400/70">read:user</code> and{' '}
                    <code className="text-violet-400/70">repo</code> scopes
                </p>
            </div>
        </div>
    );
}
