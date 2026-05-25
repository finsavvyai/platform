import { userManagementApi } from '@/lib/user-management-api'
import type { UserManagementState, PaginationState } from './types'
import type { UserListParams } from '@/types/user-management'

type SetFn = (fn: (state: UserManagementState) => Partial<UserManagementState>) => void
type GetFn = () => UserManagementState

export function createUserActions(set: SetFn, get: GetFn) {
  return {
    async fetchUsers(params: Partial<UserListParams> = {}) {
      const { userFilters, userPagination } = get()
      set((state) => ({
        loading: { ...state.loading, fetchUsers: true },
        errors: { ...state.errors, fetchUsers: null },
      }))

      try {
        const mergedFilters: UserListParams = { ...userFilters, ...params }
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

        set(() => ({
          users: result.users,
          totalUsers: result.total,
          userFilters: mergedFilters,
          userPagination: nextPagination,
        }))
      } catch (error) {
        set((state) => ({
          errors: {
            ...state.errors,
            fetchUsers: error instanceof Error ? error.message : 'Failed to load users',
          },
        }))
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchUsers: false } }))
      }
    },

    async fetchUser(id: string) {
      set((state) => ({
        loading: { ...state.loading, fetchUser: true },
        errors: { ...state.errors, fetchUser: null },
      }))
      try {
        const user = await userManagementApi.getUser(id)
        set(() => ({ currentUser: user }))
        return user
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, fetchUser: error instanceof Error ? error.message : 'Failed to load user' },
        }))
        return null
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchUser: false } }))
      }
    },

    async createUser(payload: Parameters<typeof userManagementApi.createUser>[0]) {
      set((state) => ({
        loading: { ...state.loading, createUser: true },
        errors: { ...state.errors, createUser: null },
      }))
      try {
        const user = await userManagementApi.createUser(payload)
        set((state) => ({ users: [user, ...state.users], totalUsers: state.totalUsers + 1 }))
        return user
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create user'
        set((state) => ({ errors: { ...state.errors, createUser: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, createUser: false } }))
      }
    },

    async updateUser(id: string, payload: Parameters<typeof userManagementApi.updateUser>[1]) {
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
        set((state) => ({ errors: { ...state.errors, updateUser: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, updateUser: false } }))
      }
    },

    async deleteUser(id: string) {
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
        set((state) => ({ errors: { ...state.errors, deleteUser: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, deleteUser: false } }))
      }
    },

    async runBulkOperation(payload: Parameters<typeof userManagementApi.bulkUsers>[0]) {
      set((state) => ({
        loading: { ...state.loading, bulkUsers: true },
        errors: { ...state.errors, bulkUsers: null },
      }))
      try {
        const { jobId } = await userManagementApi.bulkUsers(payload)
        return jobId
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run bulk operation'
        set((state) => ({ errors: { ...state.errors, bulkUsers: message } }))
        throw error
      } finally {
        set((state) => ({ loading: { ...state.loading, bulkUsers: false } }))
      }
    },

    async fetchUserStats() {
      set((state) => ({
        loading: { ...state.loading, fetchUserStats: true },
        errors: { ...state.errors, fetchUserStats: null },
      }))
      try {
        const stats = await userManagementApi.getUserStats()
        set(() => ({ userStats: stats }))
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, fetchUserStats: error instanceof Error ? error.message : 'Failed to load user stats' },
        }))
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchUserStats: false } }))
      }
    },

    async fetchUserActivity(id: string, params: { limit?: number; offset?: number } = {}) {
      set((state) => ({
        loading: { ...state.loading, fetchUserActivity: true },
        errors: { ...state.errors, fetchUserActivity: null },
      }))
      try {
        const result = await userManagementApi.getUserActivity(id, { limit: params.limit })
        set(() => ({ userActivity: result.activities, userActivityTotal: result.total }))
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, fetchUserActivity: error instanceof Error ? error.message : 'Failed to load user activity' },
        }))
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchUserActivity: false } }))
      }
    },

    async fetchUserRoles() {
      set((state) => ({
        loading: { ...state.loading, fetchRoles: true },
        errors: { ...state.errors, fetchRoles: null },
      }))
      try {
        const roles = await userManagementApi.listRoles()
        set(() => ({ userRoles: roles }))
      } catch (error) {
        set((state) => ({
          errors: { ...state.errors, fetchRoles: error instanceof Error ? error.message : 'Failed to load roles' },
        }))
      } finally {
        set((state) => ({ loading: { ...state.loading, fetchRoles: false } }))
      }
    },
  }
}
