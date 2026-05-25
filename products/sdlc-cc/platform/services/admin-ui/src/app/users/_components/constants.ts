import type { UserStatus } from '@/types/user-management'

export const STATUS_CONFIG: Record<
  UserStatus,
  { label: string; color: 'success' | 'secondary' | 'destructive' | 'warning' }
> = {
  ACTIVE: { label: 'Active', color: 'success' },
  INACTIVE: { label: 'Inactive', color: 'secondary' },
  SUSPENDED: { label: 'Suspended', color: 'destructive' },
  PENDING: { label: 'Pending', color: 'warning' },
  LOCKED: { label: 'Locked', color: 'destructive' },
}

export const PAGINATION_LIMITS = [10, 20, 50, 100]
