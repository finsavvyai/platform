import { useAuthStore } from '../store/authStore';

// In development, use empty string so requests go through Vite's proxy (avoids CORS).
// In production, use VITE_API_URL or same-origin.
const BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || '');

export class APIError extends Error {
    status: number;
    data: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.status = status;
        this.data = data;
        this.name = 'APIError';
    }
}

interface FetchOptions extends RequestInit {
    retries?: number;
    retryDelay?: number;
}

const defaultOptions: FetchOptions = {
    retries: 2,
    retryDelay: 1000,
    headers: {
        'Content-Type': 'application/json',
    },
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const apiClient = async <T>(endpoint: string, options: FetchOptions = {}): Promise<T> => {
    const finalOptions = { ...defaultOptions, ...options };
    const url = `${BASE_URL}${endpoint}`;

    // 1. Request Interceptor: Inject Auth Token
    const state = useAuthStore.getState();
    if (state.token) {
        finalOptions.headers = {
            ...finalOptions.headers,
            Authorization: `Bearer ${state.token}`,
        };
    }

    let attempt = 0;
    const maxRetries = finalOptions.retries || 0;

    while (attempt <= maxRetries) {
        try {
            const response = await fetch(url, finalOptions);

            // 2. Response Interceptor: Handle 401 Unauthorized (Token Expiry)
            if (response.status === 401 && state.refreshToken) {
                // Attempt token refresh
                try {
                    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken: state.refreshToken }),
                    });

                    if (refreshRes.ok) {
                        const data = await refreshRes.json();
                        state.setAuth(data.token, data.refreshToken, state.user!);

                        // Retry original request with new token
                        finalOptions.headers = {
                            ...finalOptions.headers,
                            Authorization: `Bearer ${data.token}`,
                        };
                        const retryResponse = await fetch(url, finalOptions);
                        return handleResponse<T>(retryResponse);
                    } else {
                        // Refresh failed, force logout
                        state.logout();
                        throw new APIError('Session expired. Please login again.', 401);
                    }
                } catch {
                    state.logout();
                    throw new APIError('Session expired. Please login again.', 401);
                }
            }

            // 3. Response Interceptor: Generic Error Handling
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as {
                    error?: string;
                    message?: string;
                };
                throw new APIError(errorData.error || errorData.message || 'An error occurred', response.status, errorData);
            }

            return handleResponse<T>(response);

        } catch (error: unknown) {
            if (error instanceof APIError && error.status !== 429 && error.status < 500) {
                // Don't retry client errors (except rate limits)
                throw error;
            }

            attempt++;
            if (attempt > maxRetries) {
                throw error;
            }

            // 4. Retry Logic: Wait and retry
            await wait((finalOptions.retryDelay || 1000) * attempt);
        }
    }

    throw new Error('Unreachable');
};

async function handleResponse<T>(response: Response): Promise<T> {
    // Return empty string for 204 No Content
    if (response.status === 204) {
        return '' as unknown as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }

    return response.text() as unknown as T;
}

// Convenience methods
apiClient.get = <T>(endpoint: string, options?: FetchOptions) => apiClient<T>(endpoint, { ...options, method: 'GET' });
apiClient.post = <T>(endpoint: string, body: unknown, options?: FetchOptions) => apiClient<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
apiClient.put = <T>(endpoint: string, body: unknown, options?: FetchOptions) => apiClient<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
apiClient.patch = <T>(endpoint: string, body: unknown, options?: FetchOptions) => apiClient<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
apiClient.delete = <T>(endpoint: string, options?: FetchOptions) => apiClient<T>(endpoint, { ...options, method: 'DELETE' });
