import Link from 'next/link';
import Image from 'next/image';
import { Crosshair, Bell } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { TrustScoreIndicator } from '@/components/dashboard/TrustScoreIndicator';
import { NavigationProgress } from '@/components/dashboard/NavigationProgress';
import { Breadcrumbs } from '@/components/dashboard/Breadcrumbs';
import { redirect } from 'next/navigation';
import { SidebarNav } from './SidebarNav';
import { MobileTabBar } from './MobileTabBar';
import { AiChatWidget } from './AiChatWidget';
import { SignOutIcon } from './SignOutIcon';
import { TokenForgeBridge } from '@/components/providers/TokenForgeBridge';
import { OrgStorageBootstrap } from '@/components/dashboard/OrgStorageBootstrap';

export const dynamic = 'force-dynamic';

const PLATFORM_VERSION = '0.3.0';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user: { id?: string; email?: string | null; name?: string | null; image?: string | null } | null = null;
  let userPlan = 'free';
  let hasOrg = false;

  try {
    const session = await auth();
    if (!session?.user) {
      redirect('/sign-in');
    }
    user = session.user as { id?: string; email?: string | null; name?: string | null; image?: string | null };
    const token = await getApiToken();
    if (token) {
      const [userData, orgData] = await Promise.all([
        apiClient<{ user: { plan: string } }>('/api/user', { token }).catch(() => ({ user: { plan: 'free' } })),
        apiClient<{ organizations: unknown[] }>('/api/organizations', { token }).catch(() => ({ organizations: [] })),
      ]);
      userPlan = userData.user?.plan ?? 'free';
      hasOrg = (orgData.organizations?.length ?? 0) > 0;
    }
  } catch (err) {
    // Re-throw redirect responses (Next.js uses exceptions for redirects)
    const digest = (err as { digest?: string })?.digest ?? '';
    if (digest.startsWith('NEXT_REDIRECT')) throw err;
    console.error('[DashboardLayout] Error:', err instanceof Error ? err.message : err);
  }

  return (
    <TokenForgeBridge userId={user?.id ?? null}>
    <OrgStorageBootstrap />
    <div className="flex h-screen bg-void">
      {/* Skip to content — HIG accessibility: keyboard users bypass nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      {/* Sidebar — full on lg, icon-only on md, hidden on mobile */}
      <aside className="hidden md:flex md:flex-col md:w-16 lg:w-64 shrink-0 sidebar-glass border-r border-white/6">
        {/* Logo bar */}
        <div className="flex h-14 items-center justify-between border-b border-white/6 px-3 lg:px-5">
          <Link href="/" className="flex items-center gap-2 min-h-[44px]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 border border-signal/20">
              <Crosshair className="h-4 w-4 text-signal" />
            </span>
            <span className="font-mono text-[13px] text-signal tracking-[0.08em] hidden lg:inline">
              OPEN<span className="text-text-dim">{'//'}</span>SYBER
            </span>
          </Link>
          <span className="hidden lg:inline font-mono text-[10px] text-text-dim border border-border/50 px-2 py-0.5 rounded-md">
            v{PLATFORM_VERSION}
          </span>

        </div>

        {/* Navigation */}
        <SidebarNav hasOrg={hasOrg} />

        {/* User section */}
        <div className="border-t border-white/6 p-3 lg:p-4">
          {user && (
            <div className="mb-3 flex items-center gap-3">
              {user.image ? (
                <Image src={user.image} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" unoptimized />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-border text-xs font-medium text-text-secondary">
                  {(user.name ?? 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 hidden lg:block">
                <p className="truncate text-sm font-medium">{user.name ?? 'Account'}</p>
                <p className="truncate text-xs text-text-dim">
                  {user.email}
                </p>
              </div>
              <TrustScoreIndicator score={null} bound={false} />
              <SignOutIcon />
            </div>
          )}
          <Link
            href="/pricing"
            className="hidden lg:block rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3 hover:bg-white/[0.06] transition-colors"
          >
            <p className="text-xs text-text-dim">Plan</p>
            <p className="text-sm font-medium capitalize">{userPlan}</p>
            {(userPlan === 'free' || userPlan === 'personal') && (
              <span className="mt-1 inline-block text-xs text-signal">Upgrade &rarr;</span>
            )}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with notifications bell (HIG: notifications in header, not sidebar) */}
        <header className="flex items-center justify-end gap-2 h-12 px-4 md:px-6 border-b border-border/30 md:hidden lg:flex">
          <Link
            href="/dashboard/settings/notifications"
            className="flex items-center justify-center h-9 w-9 rounded hover:bg-surface transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 text-text-dim" />
          </Link>
        </header>

        <main id="main-content" className="flex-1 overflow-auto pb-16 md:pb-0">
          <NavigationProgress />
          <div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {/* Mobile tab bar */}
      <MobileTabBar />
      <AiChatWidget />
    </div>
    </TokenForgeBridge>
  );
}
