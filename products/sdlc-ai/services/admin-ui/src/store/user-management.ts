import { create } from 'zustand'
import { userManagementApi } from '@/lib/user-management-api'
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
  UserActivity,
  UserListParams,
  UserRole,
  UserStatsResponse,
} from '@/types/user-management'

type LoadingKey =
  | 'fetchUsers'
  | 'fetchUser'
  | 'createUser'
  | 'updateUser'
  | 'deleteUser'
  | 'bulkUsers'
  | 'fetchUserStats'
  | 'fetchUserActivity'
  | 'fetchRoles'
  | 'fetchTenants'
  | 'fetchTenant'
  | 'createTenant'
  | 'updateTenant'
  | 'deleteTenant'
  | 'fetchTenantUsage'

interface PaginationState {
  limit: number
  offset: number
  sort?: string
}

interface UserManagementState {
  users: User[]
  totalUsers: number
  userPagination: PaginationState
  userFilters: UserListParams
  selectedUserIds: string[]
  currentUser: User | null
  userActivity: UserActivity[]
  userActivityTotal: number
  userStats: UserStatsResponse | null
  userRoles: UserRole[]

  tenants: Tenant[]
  totalTenants: number
  tenantPagination: PaginationState
  tenantFilters: Record<string, any>
  currentTenant: Tenant | null
  tenantUsage: TenantUsageResponse | null

  loading: Partial<Record<LoadingKey, boolean>>
  errors: Partial<Record<LoadingKey, string | null>>

  setFilter: (filters: Partial<UserListParams>) => void
  setPagination: (pagination: Partial<PaginationState>) => void
  setSelectedUserIds: (ids: string[]) => void
  setTenantFilters: (filters: Record<string, any>) => void

  fetchUsers: (params?: Partial<UserListParams>) => Promise<void>
  fetchUser: (id: string) => Promise<User | null>
  createUser: (payload: CreateUserRequest) => Promise<User>
  updateUser: (id: string, payload: UpdateUserRequest) => Promise<User>
  deleteUser: (id: string) => Promise<void>
  runBulkOperation: (payload: BulkUserOperation) => Promise<string>
  fetchUserStats: () => Promise<void>
  fetchUserActivity: (id: string, params?: { limit?: number; offset?: number }) => Promise<void>
  fetchUserRoles: () => Promise<void>

  fetchTenants: (params?: Record<string, string | number | boolean>) => Promise<TenantListResponse>
  fetchTenant: (id: string) => Promise<Tenant | null>
  createTenant: (payload: CreateTenantRequest) => Promise<Tenant>
  updateTenant: (id: string, payload: UpdateTenantRequest) => Promise<Tenant>
  deleteTenant: (id: string) => Promise<void>
  fetchTenantUsage: (id: string) => Promise<TenantUsageResponse | null>

  clearCurrentUser: () => void
  clearCurrentTenant: () => void
  reset: () => void
}

const DEFAULT_PAGINATION: PaginationState = {
  limit: 20,
  offset: 0,
  sort: 'created_at:desc',
}

const INITIAL_STATE: Omit<UserManagementState,
  | 'setFilter'
  | 'setPagination'
  | 'setSelectedUserIds'
  | 'fetchUsers'
  | 'fetchUser'
  | 'createUser'
  | 'updateUser'
  | 'deleteUser'
  | 'runBulkOperation'
  | 'fetchUserStats'
  | 'fetchUserActivity'
  | 'fetchUserRoles'
  | 'fetchTenants'
  | 'fetchTenant'
  | 'createTenant'
  | 'updateTenant'
  | 'deleteTenant'
  | 'fetchTenantUsage'
  | 'clearCurrentUser'
  | 'clearCurrentTenant'
  | 'reset'
> = {
  users: [],
  totalUsers: 0,
  userPagination: DEFAULT_PAGINATION,
  userFilters: {},
  selectedUserIds: [],
  currentUser: null,
  userActivity: [],
  userActivityTotal: 0,
  userStats: null,
  userRoles: [],
  tenants: [],
  totalTenants: 0,
  tenantPagination: DEFAULT_PAGINATION,
  tenantFilters: {},
  currentTenant: null,
  tenantUsage: null,
  loading: {},
  errors: {},
}

export const useUserManagementStore = create<UserManagementState>((set, get) => ({
  ...INITIAL_STATE,

  setFilter: (filters) => {
    set((state) => {
      const nextFilters: UserListParams = {
        ...state.userFilters,
        ...filters,
      }

      Object.entries(filters).forEach(([key, value]) => {
        const typedKey = key as keyof UserListParams
        if (
          value === undefined ||
          value === null ||
          (Array.isArray(value) && value.length === 0)
        ) {
          delete nextFilters[typedKey]
        }
      })

      return { userFilters: nextFilters }
    })
  },

  setPagination: (pagination) => {
    set((state) => ({
      userPagination: {
        ...state.userPagination,
        ...pagination,
      },
    }))
  },

  setSelectedUserIds: (ids) => {
    set({ selectedUserIds: ids })
  },

  setTenantFilters: (filters) => {
    set((state) => {
      const nextFilters = {
        ...state.tenantFilters,
        ...filters,
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
          delete nextFilters[key]
        }
      })

      return { tenantFilters: nextFilters }
    })
  },

  async fetchUsers(params = {}) {
    const { userFilters, userPagination } = get()
    set((state) => ({
      loading: { ...state.loading, fetchUsers: true },
      errors: { ...state.errors, fetchUsers: null },
    }))

    try {
      const mergedFilters: UserListParams = {
        ...userFilters,
        ...params,
      }

      const result = await userManagementApi.listUsers({
        ...mergedFilters,
        limit: mergedFilters.limit ?? userPagination.limit,
        offset: mergedFilters.offset ?? userPagination.offset,
        sort: mergedFilters.sort ?? userPagination.sort,
      })

      const nextPagination: PaginationState = {
        limit: result.limit ?? userPagination.limit,
        offset: (result.page - 1) * (result.limit ?? userPagination.limit),
        sort: mergedFilters.sort ?? userPagination.sort,
      }

      set({
        users: result.users,
        totalUsers: result.total,
        userFilters: mergedFilters,
        userPagination: nextPagination,
      })
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchUsers: error instanceof Error ? error.message : 'Failed to load users',
        },
      }))
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchUsers: false },
      }))
    }
  },

  async fetchUser(id) {
    set((state) => ({
      loading: { ...state.loading, fetchUser: true },
      errors: { ...state.errors, fetchUser: null },
    }))

    try {
      const user = await userManagementApi.getUser(id)
      set({ currentUser: user })
      return user
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchUser: error instanceof Error ? error.message : 'Failed to load user',
        },
      }))
      return null
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchUser: false },
      }))
    }
  },

  async createUser(payload) {
    set((state) => ({
      loading: { ...state.loading, createUser: true },
      errors: { ...state.errors, createUser: null },
    }))

    try {
      const user = await userManagementApi.createUser(payload)
      set((state) => ({
        users: [user, ...state.users],
        totalUsers: state.totalUsers + 1,
      }))
      return user
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user'
      set((state) => ({
        errors: { ...state.errors, createUser: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, createUser: false },
      }))
    }
  },

  async updateUser(id, payload) {
    set((state) => ({
      loading: { ...state.loading, updateUser: true },
      errors: { ...state.errors, updateUser: null },
    }))

    try {
      const updated = await userManagementApi.updateUser(id, payload)
      set((state) => ({
        users: state.users.map((user) => (user.id === id ? updated : user)),
        currentUser: state.currentUser?.id === id ? updated : state.currentUser,
      }))
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user'
      set((state) => ({
        errors: { ...state.errors, updateUser: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, updateUser: false },
      }))
    }
  },

  async deleteUser(id) {
    set((state) => ({
      loading: { ...state.loading, deleteUser: true },
      errors: { ...state.errors, deleteUser: null },
    }))

    try {
      await userManagementApi.deleteUser(id)
      set((state) => ({
        users: state.users.filter((user) => user.id !== id),
        totalUsers: Math.max(0, state.totalUsers - 1),
        currentUser: state.currentUser?.id === id ? null : state.currentUser,
        selectedUserIds: state.selectedUserIds.filter((userId) => userId !== id),
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user'
      set((state) => ({
        errors: { ...state.errors, deleteUser: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, deleteUser: false },
      }))
    }
  },

  async runBulkOperation(payload) {
    set((state) => ({
      loading: { ...state.loading, bulkUsers: true },
      errors: { ...state.errors, bulkUsers: null },
    }))

    try {
      const { jobId } = await userManagementApi.bulkUsers(payload)
      return jobId
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run bulk operation'
      set((state) => ({
        errors: { ...state.errors, bulkUsers: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, bulkUsers: false },
      }))
    }
  },

  async fetchUserStats() {
    set((state) => ({
      loading: { ...state.loading, fetchUserStats: true },
      errors: { ...state.errors, fetchUserStats: null },
    }))

    try {
      const stats = await userManagementApi.getUserStats()
      set({ userStats: stats })
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchUserStats: error instanceof Error ? error.message : 'Failed to load user stats',
        },
      }))
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchUserStats: false },
      }))
    }
  },

  async fetchUserActivity(id, params = {}) {
    set((state) => ({
      loading: { ...state.loading, fetchUserActivity: true },
      errors: { ...state.errors, fetchUserActivity: null },
    }))

    try {
      const result = await userManagementApi.getUserActivity(id, { limit: params.limit })
      set({
        userActivity: result.activities,
        userActivityTotal: result.total,
      })
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchUserActivity: error instanceof Error ? error.message : 'Failed to load user activity',
        },
      }))
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchUserActivity: false },
      }))
    }
  },

  async fetchUserRoles() {
    set((state) => ({
      loading: { ...state.loading, fetchRoles: true },
      errors: { ...state.errors, fetchRoles: null },
    }))

    try {
      const roles = await userManagementApi.listRoles()
      set({ userRoles: roles })
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchRoles: error instanceof Error ? error.message : 'Failed to load roles',
        },
      }))
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchRoles: false },
      }))
    }
  },

  async fetchTenants(params = {}) {
    set((state) => ({
      loading: { ...state.loading, fetchTenants: true },
      errors: { ...state.errors, fetchTenants: null },
    }))

    try {
      const { tenantFilters, tenantPagination } = get()
      const mergedFilters = { ...tenantFilters, ...params }
      const response = await userManagementApi.listTenants(mergedFilters)
      set({
        tenants: response.tenants,
        totalTenants: response.total,
        tenantFilters: mergedFilters,
        tenantPagination: {
          limit: response.limit,
          offset: (response.page - 1) * response.limit,
          sort: mergedFilters.sort
            ? String(mergedFilters.sort)
            : tenantPagination.sort ?? DEFAULT_PAGINATION.sort,
        },
      })
      return response
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchTenants: error instanceof Error ? error.message : 'Failed to load tenants',
        },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchTenants: false },
      }))
    }
  },

  async fetchTenant(id) {
    set((state) => ({
      loading: { ...state.loading, fetchTenant: true },
      errors: { ...state.errors, fetchTenant: null },
    }))

    try {
      const tenant = await userManagementApi.getTenant(id)
      set({ currentTenant: tenant })
      return tenant
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchTenant: error instanceof Error ? error.message : 'Failed to load tenant',
        },
      }))
      return null
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchTenant: false },
      }))
    }
  },

  async createTenant(payload) {
    set((state) => ({
      loading: { ...state.loading, createTenant: true },
      errors: { ...state.errors, createTenant: null },
    }))

    try {
      const tenant = await userManagementApi.createTenant(payload)
      set((state) => ({
        tenants: [tenant, ...state.tenants],
        totalTenants: state.totalTenants + 1,
      }))
      return tenant
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create tenant'
      set((state) => ({
        errors: { ...state.errors, createTenant: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, createTenant: false },
      }))
    }
  },

  async updateTenant(id, payload) {
    set((state) => ({
      loading: { ...state.loading, updateTenant: true },
      errors: { ...state.errors, updateTenant: null },
    }))

    try {
      const tenant = await userManagementApi.updateTenant(id, payload)
      set((state) => ({
        tenants: state.tenants.map((t) => (t.id === id ? tenant : t)),
        currentTenant: state.currentTenant?.id === id ? tenant : state.currentTenant,
      }))
      return tenant
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update tenant'
      set((state) => ({
        errors: { ...state.errors, updateTenant: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, updateTenant: false },
      }))
    }
  },

  async deleteTenant(id) {
    set((state) => ({
      loading: { ...state.loading, deleteTenant: true },
      errors: { ...state.errors, deleteTenant: null },
    }))

    try {
      await userManagementApi.deleteTenant(id)
      set((state) => ({
        tenants: state.tenants.filter((tenant) => tenant.id !== id),
        totalTenants: Math.max(0, state.totalTenants - 1),
        currentTenant: state.currentTenant?.id === id ? null : state.currentTenant,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete tenant'
      set((state) => ({
        errors: { ...state.errors, deleteTenant: message },
      }))
      throw error
    } finally {
      set((state) => ({
        loading: { ...state.loading, deleteTenant: false },
      }))
    }
  },

  async fetchTenantUsage(id) {
    set((state) => ({
      loading: { ...state.loading, fetchTenantUsage: true },
      errors: { ...state.errors, fetchTenantUsage: null },
    }))

    try {
      const usage = await userManagementApi.getTenantUsage(id)
      set({ tenantUsage: usage })
      return usage
    } catch (error) {
      set((state) => ({
        errors: {
          ...state.errors,
          fetchTenantUsage: error instanceof Error ? error.message : 'Failed to load tenant usage',
        },
      }))
      return null
    } finally {
      set((state) => ({
        loading: { ...state.loading, fetchTenantUsage: false },
      }))
    }
  },

  clearCurrentUser() {
    set({ currentUser: null, userActivity: [], userActivityTotal: 0 })
  },

  clearCurrentTenant() {
    set({ currentTenant: null, tenantUsage: null })
  },

  reset() {
    set({ ...INITIAL_STATE })
  },
}))
