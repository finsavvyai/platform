import Link from 'next/link';
import { Crosshair, BookOpen, Rocket, Cpu, Puzzle, ShieldCheck, Code, HelpCircle } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';

const docNav = [
  { href: '/docs', label: 'Overview', icon: BookOpen },
  { href: '/docs/getting-started', label: 'Getting Started', icon: Rocket },
  { href: '/docs/agent', label: 'Agent Architecture', icon: Cpu },
  { href: '/docs/skills', label: 'Skills Development', icon: Puzzle },
  { href: '/docs/security', label: 'Security Features', icon: ShieldCheck },
  { href: '/docs/api', label: 'API Reference', icon: Code },
  { href: '/docs/faq', label: 'FAQ', icon: HelpCircle },
];

export const metadata = { title: 'Documentation — OpenSyber' };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <div className="flex pt-20">
        {/* Sidebar — glass effect */}
        <aside className="hidden w-64 flex-shrink-0 sidebar-glass border-r border-border/50 md:flex md:flex-col sticky top-20 h-[calc(100vh-5rem)]">
          <div className="border-b border-border/50 px-4 py-3">
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-signal uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 border border-signal/20">
                <Crosshair className="h-4 w-4" />
              </span>
              Documentation
            </p>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
            {docNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/[0.04] hover:text-text-primary transition min-h-[44px]"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border/50 p-3">
            <Link
              href="/sign-up"
              className="flex items-center justify-center rounded-lg bg-signal px-4 py-2.5 font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider text-void glow-signal-sm hover:glow-signal transition-all min-h-[44px]"
            >
              Start Free
            </Link>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-auto">
          {/* Mobile doc tabs */}
          <div className="md:hidden border-b border-border px-4 py-3 overflow-x-auto">
            <div className="flex gap-2 text-sm whitespace-nowrap">
              {docNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-text-secondary hover:text-signal hover:bg-white/[0.04] transition"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
