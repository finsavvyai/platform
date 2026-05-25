import { ReactNode } from 'react'

// User Types
export interface User {
  id: string
  email: string
  name: string
  image?: string
  role: Role
  permissions: Permission[]
  tenantId: string
  status: UserStatus
  emailVerified?: Date
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  createdAt: Date
  updatedAt: Date
}

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING'

// Auth Types
export interface Session {
  user: {
    id: string
    email: string
    name: string
    image?: string
    role: string
    permissions: string[]
    tenantId: string
  }
  expires: string
}

// Project Types
export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  priority: TaskPriority
  startDate?: Date
  endDate?: Date
  ownerId: string
  members: ProjectMember[]
  createdAt: Date
  updatedAt: Date
  tags: string[]
}

export interface ProjectMember {
  id: string
  userId: string
  projectId: string
  role: string
  joinedAt: Date
  user: User
}

export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

// Analytics Types
export interface AnalyticsData {
  overview: AnalyticsOverview
  users: UserAnalytics
  projects: ProjectAnalytics
  performance: PerformanceAnalytics
}

export interface AnalyticsOverview {
  totalUsers: number
  activeUsers: number
  totalProjects: number
  activeProjects: number
  revenue: number
  growth: {
    users: number
    projects: number
    revenue: number
  }
}

export interface UserAnalytics {
  total: number
  active: number
  newThisMonth: number
  retention: number
  byRole: Record<string, number>
  byStatus: Record<UserStatus, number>
}

export interface ProjectAnalytics {
  total: number
  active: number
  completed: number
  averageDuration: number
  byStatus: Record<ProjectStatus, number>
  byPriority: Record<TaskPriority, number>
}

export interface PerformanceAnalytics {
  uptime: number
  responseTime: number
  errorRate: number
  throughput: number
}

// UI Types
export interface Theme {
  mode: 'light' | 'dark' | 'system'
  colors: Record<string, string>
}

export interface SidebarState {
  isOpen: boolean
  isCollapsed: boolean
  activeItem?: string
}

export interface ModalState {
  isOpen: boolean
  title?: string
  content?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: Date
  read: boolean
  actions?: NotificationAction[]
}

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export interface NotificationAction {
  label: string
  action: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  options?: Option[]
  validation?: ValidationRule[]
}

export interface Option {
  label: string
  value: string | number
  disabled?: boolean
}

export interface ValidationRule {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: any
  message: string
}

// Table Types
export interface Column<T = any> {
  key: keyof T
  title: string
  sortable?: boolean
  filterable?: boolean
  width?: string | number
  render?: (value: any, record: T) => ReactNode
}

export interface TableState<T = any> {
  data: T[]
  columns: Column<T>[]
  loading: boolean
  pagination: PaginationState
  sorting: SortingState
  filtering: FilteringState
  selection: SelectionState<T>
}

export interface PaginationState {
  current: number
  pageSize: number
  total: number
}

export interface SortingState {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilteringState {
  filters: Record<string, any>
  search: string
}

export interface SelectionState<T = any> {
  selectedRows: T[]
  selectedKeys: string[]
}

// API Types
export interface ApiResponse<T = any> {
  data: T
  message: string
  success: boolean
  errors?: Record<string, string[]>
}

export interface ApiError {
  message: string
  code?: string
  details?: any
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

// Settings Types
export interface UserSettings {
  theme: Theme
  language: string
  timezone: string
  notifications: NotificationSettings
  privacy: PrivacySettings
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  inApp: boolean
  types: Record<NotificationType, boolean>
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'team'
  showEmail: boolean
  showLastLogin: boolean
}

// Component Props Types
export interface BaseComponentProps {
  className?: string
  children?: ReactNode
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export interface InputProps extends BaseComponentProps {
  type?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  error?: string
  label?: string
  description?: string
}

// Hook Types
export interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  refetch: () => Promise<void>
  mutate: (data: T) => Promise<void>
}

export interface UseLocalStorageResult<T> {
  value: T
  setValue: (value: T) => void
  removeValue: () => void
}

// Navigation Types
export interface NavigationItem {
  key: string
  label: string
  icon?: ReactNode
  href?: string
  children?: NavigationItem[]
  badge?: string | number
  disabled?: boolean
  permissions?: string[]
}

export interface BreadcrumbItem {
  label: string
  href?: string
  active?: boolean
}

// Chart Types
export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
  fill?: boolean
}

// File Types
export interface FileUpload {
  file: File
  id: string
  name: string
  size: number
  type: string
  preview?: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}
