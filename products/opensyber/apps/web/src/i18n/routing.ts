import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'he', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES: Locale[] = ['he', 'ar'];

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
