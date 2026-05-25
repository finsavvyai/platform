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

export type LoadingKey =
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

export interface PaginationState {
  limit: number
  offset: number
  sort?: string
}

export interface UserManagementState {
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
  tenantFilters: Record<string, unknown>
  currentTenant: Tenant | null
  tenantUsage: TenantUsageResponse | null

  loading: Partial<Record<LoadingKey, boolean>>
  errors: Partial<Record<LoadingKey, string | null>>

  setFilter: (filters: Partial<UserListParams>) => void
  setPagination: (pagination: Partial<PaginationState>) => void
  setSelectedUserIds: (ids: string[]) => void
  setTenantFilters: (filters: Record<string, unknown>) => void

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

export const DEFAULT_PAGINATION: PaginationState = {
  limit: 20,
  offset: 0,
  sort: 'created_at:desc',
}

export type InitialStateKeys =
  | 'setFilter' | 'setPagination' | 'setSelectedUserIds'
  | 'fetchUsers' | 'fetchUser' | 'createUser' | 'updateUser' | 'deleteUser'
  | 'runBulkOperation' | 'fetchUserStats' | 'fetchUserActivity' | 'fetchUserRoles'
  | 'fetchTenants' | 'fetchTenant' | 'createTenant' | 'updateTenant' | 'deleteTenant'
  | 'fetchTenantUsage' | 'clearCurrentUser' | 'clearCurrentTenant' | 'reset' | 'setTenantFilters'

export const INITIAL_STATE: Omit<UserManagementState, InitialStateKeys> = {
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
