// ─── Connector SDK Types ────────────────────────────────────────────────────

export interface ConnectorDefinition {
  slug: string;
  name: string;
  version: string;
  category: ConnectorCategory;
  auth: ConnectorAuth;
  events: ConnectorEventType[];
  configFields: ConnectorConfigField[];
}

export type ConnectorCategory =
  | 'cloud'
  | 'ide'
  | 'ai-agent'
  | 'devops'
  | 'communication'
  | 'monitoring'
  | 'custom';

export interface ConnectorAuth {
  type: 'api_key' | 'oauth2' | 'webhook' | 'service_account';
  /** OAuth2 authorization URL (only for oauth2 type) */
  authorizationUrl?: string;
  /** OAuth2 token URL (only for oauth2 type) */
  tokenUrl?: string;
  /** OAuth2 scopes (only for oauth2 type) */
  scopes?: string[];
  /** Header name for API key auth (default: X-API-Key) */
  headerName?: string;
}

export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface ConnectorEventType {
  type: string;
  severityMap: Record<string, EventSeverity>;
  description: string;
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
}

// ─── Ingestion Types ────────────────────────────────────────────────────────

export interface IngestEvent {
  source: string;
  eventType: string;
  severity: EventSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface IngestBatchRequest {
  events: IngestEvent[];
}

export interface IngestResponse {
  id: string;
  status: 'accepted' | 'rejected';
  error?: string;
}

export interface IngestBatchResponse {
  accepted: number;
  rejected: number;
  errors: Array<{ index: number; error: string }>;
  results: IngestResponse[];
}

// ─── API Key Types ──────────────────────────────────────────────────────────

export type ApiKeyScope = 'ingest' | 'read' | 'write';

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  rateLimit: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  key: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
}

// ─── Skill Lifecycle & Packaging Types ─────────────────────────────────────

/** Lifecycle hooks invoked during skill installation and activation */
export interface SkillLifecycleHooks {
  /** Called when the skill is first installed on an agent */
  onInstall?: (context: SkillHookContext) => Promise<void>;
  /** Called when the skill is removed from an agent */
  onUninstall?: (context: SkillHookContext) => Promise<void>;
  /** Called when the skill transitions from inactive to active */
  onActivate?: (context: SkillHookContext) => Promise<void>;
  /** Called when the skill is deactivated without removal */
  onDeactivate?: (context: SkillHookContext) => Promise<void>;
}

export interface SkillHookContext {
  agentId: string;
  skillId: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
}

/** Extended manifest for packaged skills distributed via marketplace */
export interface SkillPackageManifest {
  /** Unique skill identifier */
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** Minimum SDK version required to run this skill */
  sdkVersion: string;
  /** SHA-256 checksum of the skill package archive */
  checksum: string;
  /** SPDX license identifier */
  license: string;
  /** Minimum OpenSyber platform version required */
  minPlatformVersion: string;
  /** Skill entry point relative to package root */
  entryPoint: string;
  /** Configuration fields the skill requires */
  configFields: ConnectorConfigField[];
  /** Permissions required by the skill */
  permissions: string[];
  /** Lifecycle hooks this skill implements */
  hooks: (keyof SkillLifecycleHooks)[];
}

/** Event emitted by a skill during execution */
export interface SkillEmitEvent {
  /** Event type identifier (e.g. 'finding', 'metric', 'log') */
  type: string;
  /** Event payload — skill-specific data */
  payload: Record<string, unknown>;
  /** ISO-8601 timestamp of when the event was emitted */
  timestamp: string;
}
