import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const API_TIMEOUT = 30000; // 30 seconds

// API Error types
export interface APIError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.url}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    const apiError: APIError = {
      message: 'An unexpected error occurred',
      status: error.response?.status,
    };

    if (error.response) {
      // Server responded with error
      const data = error.response.data as any;
      apiError.message = data?.message || data?.error || error.message;
      apiError.code = data?.code;
      apiError.details = data?.details;
    } else if (error.request) {
      // Request made but no response
      apiError.message = 'No response from server. Please check your connection.';
    } else {
      // Error setting up request
      apiError.message = error.message;
    }

    // Log error in development
    if (import.meta.env.DEV) {
      console.error('[API Error]', apiError);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }

    return Promise.reject(apiError);
  }
);

export default apiClient;
