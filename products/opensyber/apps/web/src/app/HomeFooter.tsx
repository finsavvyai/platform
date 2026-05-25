'use client';

import { ArrowRight, Crosshair, ExternalLink as ExtLinkIcon } from 'lucide-react';
import { AuthCTA } from '@/components/AuthNav';
import { FadeIn } from '@/components/motion/FadeIn';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Final CTA -- gradient card with glow */
export function FinalCTASection() {
  const t = useTranslations('cta');
  const td = useTranslations('demo');

  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <FadeIn className="mx-auto max-w-4xl px-6">
        <div className="relative rounded-3xl border border-signal/20 bg-gradient-to-br from-signal/[0.06] via-panel to-info/[0.03] p-12 md:p-16 text-center overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[200px] w-full max-w-[400px] bg-signal/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative">
            <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl tracking-wide mb-5">
              {t('heading')}
            </h2>
            <p className="text-text-secondary mb-10 max-w-xl mx-auto text-lg leading-relaxed">
              {t('description')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <AuthCTA className="rounded-lg bg-signal text-void px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider hover:bg-signal-hover glow-signal-sm hover:glow-signal transition-all duration-300 inline-flex items-center gap-2" />
              <Link
                href="/demo"
                className="rounded-lg border border-border bg-panel/50 backdrop-blur-sm px-8 py-4 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-text-primary hover:border-signal/30 hover:bg-signal/5 transition-all duration-300 inline-flex items-center gap-2"
              >
                {td('liveDemo')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 font-[family-name:var(--font-mono)] text-[11px] text-text-dim tracking-wider">
              {t('noCreditCard')}
            </p>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

export function Footer() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');

  return (
    <footer className="border-t border-border/50 pt-16 pb-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-5 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-signal/10 border border-signal/20">
                <Crosshair className="h-4 w-4 text-signal" />
              </div>
              <span className="font-[family-name:var(--font-mono)] text-[12px] font-semibold tracking-[0.06em]">
                <span className="text-text-primary">OPEN</span><span className="text-text-muted">{'//'}</span><span className="text-signal">SYBER</span>
              </span>
            </div>
            <p className="text-sm text-text-dim leading-relaxed">
              {tc('tagline')}
            </p>
          </div>

          {[
            {
              title: t('product'),
              links: [
                { label: t('pricing'), href: '/pricing' as const },
                { label: t('marketplace'), href: '/marketplace' as const },
                { label: t('liveDemo'), href: '/demo' as const },
                { label: t('auditMethodology'), href: '/docs/skills/audit-methodology' as const },
              ],
            },
            {
              title: t('legal'),
              links: [
                { label: t('privacy'), href: '/privacy' as const },
                { label: t('terms'), href: '/terms' as const },
                { label: t('security'), href: '/security' as const },
              ],
            },
            {
              title: t('community'),
              links: [
                { label: t('github'), href: 'https://github.com/opensyber', external: true },
                { label: t('blog'), href: '/blog' as const },
                { label: t('support'), href: 'mailto:support@opensyber.cloud', external: true },
              ],
            },
            {
              title: t('ecosystem'),
              links: [
                { label: 'TokenForge', href: 'https://tokenforge.opensyber.cloud', external: true },
              ],
              extra: <span className="text-[10px] text-text-muted font-[family-name:var(--font-mono)]">{t('sessionSecurity')}</span>,
            },
          ].map((section) => (
            <div key={section.title}>
              <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-dim uppercase tracking-[0.14em] mb-4">{section.title}</p>
              <div className="flex flex-col gap-3 text-sm text-text-secondary">
                {section.links.map((link) =>
                  'external' in link && link.external ? (
                    <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-text-primary transition">
                      {link.label} <ExtLinkIcon className="h-3 w-3 text-text-muted" aria-hidden="true" />
                    </a>
                  ) : (
                    <Link key={link.label} href={link.href as '/pricing'} className="hover:text-text-primary transition">
                      {link.label}
                    </Link>
                  )
                )}
                {'extra' in section && section.extra}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted tracking-wider">{tc('copyright')}</p>
          <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted tracking-wider">{tc('builtOn')}</p>
        </div>
      </div>
    </footer>
  );
}
