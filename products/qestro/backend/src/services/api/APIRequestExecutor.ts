'use strict';

/**
 * API Request Executor
 * Handles HTTP requests with retry logic and auth
 */

interface RunnerConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  auth?: { type: 'Bearer' | 'Basic' | 'ApiKey'; value: string; headerName?: string };
  timeout: number;
}

interface APIResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  size: number;
}

export class APIRequestExecutor {
  private config: RunnerConfig;

  constructor(config: RunnerConfig = {}) {
    this.config = config;
  }

  /**
   * Execute HTTP request with retry logic
   */
  async execute(request: APIRequest): Promise<APIResponse> {
    let lastError: Error | null = null;
    const maxAttempts = (this.config.retries || 0) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.performRequest(request);
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay || 1000)
          );
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Perform a single HTTP request
   */
  private async performRequest(request: APIRequest): Promise<APIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeout);

    try {
      const fetchInit: RequestInit = {
        method: request.method,
        headers: this.buildHeaders(request),
        signal: controller.signal,
      };

      if (request.body) {
        fetchInit.body = typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body);
      }

      const startTime = Date.now();
      const response = await fetch(request.url, fetchInit);
      const responseTime = Date.now() - startTime;

      const responseBody = await response.text();
      const size = responseBody.length;

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers as any),
        body: this.tryParseJSON(responseBody),
        responseTime,
        size,
      };
    } catch (error: unknown) {
      if ((error as any).name === 'AbortError') {
        throw new Error(`Request timeout after ${request.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute GraphQL request
   */
  async executeGraphQL(params: {
    url: string;
    query: string;
    variables?: Record<string, any>;
    auth?: any;
    headers?: Record<string, string>;
    timeout: number;
  }): Promise<any> {
    const request: APIRequest = {
      method: 'POST',
      url: params.url,
      headers: {
        'Content-Type': 'application/json',
        ...(params.headers || {}),
      },
      body: {
        query: params.query,
        ...(params.variables && { variables: params.variables }),
      },
      auth: params.auth,
      timeout: params.timeout,
    };

    const response = await this.execute(request);

    if (response.body?.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(response.body.errors)}`);
    }

    return response;
  }

  /**
   * Build request headers with authentication
   */
  private buildHeaders(request: APIRequest): Record<string, string> {
    const headers = { ...request.headers };

    if (request.auth) {
      switch (request.auth.type) {
        case 'Bearer':
          headers['Authorization'] = `Bearer ${request.auth.value}`;
          break;
        case 'Basic':
          headers['Authorization'] = `Basic ${Buffer.from(request.auth.value).toString('base64')}`;
          break;
        case 'ApiKey':
          headers[request.auth.headerName || 'X-API-Key'] = request.auth.value;
          break;
      }
    }

    return headers;
  }

  /**
   * Try to parse JSON string
   */
  private tryParseJSON(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}
