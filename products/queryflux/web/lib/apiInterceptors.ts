/**
 * Axios interceptor setup — request auth injection, response retry/refresh/offline
 */

import { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type { APIError, RetryConfig } from './apiClientTypes';

export interface InterceptorOptions {
  retryConfig: RetryConfig;
  generateRequestId: () => string;
  isTokenExpiringSoon: (token: string) => boolean;
  refreshAuthToken: () => Promise<string>;
  shouldRetry: (error: AxiosError) => boolean;
  delay: (ms: number) => Promise<void>;
  getIsOnline: () => boolean;
  queueOfflineRequest: (config: InternalAxiosRequestConfig) => Promise<unknown>;
}

export function setupInterceptors(client: AxiosInstance, opts: InterceptorOptions): void {
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      let token = localStorage.getItem('auth_token');
      if (token && opts.isTokenExpiringSoon(token)) {
        try { token = await opts.refreshAuthToken(); }
        catch (err) { console.error('Failed to refresh token:', err); }
      }
      if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
      config.headers['X-Request-ID'] = opts.generateRequestId();
      if (import.meta.env.DEV) {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
      }
      return config;
    },
    (error: unknown) => Promise.reject(error),
  );

  client.interceptors.response.use(
    (response: AxiosResponse) => {
      if (import.meta.env.DEV) console.log(`[API Response] ${response.config.url}`, response.data);
      return response;
    },
    async (error: AxiosError) => {
      const data = error.response?.data as Record<string, string> | undefined;
      const apiError: APIError = {
        message: data?.message ?? data?.error ?? error.message ?? 'An unexpected error occurred',
        status: error.response?.status,
        code: data?.code,
        details: (error.response?.data as Record<string, unknown>)?.details,
      };
      if (import.meta.env.DEV) console.error('[API Error]', apiError);

      const cfg = error.config as (InternalAxiosRequestConfig & Record<string, unknown>) | undefined;
      if (error.response?.status === 401 && !cfg?.['_retry']) {
        try {
          const newToken = await opts.refreshAuthToken();
          if (newToken && cfg?.headers) {
            cfg.headers.Authorization = `Bearer ${newToken}`;
            cfg['_retry'] = true;
            return client.request(cfg);
          }
        } catch {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }

      if (opts.shouldRetry(error)) {
        const retryCount = (cfg?.['_retryCount'] as number) || 0;
        if (retryCount < opts.retryConfig.retries) {
          const retryCfg = (cfg ?? {}) as InternalAxiosRequestConfig & Record<string, unknown>;
          retryCfg['_retryCount'] = retryCount + 1;
          await opts.delay(opts.retryConfig.retryDelay * (retryCount + 1));
          console.log(`Retrying (attempt ${retryCount + 1}/${opts.retryConfig.retries})`);
          return client.request(retryCfg);
        }
      }

      if (!opts.getIsOnline() && cfg?.method?.toLowerCase() === 'post') {
        return opts.queueOfflineRequest(cfg);
      }

      return Promise.reject(apiError);
    },
  );
}
