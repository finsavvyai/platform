import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Activity,
  Command,
  Database,
  LayoutDashboard,
  FileCode,
  Settings,
  Moon,
  Sun,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Connections', href: '/connections', icon: Database },
  { name: 'Query Editor', href: '/query', icon: FileCode },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface LayoutProps {
  onLogout?: () => void;
}

export function Layout({ onLogout }: LayoutProps = {}) {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const shouldUseExpandedSidebar = window.innerWidth >= 768;
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setSidebarOpen(shouldUseExpandedSidebar);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const currentPage = navigation.find((item) => item.href === location.pathname)?.name || 'QueryFlux';

  return (
    <div className="premium-shell h-screen overflow-hidden text-foreground md:flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/70 bg-card/80 backdrop-blur-2xl transition-all duration-300 md:relative md:translate-x-0',
          sidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b border-border/70 px-4">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="premium-orb flex h-11 w-11 items-center justify-center rounded-2xl">
                <Database className="h-5 w-5 text-background" />
              </div>
              <div>
                <span className="block text-lg font-black tracking-tight">QueryFlux</span>
                <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                  Query OS
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="cursor-pointer rounded-xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="mx-4 mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" />
                Live workspace
              </div>
              <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_18px_hsl(var(--success))]" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="premium-pill rounded-xl px-3 py-2">
                <span className="block text-muted-foreground">Latency</span>
                <span className="font-mono font-semibold text-foreground">42ms</span>
              </div>
              <div className="premium-pill rounded-xl px-3 py-2">
                <span className="block text-muted-foreground">Guard</span>
                <span className="font-mono font-semibold text-foreground">On</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-2 p-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all animate-smooth touch-target',
                  'hover:bg-primary/10 hover:text-foreground',
                  isActive
                    ? 'bg-primary/15 text-foreground ring-1 ring-primary/30 shadow-[0_18px_42px_hsl(var(--primary)/0.12)]'
                    : 'text-muted-foreground'
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {sidebarOpen && <span className="font-semibold">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="space-y-2 border-t border-border/70 p-3">
          {sidebarOpen && (
            <div className="mb-2 rounded-2xl border border-border/70 bg-background/35 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Safe mode
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Destructive queries require confirmation before execution.
              </p>
            </div>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all',
                'hover:bg-primary/10 touch-target',
                'text-muted-foreground hover:text-foreground'
              )}
              title={!sidebarOpen ? 'Sign out' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="font-medium">Sign out</span>}
            </button>
          )}
          <button
            onClick={toggleDarkMode}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all',
              'hover:bg-primary/10 touch-target',
              'text-muted-foreground hover:text-foreground'
            )}
            title={!sidebarOpen ? (darkMode ? 'Light mode' : 'Dark mode') : undefined}
          >
            {darkMode ? (
              <Sun className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Moon className="w-5 h-5 flex-shrink-0" />
            )}
            {sidebarOpen && (
              <span className="font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="glass-dark flex min-h-20 items-center justify-between gap-4 border-x-0 border-t-0 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="cursor-pointer rounded-xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground md:hidden"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-warning" />
                Premium workspace
              </div>
              <h2 className="truncate text-xl font-black tracking-tight md:text-2xl">
                {currentPage}
              </h2>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="premium-input flex w-full max-w-xl items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
              <Command className="h-4 w-4 text-primary" />
              <span className="truncate">Search schema, saved query, connection, or command</span>
              <span className="ml-auto rounded-lg border border-border/70 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                CMD K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success sm:flex">
              <Wifi className="h-3.5 w-3.5" />
              <span>Live API</span>
            </div>
            <div className="hidden text-sm text-muted-foreground xl:block">
              <span>Connected to </span>
              <span className="font-mono font-semibold text-foreground">localhost:5432</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">U</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
