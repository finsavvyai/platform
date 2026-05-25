import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Shield, LayoutDashboard, Users, Building2, Server,
  Package, CreditCard, Activity, ScrollText, ArrowLeft,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

const adminItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/instances', label: 'Instances', icon: Server },
  { href: '/admin/skills', label: 'Skills', icon: Package },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/events', label: 'Events', icon: Activity },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const token = await getApiToken();

  if (!session?.user || !token) redirect('/dashboard');

  const user = session.user as { name?: string | null; email?: string | null };

  let isAdmin = false;
  try {
    const data = await apiClient<{ user: { isAdmin: boolean } }>('/api/user', { token });
    isAdmin = data.user.isAdmin;
  } catch {
    redirect('/dashboard');
  }

  if (!isAdmin) redirect('/dashboard');

  return (
    <div className="flex h-screen bg-void">
      <aside className="hidden w-64 flex-shrink-0 border-r border-border/50 bg-panel/30 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-alert/10 border border-alert/20">
              <Shield className="h-5 w-5 text-red-500" />
            </span>
            <span className="text-lg font-bold font-[family-name:var(--font-mono)]">Admin Panel</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {adminItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/[0.04] hover:text-white transition"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-dim hover:bg-white/[0.04] hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </nav>
        <div className="border-t border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-border text-xs font-medium">
              {(user.name ?? 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name ?? 'Admin'}</p>
              <p className="truncate text-xs text-text-dim">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
