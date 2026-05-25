'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Shield, Code, Mail, HelpCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const PAGE_HELP: Record<string, string> = {
  '/dashboard/security': 'Monitor security score, manage incidents and policies',
  '/dashboard/agents': 'Track AI agent activity, configure policies and alerts',
  '/dashboard/cloud': 'Manage cloud accounts and CSPM scanning',
  '/dashboard/ai': 'Use AI-powered security insights and queries',
  '/dashboard/team': 'Manage team members, roles, and SSO',
  '/dashboard': 'Overview of your instance, security, and onboarding',
};

function getPageHelp(pathname: string): string {
  for (const [prefix, text] of Object.entries(PAGE_HELP)) {
    if (prefix !== '/dashboard' && pathname.startsWith(prefix)) return text;
  }
  if (pathname.startsWith('/dashboard')) return PAGE_HELP['/dashboard'];
  return 'Navigate to a dashboard page for contextual help';
}

const LINKS = [
  { label: 'Quick Start Guide', href: '/docs/getting-started', icon: BookOpen },
  { label: 'API Reference', href: '/docs/api', icon: Code },
  { label: 'Security Best Practices', href: '/docs/security', icon: Shield },
] as const;

export function HelpPanel(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === '?') setOpen((p) => !p);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Toggle help panel (press ? key)"
        className="fixed bottom-6 right-20 z-40 h-12 w-12 rounded-full bg-neutral-800
          border border-neutral-700 hover:bg-neutral-700 transition shadow-lg
          flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <span className="text-lg font-medium text-neutral-300">?</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="fixed bottom-20 right-20 z-40 w-80 rounded-xl bg-neutral-900
              border border-neutral-800 shadow-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Help &amp; Support</h2>
              <button onClick={() => setOpen(false)} aria-label="Close help panel"
                className="text-neutral-400 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Section title="Getting Started">
              {LINKS.map(({ label, href, icon: Icon }) => (
                <HelpLink key={href} href={href} icon={<Icon className="h-4 w-4 text-neutral-400" />}>
                  {label}
                </HelpLink>
              ))}
            </Section>

            <Section title="This Page">
              <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-neutral-300">
                <HelpCircle className="h-4 w-4 mt-0.5 text-neutral-400 shrink-0" />
                <span>{getPageHelp(pathname)}</span>
              </div>
            </Section>

            <Section title="Support">
              <HelpLink href="mailto:support@opensyber.cloud"
                icon={<Mail className="h-4 w-4 text-neutral-400" />}>
                support@opensyber.cloud
              </HelpLink>
              <HelpLink href="/docs"
                icon={<BookOpen className="h-4 w-4 text-neutral-400" />}>
                Documentation
              </HelpLink>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function HelpLink({ href, icon, children }: {
  href: string; icon: React.ReactNode; children: React.ReactNode;
}): React.ReactElement {
  const isExternal = href.startsWith('mailto:');
  const cls = "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-neutral-800 transition text-sm text-neutral-300";
  if (isExternal) return <a href={href} className={cls}>{icon}{children}</a>;
  return <Link href={href} className={cls}>{icon}{children}</Link>;
}
