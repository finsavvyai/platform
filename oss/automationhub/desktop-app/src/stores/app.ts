import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface DeploymentUpdate {
  projectId: string
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed'
  progress: number
  message: string
}

export interface Project {
  id: string
  name: string
  type: string
  path: string
  status: 'active' | 'inactive' | 'deploying' | 'error'
  url?: string
  lastDeployed?: Date
  health?: number
}

export const useAppStore = defineStore('app', () => {
  // State
  const isLoading = ref(true)
  const loadingMessage = ref('Initializing...')
  const isOnline = ref(navigator.onLine)
  const appVersion = ref('0.1.0')
  const currentUser = ref<{ name: string; email: string } | null>(null)

  // Projects
  const projects = ref<Project[]>([])
  const activeDeployments = ref<Map<string, DeploymentUpdate>>(new Map())

  // UI State
  const sidebarCollapsed = ref(false)
  const theme = ref<'light' | 'dark' | 'system'>('system')
  const activeView = ref('dashboard')

  // Computed
  const isAuthenticated = computed(() => currentUser.value !== null)
  const runningProjects = computed(() =>
    projects.value.filter(p => p.status === 'active')
  )
  const deployingProjects = computed(() =>
    projects.value.filter(p => p.status === 'deploying')
  )
  const systemHealth = computed(() => {
    if (projects.value.length === 0) return 100
    const healthyProjects = projects.value.filter(p => p.status === 'active').length
    return Math.round((healthyProjects / projects.value.length) * 100)
  })

  // Actions
  const setLoading = (loading: boolean, message?: string) => {
    isLoading.value = loading
    if (message) {
      loadingMessage.value = message
    }
  }

  const setLoadingMessage = (message: string) => {
    loadingMessage.value = message
  }

  const setOnline = (online: boolean) => {
    isOnline.value = online
  }

  const setAppVersion = (version: string) => {
    appVersion.value = version
  }

  const setCurrentUser = (user: { name: string; email: string } | null) => {
    currentUser.value = user
  }

  const addProject = (project: Project) => {
    const existingIndex = projects.value.findIndex(p => p.id === project.id)
    if (existingIndex >= 0) {
      projects.value[existingIndex] = project
    } else {
      projects.value.push(project)
    }
  }

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index >= 0) {
      projects.value[index] = { ...projects.value[index], ...updates }
    }
  }

  const removeProject = (projectId: string) => {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index >= 0) {
      projects.value.splice(index, 1)
    }
  }

  const updateDeploymentStatus = (update: DeploymentUpdate) => {
    activeDeployments.value.set(update.projectId, update)

    // Update project status
    updateProject(update.projectId, {
      status: update.status === 'success' ? 'active' :
              update.status === 'failed' ? 'error' : 'deploying'
    })

    // Remove from active deployments if completed
    if (update.status === 'success' || update.status === 'failed') {
      setTimeout(() => {
        activeDeployments.value.delete(update.projectId)
      }, 3000) // Keep for 3 seconds after completion
    }
  }

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setTheme = (newTheme: 'light' | 'dark' | 'system') => {
    theme.value = newTheme

    // Apply theme to document
    const root = document.documentElement
    if (newTheme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemPrefersDark)
    } else {
      root.classList.toggle('dark', newTheme === 'dark')
    }
  }

  const setActiveView = (view: string) => {
    activeView.value = view
  }

  // Initialize theme on store creation
  const initializeTheme = () => {
    const savedTheme = localStorage.getItem('upm-theme') as 'light' | 'dark' | 'system' || 'system'
    setTheme(savedTheme)

    // Watch for system theme changes
    if (savedTheme === 'system') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (theme.value === 'system') {
          document.documentElement.classList.toggle('dark', e.matches)
        }
      })
    }
  }

  // Initialize theme
  initializeTheme()

  return {
    // State
    isLoading,
    loadingMessage,
    isOnline,
    appVersion,
    currentUser,
    projects,
    activeDeployments,
    sidebarCollapsed,
    theme,
    activeView,

    // Computed
    isAuthenticated,
    runningProjects,
    deployingProjects,
    systemHealth,

    // Actions
    setLoading,
    setLoadingMessage,
    setOnline,
    setAppVersion,
    setCurrentUser,
    addProject,
    updateProject,
    removeProject,
    updateDeploymentStatus,
    toggleSidebar,
    setTheme,
    setActiveView,
  }
})