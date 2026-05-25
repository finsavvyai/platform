// Qestro API Client — composed from domain modules
// Each module stays under 200 lines for maintainability.

import { createAuthApi } from './auth';
import { createTestingApi } from './testing';
import { createDevicesApi } from './devices';
import { createSecurityApi } from './security';
import { createDashboardApi } from './dashboard';
import { createIntegrationsApi } from './integrations';
import { createAiRecorderApi } from './ai-recorder';
import { createAiAgentApi } from './ai-agent';
import { createBillingApi } from './billing';
import { createNotificationsApi } from './notifications';
import { createVisualRegressionApi } from './visual-regression';
import { createOnboardingApi } from './onboarding';
import { LOCAL_API_ORIGIN, LOCAL_WS_ORIGIN } from '../../config/devDefaults';

class QestroAPICore {
  private baseURL: string;
  private wsURL: string;
  private ws: WebSocket | null = null;
  private wsReconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor() {
    this.baseURL =
      import.meta.env.VITE_API_URL ||
      (window.location.hostname === 'localhost'
        ? LOCAL_API_ORIGIN
        : window.location.origin);
    this.wsURL = import.meta.env.VITE_WS_URL || LOCAL_WS_ORIGIN;
  }

  private readAuthToken() {
    return (
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token')
    );
  }

  /** Internal fetch — exposed to domain modules via bound reference */
  async apiFetch(endpoint: string, options?: RequestInit) {
    const token = this.readAuthToken();

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API Error: ${response.status}`);
      }

      return response.json();
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'TypeError' &&
        error.message === 'Failed to fetch'
      ) {
        throw new Error(
          'Connection failed: Backend server is unreachable. Mock fallback is disabled in this environment.'
        );
      }
      throw error;
    }
  }

  // ===== WebSocket =====
  connectWebSocket(
    onMessage: (data: unknown) => void,
    onError?: (error: Event) => void
  ) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    try {
      const token = this.readAuthToken();
      const wsUrl = new URL(this.wsURL);
      if (token) {
        wsUrl.searchParams.set('token', token);
      }

      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.wsReconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect(onMessage, onError);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      return this.ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      throw error;
    }
  }

  private attemptReconnect(
    onMessage: (data: unknown) => void,
    onError?: (error: Event) => void
  ) {
    if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
      this.wsReconnectAttempts++;
      const delay =
        this.reconnectDelay *
        Math.pow(2, this.wsReconnectAttempts - 1);

      console.log(
        `Attempting WebSocket reconnection ` +
          `(${this.wsReconnectAttempts}/${this.maxReconnectAttempts}) ` +
          `in ${delay}ms`
      );

      setTimeout(() => {
        this.connectWebSocket(onMessage, onError);
      }, delay);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ===== Health =====
  async healthCheck() {
    return this.apiFetch('/api/health');
  }

  async isBackendAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

function createQestroAPI() {
  const core = new QestroAPICore();
  const fetchFn = core.apiFetch.bind(core);

  return Object.assign(core, {
    ...createAuthApi(fetchFn),
    ...createTestingApi(fetchFn),
    ...createDevicesApi(fetchFn),
    ...createSecurityApi(fetchFn),
    ...createDashboardApi(fetchFn),
    ...createIntegrationsApi(fetchFn),
    ...createAiRecorderApi(fetchFn),
    ...createAiAgentApi(fetchFn),
    ...createBillingApi(fetchFn),
    ...createNotificationsApi(fetchFn),
    ...createVisualRegressionApi(fetchFn),
    ...createOnboardingApi(fetchFn),
  });
}

export const api = createQestroAPI();

// Re-export types for consumers
export type QestroAPI = typeof api;
