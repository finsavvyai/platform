'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  he: 'עב',
  ar: 'عر',
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('languageSwitcher');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchLocale(next: Locale) {
    setOpen(false);
    router.replace(pathname, { locale: next });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={t('label')}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-text-dim hover:text-signal hover:border-signal/30 transition"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{LOCALE_LABELS[locale]}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 end-0 z-50 min-w-[120px] rounded-md border border-border bg-panel shadow-xl shadow-black/40">
          {routing.locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] transition hover:bg-border ${
                loc === locale ? 'text-signal' : 'text-text-secondary'
              }`}
            >
              <span>{t(loc)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
