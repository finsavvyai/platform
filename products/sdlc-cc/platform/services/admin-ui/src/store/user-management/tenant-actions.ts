import { userManagementApi } from '@/lib/user-management-api'
import type { UserManagementState, DEFAULT_PAGINATION } from './types'

type SetFn = (fn: (state: UserManagementState) => Partial<UserManagementState>) => void
type GetFn = () => UserManagementState

export function createTenantActions(set: SetFn, get: GetFn, defaultPagination: typeof DEFAULT_PAGINATION) {
  return {
    async fetchTenants(params: Record<string, string | number | boolean | string[]> = {}) {
      set((state) => ({
        loading: { ...state.loading, fetchTenants: true },
        errors: { ...state.errors, fetchTenants: null },
      }))

      try {
        const { tenantFilters, tenantPagination } = get()
        const mergedFilters = {
          ...tenantFilters,
          ...params,
        } as Record<string, string | number | boolean | string[]>
        const response = await userManagementApi.listTenants(mergedFilters)
        set(() => ({
          tenants: response.tenants,
          totalTenants: response.total,
          tenantFilters: mergedFilters,
          tenantPagination: {
            limit: response.limit,
            offset: (response.page - 1) * response.limit,
            sort: mergedFilters.sort
              ? String(mergedFilters.sort)
              : tenantPagination.sort ?? defaultPagination.sort,
          },
        }))
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
        set((state) => ({ loading: { ...state.loading, fetchTenants: false } }))
      }
    },

    async fetchTenant(id: string) {
      set((state) => ({
        loading: { ...state.loading, fetchTenant: true },
        errors: { ...state.errors, fetchTenant: null },
      }))
      try {
        const tenant = await userManagementApi.getTenant(id)
        set(() => ({ currentTenant: tenant }))
        return tenant
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, fetchTenant: error instanceof Error ? error.message : 'Failed to load tenant' },
        }))
        return null
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchTenant: false } }))
      }
    },

    async createTenant(payload: Parameters<typeof userManagementApi.createTenant>[0]) {
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
        set((state) => ({ errors: { ...state.errors, createTenant: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, createTenant: false } }))
      }
    },

    async updateTenant(id: string, payload: Parameters<typeof userManagementApi.updateTenant>[1]) {
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
        set((state) => ({ errors: { ...state.errors, updateTenant: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, updateTenant: false } }))
      }
    },

    async deleteTenant(id: string) {
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
        set((state) => ({ errors: { ...state.errors, deleteTenant: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, deleteTenant: false } }))
      }
    },

    async fetchTenantUsage(id: string) {
      set((state) => ({
        loading: { ...state.loading, fetchTenantUsage: true },
        errors: { ...state.errors, fetchTenantUsage: null },
      }))
      try {
        const usage = await userManagementApi.getTenantUsage(id)
        set(() => ({ tenantUsage: usage }))
        return usage
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, fetchTenantUsage: error instanceof Error ? error.message : 'Failed to load tenant usage' },
        }))
        return null
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchTenantUsage: false } }))
      }
    },
  }
}
