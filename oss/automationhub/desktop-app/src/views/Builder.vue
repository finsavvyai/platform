<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Project Builder</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Scaffold, build, and deploy projects with real automation
        </p>
      </div>

      <div class="flex space-x-3">
        <button
          @click="refreshData"
          class="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          :disabled="isRefreshing"
        >
          <span :class="{ 'animate-spin': isRefreshing }">🔄</span>
          <span class="ml-2">Refresh</span>
        </button>
        <button
          @click="showCreateProject = true"
          class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <span class="mr-2">🚀</span>
          <span>New Project</span>
        </button>
      </div>
    </div>

    <!-- Templates Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Available Templates</h2>
      </div>
      <div class="p-6">
        <div v-if="loading" class="text-center py-8">
          <span class="animate-spin text-2xl">⟳</span>
          <p class="text-gray-600 dark:text-gray-400 mt-2">Loading templates...</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="template in templates"
            :key="template.id"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer transition-colors"
            @click="selectTemplate(template)"
          >
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                <span class="text-xl">{{ getTemplateIcon(template.type) }}</span>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-white">{{ template.name }}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ template.type }}</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300">{{ template.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">My Projects</h2>
      </div>
      <div class="p-6">
        <div v-if="projects.length === 0" class="text-center py-8">
          <span class="text-4xl">📁</span>
          <p class="text-gray-600 dark:text-gray-400 mt-2">No projects yet. Create your first project!</p>
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="project in projects"
            :key="project.id"
            class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-white">{{ project.name }}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ project.description }}</p>
                <div class="flex items-center space-x-4 mt-2">
                  <span class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{{ project.template }}</span>
                  <span :class="getStatusClass(project.status)" class="text-xs px-2 py-1 rounded">
                    {{ project.status }}
                  </span>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  v-if="project.status === 'created'"
                  @click="buildProject(project)"
                  class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                  :disabled="buildingProjects.includes(project.id)"
                >
                  {{ buildingProjects.includes(project.id) ? '⟳' : '🔨' }} Build
                </button>
                <button
                  v-if="project.status === 'created'"
                  @click="createGitHubRepo(project)"
                  class="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                >
                  🐙 GitHub
                </button>
                <button
                  v-if="project.status === 'built' || project.status === 'repo_created'"
                  @click="showDeployModal(project)"
                  class="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                >
                  ☁️ Deploy
                </button>
                <button
                  @click="openProjectPath(project)"
                  class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                >
                  📁 Open
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Builds Section -->
    <div v-if="builds.length > 0" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Builds</h2>
      </div>
      <div class="p-6">
        <div class="space-y-3">
          <div
            v-for="build in builds"
            :key="build.id"
            class="p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ getProjectName(build.project_id) }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ build.start_time }}</p>
              </div>
              <div class="flex items-center space-x-2">
                <span :class="getBuildStatusClass(build.status)" class="px-2 py-1 text-xs rounded">
                  {{ build.status }}
                </span>
                <button
                  @click="viewBuildLogs(build)"
                  class="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs"
                >
                  📜 Logs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Project Modal -->
  <div v-if="showCreateProject" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Create New Project</h2>

      <form @submit.prevent="createProject">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name
            </label>
            <input
              v-model="newProject.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter project name"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              v-model="newProject.description"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter project description"
              rows="3"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template
            </label>
            <select
              v-model="newProject.template"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">Select a template</option>
              <option v-for="template in templates" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            @click="showCreateProject = false"
            class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isCreating"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg"
          >
            {{ isCreating ? 'Creating...' : 'Create Project' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Cloud Deploy Modal -->
  <div v-if="showDeploymentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Deploy to Cloud</h2>
        <button
          @click="showDeploymentModal = false"
          class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div class="mb-4">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Project: <strong>{{ selectedProject?.name }}</strong>
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Template: <strong>{{ selectedProject?.template }}</strong>
        </p>
      </div>

      <div class="space-y-3">
        <h3 class="font-semibold text-gray-900 dark:text-white">Choose a cloud provider:</h3>
        <div
          v-for="provider in getCompatibleProviders(selectedProject?.template)"
          :key="provider.id"
          @click="selectProvider(provider)"
          class="p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
          :class="{ 'border-blue-500 bg-blue-50 dark:bg-blue-900/20': selectedProvider?.id === provider.id }"
        >
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium text-gray-900 dark:text-white">{{ provider.name }}</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ provider.description }}</p>
            </div>
            <span class="text-lg">{{ provider.icon }}</span>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        <button
          type="button"
          @click="showDeploymentModal = false"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          @click="deployToCloud"
          :disabled="!selectedProvider || isDeploying"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg"
        >
          {{ isDeploying ? 'Deploying...' : '☁️ Deploy' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Build Logs Modal -->
  <div v-if="showBuildLogs" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Build Logs</h2>
        <button
          @click="showBuildLogs = false"
          class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div class="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 font-mono text-sm">
        <div v-for="(log, index) in currentBuildLogs" :key="index" class="mb-1">
          {{ log }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiService, useApi } from '../services/api'

// State
const isRefreshing = ref(false)
const showCreateProject = ref(false)
const showBuildLogs = ref(false)
const showDeploymentModal = ref(false)
const isCreating = ref(false)
const isDeploying = ref(false)
const buildingProjects = ref<string[]>([])
const selectedProject = ref<any>(null)
const selectedProvider = ref<any>(null)

// Data
const templates = ref<any[]>([])
const projects = ref<any[]>([])
const builds = ref<any[]>([])
const currentBuildLogs = ref<string[]>([])

// Cloud Providers
const cloudProviders = ref([
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Perfect for React and static sites',
    icon: '▲',
    supports: ['react', 'nextjs', 'static']
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Great for JAMstack applications',
    icon: '🌐',
    supports: ['react', 'static', 'jamstack']
  },
  {
    id: 'heroku',
    name: 'Heroku',
    description: 'Full-stack application platform',
    icon: '🟣',
    supports: ['express', 'python-fastapi']
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Modern cloud platform',
    icon: '🚆',
    supports: ['express', 'python-fastapi']
  },
  {
    id: 'render',
    name: 'Render',
    description: 'Unified cloud platform',
    icon: '🎨',
    supports: ['react', 'express', 'python-fastapi']
  }
])

// Form data
const newProject = ref({
  name: '',
  description: '',
  template: ''
})

// API composable
const { loading, error, withLoading } = useApi()

// Methods
const loadData = async () => {
  try {
    await withLoading(async () => {
      const [templatesResponse, projectsResponse, buildsResponse] = await Promise.all([
        fetch('http://localhost:8015/api/v1/templates').then(r => r.json()),
        fetch('http://localhost:8015/api/v1/projects').then(r => r.json()),
        fetch('http://localhost:8015/api/v1/builds').then(r => r.json())
      ])

      templates.value = templatesResponse.data || []
      projects.value = projectsResponse.data || []
      builds.value = buildsResponse.data || []
    })
  } catch (err) {
    console.error('Failed to load data:', err)
  }
}

const refreshData = async () => {
  isRefreshing.value = true
  try {
    await loadData()
  } finally {
    isRefreshing.value = false
  }
}

const selectTemplate = (template: any) => {
  newProject.value.template = template.id
  showCreateProject.value = true
}

const createProject = async () => {
  isCreating.value = true
  try {
    const response = await fetch('http://localhost:8015/api/v1/projects/scaffold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newProject.value)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to create project')
    }

    const result = await response.json()

    newProject.value = { name: '', description: '', template: '' }
    showCreateProject.value = false
    await loadData()

    alert(`Project "${result.data.name}" created successfully!`)
  } catch (error: any) {
    console.error('Failed to create project:', error)
    alert(`Failed to create project: ${error.message}`)
  } finally {
    isCreating.value = false
  }
}

const buildProject = async (project: any) => {
  buildingProjects.value.push(project.id)

  try {
    const response = await fetch(`http://localhost:8015/api/v1/projects/${project.id}/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error('Failed to start build')
    }

    const result = await response.json()
    alert(`Build started for "${project.name}"!`)

    // Poll build status
    pollBuildStatus(result.data.id)

  } catch (error: any) {
    console.error('Failed to build project:', error)
    alert(`Failed to build project: ${error.message}`)
  } finally {
    buildingProjects.value = buildingProjects.value.filter(id => id !== project.id)
  }
}

const pollBuildStatus = async (buildId: string) => {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:8015/api/v1/builds/${buildId}`)
      const result = await response.json()

      if (result.data.status !== 'building') {
        clearInterval(interval)
        await loadData()

        if (result.data.status === 'success') {
          alert('Build completed successfully!')
        } else {
          alert('Build failed. Check logs for details.')
        }
      }
    } catch (error) {
      console.error('Failed to poll build status:', error)
      clearInterval(interval)
    }
  }, 2000)
}

const deployProject = async (project: any) => {
  const environment = prompt('Enter deployment environment (development/staging/production):', 'development')
  if (!environment) return

  try {
    const response = await fetch(`http://localhost:8015/api/v1/projects/${project.id}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ environment })
    })

    if (!response.ok) {
      throw new Error('Failed to deploy project')
    }

    const result = await response.json()
    alert(`Project deployed to ${environment}!\nURL: ${result.data.url}`)

  } catch (error: any) {
    console.error('Failed to deploy project:', error)
    alert(`Failed to deploy project: ${error.message}`)
  }
}

const openProjectPath = (project: any) => {
  // In a real app, this would open the file system
  alert(`Project path: ${project.path}`)
}

const viewBuildLogs = async (build: any) => {
  currentBuildLogs.value = build.logs || []
  showBuildLogs.value = true
}

const getProjectName = (projectId: string) => {
  const project = projects.value.find(p => p.id === projectId)
  return project ? project.name : 'Unknown Project'
}

const getTemplateIcon = (type: string) => {
  const icons = {
    react: '⚛️',
    express: '🟢',
    'python-fastapi': '🐍'
  }
  return icons[type as keyof typeof icons] || '📦'
}

const createGitHubRepo = async (project: any) => {
  try {
    const response = await fetch(`http://localhost:8015/api/v1/projects/${project.id}/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error('Failed to create GitHub repository')
    }

    const result = await response.json()
    alert(`GitHub repository created!\nURL: ${result.data.repo_url}`)
    await loadData()

  } catch (error: any) {
    console.error('Failed to create GitHub repo:', error)
    alert(`Failed to create GitHub repository: ${error.message}`)
  }
}

const showDeployModal = (project: any) => {
  selectedProject.value = project
  selectedProvider.value = null
  showDeploymentModal.value = true
}

const getCompatibleProviders = (template: string) => {
  return cloudProviders.value.filter(provider =>
    provider.supports.includes(template)
  )
}

const selectProvider = (provider: any) => {
  selectedProvider.value = provider
}

const deployToCloud = async () => {
  if (!selectedProject.value || !selectedProvider.value) return

  isDeploying.value = true
  try {
    const response = await fetch(`http://localhost:8015/api/v1/projects/${selectedProject.value.id}/deploy/cloud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: selectedProvider.value.id,
        environment: 'production'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to deploy to cloud')
    }

    const result = await response.json()
    showDeploymentModal.value = false
    alert(`🚀 Successfully deployed to ${selectedProvider.value.name}!\n\nLive URL: ${result.data.url}\nDashboard: ${result.data.dashboard_url}`)
    await loadData()

  } catch (error: any) {
    console.error('Failed to deploy to cloud:', error)
    alert(`Failed to deploy: ${error.message}`)
  } finally {
    isDeploying.value = false
  }
}

const getStatusClass = (status: string) => {
  const classes = {
    created: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    built: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    build_failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    repo_created: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    deployed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
  }
  return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800'
}

const getBuildStatusClass = (status: string) => {
  const classes = {
    building: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  }
  return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800'
}

// Load data on mount
onMounted(() => {
  loadData()
})
</script>