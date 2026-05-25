/**
 * HTTP client for Qestro backend API
 */

import { ApiResponse, ApiError } from '../types.js';

const API_URL = process.env.QESTRO_API_URL || 'http://localhost:3001/api';
const API_TOKEN = process.env.QESTRO_API_TOKEN;

/**
 * Make an authenticated HTTP request to Qestro API
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (API_TOKEN) {
    headers['Authorization'] = `Bearer ${API_TOKEN}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const body = await response.text();

    if (!response.ok) {
      const error: ApiError = new Error(`API Error: ${response.statusText}`);
      error.statusCode = response.status;
      error.body = body;
      throw error;
    }

    const data = body ? JSON.parse(body) : null;

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode =
      error instanceof Error && 'statusCode' in error
        ? (error as ApiError).statusCode
        : undefined;

    return {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * GET request helper
 */
export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'GET',
  });
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  endpoint: string,
  body: unknown,
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(
  endpoint: string,
  body: unknown,
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Validate API connection and token
 */
export async function validateApiConnection(): Promise<boolean> {
  try {
    const response = await apiGet<{ status: string }>('/health');
    return response.success;
  } catch {
    return false;
  }
}
