export type ProjectRole =
  | 'admin'
  | 'maintainer'
  | 'release_manager'
  | 'deploy_approver'
  | 'developer'
  | 'viewer'
  | 'auditor';

export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface RunSummary {
  id: string;
  repo: string;
  branch: string;
  sha: string;
  status: RunStatus;
  duration_ms: number | null;
  created_at: string;
  commit_message?: string;
  trigger?: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  duration_ms: number;
}

export interface RunDetail extends RunSummary {
  checks: CheckResult[];
  logs: string;
}

export interface RunRecord {
  id: string;
  repo: string;
  branch: string;
  sha: string;
  status: RunStatus;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  checks_json?: string | null;
  logs?: string;
  commit_message?: string | null;
  trigger?: string | null;
}

export interface Project {
  id: string;
  repo: string;
  platform: 'github' | 'gitlab' | 'bitbucket';
  created_at: string;
  last_run_status?: string;
  webhook_secret: string;
}

export interface ProjectMembership {
  project_id: string;
  user_sub: string;
  login: string;
  provider: 'github' | 'gitlab' | 'google' | 'linkedin' | 'facebook' | 'bitbucket' | 'microsoft';
  role: ProjectRole;
  environments: string[];
  created_at: string;
  updated_at: string;
}

export interface DeploymentPolicy {
  project_id: string;
  environment: string;
  required_review_approvals: number;
  required_manual_approvals: number;
  require_protected_branch: boolean;
  require_separation_of_duties: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectAccess {
  project: Project;
  membership: ProjectMembership;
  policies: DeploymentPolicy[];
}

export interface CloudRunner {
  id: string;
  project_id: string;
  name: string;
  labels: string[];
  os: string;
  arch: string;
  status: 'idle' | 'busy' | 'offline';
  ip: string | null;
  version: string | null;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
}

export interface RunnerRegistrationTokenResponse {
  token: string;
  expiresAt: string;
  project: Pick<Project, 'id' | 'repo' | 'platform'>;
}

export interface CloudPoolStatus {
  total: number;
  idle: number;
  busy: number;
  pending: number;
}

export interface ChannelConnectionSummary {
  id: string;
  channel_type: 'whatsapp' | 'slack' | 'discord' | 'telegram' | 'webhook' | 'email';
  label: string | null;
  status: string;
  external_name: string | null;
  message_count: number;
  last_message_at: string | null;
  connected_at: string | null;
  created_at: string;
}

export interface ConnectChannelInput {
  channelType: string;
  label?: string;
  credentials: Record<string, string>;
  defaultAgent?: string;
}

export interface ConnectChannelResponse {
  id: string;
  channelType: string;
  webhookUrl: string;
  webhookSecret: string;
  status: string;
  nextSteps: string;
}

export interface ChannelMessageRecord {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_id: string | null;
  message_text: string | null;
  response_text: string | null;
  duration_ms: number | null;
  status: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_sub: string;
  actor_login: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details_json: string | null;
  created_at: string;
}

export interface ArtifactRecord {
  name: string;
  size_bytes: number;
  version: string;
  created_at: string;
  project_id: string;
}

export interface GitHubRepoRecord {
  name: string;
  private: boolean;
  language: string | null;
  description: string | null;
  updated_at: string;
  connected: boolean;
}
