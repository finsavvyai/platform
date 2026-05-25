// Client configuration and initialization

import axios from "axios";
import type { AxiosInstance } from "axios";
import type { SDLCConfig } from "../types";
import { ObjectUtils, isNode, isBrowser } from "../utils";

/**
 * Normalize configuration with defaults
 */
export function normalizeConfig(config: SDLCConfig): Required<SDLCConfig> {
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
    learning: false,
  };

  return ObjectUtils.deepMerge(defaults, config);
}

/**
 * Get user agent string
 */
export function getUserAgent(): string {
  const version = process.env.npm_package_version || "1.0.0";
  const platform = isNode ? "Node.js" : isBrowser ? "Browser" : "Unknown";
  return `SDLC-JS-SDK/${version} (${platform})`;
}

/**
 * Create the axios HTTP client instance
 */
export function createHttpClient(
  config: Required<SDLCConfig>,
  userAgent: string
): AxiosInstance {
  return axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      ...config.headers,
    },
  });
}
