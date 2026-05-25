// Browser-compatible client for the SDLC.ai JavaScript SDK

import { BaseClient } from './base';
import { AuthClient } from '../auth';
import type { AuthClientConfig } from '../auth';
import type {
  SDLCConfig, ApiResponse, Document, UploadOptions,
  UploadProgress, RAGQuery, RAGQueryUpdate, RequestConfig,
} from '../types';
import { UsersService } from '../users';
import { TenantsService } from '../tenants';
import { DocumentsService } from '../documents';
import { RAGService } from '../rag';
import { VectorService } from '../vector';
import { PoliciesService } from '../policies';
import { LLMService } from '../llm';
import { MonitoringService } from '../monitoring';
import { WebSocketClient, type WebSocketClientHost } from '../websocket';
import { isBrowser } from '../utils';
import { CacheManager } from './cache-manager';
import { uploadBrowserFile, uploadMultipleFiles as doUploadMultiple } from './upload-manager';
import { showNotification as doShowNotification } from './notification-manager';
import type { BrowserNotificationPayload } from './notification-manager';
import { getBrowserInfo, setupDragAndDrop } from './browser-utils';
import type { BrowserInfo, DragAndDropOptions } from './browser-utils';
import { streamRAGQuery } from './stream-rag';
import {
  registerServiceWorker, attachBrowserListeners,
  initializeWebAssembly, syncPendingOperations,
  type LifecycleHost,
} from './browser-lifecycle';

export interface BrowserClientConfig extends SDLCConfig {
  storageType?: 'localStorage' | 'sessionStorage' | 'memory';
  enableServiceWorker?: boolean;
  serviceWorkerScope?: string;
  enableWebWorkers?: boolean;
  enableWebAssembly?: boolean;
  withCredentials?: boolean;
  enableCache?: boolean;
  cacheTTL?: number;
  enableCSRFProtection?: boolean;
  csrfTokenHeader?: string;
  enableCompression?: boolean;
  enablePreflight?: boolean;
  enableWebRTC?: boolean;
  rtcConfiguration?: RTCConfiguration;
}

const BROWSER_DEFAULTS: Partial<BrowserClientConfig> = {
  storageType: 'localStorage', enableServiceWorker: true,
  enableWebWorkers: true, enableWebAssembly: true,
  withCredentials: false, enableCache: true, cacheTTL: 300000,
  enableCSRFProtection: true, csrfTokenHeader: 'X-CSRF-Token',
  enableCompression: true, enablePreflight: true, enableWebRTC: false,
};

export class BrowserClient extends BaseClient {
  public auth: AuthClient;
  public users: UsersService;
  public tenants: TenantsService;
  public documents: DocumentsService;
  public rag: RAGService;
  public vector: VectorService;
  public policies: PoliciesService;
  public llm: LLMService;
  public monitoring: MonitoringService;
  public websocket: WebSocketClient;

  private csrfToken?: string;
  private cacheManager = new CacheManager();
  private serviceWorkerRegistration?: ServiceWorkerRegistration;
  private webWorkers: Map<string, Worker> = new Map();

  constructor(config: BrowserClientConfig) {
    const cfg: BrowserClientConfig = { ...BROWSER_DEFAULTS, ...config };
    super(cfg);
    this.auth = new AuthClient(cfg as AuthClientConfig);
    this.users = new UsersService(this as BaseClient);
    this.tenants = new TenantsService(this as BaseClient);
    this.documents = new DocumentsService(this as BaseClient);
    this.rag = new RAGService(this as BaseClient);
    this.vector = new VectorService(this as BaseClient);
    this.policies = new PoliciesService(this as BaseClient);
    this.llm = new LLMService(this as BaseClient);
    this.monitoring = new MonitoringService(this as BaseClient);
    this.websocket = new WebSocketClient(this as unknown as WebSocketClientHost);
    if (isBrowser) this.initBrowser(cfg);
  }

  private async initBrowser(cfg: BrowserClientConfig): Promise<void> {
    // LifecycleHost wants a public `request` method but BaseClient's
    // `request` is protected. The cast is safe at the call site because
    // browser.ts is a subclass and the runtime method exists.
    const host = this as unknown as LifecycleHost;
    this.serviceWorkerRegistration = await registerServiceWorker(cfg, host);
    if (cfg.enableCSRFProtection) {
      this.csrfToken = await this.getCSRFToken();
    }
    attachBrowserListeners(host, () => this.cleanup(), () => this.doSync());
    if (cfg.enableWebAssembly && 'WebAssembly' in window) {
      initializeWebAssembly(host);
    }
  }

  protected override async request<T = unknown>(
    config: RequestConfig,
    options: { retries?: number; retryCondition?: (error: unknown) => boolean } = {}
  ): Promise<ApiResponse<T>> {
    const cfg = this.config as unknown as BrowserClientConfig;
    if (config.method === 'GET' && cfg.enableCache) {
      const cached = this.cacheManager.getFromCache(this.cacheManager.getCacheKey(config));
      if (cached) return cached as ApiResponse<T>;
    }
    if (cfg.enableCSRFProtection && this.csrfToken) {
      config.headers = { ...config.headers, [cfg.csrfTokenHeader || 'X-CSRF-Token']: this.csrfToken };
    }
    config.headers = {
      ...config.headers,
      'X-Client-Platform': 'browser',
      'X-Client-User-Agent': navigator.userAgent,
      'X-Client-Language': navigator.language,
      'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    const response = await super.request<T>(config, options);
    if (config.method === 'GET' && cfg.enableCache) {
      this.cacheManager.setCache(this.cacheManager.getCacheKey(config), response, cfg.cacheTTL || 300000);
    }
    return response;
  }

  public async uploadBrowserFile(file: File, opts: UploadOptions = {}): Promise<Document> {
    return uploadBrowserFile(this.httpClient, this.serviceWorkerRegistration, file, opts);
  }

  public async uploadMultipleFiles(
    files: FileList | File[],
    opts: {
      onProgress?: (i: number, p: UploadProgress) => void;
      onFileComplete?: (i: number, d: Document) => void;
      onAllComplete?: (docs: Document[]) => void;
      concurrency?: number; signal?: AbortSignal;
    } = {}
  ): Promise<Document[]> {
    return doUploadMultiple(this.httpClient, this.serviceWorkerRegistration, files, opts);
  }

  public setupDragAndDrop(el: HTMLElement, opts: DragAndDropOptions = {}): () => void {
    return setupDragAndDrop(el, opts);
  }

  public async *streamRAGQuery(q: RAGQuery): AsyncGenerator<RAGQueryUpdate, void, unknown> {
    yield* streamRAGQuery(this.auth, this as unknown as import('./stream-rag').StreamCapable, q);
  }

  public async showNotification(n: BrowserNotificationPayload): Promise<void> {
    return doShowNotification(n);
  }

  public getBrowserInfo(): BrowserInfo { return getBrowserInfo(); }

  private async getCSRFToken(): Promise<string> {
    try { return (await this.httpClient.get('/auth/csrf-token')).data.token; } catch { return ''; }
  }

  private async doSync(): Promise<void> {
    await syncPendingOperations(
      this as unknown as LifecycleHost,
      async () => [],
      async () => {},
    );
  }

  public cleanup(): void {
    this.webWorkers.forEach(w => w.terminate());
    this.webWorkers.clear();
    this.cacheManager.clear();
  }

  public override close(): void {
    this.cleanup();
    this.auth.close();
    this.websocket.close();
    super.close();
  }
}
