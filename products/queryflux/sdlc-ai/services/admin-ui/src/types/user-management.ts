// User management types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  status: UserStatus
  tenantId: string
  tenantName?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  permissions: Permission[]
  mfaEnabled: boolean
  emailVerified: boolean
  phone?: string
  department?: string
  location?: string
  managerId?: string
  managerName?: string
  directReports?: User[]
  metadata?: Record<string, any>
}

export interface UserRole {
  id: string
  name: string
  displayName: string
  description: string
  level: number // 1-100, higher = more permissions
  permissions: Permission[]
  isSystem: boolean
  tenantId: string
}

export interface Permission {
  id: string
  name: string
  resource: string
  action: string
  conditions?: Record<string, any>
  description: string
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING' | 'LOCKED'

export interface Tenant {
  id: string
  name: string
  displayName: string
  domain?: string
  logo?: string
  status: TenantStatus
  plan: TenantPlan
  settings: TenantSettings
  limits: TenantLimits
  usage: TenantUsage
  billing: TenantBilling
  createdAt: string
  updatedAt: string
  owner: User
  memberCount: number
  isEnterprise: boolean
}

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PENDING_CANCELLATION'

export interface TenantPlan {
  id: string
  name: string
  displayName: string
  features: string[]
  maxUsers: number
  maxProjects: number
  storageLimit: number // in GB
  apiRateLimit: number
  supportLevel: 'basic' | 'premium' | 'enterprise'
}

export interface TenantSettings {
  allowPublicSignup: boolean
  requireEmailVerification: boolean
  enforceMFA: boolean
  sessionTimeout: number // in minutes
  passwordPolicy: PasswordPolicy
  ipWhitelist: string[]
  customBranding: CustomBranding
  integrations: Record<string, any>
}

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  preventReuse: number // number of previous passwords to prevent
  expirationDays: number
}

export interface CustomBranding {
  primaryColor: string
  secondaryColor: string
  logo?: string
  favicon?: string
  customCSS?: string
}

export interface TenantLimits {
  users: number
  projects: number
  storage: number // in GB
  apiCalls: number // per month
  embeddings: number // per month
  llmTokens: number // per month
}

export interface TenantUsage {
  users: number
  projects: number
  storage: number // in GB
  apiCalls: number // current month
  embeddings: number // current month
  llmTokens: number // current month
  lastUpdated: string
}

export interface TenantBilling {
  planId: string
  status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED'
  billingEmail: string
  nextInvoiceDate?: string
  lastPaymentDate?: string
  paymentMethod?: PaymentMethod
  subscriptionId?: string
  customerId?: string
}

export interface PaymentMethod {
  id: string
  type: 'card' | 'bank' | 'invoice'
  brand?: string
  last4?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
}

// API request/response types
export interface CreateUserRequest {
  email: string
  name: string
  role: string
  tenantId: string
  password?: string
  sendInvite: boolean
  department?: string
  location?: string
  managerId?: string
  permissions?: string[]
}

export interface UpdateUserRequest {
  name?: string
  role?: string
  status?: UserStatus
  department?: string
  location?: string
  managerId?: string
  permissions?: string[]
  metadata?: Record<string, any>
}

export interface BulkUserOperation {
  action: 'invite' | 'activate' | 'deactivate' | 'delete' | 'update_role' | 'add_to_tenant' | 'remove_from_tenant'
  userIds: string[]
  params?: Record<string, any>
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface UserFilters {
  search?: string
  status?: UserStatus[]
  role?: string[]
  tenant?: string[]
  department?: string[]
  location?: string[]
  mfaEnabled?: boolean
  emailVerified?: boolean
  createdAfter?: string
  createdBefore?: string
  lastLoginAfter?: string
  lastLoginBefore?: string
}

export interface UserActivity {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  resourceId?: string
  ipAddress: string
  userAgent: string
  success: boolean
  errorMessage?: string
  createdAt: string
  metadata?: Record<string, any>
}

export interface UserAnalytics {
  totalUsers: number
  activeUsers: number // last 30 days
  newUsers: number // last 30 days
  suspendedUsers: number
  usersByRole: Record<string, number>
  usersByDepartment: Record<string, number>
  usersByLocation: Record<string, number>
  loginFrequency: Record<string, number> // day of week
  mfaAdoptionRate: number
  emailVerificationRate: number
  growthRate: number // month over month
  churnRate: number // month over month
}

export interface Invitation {
  id: string
  email: string
  invitedBy: string
  invitedByName: string
  tenantId: string
  tenantName: string
  role: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  createdAt: string
  expiresAt: string
  acceptedAt?: string
  customMessage?: string
}

export interface CreateInvitationRequest {
  emails: string[]
  role: string
  tenantId: string
  customMessage?: string
  expiresAt?: string
}

export interface UserListParams extends UserFilters {
  limit?: number
  offset?: number
  sort?: string
}

export interface UserActivityResponse {
  activities: UserActivity[]
  total: number
  limit: number
  offset: number
}

export interface UserStatsResponse {
  totals: {
    users: number
    activeUsers: number
    suspendedUsers: number
    pendingInvites: number
  }
  growth: {
    percentage: number
    timeframe: '7d' | '30d' | '90d'
  }
  multifactor: {
    enabled: number
    total: number
  }
  byRole: Array<{ role: string; count: number }>
  byStatus: Array<{ status: UserStatus; count: number }>
}

export interface TenantListResponse {
  tenants: Tenant[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface TenantUsageResponse {
  tenantId: string
  limits: TenantLimits
  usage: TenantUsage
  projections?: {
    users: number
    storage: number
    apiCalls: number
  }
  warnedAt?: string
  exceededAt?: string
}

export interface CreateTenantRequest {
  name: string
  displayName: string
  domain?: string
  planId: string
  owner: {
    email: string
    name: string
    roleId?: string
  }
  billing?: Partial<TenantBilling>
  settings?: Partial<TenantSettings>
}

export interface UpdateTenantRequest {
  displayName?: string
  domain?: string
  status?: TenantStatus
  planId?: string
  billing?: Partial<TenantBilling>
  settings?: Partial<TenantSettings>
  metadata?: Record<string, any>
}
