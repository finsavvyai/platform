import { User, Session, Theme, SidebarState, ModalState, Notification } from '@/types'
import type {
  User as ManagedUser,
  Tenant,
  UserActivity,
  UserRole,
  UserStatsResponse,
  TenantUsageResponse,
  UserListParams,
} from '@/types/user-management'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  permissions: string[]
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: RegisterData) => Promise<void>
  refreshToken: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  verifyEmail: (token: string) => Promise<void>
}

export interface RegisterData {
  email: string
  password: string
  name: string
}

export interface UIState {
  theme: Theme
  sidebar: SidebarState
  modal: ModalState
  notifications: Notification[]
  loading: Record<string, boolean>
  breadcrumbs: BreadcrumbItem[]

  // Actions
  setTheme: (theme: Partial<Theme>) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActiveSidebarItem: (item: string) => void
  openModal: (modal: Partial<ModalState>) => void
  closeModal: () => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'> & { read?: boolean }) => void
  removeNotification: (id: string) => void
  markNotificationAsRead: (id: string) => void
  setLoading: (key: string, loading: boolean) => void
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
}

export interface BreadcrumbItem {
  label: string
  href?: string
  active?: boolean
}

export interface DataState {
  // Cache state
  cache: Record<string, { data: unknown; timestamp: number; ttl: number }>

  // API state
  api: {
    loading: boolean
    error: string | null
    lastFetch: number | null
  }

  // Data tables state
  tables: Record<string, {
    data: unknown[]
    pagination: {
      current: number
      pageSize: number
      total: number
    }
    sorting: {
      field: string
      direction: 'asc' | 'desc'
    }
    filtering: {
      search: string
      filters: Record<string, unknown>
    }
    selection: {
      selected: string[]
    }
  }>

  // Actions
  setCache: (key: string, data: unknown, ttl?: number) => void
  getCache: (key: string) => unknown | null
  clearCache: (key?: string) => void
  setTableState: (tableId: string, state: Partial<DataState['tables'][string]>) => void
  getTableState: (tableId: string) => DataState['tables'][string] | null
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export interface SettingsState {
  user: {
    theme: 'light' | 'dark' | 'system'
    language: string
    timezone: string
    dateFormat: string
    timeFormat: string
  }

  notifications: {
    email: boolean
    push: boolean
    inApp: boolean
    types: Record<string, boolean>
  }

  privacy: {
    profileVisibility: 'public' | 'private' | 'team'
    showEmail: boolean
    showLastLogin: boolean
  }

  preferences: {
    autoSave: boolean
    compactMode: boolean
    showKeyboardShortcuts: boolean
    defaultPageSize: number
  }

  // Actions
  updateUserSettings: (settings: Partial<SettingsState['user']>) => void
  updateNotificationSettings: (settings: Partial<SettingsState['notifications']>) => void
  updatePrivacySettings: (settings: Partial<SettingsState['privacy']>) => void
  updatePreferences: (preferences: Partial<SettingsState['preferences']>) => void
  resetSettings: () => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
}

export interface UserManagementState {
  users: ManagedUser[]
  totalUsers: number
  userPagination: {
    limit: number
    offset: number
    sort?: string
  }
  userFilters: UserListParams
  selectedUserIds: string[]
  currentUser: ManagedUser | null
  userActivity: UserActivity[]
  userActivityTotal: number
  userStats: UserStatsResponse | null
  userRoles: UserRole[]
  tenants: Tenant[]
  totalTenants: number
  tenantPagination: {
    limit: number
    offset: number
    sort?: string
  }
  tenantFilters: Record<string, unknown>
  currentTenant: Tenant | null
  tenantUsage: TenantUsageResponse | null
  loading: Record<string, boolean>
  errors: Record<string, string | null>
}
