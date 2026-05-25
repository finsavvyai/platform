// Browser lifecycle and event handlers for the Browser SDLC Client

import type { RequestConfig } from '../types';
import { handleServiceWorkerMessage } from './notification-manager';

export interface LifecycleHost {
  emit(event: string, data?: unknown): void;
  request(config: RequestConfig): Promise<unknown>;
}

export interface BrowserFeatureConfig {
  enableServiceWorker?: boolean;
  serviceWorkerScope?: string;
  enableCSRFProtection?: boolean;
  enableWebAssembly?: boolean;
}

export interface LifecycleState {
  serviceWorkerRegistration?: ServiceWorkerRegistration;
  csrfToken?: string;
}

/**
 * Register the service worker and attach message listener.
 */
export async function registerServiceWorker(
  cfg: BrowserFeatureConfig,
  host: LifecycleHost
): Promise<ServiceWorkerRegistration | undefined> {
  if (!cfg.enableServiceWorker || !('serviceWorker' in navigator)) return undefined;
  try {
    const reg = await navigator.serviceWorker.register(
      '/sdlc-sw.js', { scope: cfg.serviceWorkerScope || '/' }
    );
    navigator.serviceWorker.addEventListener('message', (e) => {
      handleServiceWorkerMessage(e, (t, d) => host.emit(t, d));
    });
    return reg;
  } catch (error) {
    console.warn('Failed to register service worker:', error);
    return undefined;
  }
}

/**
 * Attach browser visibility and connectivity handlers.
 */
export function attachBrowserListeners(
  host: LifecycleHost,
  onCleanup: () => void,
  onOnline: () => void
): void {
  document.addEventListener('visibilitychange', () => {
    host.emit(document.hidden ? 'pageHidden' : 'pageVisible');
  });
  window.addEventListener('online', () => { host.emit('online'); onOnline(); });
  window.addEventListener('offline', () => { host.emit('offline'); });
  window.addEventListener('beforeunload', () => onCleanup());
}

/**
 * Initialize WebAssembly module if available.
 */
export async function initializeWebAssembly(
  host: LifecycleHost
): Promise<void> {
  try {
    const mod = await WebAssembly.compileStreaming(
      fetch('/wasm/text-processing.wasm')
    );
    host.emit('wasmLoaded', { module: mod });
  } catch (error) {
    console.warn('Failed to load WebAssembly module:', error);
  }
}

/**
 * Sync pending offline operations.
 */
export async function syncPendingOperations(
  host: LifecycleHost,
  getPending: () => Promise<Array<{ id: string; config: RequestConfig }>>,
  removePending: (id: string) => Promise<void>
): Promise<void> {
  const pending = await getPending();
  for (const op of pending) {
    try {
      await host.request(op.config);
      await removePending(op.id);
    } catch (error) {
      console.error('Failed to sync operation:', error);
    }
  }
}
