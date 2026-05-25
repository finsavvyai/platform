<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Deployments</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Monitor and manage your project deployments
        </p>
      </div>

      <div class="flex space-x-3">
        <button
          @click="refreshDeployments"
          class="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          :disabled="isRefreshing"
        >
          <span :class="{ 'animate-spin': isRefreshing }">🔄</span>
          <span class="ml-2">Refresh</span>
        </button>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">📦</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Deployments</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ deployments.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">✅</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Successful</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ successfulCount }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">🚀</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Production</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ productionCount }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">📅</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Today</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ todayCount }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Deployments List -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Deployments</h2>
          <div class="flex items-center space-x-3">
            <select v-model="filterEnvironment" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-6 text-center">
        <div class="inline-flex items-center">
          <span class="animate-spin text-2xl mr-3">⟳</span>
          <span class="text-gray-600 dark:text-gray-400">Loading deployments...</span>
        </div>
      </div>

      <div v-else-if="error" class="p-6 text-center">
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
        <button @click="refreshDeployments" class="mt-2 text-blue-600 hover:text-blue-700">Try again</button>
      </div>

      <div v-else-if="filteredDeployments.length === 0" class="p-6 text-center">
        <p class="text-gray-600 dark:text-gray-400">No deployments found</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Project
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Environment
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                URL
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Deployed
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="deployment in filteredDeployments" :key="deployment.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ getProjectName(deployment.project_id) }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  ID: {{ deployment.project_id }}
                </div>
              </td>
              <td class="px-6 py-4">
                <span :class="getEnvironmentClass(deployment.environment)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ deployment.environment }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span :class="getStatusClass(deployment.status)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ deployment.status }}
                </span>
              </td>
              <td class="px-6 py-4">
                <a
                  :href="deployment.url"
                  target="_blank"
                  class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                >
                  {{ deployment.url }}
                </a>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                {{ formatDate(deployment.created_at) }}
              </td>
              <td class="px-6 py-4 text-sm">
                <div class="flex items-center space-x-2">
                  <button
                    @click="viewLogs(deployment)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Logs
                  </button>
                  <button
                    @click="redeploy(deployment)"
                    class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Redeploy
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiService, useApi } from '../services/api'

// State
const isRefreshing = ref(false)
const filterEnvironment = ref('')
const deployments = ref<any[]>([])
const projects = ref<any[]>([])

// API composable
const { loading, error, withLoading } = useApi()

// Computed properties
const filteredDeployments = computed(() => {
  if (!filterEnvironment.value) return deployments.value
  return deployments.value.filter(deployment => deployment.environment === filterEnvironment.value)
})

const successfulCount = computed(() =>
  deployments.value.filter(d => d.status === 'success').length
)

const productionCount = computed(() =>
  deployments.value.filter(d => d.environment === 'production').length
)

const todayCount = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return deployments.value.filter(d => d.created_at.startsWith(today)).length
})

// Methods
const loadDeployments = async () => {
  try {
    await withLoading(async () => {
      const [deploymentsResponse, projectsResponse] = await Promise.all([
        apiService.getDeployments(),
        apiService.getProjects()
      ])

      deployments.value = deploymentsResponse.data || deploymentsResponse || []
      projects.value = projectsResponse.data || projectsResponse || []
    })
  } catch (err) {
    console.error('Failed to load deployments:', err)
  }
}

const refreshDeployments = async () => {
  isRefreshing.value = true
  try {
    await loadDeployments()
  } finally {
    isRefreshing.value = false
  }
}

const getProjectName = (projectId: string) => {
  const project = projects.value.find(p => p.id === projectId)
  return project ? project.name : `Project ${projectId}`
}

const getEnvironmentClass = (environment: string) => {
  const classes = {
    production: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    staging: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    development: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  }
  return classes[environment as keyof typeof classes] || classes.development
}

const getStatusClass = (status: string) => {
  const classes = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  }
  return classes[status as keyof typeof classes] || classes.pending
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const viewLogs = (deployment: any) => {
  alert(`View logs for deployment ${deployment.id}`)
}

const redeploy = (deployment: any) => {
  alert(`Redeploy ${deployment.id} to ${deployment.environment}`)
}

// Load data on mount
onMounted(() => {
  loadDeployments()
})
</script>