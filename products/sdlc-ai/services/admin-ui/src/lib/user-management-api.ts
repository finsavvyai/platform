import type {
  BulkUserOperation,
  CreateTenantRequest,
  CreateUserRequest,
  Tenant,
  TenantListResponse,
  TenantUsageResponse,
  UpdateTenantRequest,
  UpdateUserRequest,
  User,
  UserActivityResponse,
  UserListParams,
  UserListResponse,
  UserRole,
  UserStatsResponse,
} from '@/types/user-management'
import { API_ENDPOINTS } from './constants'
import { apiClient } from './api-client'

const DEFAULT_PAGE_SIZE = 20

export const userManagementApi = {
  async listUsers(params: UserListParams = {}) {
    const searchParams: Record<string, string> = {}

    if (params.search) {
      searchParams.search = params.search
    }

    if (params.status?.length) {
      searchParams.status = params.status.join(',')
    }

    if (params.role?.length) {
      searchParams.role = params.role.join(',')
    }

    if (params.tenant?.length) {
      searchParams.tenant = params.tenant.join(',')
    }

    if (params.department?.length) {
      searchParams.department = params.department.join(',')
    }

    if (params.location?.length) {
      searchParams.location = params.location.join(',')
    }

    if (params.mfaEnabled !== undefined) {
      searchParams.mfa_enabled = String(params.mfaEnabled)
    }

    if (params.emailVerified !== undefined) {
      searchParams.email_verified = String(params.emailVerified)
    }

    searchParams.limit = String(params.limit ?? DEFAULT_PAGE_SIZE)
    searchParams.offset = String(params.offset ?? 0)

    if (params.sort) {
      searchParams.sort = params.sort
    }

    return apiClient.get<UserListResponse>(API_ENDPOINTS.users.list, searchParams)
  },

  async getUser(id: string) {
    return apiClient.get<User>(API_ENDPOINTS.users.get(id))
  },

  async createUser(payload: CreateUserRequest) {
    return apiClient.post<User>(API_ENDPOINTS.users.create, payload)
  },

  async updateUser(id: string, payload: UpdateUserRequest) {
    return apiClient.put<User>(API_ENDPOINTS.users.update(id), payload)
  },

  async deleteUser(id: string) {
    return apiClient.delete<void>(API_ENDPOINTS.users.delete(id))
  },

  async bulkUsers(payload: BulkUserOperation) {
    return apiClient.post<{ jobId: string }>(API_ENDPOINTS.users.bulk, payload)
  },

  async getUserActivity(id: string, params?: { limit?: number }) {
    return apiClient.get<UserActivityResponse>(API_ENDPOINTS.users.activity(id), params)
  },

  async getUserStats() {
    return apiClient.get<UserStatsResponse>(API_ENDPOINTS.users.stats)
  },

  async listRoles() {
    return apiClient.get<UserRole[]>(API_ENDPOINTS.users.roles)
  },

  async listTenants(params: Record<string, string | number | boolean | string[]> = {}) {
    const searchParams: Record<string, string> = {}

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      if (Array.isArray(value)) {
        if (value.length > 0) {
          searchParams[key] = value.join(',')
        }
        return
      }
      searchParams[key] = String(value)
    })

    return apiClient.get<TenantListResponse>(API_ENDPOINTS.tenants.list, searchParams)
  },

  async getTenant(id: string) {
    return apiClient.get<Tenant>(API_ENDPOINTS.tenants.get(id))
  },

  async createTenant(payload: CreateTenantRequest) {
    return apiClient.post<Tenant>(API_ENDPOINTS.tenants.create, payload)
  },

  async updateTenant(id: string, payload: UpdateTenantRequest) {
    return apiClient.put<Tenant>(API_ENDPOINTS.tenants.update(id), payload)
  },

  async deleteTenant(id: string) {
    return apiClient.delete<void>(API_ENDPOINTS.tenants.delete(id))
  },

  async getTenantUsage(id: string) {
    return apiClient.get<TenantUsageResponse>(API_ENDPOINTS.tenants.usage(id))
  },

  async getTenantActivity(id: string) {
    return apiClient.get<UserActivityResponse>(API_ENDPOINTS.tenants.activity(id))
  },
}
