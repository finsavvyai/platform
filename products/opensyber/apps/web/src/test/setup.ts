import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import messages from '@messages/en.json';

// Ensure DOM is cleaned between tests to prevent "multiple elements" errors
afterEach(cleanup);

// jsdom stubs for APIs not available in test environment
Element.prototype.scrollIntoView = () => {};
HTMLCanvasElement.prototype.getContext = (() => null) as any;

/* ------------------------------------------------------------------
 * Global mock for next-intl — provides useTranslations backed by the
 * English message catalogue so component tests render real text.
 * ----------------------------------------------------------------*/
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const base = namespace
      ? (getNestedValue(messages, namespace) as Record<string, unknown>) ?? {}
      : messages;
    return (key: string, values?: Record<string, unknown>) => {
      const raw = getNestedValue(base as Record<string, unknown>, key);
      if (typeof raw === 'string') {
        if (!values) return raw;
        return raw.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
      }
      return key;
    };
  },
  useLocale: () => 'en',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/* Mock @/i18n/navigation so Link renders a plain <a> */
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => {
    const { createElement } = require('react');
    return createElement('a', props, children);
  },
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  redirect: () => {},
  getPathname: (opts: any) => opts?.href ?? '/',
}));
