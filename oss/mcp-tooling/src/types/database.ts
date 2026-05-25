export type ConnectorStatus = 'draft' | 'active' | 'error'
export type ConnectorRuntime = 'worker-ts' | 'worker-go' | 'download-only'
export type AuthMode = 'api_key' | 'oauth_client' | 'oauth_code' | 'jwt' | 'none'
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Connector {
  id: string
  name: string
  owner_id: string
  version: number
  status: ConnectorStatus
  runtime: ConnectorRuntime
  build_artifact_key: string | null
  deployed_worker_name: string | null
  auth_mode: AuthMode
  spec_url: string | null
  spec_content: Record<string, unknown> | null
  manifest_content: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  connector_id: string
  status: JobStatus
  started_at: string | null
  finished_at: string | null
  logs: LogEntry[]
  error_message: string | null
  created_at: string
}

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface UsageMetrics {
  id: string
  connector_id: string
  date: string
  req_total: number
  err_total: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
  created_at: string
  updated_at: string
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}

export interface MCPManifest {
  name: string
  version: string
  description?: string
  tools: MCPTool[]
}

export interface GenerateRequest {
  specContent?: string
  specUrl?: string
  targetRuntime: ConnectorRuntime
  authMode: AuthMode
  connectorName: string
  filter?: {
    exclude?: string[]
  }
}

export interface GenerateResponse {
  jobId: string
  connectorId: string
  estimated: number
}

// User Profile Management Types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: NotificationSettings
  default_auth_mode?: AuthMode
  default_runtime?: ConnectorRuntime
}

export interface NotificationSettings {
  email_notifications: boolean
  job_completion: boolean
  deployment_status: boolean
  usage_alerts: boolean
}

export interface UserProfile {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  last_sign_in_at?: string
  preferences: UserPreferences
  activity_count: {
    connectors_created: number
    jobs_completed: number
    total_requests: number
  }
}

export interface ActivityItem {
  id: string
  type: 'connector_created' | 'connector_updated' | 'job_completed' | 'user_updated'
  description: string
  timestamp: string
  metadata?: Record<string, unknown>
}
