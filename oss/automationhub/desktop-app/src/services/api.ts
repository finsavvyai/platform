// API service for connecting to UPM.Plus backend
import { ref } from 'vue'

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export interface ApiResponse<T> {
  data: T
  message?: string
  status: string
}

export interface SystemHealth {
  status: string
  version: string
  uptime: number
  database: boolean
  redis: boolean
  chroma: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  status: string
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  name: string
  type: string
  status: string
  capabilities: string[]
}

export interface Task {
  id: string
  name: string
  status: string
  progress: number
  created_at: string
}

export interface Deployment {
  id: string
  project_id: string
  environment: string
  status: string
  url?: string
  created_at: string
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error)
      throw error
    }
  }

  // Health endpoints
  async getSystemHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health')
  }

  // Project endpoints (using workflows as projects)
  async getProjects(): Promise<Project[]> {
    const response = await this.request<Project[]>('/workflows')
    return Array.isArray(response) ? response : []
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    const response = await this.request<Project>('/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: project.name,
        description: project.description,
        nodes: [],
        connections: [],
      }),
    })
    return response
  }

  // Agent endpoints
  async getAgents(): Promise<Agent[]> {
    const response = await this.request<Agent[]>('/agents')
    return Array.isArray(response) ? response : []
  }

  // Task endpoints
  async getTasks(): Promise<Task[]> {
    const response = await this.request<Task[]>('/tasks')
    return Array.isArray(response) ? response : []
  }

  // Deployment endpoints (using workflow executions)
  async getDeployments(): Promise<Deployment[]> {
    // Map workflow executions to deployments
    const workflows = await this.getProjects()
    const deployments: Deployment[] = []
    
    for (const workflow of workflows) {
      try {
        const executions = await this.request<any[]>(`/workflows/${workflow.id}/executions`)
        if (Array.isArray(executions)) {
          for (const exec of executions) {
            deployments.push({
              id: exec.id,
              project_id: workflow.id,
              environment: 'production',
              status: exec.status,
              created_at: exec.started_at || exec.created_at,
            })
          }
        }
      } catch (e) {
        // Skip if executions endpoint fails
      }
    }
    
    return deployments
  }

  // Analytics endpoints
  async getMetrics() {
    return this.request('/performance/analytics')
  }
}

export const apiService = new ApiService()

// Composable for reactive API state
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const withLoading = async <T>(operation: () => Promise<T>): Promise<T> => {
    loading.value = true
    error.value = null
    try {
      const result = await operation()
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    withLoading,
  }
}