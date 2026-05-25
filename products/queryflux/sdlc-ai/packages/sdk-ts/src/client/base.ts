// Base client for the SDLC.ai JavaScript SDK

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";
import { EventEmitter } from "eventemitter3";
import {
  SDLCConfig,
  RequestConfig,
  ApiResponse,
  SDLCException,
  NetworkError,
  TimeoutError,
  createErrorFromResponse,
  TokenExpiredError,
  RateLimitError,
} from "../types";
import {
  SecurityUtils,
  NetworkUtils,
  TokenUtils,
  ObjectUtils,
  isNode,
  isBrowser,
} from "../utils";

export abstract class BaseClient extends EventEmitter {
  protected config: Required<SDLCConfig>;
  protected httpClient: AxiosInstance;
  protected abortController?: AbortController;
  protected refreshPromise?: Promise<void>;

  constructor(config: SDLCConfig) {
    super();

    // Validate and normalize configuration
    this.config = this.normalizeConfig(config);

    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": this.getUserAgent(),
        ...this.config.headers,
      },
    });

    // Setup interceptors
    this.setupInterceptors();
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: SDLCConfig): Required<SDLCConfig> {
    const defaults: Required<SDLCConfig> = {
      baseURL: "",
      apiKey: "",
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      environment: "production",
      headers: {},
      interceptors: {
        request: [],
        response: [],
        error: [],
      },
    };

    return ObjectUtils.deepMerge(defaults, config);
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string {
    const version = process.env.npm_package_version || "1.0.0";
    const platform = isNode ? "Node.js" : isBrowser ? "Browser" : "Unknown";
    return `SDLC-JS-SDK/${version} (${platform})`;
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      async (config) => {
        // Apply custom request interceptors
        for (const interceptor of this.config.interceptors.request || []) {
          config = interceptor(config);
        }

        // Add authentication header if available
        if (this.config.apiKey) {
          config.headers.Authorization = `Bearer ${this.config.apiKey}`;
        }

        // Add request ID for tracing
        config.headers["X-Request-ID"] = SecurityUtils.generateSecureRandom(16);

        // Add timestamp
        config.headers["X-Request-Time"] = new Date().toISOString();

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        // Apply custom response interceptors
        for (const interceptor of this.config.interceptors.response || []) {
          response = interceptor(response);
        }

        // Emit response event
        this.emit("response", {
          url: response.config.url,
          status: response.status,
          duration:
            Date.now() -
            parseInt(
              (response.config.headers["X-Request-Time"] as string) || "0",
            ),
        });

        return response;
      },
      async (error: AxiosError) => {
        // Handle token refresh
        if (
          error.response?.status === 401 &&
          !error.config?.url?.includes("/auth/refresh")
        ) {
          if (!this.refreshPromise) {
            this.refreshPromise = this.handleTokenRefresh();
          }

          try {
            await this.refreshPromise;
            // Retry the original request
            if (error.config) {
              return this.httpClient.request(error.config);
            }
          } catch {
            // Refresh failed, emit auth error
            this.emit("auth:error", error);
            throw new TokenExpiredError(
              "Authentication failed and token refresh failed",
            );
          } finally {
            this.refreshPromise = undefined;
          }
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = NetworkUtils.parseRetryAfter(
            error.response.headers["retry-after"],
          );

          if (retryAfter && retryAfter > 0) {
            this.emit("rateLimited", {
              retryAfter,
              limit: error.response.headers["x-ratelimit-limit"],
              remaining: error.response.headers["x-ratelimit-remaining"],
            });
          }
        }

        // Apply custom error interceptors
        for (const interceptor of this.config.interceptors.error || []) {
          error = interceptor(error);
        }

        // Convert to SDLC exception
        const sdlcError = createErrorFromResponse(
          error.response?.data,
          error.response?.status,
          error.config?.headers?.["X-Request-ID"],
        );

        // Emit error event
        this.emit("error", sdlcError);

        throw sdlcError;
      },
    );
  }

  /**
   * Handle token refresh (to be implemented by auth client)
   */
  protected async handleTokenRefresh(): Promise<void> {
    // This will be overridden by the authentication client
    throw new Error("Token refresh not implemented");
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async request<T = any>(
    config: RequestConfig,
    options: {
      retries?: number;
      retryCondition?: (error: any) => boolean;
    } = {},
  ): Promise<ApiResponse<T>> {
    const retries = options.retries ?? this.config.retries;
    const retryCondition =
      options.retryCondition ?? NetworkUtils.isRetryableError;

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Setup abort controller for timeout
        if (isNode || (isBrowser && "AbortController" in window)) {
          this.abortController = new AbortController();
          config.signal = this.abortController.signal;
        }

        // Make the request
        const response: AxiosResponse<T> = await this.httpClient.request({
          url: config.url,
          method: config.method,
          params: config.params,
          data: config.data,
          headers: config.headers,
          timeout: config.timeout,
        });

        // Transform response
        return this.transformResponse(response);
      } catch (error: any) {
        lastError = error;

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt === retries || !retryCondition(error)) {
          throw error;
        }

        // Calculate delay for exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);

        // Emit retry event
        this.emit("retry", {
          attempt: attempt + 1,
          maxRetries: retries,
          error,
          nextRetryIn: delay,
        });

        // Wait before retrying
        await NetworkUtils.backoff(attempt, this.config.retryDelay);
      }
    }

    throw lastError;
  }

  /**
   * Transform Axios response to API response
   */
  private transformResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      requestId: response.headers["x-request-id"],
      timestamp:
        response.headers["x-response-time"] || new Date().toISOString(),
    };
  }

  /**
   * GET request
   */
  protected async get<T = any>(
    url: string,
    params?: Record<string, any>,
    options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: "GET",
      params,
      ...options,
    });
  }

  /**
   * POST request
   */
  protected async post<T = any>(
    url: string,
    data?: any,
    options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: "POST",
      data,
      ...options,
    });
  }

  /**
   * PUT request
   */
  protected async put<T = any>(
    url: string,
    data?: any,
    options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: "PUT",
      data,
      ...options,
    });
  }

  /**
   * PATCH request
   */
  protected async patch<T = any>(
    url: string,
    data?: any,
    options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: "PATCH",
      data,
      ...options,
    });
  }

  /**
   * DELETE request
   */
  protected async delete<T = any>(
    url: string,
    options?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: "DELETE",
      ...options,
    });
  }

  /**
   * Streaming request (for SSE or chunked responses)
   */
  protected async *stream<T = any>(
    config: RequestConfig,
  ): AsyncGenerator<T, void, unknown> {
    try {
      const response = await fetch(`${this.config.baseURL}${config.url}`, {
        method: config.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: this.config.apiKey
            ? `Bearer ${this.config.apiKey}`
            : "",
          Accept: "text/event-stream",
          ...config.headers,
        },
        body: config.data ? JSON.stringify(config.data) : undefined,
        signal: config.signal,
      });

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new NetworkError("Response body is not readable");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch (error) {
              // Ignore invalid JSON
            }
          }
        }
      }
    } catch (error) {
      throw new NetworkError(`Streaming failed: ${error.message}`);
    }
  }

  /**
   * Upload file with progress tracking
   */
  protected async uploadFile<T = any>(
    url: string,
    file: File | Blob,
    options: {
      field?: string;
      metadata?: Record<string, any>;
      onProgress?: (progress: {
        loaded: number;
        total: number;
        percentage: number;
      }) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(options.field || "file", file);

    // Add metadata
    if (options.metadata) {
      formData.append("metadata", JSON.stringify(options.metadata));
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Setup progress tracking
      if (options.onProgress) {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            options.onProgress!({
              loaded: event.loaded,
              total: event.total,
              percentage,
            });
          }
        });
      }

      // Setup response handler
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              data,
              status: xhr.status,
              statusText: xhr.statusText,
              headers: this.parseXHRHeaders(xhr.getAllResponseHeaders()),
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            reject(new Error("Invalid response"));
          }
        } else {
          reject(new NetworkError(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      });

      // Setup error handler
      xhr.addEventListener("error", () => {
        reject(new NetworkError("Upload failed"));
      });

      // Setup abort handler
      xhr.addEventListener("abort", () => {
        reject(new NetworkError("Upload aborted"));
      });

      // Configure request
      xhr.open("POST", `${this.config.baseURL}${url}`);

      if (this.config.apiKey) {
        xhr.setRequestHeader("Authorization", `Bearer ${this.config.apiKey}`);
      }

      // Setup abort
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          xhr.abort();
        });
      }

      // Send request
      xhr.send(formData);
    });
  }

  /**
   * Parse XHR headers
   */
  private parseXHRHeaders(headerStr: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerPairs = headerStr.split("\u000d\u000a");

    for (const headerPair of headerPairs) {
      const index = headerPair.indexOf("\u003a\u0020");
      if (index > 0) {
        const key = headerPair.substring(0, index);
        const value = headerPair.substring(index + 2);
        headers[key] = value;
      }
    }

    return headers;
  }

  /**
   * Cancel all pending requests
   */
  public cancelAllRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SDLCConfig>): void {
    this.config = ObjectUtils.deepMerge(this.config, config);

    // Update axios instance
    if (config.baseURL) {
      this.httpClient.defaults.baseURL = config.baseURL;
    }
    if (config.timeout) {
      this.httpClient.defaults.timeout = config.timeout;
    }
    if (config.headers) {
      Object.assign(this.httpClient.defaults.headers.common, config.headers);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<Required<SDLCConfig>> {
    return { ...this.config };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.get("/health", undefined, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get service version
   */
  public async getVersion(): Promise<string> {
    try {
      const response = await this.get<{ version: string }>("/version");
      return response.data.version;
    } catch {
      return "unknown";
    }
  }

  /**
   * Close client and cleanup resources
   */
  public close(): void {
    this.cancelAllRequests();
    this.removeAllListeners();
  }
}
