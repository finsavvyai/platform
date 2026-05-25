/**
 * API service for communicating with the Multi-Database Manager server
 */

import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import NetInfo from '@react-native-community/netinfo';
import {showMessage} from 'react-native-flash-message';

import {StorageService} from './StorageService';

class ApiServiceClass {
  private axiosInstance: AxiosInstance;
  private baseURL: string = '';
  private authToken: string | null = null;
  private isOnline: boolean = true;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupNetworkMonitoring();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add auth token if available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Check network connectivity
        if (!this.isOnline) {
          return Promise.reject(new Error('No internet connection'));
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Clear stored auth data
          await this.clearAuthToken();
          
          showMessage({
            message: 'Session Expired',
            description: 'Please log in again',
            type: 'warning',
          });

          return Promise.reject(error);
        }

        // Handle network errors
        if (!error.response) {
          showMessage({
            message: 'Network Error',
            description: 'Please check your internet connection',
            type: 'danger',
          });
        }

        return Promise.reject(error);
      }
    );
  }

  private setupNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      
      if (!this.isOnline) {
        showMessage({
          message: 'Connection Lost',
          description: 'You are now offline',
          type: 'warning',
        });
      }
    });
  }

  setBaseURL(url: string) {
    this.baseURL = url;
    this.axiosInstance.defaults.baseURL = url;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  async clearAuthToken() {
    this.authToken = null;
    await StorageService.removeSecureItem('auth_token');
  }

  // HTTP Methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete(url, config);
  }

  // Utility methods
  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Test connection to server
  async testConnection(url: string): Promise<boolean> {
    try {
      const testInstance = axios.create({
        baseURL: url,
        timeout: 10000,
      });

      const response = await testInstance.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

export const ApiService = new ApiServiceClass();