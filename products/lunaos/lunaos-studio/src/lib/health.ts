/**
 * Client-side health check utilities — Task 10.4
 * Validates that critical app subsystems are operational.
 * Used by deployment pipelines and monitoring agents.
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: Record<string, CheckResult>;
  version: string;
}

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

const APP_VERSION =
  (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0');

declare const __APP_VERSION__: string | undefined;

/** Ping the LunaOS Engine API health endpoint. */
async function checkApiConnectivity(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://api.lunaos.ai/health', {
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - start };
  }
}

/** Verify localStorage is accessible (required for auth token). */
function checkStorage(): CheckResult {
  try {
    const key = '__health_check__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Verify the service worker is active (offline support). */
async function checkServiceWorker(): Promise<CheckResult> {
  if (!('serviceWorker' in navigator)) {
    return { ok: false, error: 'ServiceWorker not supported' };
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return { ok: reg !== undefined };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Check WebGL availability (required for Konva/Three.js). */
function checkWebGL(): CheckResult {
  try {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    return { ok: ctx !== null };
  } catch {
    return { ok: false, error: 'WebGL unavailable' };
  }
}

/**
 * Run all health checks and return a consolidated HealthStatus.
 * Designed to be called from deployment health gates and synthetic monitors.
 */
export async function runHealthChecks(): Promise<HealthStatus> {
  const [api, sw] = await Promise.all([
    checkApiConnectivity(),
    checkServiceWorker(),
  ]);

  const storage = checkStorage();
  const webgl = checkWebGL();

  const checks: Record<string, CheckResult> = {
    api,
    storage,
    serviceWorker: sw,
    webgl,
  };

  const failed = Object.values(checks).filter((c) => !c.ok).length;
  const status: HealthStatus['status'] =
    failed === 0 ? 'healthy' : failed <= 1 ? 'degraded' : 'unhealthy';

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: APP_VERSION,
  };
}

/**
 * Expose health status at window.__health for Playwright smoke tests.
 * Call once on app startup.
 */
export function exposeHealthEndpoint(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)['__health'] = runHealthChecks;
}
