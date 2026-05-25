'use client';

import { Crosshair, ExternalLink as ExtLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthNav } from '@/components/AuthNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const t = useTranslations('nav');
  const tc = useTranslations('common');

  const navItems = [
    { label: t('pricing'), href: '/pricing' as const },
    { label: t('skills'), href: '/marketplace' as const },
    { label: t('docs'), href: '/docs' as const },
    { label: t('blog'), href: '/blog' as const },
    { label: t('demo'), href: '/demo' as const },
    { label: t('threats'), href: '/threats' as const },
  ];

  return (
    <>
    <nav className="fixed top-0 z-50 w-full">
      <div className="mx-auto max-w-7xl px-6 pt-4">
        <div className="flex h-14 items-center justify-between rounded-2xl border border-border/60 bg-void/80 backdrop-blur-2xl px-6 shadow-[0_0_60px_rgba(0,0,0,0.3)]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-signal/10 border border-signal/20 group-hover:bg-signal/15 transition">
              <Crosshair className="h-4 w-4 text-signal" />
            </div>
            <span className="font-[family-name:var(--font-mono)] text-[13px] font-semibold tracking-[0.06em]">
              <span className="text-text-primary">OPEN</span><span className="text-text-muted">{'//'}</span><span className="text-signal">SYBER</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition"
              >
                {item.label}
              </Link>
            ))}
            <div className="w-px h-4 bg-border mx-2" />
            <a
              href="https://tokenforge.opensyber.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] text-text-dim hover:text-info hover:bg-info/5 transition"
            >
              TokenForge <ExtLinkIcon className="h-3 w-3" aria-hidden="true" />
            </a>
            <LanguageSwitcher />
            <AuthNav />
          </div>

          {/* Mobile hamburger */}
          <div className="lg:hidden">
            <button onClick={() => setMobileOpen(true)} aria-label={t('openMenu')} className="text-white p-2">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>

    {/* Mobile drawer — sibling of <nav> so backdrop-filter on the header pill
        cannot create a containing block that clamps `fixed inset-0`. */}
    <div
      className={`fixed inset-0 z-[60] bg-void flex flex-col lg:hidden transition-[transform,visibility] duration-300 ease-in-out ${
        mobileOpen ? 'translate-x-0 visible' : 'translate-x-full rtl:-translate-x-full invisible'
      }`}
    >
      <div className="flex justify-end p-6 rtl:justify-start">
        <button onClick={() => setMobileOpen(false)} aria-label={t('closeMenu')} className="p-2 rounded-lg hover:bg-white/5">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex flex-col items-center gap-6 mt-12 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="font-[family-name:var(--font-mono)] text-lg uppercase tracking-wider text-text-primary hover:text-signal transition"
          >
            {item.label}
          </Link>
        ))}
        <a
          href="https://tokenforge.opensyber.cloud"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMobileOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 font-[family-name:var(--font-mono)] text-sm text-text-dim hover:text-info hover:border-info/30 transition"
        >
          TokenForge <ExtLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </nav>
      <div className="p-8 flex justify-center">
        <Link
          href={isSignedIn ? '/dashboard' : '/sign-in'}
          onClick={() => setMobileOpen(false)}
          className="rounded-lg bg-signal text-void px-8 py-3.5 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider hover:bg-signal-hover transition"
        >
          {isSignedIn ? tc('dashboard') : tc('signIn')}
        </Link>
      </div>
    </div>
    </>
  );
}
