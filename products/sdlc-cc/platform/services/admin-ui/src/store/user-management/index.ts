import { create } from 'zustand'
import type { UserManagementState } from './types'
import type { UserListParams } from '@/types/user-management'
import { INITIAL_STATE, DEFAULT_PAGINATION } from './types'
import { createUserActions } from './user-actions'
import { createTenantActions } from './tenant-actions'

export type { UserManagementState } from './types'

export const useUserManagementStore = create<UserManagementState>((set, get) => ({
  ...INITIAL_STATE,

  setFilter: (filters) => {
    set((state) => {
      const nextFilters: UserListParams = { ...state.userFilters, ...filters }
      Object.entries(filters).forEach(([key, value]) => {
        const typedKey = key as keyof UserListParams
        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
          delete nextFilters[typedKey]
        }
      })
      return { userFilters: nextFilters }
    })
  },

  setPagination: (pagination) => {
    set((state) => ({
      userPagination: { ...state.userPagination, ...pagination },
    }))
  },

  setSelectedUserIds: (ids) => {
    set({ selectedUserIds: ids })
  },

  setTenantFilters: (filters) => {
    set((state) => {
      const nextFilters = { ...state.tenantFilters, ...filters }
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
          delete nextFilters[key]
        }
      })
      return { tenantFilters: nextFilters }
    })
  },

  ...createUserActions(set as any, get),
  ...createTenantActions(set as any, get, DEFAULT_PAGINATION),

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
