import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Security headers are applied via src/middleware.ts — OpenNext's routing
// layer uses path-to-regexp v8, which rejects the `/(.*)` source pattern
// Next.js docs still recommend for `headers()`. Runtime injection in the
// middleware avoids the pattern-parse crash and keeps the exact same CSP.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Source maps are fetched lazily by the browser (only when DevTools is
  // open or Sentry needs them). Cost on normal page loads is zero; benefit
  // is unminified stacks in user-reported error logs.
  productionBrowserSourceMaps: true,
  // Transpile workspace packages whose source TypeScript is consumed by
  // the Next.js bundler. Without this, Turbopack can't find them during
  // production builds even though vitest resolves them fine via alias.
  transpilePackages: ['@opensyber/ui'],
  async redirects() {
    return [
      { source: '/faq', destination: '/docs/faq', permanent: true },
    ];
  },
};

// Sentry build-time options. Source map upload is only enabled when a DSN and
// auth token are present so local builds and CI forks work without Sentry.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Only upload source maps when Sentry is fully configured.
  disableSourceMapUpload:
    !process.env.SENTRY_AUTH_TOKEN || !process.env.NEXT_PUBLIC_SENTRY_DSN,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring/sentry',
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(withNextIntl(nextConfig), sentryBuildOptions);
