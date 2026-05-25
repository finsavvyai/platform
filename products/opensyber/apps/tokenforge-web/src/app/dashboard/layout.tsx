import Link from 'next/link';
import {
  KeyRound,
  LayoutDashboard,
  Monitor,
  Activity,
  Bell,
  Settings,
  BookOpen,
  Globe,
  FileText,
  Users,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { UserMenu } from '@/components/dashboard/UserMenu';
import { ApiKeyCheck } from '@/components/dashboard/ApiKeyCheck';
import { ApiKeyProvider } from '@/lib/api-key-context';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/sessions', label: 'Sessions', icon: Monitor },
  { href: '/dashboard/events', label: 'Events', icon: Activity },
  { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  { href: '/dashboard/proxy', label: 'Zero-Code Proxy', icon: Globe },
  { href: '/dashboard/compliance', label: 'Compliance', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/docs', label: 'Quick Start', icon: BookOpen },
];

const workforceItems = [
  { href: '/dashboard/workforce/users', label: 'Users', icon: Users },
  { href: '/dashboard/workforce/policies', label: 'Policies', icon: ShieldCheck },
  { href: '/dashboard/workforce/apps', label: 'IdP Apps', icon: Building2 },
];

export const metadata = {
  title: {
    default: 'Dashboard',
    template: '%s | TokenForge',
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-screen bg-void">
      <aside className="hidden w-64 flex-shrink-0 border-r border-border/50 sidebar-glass md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border/50 px-6">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="my-3 border-t border-border/30" />
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Workforce
          </p>
          {workforceItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <UserMenu />
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 md:p-8">
          <ApiKeyProvider><ApiKeyCheck>{children}</ApiKeyCheck></ApiKeyProvider>
        </div>
      </main>
    </div>
  );
}
