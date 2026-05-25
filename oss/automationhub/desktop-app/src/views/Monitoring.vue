<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">System Monitoring</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Real-time system health and performance metrics
        </p>
      </div>

      <div class="flex space-x-3">
        <button
          @click="refreshMetrics"
          class="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          :disabled="isRefreshing"
        >
          <span :class="{ 'animate-spin': isRefreshing }">🔄</span>
          <span class="ml-2">Refresh</span>
        </button>
        <button
          @click="toggleAutoRefresh"
          :class="[
            'inline-flex items-center px-4 py-2 rounded-lg transition-colors',
            autoRefresh
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          ]"
        >
          <span class="mr-2">{{ autoRefresh ? '⏸️' : '▶️' }}</span>
          <span>{{ autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh' }}</span>
        </button>
      </div>
    </div>

    <!-- System Health Status -->
    <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold mb-2">System Health Status</h2>
          <p class="text-blue-100">Overall system performance and availability</p>
        </div>
        <div class="text-right">
          <div class="text-3xl font-bold">{{ systemHealth }}%</div>
          <div class="text-sm text-blue-100">Uptime: {{ uptime }}</div>
        </div>
      </div>
    </div>

    <!-- Core Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">⚡</span>
          </div>
          <span :class="getMetricStatusClass(responseTime)" class="text-xs px-2 py-1 rounded-full">
            {{ responseTime < 200 ? 'EXCELLENT' : responseTime < 500 ? 'GOOD' : 'SLOW' }}
          </span>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Response Time</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ responseTime }}ms</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ getMetricTrend(responseTime, 150) }}
          </p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">🔄</span>
          </div>
          <span :class="getMetricStatusClass(throughput)" class="text-xs px-2 py-1 rounded-full">
            {{ throughput > 1000 ? 'HIGH' : throughput > 500 ? 'GOOD' : 'LOW' }}
          </span>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Throughput</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ throughput }}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">requests/min</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">❌</span>
          </div>
          <span :class="getMetricStatusClass(errorRate)" class="text-xs px-2 py-1 rounded-full">
            {{ errorRate < 1 ? 'EXCELLENT' : errorRate < 5 ? 'GOOD' : 'HIGH' }}
          </span>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Error Rate</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ errorRate }}%</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">last hour</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">👥</span>
          </div>
          <span class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
            ACTIVE
          </span>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ activeUsers }}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">online now</p>
        </div>
      </div>
    </div>

    <!-- Services Status -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Service Health -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Service Health</h3>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div v-for="service in services" :key="service.name" class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div :class="getServiceStatusClass(service.status)" class="w-3 h-3 rounded-full"></div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ service.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ service.description }}</p>
                </div>
              </div>
              <div class="text-right">
                <span :class="getServiceBadgeClass(service.status)" class="px-2 py-1 text-xs font-medium rounded-full">
                  {{ service.status.toUpperCase() }}
                </span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ service.lastCheck }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Alerts -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Alerts</h3>
        </div>
        <div class="p-6">
          <div v-if="alerts.length === 0" class="text-center py-8">
            <span class="text-4xl">✅</span>
            <p class="text-gray-500 dark:text-gray-400 mt-2">No active alerts</p>
          </div>
          <div v-else class="space-y-3">
            <div v-for="alert in alerts" :key="alert.id" :class="getAlertClass(alert.severity)" class="p-3 rounded-lg border">
              <div class="flex items-start space-x-3">
                <span class="text-lg">{{ getAlertIcon(alert.severity) }}</span>
                <div class="flex-1">
                  <p class="font-medium">{{ alert.title }}</p>
                  <p class="text-sm opacity-75">{{ alert.message }}</p>
                  <p class="text-xs opacity-60 mt-1">{{ formatTime(alert.timestamp) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Charts -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Performance Trends</h3>
      </div>
      <div class="p-6">
        <div class="text-center py-8">
          <span class="text-4xl">📊</span>
          <p class="text-gray-500 dark:text-gray-400 mt-2">Performance charts coming soon</p>
          <p class="text-sm text-gray-400 dark:text-gray-500">Real-time metrics visualization</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { apiService, useApi } from '../services/api'

// State
const isRefreshing = ref(false)
const autoRefresh = ref(false)
const refreshInterval = ref<NodeJS.Timeout | null>(null)

// Metrics
const systemHealth = ref(98)
const uptime = ref('99.9%')
const responseTime = ref(127)
const throughput = ref(847)
const errorRate = ref(0.3)
const activeUsers = ref(42)

// Services
const services = ref([
  {
    name: 'API Gateway',
    description: 'Main API endpoint',
    status: 'healthy',
    lastCheck: '2 min ago'
  },
  {
    name: 'Database',
    description: 'PostgreSQL cluster',
    status: 'healthy',
    lastCheck: '1 min ago'
  },
  {
    name: 'Redis Cache',
    description: 'Caching layer',
    status: 'healthy',
    lastCheck: '30 sec ago'
  },
  {
    name: 'Agent Registry',
    description: 'AI agent management',
    status: 'warning',
    lastCheck: '5 min ago'
  },
  {
    name: 'Task Queue',
    description: 'Background processing',
    status: 'healthy',
    lastCheck: '1 min ago'
  }
])

// Alerts
const alerts = ref([
  {
    id: 1,
    title: 'High Memory Usage',
    message: 'Agent Registry service using 85% memory',
    severity: 'warning',
    timestamp: new Date(Date.now() - 300000) // 5 minutes ago
  }
])

// API composable
const { loading, error, withLoading } = useApi()

// Methods
const loadMetrics = async () => {
  try {
    await withLoading(async () => {
      // Simulate real-time metrics
      responseTime.value = Math.floor(Math.random() * 100) + 80
      throughput.value = Math.floor(Math.random() * 300) + 600
      errorRate.value = Math.random() * 2
      activeUsers.value = Math.floor(Math.random() * 20) + 30
      systemHealth.value = Math.floor(Math.random() * 5) + 95

      // Get health from API
      const health = await apiService.getSystemHealth()
      if (health.status === 'healthy') {
        systemHealth.value = Math.max(systemHealth.value, 95)
      }
    })
  } catch (err) {
    console.error('Failed to load metrics:', err)
  }
}

const refreshMetrics = async () => {
  isRefreshing.value = true
  try {
    await loadMetrics()
  } finally {
    isRefreshing.value = false
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value

  if (autoRefresh.value) {
    refreshInterval.value = setInterval(() => {
      loadMetrics()
    }, 10000) // Refresh every 10 seconds
  } else {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }
}

const getMetricStatusClass = (value: number) => {
  if (value < 200) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  if (value < 500) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
}

const getMetricTrend = (current: number, baseline: number) => {
  const diff = current - baseline
  if (diff > 0) return `+${diff}ms from baseline`
  if (diff < 0) return `${diff}ms from baseline`
  return 'at baseline'
}

const getServiceStatusClass = (status: string) => {
  const classes = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    offline: 'bg-gray-500'
  }
  return classes[status as keyof typeof classes] || classes.offline
}

const getServiceBadgeClass = (status: string) => {
  const classes = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    offline: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
  return classes[status as keyof typeof classes] || classes.offline
}

const getAlertClass = (severity: string) => {
  const classes = {
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    error: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
  }
  return classes[severity as keyof typeof classes] || classes.info
}

const getAlertIcon = (severity: string) => {
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '🚨'
  }
  return icons[severity as keyof typeof icons] || icons.info
}

const formatTime = (timestamp: Date) => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Lifecycle
onMounted(() => {
  loadMetrics()
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>