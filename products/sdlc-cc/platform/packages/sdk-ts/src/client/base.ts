// Base client for the SDLC.ai JavaScript SDK

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { EventEmitter } from "eventemitter3";
import type { SDLCConfig, RequestConfig, ApiResponse } from "../types";
import { NetworkUtils, ObjectUtils, isNode, isBrowser } from "../utils";
import { normalizeConfig, getUserAgent, createHttpClient } from "./config";
import { setupInterceptors } from "./interceptors";
import { streamRequest, uploadFileRequest } from "./streaming";
import type { LearningLayer } from "../learning";
import { initLearningLayer, buildLearningCacheKey, getCachedResponse,
  recordOutcome, maybeCacheResult } from "./learning-integration";

export abstract class BaseClient extends EventEmitter {
  protected config: Required<SDLCConfig>;
  protected httpClient: AxiosInstance;
  protected abortController?: AbortController;
  protected refreshPromise?: Promise<void>;
  protected learning: LearningLayer | null = null;

  constructor(config: SDLCConfig) {
    super();
    this.config = normalizeConfig(config);
    this.httpClient = createHttpClient(this.config, getUserAgent());

    setupInterceptors({
      config: this.config,
      httpClient: this.httpClient,
      emitter: this,
      getRefreshPromise: () => this.refreshPromise,
      setRefreshPromise: (p) => { this.refreshPromise = p; },
      handleTokenRefresh: () => this.handleTokenRefresh(),
    });

    this.learning = initLearningLayer(config.learning);
  }

  /**
   * Handle token refresh (to be implemented by auth client)
   */
  protected async handleTokenRefresh(): Promise<void> {
    throw new Error("Token refresh not implemented");
  }

  /**
   * Make HTTP request with retry logic and optional self-learning cache.
   */
  protected async request<T = unknown>(
    config: RequestConfig,
    options: {
      retries?: number;
      retryCondition?: (error: unknown) => boolean;
    } = {},
  ): Promise<ApiResponse<T>> {
    // --- Learning layer: cache check (GET only) ---
    const isReadRequest = (config.method ?? "GET").toUpperCase() === "GET";
    const cacheKey = buildLearningCacheKey(this.learning, config, isReadRequest);

    const cached = getCachedResponse<T>(this.learning, cacheKey, config.url, this);
    if (cached) return cached;

    const startTime = Date.now();
    const retries = options.retries ?? this.config.retries;
    const retryCondition =
      options.retryCondition ?? NetworkUtils.isRetryableError;

    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (isNode || (isBrowser && "AbortController" in window)) {
          this.abortController = new AbortController();
          config.signal = this.abortController.signal;
        }

        const response: AxiosResponse<T> = await this.httpClient.request({
          url: config.url,
          method: config.method,
          params: config.params,
          data: config.data,
          headers: config.headers as Record<string, string>,
          timeout: config.timeout,
        });

        const result = this.transformResponse<T>(response);

        recordOutcome(this.learning, config.url, true, Date.now() - startTime);
        maybeCacheResult(this.learning, cacheKey, config.url, result, this);

        return result;
      } catch (error: unknown) {
        lastError = error;

        if (attempt === retries || !retryCondition(error)) {
          recordOutcome(this.learning, config.url, false, Date.now() - startTime);
          throw error;
        }

        const delay = this.config.retryDelay * Math.pow(2, attempt);
        this.emit("retry", {
          attempt: attempt + 1,
          maxRetries: retries,
          error,
          nextRetryIn: delay,
        });

        await NetworkUtils.backoff(attempt, this.config.retryDelay);
      }
    }

    throw lastError;
  }


  private transformResponse<T>(res: AxiosResponse<T>): ApiResponse<T> {
    return { data: res.data, status: res.status, statusText: res.statusText,
      headers: res.headers as Record<string, string>,
      requestId: res.headers["x-request-id"],
      timestamp: res.headers["x-response-time"] || new Date().toISOString() };
  }

  // --- HTTP convenience methods ---

  public async get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: "GET", params, ...options } as RequestConfig);
  }

  public async post<T = unknown>(
    url: string, data?: unknown, options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: "POST", data, ...options } as RequestConfig);
  }

  public async put<T = unknown>(
    url: string, data?: unknown, options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: "PUT", data, ...options } as RequestConfig);
  }

  public async patch<T = unknown>(
    url: string, data?: unknown, options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: "PATCH", data, ...options } as RequestConfig);
  }

  public async delete<T = unknown>(
    url: string, options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ url, method: "DELETE", ...options } as RequestConfig);
  }

  protected async *stream<T = unknown>(config: RequestConfig): AsyncGenerator<T, void, unknown> {
    yield* streamRequest<T>(this.config.baseURL, this.config.apiKey, config);
  }

  protected async uploadFile<T = unknown>(url: string, file: File | Blob, options?: {
    field?: string; metadata?: Record<string, unknown>;
    onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
    signal?: AbortSignal;
  }): Promise<ApiResponse<T>> {
    return uploadFileRequest<T>(this.config.baseURL, this.config.apiKey, url, file, options);
  }

  public cancelAllRequests(): void { this.abortController?.abort(); }

  public updateConfig(config: Partial<SDLCConfig>): void {
    this.config = ObjectUtils.deepMerge(this.config, config) as Required<SDLCConfig>;
    if (config.baseURL) this.httpClient.defaults.baseURL = config.baseURL;
    if (config.timeout) this.httpClient.defaults.timeout = config.timeout;
    if (config.headers) Object.assign(this.httpClient.defaults.headers.common, config.headers);
  }

  public getConfig(): Readonly<Required<SDLCConfig>> { return { ...this.config }; }

  public async healthCheck(): Promise<boolean> {
    try { await this.get("/health", undefined, { timeout: 5000 }); return true; }
    catch { return false; }
  }

  public async getVersion(): Promise<string> {
    try { return (await this.get<{ version: string }>("/version")).data.version; }
    catch { return "unknown"; }
  }

  /** Get the learning layer (cache + tracker) if enabled. */
  public getLearning(): LearningLayer | null { return this.learning; }

  public close(): void {
    this.cancelAllRequests();
    this.removeAllListeners();
    if (this.learning) { this.learning.cache.clear(); this.learning.tracker.reset(); }
  }
}
