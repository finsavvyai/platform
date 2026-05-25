<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Manage your autonomous projects and deployments
        </p>
      </div>

      <div class="flex space-x-3">
        <button
          @click="showCreateProject = true"
          class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          ➕ New Project
        </button>
        <button
          @click="refreshProjects"
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
            <span class="text-2xl">📁</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Projects</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ projects.length }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">🚀</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Active</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ activeCount }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">⚙️</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Development</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ developmentCount }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center">
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mr-4">
            <span class="text-2xl">✅</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ completedCount }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects List -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">All Projects</h2>
          <div class="flex items-center space-x-3">
            <select v-model="filterStatus" class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="development">Development</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-6 text-center">
        <div class="inline-flex items-center">
          <span class="animate-spin text-2xl mr-3">⟳</span>
          <span class="text-gray-600 dark:text-gray-400">Loading projects...</span>
        </div>
      </div>

      <div v-else-if="error" class="p-6 text-center">
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
        <button @click="refreshProjects" class="mt-2 text-blue-600 hover:text-blue-700">Try again</button>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="p-6 text-center">
        <p class="text-gray-600 dark:text-gray-400">No projects found</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Project
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Updated
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="project in filteredProjects" :key="project.id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-6 py-4">
                <div>
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ project.name }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ project.description }}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span :class="getStatusClass(project.status)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ project.status }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                {{ formatDate(project.created_at) }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                {{ formatDate(project.updated_at) }}
              </td>
              <td class="px-6 py-4 text-sm">
                <div class="flex items-center space-x-2">
                  <button
                    @click="editProject(project)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    @click="deleteProject(project.id)"
                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
import { ref, computed, onMounted } from 'vue'
import { apiService, useApi } from '../services/api'

// State
const showCreateProject = ref(false)
const isRefreshing = ref(false)
const isCreating = ref(false)
const filterStatus = ref('')
const projects = ref<any[]>([])

// New project form data
const newProject = ref({
  name: '',
  description: '',
  status: 'development'
})

// API composable
const { loading, error, withLoading } = useApi()

// Computed properties
const filteredProjects = computed(() => {
  if (!filterStatus.value) return projects.value
  return projects.value.filter(project => project.status === filterStatus.value)
})

const activeCount = computed(() =>
  projects.value.filter(p => p.status === 'active').length
)

const developmentCount = computed(() =>
  projects.value.filter(p => p.status === 'development').length
)

const completedCount = computed(() =>
  projects.value.filter(p => p.status === 'completed').length
)

// Methods
const loadProjects = async () => {
  try {
    await withLoading(async () => {
      const response = await apiService.getProjects()
      projects.value = response.data || response || []
    })
  } catch (err) {
    console.error('Failed to load projects:', err)
  }
}

const refreshProjects = async () => {
  isRefreshing.value = true
  try {
    await loadProjects()
  } finally {
    isRefreshing.value = false
  }
}

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

    // Refresh projects list
    await loadProjects()

  } catch (error) {
    console.error('Failed to create project:', error)
    alert('Failed to create project. Please try again.')
  } finally {
    isCreating.value = false
  }
}

const cancelCreateProject = () => {
  newProject.value = {
    name: '',
    description: '',
    status: 'development'
  }
  showCreateProject.value = false
}

const editProject = (project: any) => {
  // TODO: Implement edit functionality
  alert(`Edit project: ${project.name}`)
}

const deleteProject = async (projectId: string) => {
  if (!confirm('Are you sure you want to delete this project?')) return

  try {
    // TODO: Implement delete API endpoint
    alert(`Delete project: ${projectId}`)
  } catch (error) {
    console.error('Failed to delete project:', error)
    alert('Failed to delete project. Please try again.')
  }
}

const getStatusClass = (status: string) => {
  const classes = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    development: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    paused: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
  return classes[status as keyof typeof classes] || classes.development
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Load data on mount
onMounted(() => {
  loadProjects()
})
</script>