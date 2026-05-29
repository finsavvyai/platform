import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { DataState } from './types'

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      // State
      cache: {},
      api: {
        loading: false,
        error: null,
        lastFetch: null,
      },
      tables: {},

      // Actions
      setCache: (key, data, ttl = DEFAULT_TTL) => {
        set(state => ({
          cache: {
            ...state.cache,
            [key]: {
              data,
              timestamp: Date.now(),
              ttl,
            },
          },
        }))
      },

      getCache: (key) => {
        const cached = get().cache[key]
        if (!cached) return null

        const now = Date.now()
        if (now - cached.timestamp > cached.ttl) {
          // Cache expired, remove it
          set(state => {
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
          set(state => {
            const newCache = { ...state.cache }
            delete newCache[key]
            return { cache: newCache }
          })
        } else {
          set({ cache: {} })
        }
      },

      setTableState: (tableId, stateUpdate) => {
        set(state => ({
          tables: {
            ...state.tables,
            [tableId]: {
              ...state.tables[tableId],
              ...stateUpdate,
            },
          },
        }))
      },

      getTableState: (tableId) => {
        return get().tables[tableId] || {
          data: [],
          pagination: {
            current: 1,
            pageSize: 20,
            total: 0,
          },
          sorting: {
            field: 'createdAt',
            direction: 'desc',
          },
          filtering: {
            search: '',
            filters: {},
          },
          selection: {
            selected: [],
          },
        }
      },

      setLoading: (loading) => {
        set(state => ({
          api: { ...state.api, loading },
        }))
      },

      setError: (error) => {
        set(state => ({
          api: { ...state.api, error },
        }))
      },
    }),
    {
      name: 'data-store',
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage for data
    }
  )
)
