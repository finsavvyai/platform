/**
 * DataDog RUM integration — Task 10.1
 * Loaded via CDN (window.DD_RUM) to keep bundle size minimal.
 * Requirements: 10.2, 10.3
 */

interface DDRum {
  init(options: DDRumInitOptions): void;
  startSessionReplayRecording(): void;
  addAction(name: string, context?: Record<string, unknown>): void;
  addError(error: Error | string, context?: Record<string, unknown>): void;
  setGlobalContextProperty(key: string, value: unknown): void;
  setUser(user: { id: string; name?: string; email?: string }): void;
}

interface DDRumInitOptions {
  applicationId: string;
  clientToken: string;
  site: string;
  service: string;
  env: string;
  version: string;
  sessionSampleRate: number;
  sessionReplaySampleRate: number;
  trackUserInteractions: boolean;
  trackResources: boolean;
  trackLongTasks: boolean;
  defaultPrivacyLevel: string;
  allowedTracingUrls: string[];
}

declare global {
  interface Window {
    DD_RUM?: DDRum;
  }
}

let initialized = false;

/** Reset initialization state — test use only. */
export function _resetForTesting(): void {
  initialized = false;
}

function getDD(): DDRum | null {
  return window.DD_RUM ?? null;
}

/**
 * Initialize DataDog RUM if credentials are available.
 */
export function initDatadog(options: {
  applicationId: string;
  clientToken: string;
  env: string;
  version?: string;
}): void {
  if (initialized || !options.applicationId || !options.clientToken) return;

  const dd = getDD();
  if (!dd) {
    // DD_RUM script not yet loaded — schedule retry
    window.addEventListener('load', () => initDatadog(options), { once: true });
    return;
  }

  dd.init({
    applicationId: options.applicationId,
    clientToken: options.clientToken,
    site: 'datadoghq.com',
    service: 'lunaos-studio',
    env: options.env,
    version: options.version ?? '1.0.0',
    sessionSampleRate: options.env === 'production' ? 100 : 20,
    sessionReplaySampleRate: options.env === 'production' ? 20 : 5,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: ['https://api.lunaos.ai'],
  });

  if (options.env === 'production') {
    dd.startSessionReplayRecording();
  }

  initialized = true;
}

/** Track a custom user action (workflow creation, execution, etc.). */
export function trackAction(
  name: string,
  context?: Record<string, unknown>
): void {
  getDD()?.addAction(name, context);
}

/** Report a captured error to DataDog. */
export function reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  getDD()?.addError(error, context);
}

/** Attach global metadata to all RUM events. */
export function setGlobalTag(key: string, value: unknown): void {
  getDD()?.setGlobalContextProperty(key, value);
}

/** Set authenticated user context for RUM sessions. */
export function setRumUser(user: {
  id: string;
  name?: string;
  email?: string;
}): void {
  getDD()?.setUser(user);
}

/** Custom metrics tracked as RUM actions for dashboard aggregation. */
export const Metrics = {
  workflowCreated: (nodeCount: number) =>
    trackAction('workflow.created', { nodeCount }),

  workflowExecuted: (nodeCount: number, durationMs: number) =>
    trackAction('workflow.executed', { nodeCount, durationMs }),

  workflowFailed: (error: string) =>
    trackAction('workflow.failed', { error }),

  nodeAdded: (nodeType: string) =>
    trackAction('node.added', { nodeType }),

  templateUsed: (templateId: string) =>
    trackAction('template.used', { templateId }),

  pageLoad: (route: string, durationMs: number) =>
    trackAction('page.load', { route, durationMs }),
} as const;
