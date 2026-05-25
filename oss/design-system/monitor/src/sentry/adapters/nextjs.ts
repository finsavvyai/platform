import type { SentryConfig } from '../../types.js';
import { initSentry } from '../init.js';

interface NextjsSentryConfig extends SentryConfig {
  tunnelRoute?: string;
  enableClientErrorReporting?: boolean;
}

export async function initNextjsSentry(
  config: NextjsSentryConfig
): Promise<void> {
  const nextjsConfig: NextjsSentryConfig = {
    ...config,
    tunnelRoute: config.tunnelRoute ?? '/api/sentry-tunnel',
  };

  await initSentry(nextjsConfig);

  if (config.debugLogging) {
    console.log('[Sentry] Initialized for Next.js');
  }
}
