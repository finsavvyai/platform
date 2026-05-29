/**
 * Shared types for the enhanced API client modules
 */

import { AxiosError, InternalAxiosRequestConfig } from 'axios';

export interface APIError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: AxiosError) => boolean;
}

export interface QueuedRequest {
  config: InternalAxiosRequestConfig;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timestamp: number;
}
