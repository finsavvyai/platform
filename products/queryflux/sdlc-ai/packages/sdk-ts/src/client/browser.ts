// Browser-compatible client for the SDLC.ai JavaScript SDK

import { BaseClient } from './base';
import { AuthClient, AuthClientConfig } from '../auth';
import {
  SDLCConfig,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  Tenant,
  CreateTenantRequest,
  Document,
  DocumentType,
  UploadOptions,
  UploadProgress,
  RAGQuery,
  RAGResponse,
  RAGQueryUpdate,
  VectorSearchRequest,
  VectorSearchResult,
  Policy,
  PolicyTestRequest,
  PolicyTestResult,
  LLMRequest,
  LLMResponse,
  TokenUsage,
  Metric,
  HealthCheck,
  LogEntry,
  Notification
} from '../types';
import { UsersService } from '../users';
import { TenantsService } from '../tenants';
import { DocumentsService } from '../documents';
import { RAGService } from '../rag';
import { VectorService } from '../vector';
import { PoliciesService } from '../policies';
import { LLMService } from '../llm';
import { MonitoringService } from '../monitoring';
import { WebSocketClient } from '../websocket';
import {
  SecurityUtils,
  StorageUtils,
  NetworkUtils,
  ValidationUtils,
  isBrowser
} from '../utils';

export interface BrowserClientConfig extends SDLCConfig {
  // Browser-specific options
  storageType?: 'localStorage' | 'sessionStorage' | 'memory';
  enableServiceWorker?: boolean;
  serviceWorkerScope?: string;
  enableWebWorkers?: boolean;
  enableWebAssembly?: boolean;
  // CORS options
  withCredentials?: boolean;
  // Cache options
  enableCache?: boolean;
  cacheTTL?: number;
  // Security options
  enableCSRFProtection?: boolean;
  csrfTokenHeader?: string;
  // Performance options
  enableCompression?: boolean;
  enablePreflight?: boolean;
  // WebRTC options (for peer-to-peer)
  enableWebRTC?: boolean;
  rtcConfiguration?: RTCConfiguration;
}

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
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private serviceWorkerRegistration?: ServiceWorkerRegistration;
  private webWorkers: Map<string, Worker> = new Map();

  constructor(config: BrowserClientConfig) {
    // Add browser-specific defaults
    const browserConfig: BrowserClientConfig = {
      storageType: 'localStorage',
      enableServiceWorker: true,
      enableWebWorkers: true,
      enableWebAssembly: true,
      withCredentials: false,
      enableCache: true,
      cacheTTL: 300000, // 5 minutes
      enableCSRFProtection: true,
      csrfTokenHeader: 'X-CSRF-Token',
      enableCompression: true,
      enablePreflight: true,
      enableWebRTC: false,
      ...config
    };

    super(browserConfig);

    // Create auth client
    this.auth = new AuthClient(browserConfig as AuthClientConfig);

    // Create service clients
    this.users = new UsersService(this);
    this.tenants = new TenantsService(this);
    this.documents = new DocumentsService(this);
    this.rag = new RAGService(this);
    this.vector = new VectorService(this);
    this.policies = new PoliciesService(this);
    this.llm = new LLMService(this);
    this.monitoring = new MonitoringService(this);
    this.websocket = new WebSocketClient(this);

    // Setup browser-specific features
    if (isBrowser) {
      this.setupBrowserFeatures(browserConfig);
    }
  }

  /**
   * Setup browser-specific features
   */
  private async setupBrowserFeatures(config: BrowserClientConfig): Promise<void> {
    // Setup Service Worker
    if (config.enableServiceWorker && 'serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register(
          '/sdlc-sw.js',
          { scope: config.serviceWorkerScope || '/' }
        );

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });
      } catch (error) {
        console.warn('Failed to register service worker:', error);
      }
    }

    // Setup CSRF protection
    if (config.enableCSRFProtection) {
      this.csrfToken = await this.getCSRFToken();
    }

    // Setup visibility change handler
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Setup online/offline handlers
    window.addEventListener('online', () => {
      this.handleOnlineStatusChange(true);
    });

    window.addEventListener('offline', () => {
      this.handleOnlineStatusChange(false);
    });

    // Setup beforeunload handler
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Setup WebAssembly if enabled
    if (config.enableWebAssembly && 'WebAssembly' in window) {
      this.initializeWebAssembly();
    }
  }

  /**
   * Override request method to add browser-specific features
   */
  protected async request<T = any>(
    config: any,
    options: any = {}
  ): Promise<ApiResponse<T>> {
    // Check cache for GET requests
    if (config.method === 'GET' && this.config.enableCache) {
      const cacheKey = this.getCacheKey(config);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Add CSRF token if enabled
    if (this.config.enableCSRFProtection && this.csrfToken) {
      config.headers = {
        ...config.headers,
        [this.config.csrfTokenHeader || 'X-CSRF-Token']: this.csrfToken
      };
    }

    // Add browser-specific headers
    config.headers = {
      ...config.headers,
      'X-Client-Platform': 'browser',
      'X-Client-User-Agent': navigator.userAgent,
      'X-Client-Language': navigator.language,
      'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Make the request
    const response = await super.request<T>(config, options);

    // Cache GET responses
    if (config.method === 'GET' && this.config.enableCache) {
      const cacheKey = this.getCacheKey(config);
      this.setCache(cacheKey, response, this.config.cacheTTL || 300000);
    }

    return response;
  }

  /**
   * Upload file from input element or File object
   */
  public async uploadFile(
    file: File,
    options: UploadOptions = {}
  ): Promise<Document> {
    // Validate file
    this.validateFile(file);

    // Create FormData
    const formData = new FormData();
    formData.append('file', file, options.name || file.name);

    // Add metadata
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    if (options.tags) {
      formData.append('tags', JSON.stringify(options.tags));
    }

    // Add chunk info if specified
    if (options.chunkSize) {
      formData.append('chunkSize', options.chunkSize.toString());
    }

    // Track upload in service worker if available
    if (this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration.active?.postMessage({
        type: 'uploadStart',
        fileId: SecurityUtils.generateSecureRandom(),
        fileName: file.name,
        fileSize: file.size
      });
    }

    try {
      const response = await this.httpClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Size': file.size.toString(),
          'X-File-Type': file.type
        },
        onUploadProgress: options.onProgress ? (progressEvent: any) => {
          if (progressEvent.lengthComputable) {
            const progress: UploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded / progressEvent.total) * 100),
              speed: this.calculateUploadSpeed(progressEvent),
              timeRemaining: this.calculateTimeRemaining(progressEvent)
            };

            options.onProgress!(progress);

            // Notify service worker
            if (this.serviceWorkerRegistration) {
              this.serviceWorkerRegistration.active?.postMessage({
                type: 'uploadProgress',
                progress
              });
            }
          }
        } : undefined,
        signal: options.signal
      });

      // Notify service worker of completion
      if (this.serviceWorkerRegistration) {
        this.serviceWorkerRegistration.active?.postMessage({
          type: 'uploadComplete',
          document: response.data
        });
      }

      return response.data;
    } catch (error) {
      // Notify service worker of error
      if (this.serviceWorkerRegistration) {
        this.serviceWorkerRegistration.active?.postMessage({
          type: 'uploadError',
          error: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Upload multiple files with drag and drop support
   */
  public async uploadMultipleFiles(
    files: FileList | File[],
    options: {
      onProgress?: (fileIndex: number, progress: UploadProgress) => void;
      onFileComplete?: (fileIndex: number, document: Document) => void;
      onAllComplete?: (documents: Document[]) => void;
      concurrency?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<Document[]> {
    const fileArray = Array.from(files);
    const concurrency = options.concurrency || 3;
    const documents: Document[] = [];
    let completed = 0;

    // Process files in batches
    for (let i = 0; i < fileArray.length; i += concurrency) {
      const batch = fileArray.slice(i, i + concurrency);

      const batchPromises = batch.map(async (file, index) => {
        const document = await this.uploadFile(file, {
          onProgress: (progress) => {
            if (options.onProgress) {
              options.onProgress(i + index, progress);
            }
          },
          signal: options.signal
        });

        if (options.onFileComplete) {
          options.onFileComplete(i + index, document);
        }

        return document;
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect successful uploads
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          documents.push(result.value);
          completed++;
        }
      });
    }

    if (options.onAllComplete) {
      options.onAllComplete(documents);
    }

    return documents;
  }

  /**
   * Setup drag and drop zone
   */
  public setupDragAndDrop(
    element: HTMLElement,
    options: {
      onDrop?: (files: File[]) => void;
      onDragEnter?: (event: DragEvent) => void;
      onDragLeave?: (event: DragEvent) => void;
      onDragOver?: (event: DragEvent) => void;
      acceptedTypes?: string[];
      maxFiles?: number;
      maxFileSize?: number;
    } = {}
  ): () => void {
    const {
      onDrop,
      onDragEnter,
      onDragLeave,
      onDragOver,
      acceptedTypes = [],
      maxFiles = 10,
      maxFileSize = 100 * 1024 * 1024 // 100MB
    } = options;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (onDragEnter) {
        onDragEnter(e);
      }

      element.classList.add('drag-over');
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (onDragLeave) {
        onDragLeave(e);
      }

      element.classList.remove('drag-over');
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (onDragOver) {
        onDragOver(e);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      element.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer?.files || []);

      // Validate files
      const validFiles = files.filter(file => {
        // Check file type
        if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
          return false;
        }

        // Check file size
        if (file.size > maxFileSize) {
          return false;
        }

        return true;
      });

      // Limit number of files
      const limitedFiles = validFiles.slice(0, maxFiles);

      if (onDrop) {
        onDrop(limitedFiles);
      }
    };

    // Add event listeners
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    // Return cleanup function
    return () => {
      element.removeEventListener('dragenter', handleDragEnter);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }

  /**
   * Stream RAG query in browser
   */
  public async *streamRAGQuery(
    query: RAGQuery
  ): AsyncGenerator<RAGQueryUpdate, void, unknown> {
    const token = await this.auth.ensureValidToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    // Use EventSource for server-sent events
    if (typeof EventSource !== 'undefined') {
      const eventSource = new EventSource(
        `${this.config.baseURL}/rag/query/stream?${new URLSearchParams({
          query: JSON.stringify(query),
          token: this.auth.getAccessToken() || ''
        })}`
      );

      try {
        while (true) {
          const event = await new Promise<RAGQueryUpdate>((resolve, reject) => {
            eventSource.onmessage = (e) => {
              try {
                const data = JSON.parse(e.data);
                resolve(data);
              } catch (error) {
                reject(error);
              }
            };

            eventSource.onerror = (e) => {
              reject(new Error('Stream error'));
            };
          });

          yield event;

          if (event.status === 'completed' || event.status === 'failed') {
            break;
          }
        }
      } finally {
        eventSource.close();
      }
    } else {
      // Fallback to regular streaming
      yield* this.stream<RAGQueryUpdate>({
        url: '/rag/query',
        method: 'POST',
        data: {
          ...query,
          streaming: true
        },
        headers: {
          'Authorization': `Bearer ${this.auth.getAccessToken()}`
        }
      });
    }
  }

  /**
   * Create notification using browser Notification API
   */
  public async showNotification(
    notification: Omit<Notification, 'id' | 'createdAt'> & {
      title: string;
      body?: string;
      icon?: string;
      image?: string;
      badge?: string;
      tag?: string;
      requireInteraction?: boolean;
      actions?: NotificationAction[];
      silent?: boolean;
    }
  ): Promise<void> {
    // Request permission if needed
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon,
        image: notification.image,
        badge: notification.badge,
        tag: notification.tag,
        requireInteraction: notification.requireInteraction,
        silent: notification.silent,
        data: notification.data
      });

      // Auto-close after 5 seconds if not interactive
      if (!notification.requireInteraction) {
        setTimeout(() => {
          browserNotification.close();
        }, 5000);
      }

      // Handle click
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
      };
    }
  }

  /**
   * Get browser information
   */
  public getBrowserInfo(): {
    userAgent: string;
    language: string;
    languages: string[];
    platform: string;
    cookieEnabled: boolean;
    doNotTrack: string | null;
    onLine: boolean;
    screen: {
      width: number;
      height: number;
      colorDepth: number;
      pixelDepth: number;
    };
    viewport: {
      width: number;
      height: number;
    };
    timezone: string;
    timezoneOffset: number;
  } {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: Array.from(navigator.languages),
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset()
    };
  }

  /**
   * Validate file for upload
   */
  private validateFile(file: File): void {
    // Check file size
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/json',
      'text/html',
      'text/markdown',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'video/mp4'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported`);
    }
  }

  /**
   * Calculate upload speed
   */
  private calculateUploadSpeed(progressEvent: any): number {
    // This would need proper implementation with time tracking
    return 0;
  }

  /**
   * Calculate time remaining
   */
  private calculateTimeRemaining(progressEvent: any): number {
    // This would need proper implementation with time tracking
    return 0;
  }

  /**
   * Get CSRF token
   */
  private async getCSRFToken(): Promise<string> {
    try {
      const response = await this.httpClient.get('/auth/csrf-token');
      return response.data.token;
    } catch {
      return '';
    }
  }

  /**
   * Handle service worker messages
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    switch (event.data.type) {
      case 'cacheUpdate':
        this.emit('cacheUpdate', event.data);
        break;
      case 'pushNotification':
        this.emit('pushNotification', event.data);
        break;
      case 'syncComplete':
        this.emit('syncComplete', event.data);
        break;
    }
  }

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Page is hidden, pause background operations
      this.emit('pageHidden');
    } else {
      // Page is visible, resume operations
      this.emit('pageVisible');
    }
  }

  /**
   * Handle online/offline status change
   */
  private handleOnlineStatusChange(isOnline: boolean): void {
    if (isOnline) {
      this.emit('online');
      // Sync any pending operations
      this.syncPendingOperations();
    } else {
      this.emit('offline');
    }
  }

  /**
   * Sync pending operations
   */
  private async syncPendingOperations(): Promise<void> {
    // Get pending operations from IndexedDB
    const pendingOperations = await this.getPendingOperations();

    // Process each pending operation
    for (const operation of pendingOperations) {
      try {
        await this.retryOperation(operation);
        await this.removePendingOperation(operation.id);
      } catch (error) {
        console.error('Failed to sync operation:', error);
      }
    }
  }

  /**
   * Get pending operations from IndexedDB
   */
  private async getPendingOperations(): Promise<any[]> {
    // This would need IndexedDB implementation
    return [];
  }

  /**
   * Remove pending operation from IndexedDB
   */
  private async removePendingOperation(id: string): Promise<void> {
    // This would need IndexedDB implementation
  }

  /**
   * Retry operation
   */
  private async retryOperation(operation: any): Promise<void> {
    // Retry the operation
    await this.request(operation.config);
  }

  /**
   * Initialize WebAssembly modules
   */
  private async initializeWebAssembly(): Promise<void> {
    // Load WebAssembly modules for performance-critical operations
    try {
      // Example: Load text processing module
      const wasmModule = await WebAssembly.compileStreaming(
        fetch('/wasm/text-processing.wasm')
      );

      // Use module for faster text processing
      this.emit('wasmLoaded', { module: wasmModule });
    } catch (error) {
      console.warn('Failed to load WebAssembly module:', error);
    }
  }

  /**
   * Cache management
   */
  private getCacheKey(config: any): string {
    return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Terminate web workers
    this.webWorkers.forEach(worker => worker.terminate());
    this.webWorkers.clear();

    // Clear cache
    this.cache.clear();
  }

  /**
   * Close client and cleanup resources
   */
  public close(): void {
    this.cleanup();
    this.auth.close();
    this.websocket.close();
    super.close();
  }
}
