/**
 * Sentry initialization for the document-processor service.
 *
 * Reads the standard environment variables:
 *   SENTRY_DSN                 required to enable
 *   SENTRY_ENVIRONMENT         defaults to "development"
 *   SENTRY_RELEASE             defaults to "" (Sentry derives from CI)
 *   SENTRY_TRACES_SAMPLE_RATE  number, defaults to 0.1
 *
 * When DSN is unset, initSentry is a no-op and captureException returns
 * silently, so the rest of the codebase can call it freely.
 */

let sentryAvailable = false;
type SentryModule = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown) => void;
  flush: (timeoutMs?: number) => Promise<boolean>;
};
let sentry: SentryModule | undefined;

export function initSentry(): boolean {
  const dsn = (process.env.SENTRY_DSN ?? "").trim();
  if (!dsn) {
    // eslint-disable-next-line no-console
    console.info("[sentry] disabled (SENTRY_DSN unset)");
    return false;
  }

  try {
    // Lazy require so missing dep doesn't break unit tests on workers
    // that never set the DSN.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/node") as SentryModule;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      "[sentry] DSN set but @sentry/node not installed; " +
        "add to dependencies in package.json",
    );
    return false;
  }

  const sampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
  sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : 0.1,
    attachStacktrace: true,
  });
  sentryAvailable = true;
  // eslint-disable-next-line no-console
  console.info(
    `[sentry] initialised (env=${process.env.SENTRY_ENVIRONMENT ?? "development"}, ` +
      `traces_sample_rate=${sampleRate})`,
  );
  return true;
}

export function captureException(err: unknown): void {
  if (!sentryAvailable || !sentry) return;
  sentry.captureException(err);
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!sentryAvailable || !sentry) return;
  await sentry.flush(timeoutMs);
}
