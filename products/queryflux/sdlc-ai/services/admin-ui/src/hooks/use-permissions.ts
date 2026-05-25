'use client'

import { useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { PERMISSIONS } from '@/lib/constants'

export function usePermissions() {
  const { permissions, user } = useAuthStore()

  const hasPermission = useMemo(
    () => (permission: string): boolean => {
      return permissions.includes(permission) || permissions.includes('system:admin')
    },
    [permissions]
  )

  const hasAnyPermission = useMemo(
    () => (requiredPermissions: string[]): boolean => {
      return requiredPermissions.some(permission => hasPermission(permission))
    },
    [hasPermission]
  )

  const hasAllPermissions = useMemo(
    () => (requiredPermissions: string[]): boolean => {
      return requiredPermissions.every(permission => hasPermission(permission))
    },
    [hasPermission]
  )

  const hasRole = useMemo(
    () => (role: string): boolean => {
      return user?.role === role || user?.role === 'ADMIN'
    },
    [user?.role]
  )

  const isOwner = useMemo(
    () => (resourceId: string): boolean => {
      return user?.id === resourceId || hasRole('ADMIN')
    },
    [user?.id, hasRole]
  )

  const canAccess = useMemo(
    () => (resource: string, action: string): boolean => {
      const permission = `${resource}:${action}`
      return hasPermission(permission)
    },
    [hasPermission]
  )

  const isAdmin = useMemo(() => hasRole('ADMIN'), [hasRole])
  const isManager = useMemo(() => hasRole('MANAGER') || isAdmin, [hasRole, isAdmin])
  const isDeveloper = useMemo(() => hasRole('DEVELOPER') || isManager, [hasRole, isManager])
  const isUser = useMemo(() => hasRole('USER') || isDeveloper, [hasRole, isDeveloper])

  // Common permission checks
  const canReadUsers = useMemo(() => hasPermission(PERMISSIONS.USER_READ), [hasPermission])
  const canCreateUsers = useMemo(() => hasPermission(PERMISSIONS.USER_CREATE), [hasPermission])
  const canUpdateUsers = useMemo(() => hasPermission(PERMISSIONS.USER_UPDATE), [hasPermission])
  const canDeleteUsers = useMemo(() => hasPermission(PERMISSIONS.USER_DELETE), [hasPermission])

  const canReadProjects = useMemo(() => hasPermission(PERMISSIONS.PROJECT_READ), [hasPermission])
  const canCreateProjects = useMemo(() => hasPermission(PERMISSIONS.PROJECT_CREATE), [hasPermission])
  const canUpdateProjects = useMemo(() => hasPermission(PERMISSIONS.PROJECT_UPDATE), [hasPermission])
  const canDeleteProjects = useMemo(() => hasPermission(PERMISSIONS.PROJECT_DELETE), [hasPermission])
  const canManageProjectMembers = useMemo(() => hasPermission(PERMISSIONS.PROJECT_MEMBERS_MANAGE), [hasPermission])

  const canViewAnalytics = useMemo(() => hasPermission(PERMISSIONS.ANALYTICS_VIEW), [hasPermission])
  const canExportAnalytics = useMemo(() => hasPermission(PERMISSIONS.ANALYTICS_EXPORT), [hasPermission])

  const canReadSettings = useMemo(() => hasPermission(PERMISSIONS.SETTINGS_READ), [hasPermission])
  const canUpdateSettings = useMemo(() => hasPermission(PERMISSIONS.SETTINGS_UPDATE), [hasPermission])

  const canAdminSystem = useMemo(() => hasPermission(PERMISSIONS.SYSTEM_ADMIN), [hasPermission])
  const canMonitorSystem = useMemo(() => hasPermission(PERMISSIONS.SYSTEM_MONITORING), [hasPermission])

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isOwner,
    canAccess,
    isAdmin,
    isManager,
    isDeveloper,
    isUser,
    // Specific permissions
    canReadUsers,
    canCreateUsers,
    canUpdateUsers,
    canDeleteUsers,
    canReadProjects,
    canCreateProjects,
    canUpdateProjects,
    canDeleteProjects,
    canManageProjectMembers,
    canViewAnalytics,
    canExportAnalytics,
    canReadSettings,
    canUpdateSettings,
    canAdminSystem,
    canMonitorSystem,
  }
}

// Hook for component-level permission checking
export function useRequirePermission(permission: string) {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

// Hook for requiring multiple permissions
export function useRequirePermissions(
  permissions: string[],
  requireAll: boolean = false
) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions()
  return requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
}
