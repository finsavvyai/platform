// HTTP interceptor setup for the base client

import type { AxiosInstance, AxiosError, AxiosResponse } from "axios";
import type { EventEmitter } from "eventemitter3";
import type { SDLCConfig, RequestConfig } from "../types";
import { createErrorFromResponse, TokenExpiredError } from "../exceptions";
import { SecurityUtils, NetworkUtils } from "../utils";

interface InterceptorContext {
  config: Required<SDLCConfig>;
  httpClient: AxiosInstance;
  emitter: EventEmitter;
  getRefreshPromise: () => Promise<void> | undefined;
  setRefreshPromise: (p: Promise<void> | undefined) => void;
  handleTokenRefresh: () => Promise<void>;
}

/**
 * Setup request and response interceptors on the HTTP client
 */
export function setupInterceptors(ctx: InterceptorContext): void {
  // Request interceptor
  ctx.httpClient.interceptors.request.use(
    async (axiosConfig) => {
      for (const interceptor of ctx.config.interceptors.request || []) {
        axiosConfig = interceptor(axiosConfig as RequestConfig) as typeof axiosConfig;
      }

      if (ctx.config.apiKey) {
        axiosConfig.headers.Authorization = `Bearer ${ctx.config.apiKey}`;
      }

      axiosConfig.headers["X-Request-ID"] = SecurityUtils.generateSecureRandom(16);
      axiosConfig.headers["X-Request-Time"] = new Date().toISOString();

      return axiosConfig;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor
  ctx.httpClient.interceptors.response.use(
    (response) => {
      for (const interceptor of ctx.config.interceptors.response || []) {
        response = interceptor(response) as AxiosResponse;
      }

      ctx.emitter.emit("response", {
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
      if (
        error.response?.status === 401 &&
        !error.config?.url?.includes("/auth/refresh")
      ) {
        if (!ctx.getRefreshPromise()) {
          ctx.setRefreshPromise(ctx.handleTokenRefresh());
        }

        try {
          await ctx.getRefreshPromise();
          if (error.config) {
            return ctx.httpClient.request(error.config);
          }
        } catch {
          ctx.emitter.emit("auth:error", error);
          throw new TokenExpiredError(
            "Authentication failed and token refresh failed",
          );
        } finally {
          ctx.setRefreshPromise(undefined);
        }
      }

      if (error.response?.status === 429) {
        const retryAfter = NetworkUtils.parseRetryAfter(
          error.response.headers["retry-after"],
        );

        if (retryAfter && retryAfter > 0) {
          ctx.emitter.emit("rateLimited", {
            retryAfter,
            limit: error.response.headers["x-ratelimit-limit"],
            remaining: error.response.headers["x-ratelimit-remaining"],
          });
        }
      }

      for (const interceptor of ctx.config.interceptors.error || []) {
        error = interceptor(error) as AxiosError;
      }

      const responseData =
        typeof error.response?.data === "object" && error.response?.data !== null
          ? (error.response.data as Record<string, unknown>)
          : {};
      const requestId = error.config?.headers?.["X-Request-ID"];
      const sdlcError = createErrorFromResponse(
        responseData,
        error.response?.status,
        typeof requestId === "string" ? requestId : undefined,
      );

      ctx.emitter.emit("error", sdlcError);
      throw sdlcError;
    },
  );
}
