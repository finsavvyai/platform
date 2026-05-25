'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { authApi, type User } from '../../lib/api';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { OAuthCallbackHandler } from '../../components/auth/OAuthCallbackHandler';
import {
    Zap, Bot, Link2, Sparkles, BookOpen, BarChart3, Brain,
    Package, ClipboardList, CreditCard, KeyRound, Settings,
    Palette, FileText, Moon, LogOut, ExternalLink,
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Zap },
    { href: '/dashboard/agents', label: 'Agents', icon: Bot },
    { href: '/dashboard/chains', label: 'Chains', icon: Link2 },
    { href: '/dashboard/services', label: 'Services Hub', icon: Sparkles },
    { href: '/dashboard/kb', label: 'Knowledge Base', icon: BookOpen },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/dashboard/visualizer', label: 'Visualizer', icon: Brain },
    { href: '/dashboard/repos', label: 'Repos', icon: Package },
    { href: '/dashboard/history', label: 'History', icon: ClipboardList },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { href: '/dashboard/api-keys', label: 'API Keys', icon: KeyRound },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkAuth() {
            if (!authApi.isAuthenticated()) {
                router.push('/auth/login');
                return;
            }
            try {
                const me = await authApi.me();
                if (!me) {
                    router.push('/auth/login');
                    return;
                }
                setUser(me);
            } catch {
                router.push('/auth/login');
            } finally {
                setLoading(false);
            }
        }
        checkAuth();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-neutral-400 text-sm">Loading LunaOS...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex">
            <Suspense fallback={null}>
                <OAuthCallbackHandler />
            </Suspense>
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <Moon className="w-6 h-6 text-violet-400" aria-hidden="true" />
                    <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                        LunaOS
                    </span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`sidebar-item ${pathname === item.href ||
                                    (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                                    ? 'active' : ''
                                    }`}
                            >
                                <Icon className="w-5 h-5" aria-hidden="true" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}

                    <div className="mt-6 mb-2 px-3">
                        <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                            External
                        </span>
                    </div>
                    <a
                        href="https://studio.lunaos.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar-item"
                    >
                        <Palette className="w-5 h-5" aria-hidden="true" />
                        <span>Studio</span>
                        <ExternalLink className="ml-auto w-3 h-3 text-neutral-600" aria-hidden="true" />
                    </a>
                    <a
                        href="https://docs.lunaos.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sidebar-item"
                    >
                        <FileText className="w-5 h-5" aria-hidden="true" />
                        <span>Docs</span>
                        <ExternalLink className="ml-auto w-3 h-3 text-neutral-600" aria-hidden="true" />
                    </a>
                </nav>

                <SidebarFooter user={user} router={router} />
            </aside>

            <div className="main-content">
                <ErrorBoundary>
                    {children}
                </ErrorBoundary>
            </div>
        </div>
    );
}

function SidebarFooter({ user, router }: { user: User | null; router: ReturnType<typeof useRouter> }) {
    return (
        <div className="sidebar-footer">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-200 truncate">
                        {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
                </div>
                <button
                    onClick={() => {
                        authApi.logout();
                        router.push('/auth/login');
                    }}
                    className="text-neutral-400 hover:text-neutral-300 transition-colors cursor-pointer"
                    aria-label="Logout"
                    title="Logout"
                >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <span className={`agent-tier-badge ${user?.tier || 'free'}`}>
                    {user?.tier || 'free'}
                </span>
                {user?.tier === 'free' && (
                    <Link href="/pricing" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                        Upgrade →
                    </Link>
                )}
            </div>
        </div>
    );
}
