import { signOut, useSession } from 'next-auth/react'
import { API_ENDPOINTS } from './constants'

// API base URL - should be configured via environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Create API client class
class ApiClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // Get session to extract token
    const response = await fetch('/api/auth/session')
    const session = await response.json()

    const headers: Record<string, string> = { ...this.defaultHeaders }

    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`
    }

    // Add tenant header if available
    if (session?.user?.tenantId) {
      headers['X-Tenant-ID'] = session.user.tenantId
    }

    return headers
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers = await this.getAuthHeaders()

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      })

      // Handle unauthorized responses
      if (response.status === 401) {
        // Try to refresh token or redirect to login
        await signOut({ redirect: true, callbackUrl: '/auth/signin' })
        throw new Error('Session expired. Please sign in again.')
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection.')
      }
      throw error
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint, this.baseURL)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return this.request<T>(url.pathname + url.search)
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }

  // File upload method
  async upload<T>(endpoint: string, file: File, onProgress?: (progress: number) => void): Promise<T> {
    const headers = await this.getAuthHeaders()
    delete headers['Content-Type'] // Let browser set multipart boundary

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100
            onProgress(progress)
          }
        })
      }

      xhr.addEventListener('load', async () => {
        if (xhr.status === 401) {
          await signOut({ redirect: true, callbackUrl: '/auth/signin' })
          reject(new Error('Session expired. Please sign in again.'))
          return
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (error) {
            reject(new Error('Invalid response from server'))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.message || `HTTP ${xhr.status}`))
          } catch {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error. Please check your connection.'))
      })

      xhr.open('POST', `${this.baseURL}${endpoint}`)

      // Set headers
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })

      const formData = new FormData()
      formData.append('file', file)

      xhr.send(formData)
    })
  }
}

// Create singleton instance
export const apiClient = new ApiClient()

// Hook for using API client with React
export function useApiClient() {
  const { data: session, status } = useSession()

  return {
    apiClient,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    session,
  }
}

// API service functions for common operations
export const authService = {
  async login(credentials: { email: string; password: string }) {
    return apiClient.post('/auth/login', credentials)
  },

  async logout() {
    await apiClient.post('/auth/logout')
  },

  async refreshToken() {
    return apiClient.post('/auth/refresh')
  },

  async forgotPassword(email: string) {
    return apiClient.post('/auth/forgot-password', { email })
  },

  async resetPassword(token: string, password: string) {
    return apiClient.post('/auth/reset-password', { token, password })
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return apiClient.post('/auth/change-password', { oldPassword, newPassword })
  },
}

export const userService = {
  async getUsers(params?: { page?: number; limit?: number; search?: string }) {
    return apiClient.get('/users', params)
  },

  async getUser(id: string) {
    return apiClient.get(`/users/${id}`)
  },

  async createUser(userData: any) {
    return apiClient.post('/users', userData)
  },

  async updateUser(id: string, userData: any) {
    return apiClient.put(`/users/${id}`, userData)
  },

  async deleteUser(id: string) {
    return apiClient.delete(`/users/${id}`)
  },

  async getUserRoles() {
    return apiClient.get('/users/roles')
  },

  async updateUserRole(userId: string, roleId: string) {
    return apiClient.put(`/users/${userId}/role`, { roleId })
  },
}

export const tenantService = {
  async getTenants() {
    return apiClient.get('/tenants')
  },

  async getTenant(id: string) {
    return apiClient.get(`/tenants/${id}`)
  },

  async createTenant(tenantData: any) {
    return apiClient.post('/tenants', tenantData)
  },

  async updateTenant(id: string, tenantData: any) {
    return apiClient.put(`/tenants/${id}`, tenantData)
  },

  async deleteTenant(id: string) {
    return apiClient.delete(`/tenants/${id}`)
  },

  async getTenantSettings(id: string) {
    return apiClient.get(`/tenants/${id}/settings`)
  },

  async updateTenantSettings(id: string, settings: any) {
    return apiClient.put(`/tenants/${id}/settings`, settings)
  },
}

export const policyService = {
  async getPolicies(params?: { page?: number; limit?: number; type?: string }) {
    return apiClient.get('/policies', params)
  },

  async getPolicy(id: string) {
    return apiClient.get(`/policies/${id}`)
  },

  async createPolicy(policyData: any) {
    return apiClient.post('/policies', policyData)
  },

  async updatePolicy(id: string, policyData: any) {
    return apiClient.put(`/policies/${id}`, policyData)
  },

  async deletePolicy(id: string) {
    return apiClient.delete(`/policies/${id}`)
  },

  async testPolicy(policyData: any, testData: any) {
    return apiClient.post('/policies/test', { policy: policyData, testCases: testData })
  },

  async deployPolicy(id: string) {
    return apiClient.post(`/policies/${id}/deploy`)
  },

  async getPolicyEvaluations(params?: { policyId?: string; dateFrom?: string; dateTo?: string }) {
    return apiClient.get('/policy-evaluations', params)
  },
}

export const documentService = {
  async getDocuments(params?: { page?: number; limit?: number; search?: string; type?: string }) {
    return apiClient.get('/documents', params)
  },

  async getDocument(id: string) {
    return apiClient.get(`/documents/${id}`)
  },

  async uploadDocument(file: File, metadata?: any, onProgress?: (progress: number) => void) {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata))
    }

    return apiClient.upload('/documents', file, onProgress)
  },

  async deleteDocument(id: string) {
    return apiClient.delete(`/documents/${id}`)
  },

  async getDocumentChunks(documentId: string) {
    return apiClient.get(`/documents/${documentId}/chunks`)
  },

  async reprocessDocument(id: string) {
    return apiClient.post(`/documents/${id}/reprocess`)
  },
}

export const analyticsService = {
  async getOverview(timeframe?: string) {
    return apiClient.get('/analytics/overview', { timeframe })
  },

  async getUserAnalytics(params?: { dateFrom?: string; dateTo?: string; groupBy?: string }) {
    return apiClient.get('/analytics/users', params)
  },

  async getDocumentAnalytics(params?: { dateFrom?: string; dateTo?: string; tenantId?: string }) {
    return apiClient.get('/analytics/documents', params)
  },

  async getTokenUsage(params?: { dateFrom?: string; dateTo?: string; provider?: string }) {
    return apiClient.get('/analytics/token-usage', params)
  },

  async getPerformanceMetrics() {
    return apiClient.get('/analytics/performance')
  },

  async exportReport(type: string, params?: any) {
    return apiClient.post('/analytics/export', { type, params })
  },
}

export const settingsService = {
  async getSettings() {
    return apiClient.get('/settings')
  },

  async updateSettings(settings: any) {
    return apiClient.put('/settings', settings)
  },

  async getSystemInfo() {
    return apiClient.get('/settings/system')
  },

  async getApiKeys() {
    return apiClient.get('/settings/api-keys')
  },

  async createApiKey(keyData: any) {
    return apiClient.post('/settings/api-keys', keyData)
  },

  async revokeApiKey(keyId: string) {
    return apiClient.delete(`/settings/api-keys/${keyId}`)
  },
}

export default apiClient
