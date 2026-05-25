import { ref, onMounted, onUnmounted } from 'vue'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/tauri'

// Types
interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_rx: number
  network_tx: number
  timestamp: string
}

interface DeploymentUpdate {
  project_id: string
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed'
  progress: number
  message: string
  logs?: string[]
}

interface ProjectUpdate {
  id: string
  status: 'active' | 'inactive' | 'deploying' | 'error'
  health: number
  last_activity: string
}

interface NotificationEvent {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: string
  actions?: Array<{
    label: string
    action: string
  }>
}

/**
 * Composable for real-time system updates
 * Handles WebSocket connections, system monitoring, and live data
 */
export function useRealTimeUpdates() {
  // State
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)
  const lastUpdateTime = ref<Date | null>(null)

  // System metrics
  const systemMetrics = ref<SystemMetrics>({
    cpu_usage: 0,
    memory_usage: 0,
    disk_usage: 0,
    network_rx: 0,
    network_tx: 0,
    timestamp: new Date().toISOString()
  })

  // Real-time data
  const deploymentUpdates = ref<Map<string, DeploymentUpdate>>(new Map())
  const projectUpdates = ref<Map<string, ProjectUpdate>>(new Map())
  const liveNotifications = ref<NotificationEvent[]>([])

  // Event listeners
  const eventListeners = ref<UnlistenFn[]>([])

  /**
   * Initialize real-time connections and event listeners
   */
  const initialize = async () => {
    try {
      console.log('🔌 Initializing real-time updates...')

      // Start system monitoring
      await startSystemMonitoring()

      // Listen for deployment updates
      const deploymentListener = await listen<DeploymentUpdate>('deployment-update', (event) => {
        handleDeploymentUpdate(event.payload)
      })
      eventListeners.value.push(deploymentListener)

      // Listen for project updates
      const projectListener = await listen<ProjectUpdate>('project-update', (event) => {
        handleProjectUpdate(event.payload)
      })
      eventListeners.value.push(projectListener)

      // Listen for system notifications
      const notificationListener = await listen<NotificationEvent>('system-notification', (event) => {
        handleNotification(event.payload)
      })
      eventListeners.value.push(notificationListener)

      // Listen for system metrics
      const metricsListener = await listen<SystemMetrics>('system-metrics', (event) => {
        handleSystemMetrics(event.payload)
      })
      eventListeners.value.push(metricsListener)

      // Connection status updates
      const connectionListener = await listen<{ connected: boolean; error?: string }>('connection-status', (event) => {
        isConnected.value = event.payload.connected
        connectionError.value = event.payload.error || null
      })
      eventListeners.value.push(connectionListener)

      isConnected.value = true
      connectionError.value = null
      lastUpdateTime.value = new Date()

      console.log('✅ Real-time updates initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize real-time updates:', error)
      connectionError.value = error instanceof Error ? error.message : 'Unknown error'
      isConnected.value = false
    }
  }

  /**
   * Start system monitoring
   */
  const startSystemMonitoring = async () => {
    try {
      await invoke('start_system_monitoring', { interval: 2000 }) // Update every 2 seconds
    } catch (error) {
      console.error('Failed to start system monitoring:', error)
    }
  }

  /**
   * Stop system monitoring
   */
  const stopSystemMonitoring = async () => {
    try {
      await invoke('stop_system_monitoring')
    } catch (error) {
      console.error('Failed to stop system monitoring:', error)
    }
  }

  /**
   * Handle deployment updates
   */
  const handleDeploymentUpdate = (update: DeploymentUpdate) => {
    deploymentUpdates.value.set(update.project_id, update)
    lastUpdateTime.value = new Date()

    // Emit custom event for components to listen
    window.dispatchEvent(new CustomEvent('deployment-progress', {
      detail: update
    }))

    // Auto-remove completed deployments after 5 seconds
    if (update.status === 'success' || update.status === 'failed') {
      setTimeout(() => {
        deploymentUpdates.value.delete(update.project_id)
      }, 5000)
    }
  }

  /**
   * Handle project status updates
   */
  const handleProjectUpdate = (update: ProjectUpdate) => {
    projectUpdates.value.set(update.id, update)
    lastUpdateTime.value = new Date()

    // Emit custom event
    window.dispatchEvent(new CustomEvent('project-status-change', {
      detail: update
    }))
  }

  /**
   * Handle system notifications
   */
  const handleNotification = (notification: NotificationEvent) => {
    liveNotifications.value.unshift(notification) // Add to beginning
    lastUpdateTime.value = new Date()

    // Keep only last 100 notifications
    if (liveNotifications.value.length > 100) {
      liveNotifications.value = liveNotifications.value.slice(0, 100)
    }

    // Emit custom event
    window.dispatchEvent(new CustomEvent('system-notification', {
      detail: notification
    }))

    // Show native notification for important events
    if (notification.type === 'error' || notification.type === 'warning') {
      showNativeNotification(notification)
    }
  }

  /**
   * Handle system metrics updates
   */
  const handleSystemMetrics = (metrics: SystemMetrics) => {
    systemMetrics.value = metrics
    lastUpdateTime.value = new Date()

    // Emit custom event for charts and graphs
    window.dispatchEvent(new CustomEvent('system-metrics-update', {
      detail: metrics
    }))
  }

  /**
   * Show native notification
   */
  const showNativeNotification = async (notification: NotificationEvent) => {
    try {
      await invoke('send_notification', {
        title: notification.title,
        body: notification.message,
        icon: getNotificationIcon(notification.type)
      })
    } catch (error) {
      console.error('Failed to send native notification:', error)
    }
  }

  /**
   * Get notification icon based on type
   */
  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      case 'info':
      default: return 'ℹ️'
    }
  }

  /**
   * Force refresh system data
   */
  const refreshSystemData = async () => {
    try {
      const metrics = await invoke<SystemMetrics>('get_system_metrics')
      handleSystemMetrics(metrics)
    } catch (error) {
      console.error('Failed to refresh system data:', error)
    }
  }

  /**
   * Subscribe to deployment updates for a specific project
   */
  const subscribeToDeployment = async (projectId: string) => {
    try {
      await invoke('subscribe_deployment_updates', { projectId })
    } catch (error) {
      console.error('Failed to subscribe to deployment updates:', error)
    }
  }

  /**
   * Unsubscribe from deployment updates
   */
  const unsubscribeFromDeployment = async (projectId: string) => {
    try {
      await invoke('unsubscribe_deployment_updates', { projectId })
      deploymentUpdates.value.delete(projectId)
    } catch (error) {
      console.error('Failed to unsubscribe from deployment updates:', error)
    }
  }

  /**
   * Get deployment status for a project
   */
  const getDeploymentStatus = (projectId: string): DeploymentUpdate | undefined => {
    return deploymentUpdates.value.get(projectId)
  }

  /**
   * Get project status
   */
  const getProjectStatus = (projectId: string): ProjectUpdate | undefined => {
    return projectUpdates.value.get(projectId)
  }

  /**
   * Clear old notifications
   */
  const clearNotifications = (olderThan?: Date) => {
    if (olderThan) {
      liveNotifications.value = liveNotifications.value.filter(
        notification => new Date(notification.timestamp) > olderThan
      )
    } else {
      liveNotifications.value = []
    }
  }

  /**
   * Get connection health score
   */
  const getConnectionHealth = (): number => {
    if (!isConnected.value) return 0
    if (connectionError.value) return 25
    if (!lastUpdateTime.value) return 50

    const timeSinceUpdate = Date.now() - lastUpdateTime.value.getTime()
    if (timeSinceUpdate < 5000) return 100  // Less than 5 seconds
    if (timeSinceUpdate < 30000) return 75  // Less than 30 seconds
    if (timeSinceUpdate < 60000) return 50  // Less than 1 minute
    return 25
  }

  /**
   * Reconnect to real-time services
   */
  const reconnect = async () => {
    console.log('🔄 Attempting to reconnect...')

    // Clean up existing connections
    cleanup()

    // Reinitialize after a short delay
    setTimeout(async () => {
      await initialize()
    }, 1000)
  }

  /**
   * Cleanup function
   */
  const cleanup = () => {
    console.log('🧹 Cleaning up real-time connections...')

    // Stop system monitoring
    stopSystemMonitoring()

    // Remove all event listeners
    eventListeners.value.forEach(unlisten => {
      try {
        unlisten()
      } catch (error) {
        console.error('Error removing event listener:', error)
      }
    })
    eventListeners.value = []

    // Reset state
    isConnected.value = false
    connectionError.value = null
    deploymentUpdates.value.clear()
    projectUpdates.value.clear()
  }

  // Lifecycle hooks
  onMounted(() => {
    initialize()
  })

  onUnmounted(() => {
    cleanup()
  })

  // Return reactive state and methods
  return {
    // State
    isConnected,
    connectionError,
    lastUpdateTime,
    systemMetrics,
    deploymentUpdates,
    projectUpdates,
    liveNotifications,

    // Methods
    initialize,
    reconnect,
    refreshSystemData,
    subscribeToDeployment,
    unsubscribeFromDeployment,
    getDeploymentStatus,
    getProjectStatus,
    clearNotifications,
    getConnectionHealth,
    cleanup
  }
}

/**
 * Lightweight composable for system metrics only
 */
export function useSystemMetrics() {
  const metrics = ref<SystemMetrics>({
    cpu_usage: 0,
    memory_usage: 0,
    disk_usage: 0,
    network_rx: 0,
    network_tx: 0,
    timestamp: new Date().toISOString()
  })

  const startMonitoring = async () => {
    const listener = await listen<SystemMetrics>('system-metrics', (event) => {
      metrics.value = event.payload
    })

    await invoke('start_system_monitoring', { interval: 5000 })

    onUnmounted(async () => {
      listener()
      await invoke('stop_system_monitoring')
    })
  }

  return {
    metrics,
    startMonitoring
  }
}

/**
 * Composable for deployment monitoring
 */
export function useDeploymentMonitoring(projectId?: string) {
  const deployments = ref<Map<string, DeploymentUpdate>>(new Map())
  const isMonitoring = ref(false)

  const startMonitoring = async (targetProjectId?: string) => {
    const id = targetProjectId || projectId
    if (!id) {
      console.warn('No project ID provided for deployment monitoring')
      return
    }

    const listener = await listen<DeploymentUpdate>('deployment-update', (event) => {
      if (event.payload.project_id === id) {
        deployments.value.set(event.payload.project_id, event.payload)
      }
    })

    await invoke('subscribe_deployment_updates', { projectId: id })
    isMonitoring.value = true

    onUnmounted(async () => {
      listener()
      if (id) {
        await invoke('unsubscribe_deployment_updates', { projectId: id })
      }
      isMonitoring.value = false
    })
  }

  const getStatus = (id: string) => deployments.value.get(id)

  return {
    deployments,
    isMonitoring,
    startMonitoring,
    getStatus
  }
}