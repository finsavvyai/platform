<template>
  <div class="p-6 space-y-6">
    <!-- Welcome Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome to UPM.Plus! 👋
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Your autonomous digital ecosystem orchestrator
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="flex space-x-3">
        <button
          @click="showCreateProject = true"
          class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          ➕ New Project
        </button>
        <button
          @click="refreshData"
          class="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          :disabled="isRefreshing"
        >
          <span :class="{ 'animate-spin': isRefreshing }">🔄</span>
          <span class="ml-2">Refresh</span>
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Active Projects -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active Projects</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ activeProjects }}</p>
          </div>
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">🚀</span>
          </div>
        </div>
        <div class="mt-4 flex items-center">
          <span class="text-sm font-medium text-green-600 dark:text-green-400">+12%</span>
          <span class="text-sm text-gray-600 dark:text-gray-400 ml-2">from last week</span>
        </div>
      </div>

      <!-- System Health -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">System Health</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ systemHealth }}%</p>
          </div>
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">💚</span>
          </div>
        </div>
        <div class="mt-4 flex items-center">
          <span class="text-sm font-medium text-green-600 dark:text-green-400">+2%</span>
          <span class="text-sm text-gray-600 dark:text-gray-400 ml-2">from yesterday</span>
        </div>
      </div>

      <!-- Total Deployments -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Deployments Today</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ deploymentsToday }}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">📦</span>
          </div>
        </div>
        <div class="mt-4 flex items-center">
          <span class="text-sm font-medium text-green-600 dark:text-green-400">+25%</span>
          <span class="text-sm text-gray-600 dark:text-gray-400 ml-2">from yesterday</span>
        </div>
      </div>

      <!-- Response Time -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Response Time</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ avgResponseTime }}ms</p>
          </div>
          <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex items-center justify-center">
            <span class="text-2xl">⚡</span>
          </div>
        </div>
        <div class="mt-4 flex items-center">
          <span class="text-sm font-medium text-green-600 dark:text-green-400">-15%</span>
          <span class="text-sm text-gray-600 dark:text-gray-400 ml-2">improvement</span>
        </div>
      </div>
    </div>

    <!-- AI Insights -->
    <div class="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
      <div class="flex items-center space-x-3 mb-4">
        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          🤖
        </div>
        <div>
          <h3 class="text-lg font-semibold">AI Insights</h3>
          <p class="text-purple-100">Personalized recommendations for your projects</p>
        </div>
      </div>

      <div class="space-y-3">
        <div v-for="insight in aiInsights" :key="insight.id" class="bg-white/10 rounded-lg p-3">
          <div class="flex items-start space-x-3">
            <span class="text-lg">{{ insight.icon }}</span>
            <div>
              <p class="font-medium">{{ insight.title }}</p>
              <p class="text-sm text-purple-100">{{ insight.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div :class="[
      'border rounded-lg p-4',
      error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
      loading ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
      'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    ]">
      <div class="flex items-center space-x-3">
        <span v-if="loading" class="text-yellow-500 text-xl animate-spin">⟳</span>
        <span v-else-if="error" class="text-red-500 text-xl">⚠️</span>
        <span v-else class="text-green-500 text-xl">✅</span>
        <div>
          <h3 :class="[
            'text-sm font-medium',
            error ? 'text-red-900 dark:text-red-100' :
            loading ? 'text-yellow-900 dark:text-yellow-100' :
            'text-green-900 dark:text-green-100'
          ]">{{ connectionStatus }}</h3>
          <p :class="[
            'text-sm mt-1',
            error ? 'text-red-700 dark:text-red-200' :
            loading ? 'text-yellow-700 dark:text-yellow-200' :
            'text-green-700 dark:text-green-200'
          ]">
            <span v-if="loading">Loading dashboard data...</span>
            <span v-else-if="error">{{ error }}</span>
            <span v-else>Real-time data from UPM.Plus backend at localhost:8015</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Create Project Modal -->
    <div v-if="showCreateProject" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Project</h2>

        <form @submit.prevent="createProject" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <input
              v-model="newProject.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter project name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              v-model="newProject.description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter project description"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              v-model="newProject.status"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="development">Development</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              @click="cancelCreateProject"
              class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              :disabled="isCreating"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isCreating || !newProject.name.trim()"
            >
              <span v-if="isCreating">Creating...</span>
              <span v-else>Create Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiService, useApi } from '../services/api'

// Local state
const showCreateProject = ref(false)
const isRefreshing = ref(false)
const isCreating = ref(false)

// New project form data
const newProject = ref({
  name: '',
  description: '',
  status: 'development'
})

// Real API data
const activeProjects = ref(0)
const systemHealth = ref(0)
const deploymentsToday = ref(0)
const avgResponseTime = ref(0)
const connectionStatus = ref('Connecting...')

// API composable
const { loading, error, withLoading } = useApi()

const aiInsights = ref([
  {
    id: 1,
    icon: '📈',
    title: 'Performance Optimization',
    description: 'Your e-commerce app could benefit from Redis caching. Estimated 40% speed improvement.'
  },
  {
    id: 2,
    icon: '🔒',
    title: 'Security Update',
    description: 'Consider updating to Node.js 18.17.1 for the latest security patches.'
  },
  {
    id: 3,
    icon: '💰',
    title: 'Cost Optimization',
    description: 'Switching to ARM instances could reduce your AWS costs by $127/month.'
  }
])

// Load real data from API
const loadDashboardData = async () => {
  try {
    await withLoading(async () => {
      // Get system health
      const health = await apiService.getSystemHealth()
      systemHealth.value = health.status === 'healthy' ? 98 : 50
      connectionStatus.value = 'Connected to UPM.Plus Backend'

      // Get projects
      const projects = await apiService.getProjects()
      activeProjects.value = projects.filter(p => p.status === 'active').length

      // Get deployments
      const deployments = await apiService.getDeployments()
      const today = new Date().toISOString().split('T')[0]
      deploymentsToday.value = deployments.filter(d =>
        d.created_at.startsWith(today)
      ).length

      // Mock response time for now
      avgResponseTime.value = 127
    })
  } catch (err) {
    console.error('Failed to load dashboard data:', err)
    connectionStatus.value = 'Connection failed - using mock data'
    // Fallback to mock data
    activeProjects.value = 12
    systemHealth.value = 98
    deploymentsToday.value = 8
    avgResponseTime.value = 127
  }
}

// Actions
const refreshData = async () => {
  isRefreshing.value = true
  try {
    await loadDashboardData()
  } catch (error) {
    console.error('Failed to refresh data:', error)
  } finally {
    isRefreshing.value = false
  }
}

// Project creation functions
const createProject = async () => {
  isCreating.value = true
  try {
    await apiService.createProject(newProject.value)

    // Reset form
    newProject.value = {
      name: '',
      description: '',
      status: 'development'
    }

    // Close modal
    showCreateProject.value = false

    // Refresh dashboard data to show new project
    await loadDashboardData()

  } catch (error) {
    console.error('Failed to create project:', error)
    alert('Failed to create project. Please try again.')
  } finally {
    isCreating.value = false
  }
}

const cancelCreateProject = () => {
  // Reset form
  newProject.value = {
    name: '',
    description: '',
    status: 'development'
  }
  showCreateProject.value = false
}

// Load data on mount
onMounted(() => {
  loadDashboardData()
})
</script>