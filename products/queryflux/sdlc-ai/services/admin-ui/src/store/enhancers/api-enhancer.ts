import { StateCreator } from 'zustand'
import { apiClient } from '@/lib/api-client'

// API middleware for Zustand stores
export interface WithAPI<T> {
  loading: Record<string, boolean>
  errors: Record<string, string | null>
  lastFetch: Record<string, number>

  // API actions
  setLoading: (key: string, loading: boolean) => void
  setError: (key: string, error: string | null) => void
  clearErrors: () => void

  // Enhanced fetch with loading and error handling
  fetchWithState: <T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void
      onError?: (error: Error) => void
    }
  ) => Promise<T | null>
}

export const withAPI = <S>(
  create: StateCreator<S & WithAPI<S>>
): StateCreator<S & WithAPI<S>> => (set, get, api) => {
  const store = create(set, get, api)

  return {
    ...store,
    loading: {},
    errors: {},
    lastFetch: {},

    setLoading: (key, loading) => {
      set((state) => ({
        loading: { ...state.loading, [key]: loading }
      }))
    },

    setError: (key, error) => {
      set((state) => ({
        errors: { ...state.errors, [key]: error }
      }))
    },

    clearErrors: () => {
      set({ errors: {} })
    },

    fetchWithState: async (key, fetcher, options) => {
      try {
        // Set loading state
        get().setLoading(key, true)
        get().setError(key, null)

        // Execute fetch
        const data = await fetcher()

        // Update last fetch time
        set((state) => ({
          lastFetch: { ...state.lastFetch, [key]: Date.now() }
        }))

        // Call success callback if provided
        options?.onSuccess?.(data)

        return data
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred'

        // Set error state
        get().setError(key, errorMessage)

        // Call error callback if provided
        options?.onError?.(error instanceof Error ? error : new Error(errorMessage))

        return null
      } finally {
        // Clear loading state
        get().setLoading(key, false)
      }
    },
  }
}

// Cache middleware for Zustand stores
export interface WithCache<T> {
  cache: Record<string, { data: any; timestamp: number; ttl: number }>

  // Cache actions
  setCache: (key: string, data: any, ttl?: number) => void
  getCache: (key: string) => any | null
  clearCache: (key?: string) => void
  isCacheValid: (key: string) => boolean
}

export const withCache = <S>(
  defaultTTL: number = 5 * 60 * 1000 // 5 minutes
) => (create: StateCreator<S & WithCache<S>>): StateCreator<S & WithCache<S>> => (set, get, api) => {
  const store = create(set, get, api)

  return {
    ...store,
    cache: {},

    setCache: (key, data, ttl = defaultTTL) => {
      set((state) => ({
        cache: {
          ...state.cache,
          [key]: {
            data,
            timestamp: Date.now(),
            ttl
          }
        }
      }))
    },

    getCache: (key) => {
      const cached = get().cache[key]
      if (!cached) return null

      if (!get().isCacheValid(key)) {
        // Clear expired cache
        set((state) => {
          const newCache = { ...state.cache }
          delete newCache[key]
          return { cache: newCache }
        })
        return null
      }

      return cached.data
    },

    clearCache: (key) => {
      if (key) {
        set((state) => {
          const newCache = { ...state.cache }
          delete newCache[key]
          return { cache: newCache }
        })
      } else {
        set({ cache: {} })
      }
    },

    isCacheValid: (key) => {
      const cached = get().cache[key]
      if (!cached) return false

      const elapsed = Date.now() - cached.timestamp
      return elapsed < cached.ttl
    },
  }
}

// Optimistic updates middleware
export interface WithOptimistic<T> {
  optimistic: Record<string, any>

  // Optimistic actions
  setOptimistic: (key: string, data: any) => void
  clearOptimistic: (key: string) => void
  rollbackOptimistic: (key: string) => void
}

export const withOptimistic = <S>(
  create: StateCreator<S & WithOptimistic<S>>
): StateCreator<S & WithOptimistic<S>> => (set, get, api) => {
  const store = create(set, get, api)

  return {
    ...store,
    optimistic: {},

    setOptimistic: (key, data) => {
      set((state) => ({
        optimistic: {
          ...state.optimistic,
          [key]: { previous: state[key as keyof S], data }
        }
      }))

      // Apply optimistic update
      set((state) => ({
        ...state,
        [key]: data
      }))
    },

    clearOptimistic: (key) => {
      set((state) => {
        const newOptimistic = { ...state.optimistic }
        delete newOptimistic[key]
        return { optimistic: newOptimistic }
      })
    },

    rollbackOptimistic: (key) => {
      const optimistic = get().optimistic[key]
      if (optimistic) {
        set((state) => ({
          ...state,
          [key]: optimistic.previous
        }))
        get().clearOptimistic(key)
      }
    },
  }
}

// Pagination middleware
export interface WithPagination<T> {
  pagination: Record<string, {
    current: number
    pageSize: number
    total: number
    totalPages: number
  }>

  // Pagination actions
  setPagination: (key: string, pagination: Partial<WithPagination<T>['pagination'][string]>) => void
  nextPage: (key: string) => void
  prevPage: (key: string) => void
  goToPage: (key: string, page: number) => void
  setPageSize: (key: string, pageSize: number) => void
}

export const withPagination = <S>(
  create: StateCreator<S & WithPagination<S>>
): StateCreator<S & WithPagination<S>> => (set, get, api) => {
  const store = create(set, get, api)

  return {
    ...store,
    pagination: {},

    setPagination: (key, pagination) => {
      const current = get().pagination[key] || {
        current: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0
      }

      const totalPages = Math.ceil(
        (pagination.total ?? current.total) /
        (pagination.pageSize ?? current.pageSize)
      )

      set((state) => ({
        pagination: {
          ...state.pagination,
          [key]: {
            ...current,
            ...pagination,
            totalPages
          }
        }
      }))
    },

    nextPage: (key) => {
      const current = get().pagination[key]
      if (current && current.current < current.totalPages) {
        get().setPagination(key, { current: current.current + 1 })
      }
    },

    prevPage: (key) => {
      const current = get().pagination[key]
      if (current && current.current > 1) {
        get().setPagination(key, { current: current.current - 1 })
      }
    },

    goToPage: (key, page) => {
      const current = get().pagination[key]
      if (current && page >= 1 && page <= current.totalPages) {
        get().setPagination(key, { current: page })
      }
    },

    setPageSize: (key, pageSize) => {
      get().setPagination(key, { pageSize, current: 1 })
    },
  }
}

// Selection middleware
export interface WithSelection<T> {
  selection: Record<string, {
    selected: string[]
    allSelected: boolean
    indeterminate: boolean
  }>

  // Selection actions
  setSelected: (key: string, ids: string[]) => void
  toggleSelected: (key: string, id: string) => void
  selectAll: (key: string, allIds: string[]) => void
  clearSelection: (key: string) => void
  isSelected: (key: string, id: string) => boolean
}

export const withSelection = <S>(
  create: StateCreator<S & WithSelection<S>>
): StateCreator<S & WithSelection<S>> => (set, get, api) => {
  const store = create(set, get, api)

  return {
    ...store,
    selection: {},

    setSelected: (key, ids) => {
      set((state) => ({
        selection: {
          ...state.selection,
          [key]: {
            selected: ids,
            allSelected: false,
            indeterminate: false
          }
        }
      }))
    },

    toggleSelected: (key, id) => {
      const current = get().selection[key] || { selected: [], allSelected: false, indeterminate: false }
      const selected = current.selected.includes(id)
        ? current.selected.filter(s => s !== id)
        : [...current.selected, id]

      set((state) => ({
        selection: {
          ...state.selection,
          [key]: {
            selected,
            allSelected: false,
            indeterminate: selected.length > 0 && selected.length < current.selected.length
          }
        }
      }))
    },

    selectAll: (key, allIds) => {
      const current = get().selection[key] || { selected: [], allSelected: false, indeterminate: false }
      const allSelected = current.selected.length === allIds.length
      const selected = allSelected ? [] : allIds

      set((state) => ({
        selection: {
          ...state.selection,
          [key]: {
            selected,
            allSelected: !allSelected,
            indeterminate: false
          }
        }
      }))
    },

    clearSelection: (key) => {
      set((state) => ({
        selection: {
          ...state.selection,
          [key]: {
            selected: [],
            allSelected: false,
            indeterminate: false
          }
        }
      }))
    },

    isSelected: (key, id) => {
      const current = get().selection[key]
      return current ? current.selected.includes(id) : false
    },
  }
}
