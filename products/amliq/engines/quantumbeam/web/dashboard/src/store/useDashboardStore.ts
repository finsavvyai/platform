import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DashboardUser, DashboardConfig, FraudMetrics, SystemHealth } from '@/types'

interface DashboardState {
  // User state
  user: DashboardUser | null
  setUser: (user: DashboardUser | null) => void

  // Configuration
  config: DashboardConfig
  updateConfig: (updates: Partial<DashboardConfig>) => void

  // UI state
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Data state
  metrics: FraudMetrics | null
  setMetrics: (metrics: FraudMetrics | null) => void

  systemHealth: SystemHealth | null
  setSystemHealth: (health: SystemHealth | null) => void

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Error state
  error: string | null
  setError: (error: string | null) => void

  // Time range for charts
  timeRange: string
  setTimeRange: (range: string) => void

  // Refresh state
  lastRefresh: Date | null
  setLastRefresh: (date: Date | null) => void
  autoRefresh: boolean
  setAutoRefresh: (auto: boolean) => void
}

const defaultConfig: DashboardConfig = {
  theme: 'auto',
  refresh_interval: 30000, // 30 seconds
  notifications: {
    email: true,
    push: true,
    thresholds: {
      fraud_rate: 5.0,
      error_rate: 1.0,
      response_time: 1000,
    },
  },
  charts: {
    default_time_range: '24h',
    animation_enabled: true,
    data_points_limit: 1000,
  },
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // User state
      user: null,
      setUser: (user) => set({ user }),

      // Configuration
      config: defaultConfig,
      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),

      // UI state
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Data state
      metrics: null,
      setMetrics: (metrics) => set({ metrics }),

      systemHealth: null,
      setSystemHealth: (health) => set({ systemHealth: health }),

      // Loading states
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Error state
      error: null,
      setError: (error) => set({ error }),

      // Time range
      timeRange: '24h',
      setTimeRange: (range) => set({ timeRange: range }),

      // Refresh state
      lastRefresh: null,
      setLastRefresh: (date) => set({ lastRefresh: date }),
      autoRefresh: true,
      setAutoRefresh: (auto) => set({ autoRefresh: auto }),
    }),
    {
      name: 'quantumbeam-dashboard',
      partialize: (state) => ({
        config: state.config,
        sidebarOpen: state.sidebarOpen,
        timeRange: state.timeRange,
        autoRefresh: state.autoRefresh,
      }),
    }
  )
)

// Selectors for common state combinations
export const useUser = () => useDashboardStore((state) => state.user)
export const useConfig = () => useDashboardStore((state) => state.config)
export const useSidebarOpen = () => useDashboardStore((state) => state.sidebarOpen)
export const useMetrics = () => useDashboardStore((state) => state.metrics)
export const useSystemHealth = () => useDashboardStore((state) => state.systemHealth)
export const useLoading = () => useDashboardStore((state) => state.isLoading)
export const useError = () => useDashboardStore((state) => state.error)
export const useTimeRange = () => useDashboardStore((state) => state.timeRange)
export const useAutoRefresh = () => useDashboardStore((state) => state.autoRefresh)

// Computed selectors
export const useIsAuthenticated = () => useDashboardStore((state) => !!state.user)
export const useUserRole = () => useDashboardStore((state) => state.user?.role)
export const useTheme = () => useDashboardStore((state) => state.config.theme)
export const useRefreshInterval = () => useDashboardStore((state) => state.config.refresh_interval)

// Action hooks for common operations
export const useRefreshData = () => {
  const setLastRefresh = useDashboardStore((state) => state.setLastRefresh)
  const setIsLoading = useDashboardStore((state) => state.setIsLoading)

  return async (refreshFn: () => Promise<void>) => {
    setIsLoading(true)
    try {
      await refreshFn()
      setLastRefresh(new Date())
    } finally {
      setIsLoading(false)
    }
  }
}

// Error handling hook
export const useErrorHandler = () => {
  const setError = useDashboardStore((state) => state.setError)

  return (error: string | Error) => {
    const message = typeof error === 'string' ? error : error.message
    setError(message)
    // Auto-clear error after 5 seconds
    setTimeout(() => setError(null), 5000)
  }
}

// Notification threshold checking
export const useNotificationThresholds = () => {
  const config = useConfig()
  const metrics = useMetrics()

  const checkThresholds = () => {
    if (!metrics) return []

    const alerts = []
    const { thresholds } = config.notifications

    if (metrics.fraud_rate > thresholds.fraud_rate) {
      alerts.push({
        type: 'fraud_rate',
        value: metrics.fraud_rate,
        threshold: thresholds.fraud_rate,
        severity: 'warning',
      })
    }

    return alerts
  }

  return { checkThresholds }
}