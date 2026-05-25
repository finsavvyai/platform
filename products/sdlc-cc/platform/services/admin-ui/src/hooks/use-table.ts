'use client'

import { useState, useEffect, useMemo } from 'react'
import { useDataStore } from '@/store/data'
import type { Column, TableState, PaginationParams } from '@/types'

interface UseTableOptions<T> {
  columns: Column<T>[]
  data?: T[]
  fetchData?: (params: PaginationParams) => Promise<{ data: T[]; total: number }>
  pageSize?: number
  manualPagination?: boolean
  manualSorting?: boolean
  manualFiltering?: boolean
  initialSorting?: { field: string; direction: 'asc' | 'desc' }
  initialFilters?: Record<string, unknown>
}

interface UseTableResult<T> {
  // Data
  data: T[]
  columns: Column<T>[]

  // State
  loading: boolean
  pagination: {
    current: number
    pageSize: number
    total: number
    setCurrent: (page: number) => void
    setPageSize: (size: number) => void
  }
  sorting: {
    field: string
    direction: 'asc' | 'desc'
    setSorting: (field: string, direction: 'asc' | 'desc') => void
  }
  filtering: {
    search: string
    filters: Record<string, unknown>
    setSearch: (search: string) => void
    setFilters: (filters: Record<string, unknown>) => void
    clearFilters: () => void
  }
  selection: {
    selectedRows: T[]
    selectedKeys: string[]
    isSelected: (key: string) => boolean
    toggleRow: (row: T) => void
    toggleAll: () => void
    clearSelection: () => void
  }

  // Actions
  refetch: () => Promise<void>
  reset: () => void
}

interface LocalTableState<T> {
  data: T[]
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
}

export function useTable<T extends { id?: string | number } & Record<string, unknown>>(
  tableId: string,
  options: UseTableOptions<T>
): UseTableResult<T> {
  const {
    columns,
    data: initialData,
    fetchData,
    pageSize: defaultPageSize = 20,
    manualPagination = false,
    manualSorting = false,
    manualFiltering = false,
    initialSorting = { field: 'createdAt', direction: 'desc' },
    initialFilters = {},
  } = options

  const { getTableState, setTableState } = useDataStore()

  // Get or initialize table state
  const persistedState = getTableState(tableId) as Partial<LocalTableState<T>> | undefined
  const tableState: LocalTableState<T> = {
    data: persistedState?.data ?? initialData ?? [],
    pagination: {
      current: persistedState?.pagination?.current ?? 1,
      pageSize: persistedState?.pagination?.pageSize ?? defaultPageSize,
      total: persistedState?.pagination?.total ?? 0,
    },
    sorting: persistedState?.sorting ?? initialSorting,
    filtering: {
      search: persistedState?.filtering?.search ?? '',
      filters: persistedState?.filtering?.filters ?? initialFilters,
    },
    selection: {
      selected: persistedState?.selection?.selected ?? [],
    },
  }

  const [state, setState] = useState<LocalTableState<T>>(tableState)
  const [loading, setLoading] = useState(false)

  // Update store when state changes
  useEffect(() => {
    setTableState(tableId, state as unknown as TableState<T>)
  }, [tableId, state, setTableState])

  // Data fetching
  const refetch = async () => {
    if (!fetchData) return

    setLoading(true)
    try {
      const params: PaginationParams = {
        page: state.pagination.current,
        pageSize: state.pagination.pageSize,
        sortBy: state.sorting.field,
        sortOrder: state.sorting.direction,
        search: state.filtering.search,
        ...state.filtering.filters,
      }

      const result = await fetchData(params)

      setState(prev => ({
        ...prev,
        data: result.data,
        pagination: {
          ...prev.pagination,
          total: result.total,
        },
      }))
    } catch (error) {
      console.error('Failed to fetch table data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (fetchData && (manualPagination || manualSorting || manualFiltering)) {
      refetch()
    }
  }, [
    state.pagination.current,
    state.pagination.pageSize,
    state.sorting.field,
    state.sorting.direction,
    state.filtering.search,
    state.filtering.filters,
  ])

  // Local data processing (when not manual)
  const processedData = useMemo<T[]>(() => {
    if (manualPagination || manualSorting || manualFiltering || !initialData) {
      return state.data
    }

    let result = [...initialData]

    // Apply filters
    if (state.filtering.search) {
      const searchLower = state.filtering.search.toLowerCase()
      result = result.filter(item =>
        Object.values(item as Record<string, unknown>).some(value =>
          String(value).toLowerCase().includes(searchLower)
        )
      )
    }

    Object.entries(state.filtering.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        result = result.filter(item => item[key] === value)
      }
    })

    // Apply sorting
    if (state.sorting.field) {
      result.sort((a, b) => {
        const comparison = compareUnknownValues(a[state.sorting.field], b[state.sorting.field])
        return state.sorting.direction === 'asc' ? comparison : -comparison
      })
    }

    // Apply pagination
    const startIndex = (state.pagination.current - 1) * state.pagination.pageSize
    const endIndex = startIndex + state.pagination.pageSize
    result = result.slice(startIndex, endIndex)

    return result
  }, [
    initialData,
    state.data,
    state.filtering,
    state.sorting,
    state.pagination,
    manualPagination,
    manualSorting,
    manualFiltering,
  ])

  // Pagination actions
  const setCurrent = (page: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, current: page },
    }))
  }

  const setPageSize = (size: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, pageSize: size, current: 1 },
    }))
  }

  // Sorting actions
  const setSorting = (field: string, direction: 'asc' | 'desc') => {
    setState(prev => ({
      ...prev,
      sorting: { field, direction },
    }))
  }

  // Filtering actions
  const setSearch = (search: string) => {
    setState(prev => ({
      ...prev,
      filtering: { ...prev.filtering, search },
    }))
  }

  const setFilters = (filters: Record<string, unknown>) => {
    setState(prev => ({
      ...prev,
      filtering: { ...prev.filtering, filters },
    }))
  }

  const clearFilters = () => {
    setState(prev => ({
      ...prev,
      filtering: { search: '', filters: {} },
    }))
  }

  // Selection actions
  const toggleRow = (row: T) => {
    const key = String(row.id || JSON.stringify(row))
    setState(prev => {
      const isSelected = prev.selection.selected.includes(key)
      return {
        ...prev,
        selection: {
          selected: isSelected
            ? prev.selection.selected.filter(k => k !== key)
            : [...prev.selection.selected, key],
        },
      }
    })
  }

  const toggleAll = () => {
    const allKeys = processedData.map(row => String(row.id || JSON.stringify(row)))
    const allSelected = allKeys.every(key => state.selection.selected.includes(key))

    setState(prev => ({
      ...prev,
      selection: {
        selected: allSelected ? [] : allKeys,
      },
    }))
  }

  const isSelected = (key: string) => state.selection.selected.includes(key)

  const clearSelection = () => {
    setState(prev => ({
      ...prev,
      selection: { selected: [] },
    }))
  }

  const selectedRows = processedData.filter(row =>
    state.selection.selected.includes(String(row.id || JSON.stringify(row)))
  )

  // Reset
  const reset = () => {
    setState({
      data: initialData || [],
      pagination: {
        current: 1,
        pageSize: defaultPageSize,
        total: 0,
      },
      sorting: initialSorting,
      filtering: {
        search: '',
        filters: initialFilters,
      },
      selection: {
        selected: [],
      },
    })
  }

  return {
    data: processedData,
    columns,
    loading,
    pagination: {
      current: state.pagination.current,
      pageSize: state.pagination.pageSize,
      total: manualPagination ? state.pagination.total : (initialData?.length || 0),
      setCurrent,
      setPageSize,
    },
    sorting: {
      field: state.sorting.field,
      direction: state.sorting.direction,
      setSorting,
    },
    filtering: {
      search: state.filtering.search,
      filters: state.filtering.filters,
      setSearch,
      setFilters,
      clearFilters,
    },
    selection: {
      selectedRows,
      selectedKeys: state.selection.selected,
      isSelected,
      toggleRow,
      toggleAll,
      clearSelection,
    },
    refetch,
    reset,
  }
}

function compareUnknownValues(a: unknown, b: unknown): number {
  const aString = String(a ?? '')
  const bString = String(b ?? '')
  if (aString < bString) return -1
  if (aString > bString) return 1
  return 0
}
