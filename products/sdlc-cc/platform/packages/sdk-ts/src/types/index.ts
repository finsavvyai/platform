// Core types for the SDLC.ai JavaScript SDK

export interface SDLCConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  environment?: "development" | "staging" | "production";
  headers?: Record<string, string>;
  interceptors?: {
    request?: Array<(config: RequestConfig) => RequestConfig>;
    response?: Array<(response: unknown) => unknown>;
    error?: Array<(error: unknown) => unknown>;
  };
  /** Enable self-learning cache + outcome tracking (default: false) */
  learning?: boolean | {
    enabled?: boolean;
    maxCacheEntries?: number;
    defaultTTL?: number;
    minCallsForCache?: number;
    minSuccessRate?: number;
  };
}

export interface RequestConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestId?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: "Bearer";
  scope?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
  rememberMe?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
  lastLoginAt?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyCredentials {
  keyId: string;
  keySecret: string;
  expiresAt?: number;
  permissions?: string[];
}

// User Management Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  roles: Role[];
  permissions: string[];
  tenantId: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  roles?: string[];
  tenantId?: string;
  sendInvite?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  roles?: string[];
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
  description?: string;
}

// Tenant Management Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  settings: TenantSettings;
  subscription: TenantSubscription;
  parentId?: string;
  children?: Tenant[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  maxUsers: number;
  allowSelfRegistration: boolean;
  requireMFA: boolean;
  sessionTimeout: number;
  allowedDomains?: string[];
  customSettings?: Record<string, unknown>;
}

export interface TenantSubscription {
  plan: "free" | "starter" | "pro" | "enterprise";
  status: "active" | "inactive" | "cancelled" | "past_due";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  limits: SubscriptionLimits;
}

export interface SubscriptionLimits {
  maxUsers: number;
  maxDocuments: number;
  maxStorage: number; // in bytes
  maxApiCalls: number;
  maxEmbeddings: number;
  features: string[];
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  domain?: string;
  parentId?: string;
  settings?: Partial<TenantSettings>;
  plan?: "free" | "starter" | "pro" | "enterprise";
}

// Document Types
export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  url?: string;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  tenantId: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  embeddingsGeneratedAt?: string;
}

export type DocumentType =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt"
  | "md"
  | "html"
  | "json"
  | "csv"
  | "xml"
  | "image"
  | "audio"
  | "video"
  | "other";

export type DocumentStatus =
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  language?: string;
  pageCount?: number;
  wordCount?: number;
  extractedText?: string;
  thumbnailUrl?: string;
  custom?: Record<string, unknown>;
}

export interface UploadOptions {
  file?: File | Blob;
  name?: string;
  metadata?: Partial<DocumentMetadata>;
  tags?: string[];
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  timeRemaining?: number;
}

// RAG Types
export interface RAGQuery {
  query: string;
  context?: RAGContextOptions;
  filters?: RAGFilters;
  streaming?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface RAGContextOptions {
  maxDocuments?: number;
  maxChunks?: number;
  strategy?: "semantic" | "keyword" | "hybrid" | "diversified";
  relevanceThreshold?: number;
  includeCitations?: boolean;
}

export interface RAGFilters {
  documentIds?: string[];
  documentTypes?: DocumentType[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  metadata?: Record<string, unknown>;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  citations?: Citation[];
  usage: TokenUsage;
  metadata: {
    queryId: string;
    model: string;
    processingTime: number;
    relevanceScore: number;
  };
}

export interface RAGSource {
  documentId: string;
  documentName: string;
  chunkId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface Citation {
  id: string;
  text: string;
  source: {
    documentId: string;
    documentName: string;
    url?: string;
    page?: number;
  };
  style: "apa" | "mla" | "chicago" | "harvard";
}

// Vector Search Types
export interface VectorSearchRequest {
  query: string;
  vector?: number[];
  topK?: number;
  threshold?: number;
  filters?: VectorFilters;
  includeMetadata?: boolean;
  searchType?: "semantic" | "hybrid" | "keyword";
}

export interface VectorFilters {
  documentTypes?: DocumentType[];
  tags?: string[];
  tenantId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  documentId: string;
  documentName: string;
  chunkId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// LLM Gateway Types
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[] | string;
  stream?: boolean;
  tools?: LLMTool[];
}

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface LLMResponse {
  id: string;
  object: "chat.completion" | "chat.completion.chunk";
  created: number;
  model: string;
  choices: LLMChoice[];
  usage?: TokenUsage;
}

export interface LLMChoice {
  index: number;
  message?: LLMMessage;
  delta?: Partial<LLMMessage>;
  finishReason?: "stop" | "length" | "function_call" | "content_filter";
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// Policy Management Types
export interface Policy {
  id: string;
  name: string;
  description: string;
  type: "access" | "data" | "security" | "compliance";
  status: "draft" | "active" | "inactive" | "archived";
  rules: PolicyRule[];
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tenantId: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  condition: string; // Rego expression
  effect: "allow" | "deny";
  priority: number;
  resources: string[];
  actions: string[];
  conditions?: Record<string, unknown>;
}

export interface PolicyTestRequest {
  policyId: string;
  scenarios: PolicyTestScenario[];
}

export interface PolicyTestScenario {
  name: string;
  input: {
    user: string;
    resource: string;
    action: string;
    context?: Record<string, unknown>;
  };
  expected: "allow" | "deny";
}

export interface PolicyTestResult {
  scenario: string;
  actual: "allow" | "deny";
  expected: "allow" | "deny";
  passed: boolean;
  reason?: string;
  duration: number;
}

// Monitoring Types
export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels?: Record<string, string>;
}

export interface HealthCheck {
  status: "healthy" | "unhealthy" | "degraded";
  checks: HealthCheckItem[];
  timestamp: string;
  duration: number;
}

export interface HealthCheckItem {
  name: string;
  status: "pass" | "fail" | "warn";
  duration: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface LogEntry {
  id: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  timestamp: string;
  service: string;
  traceId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: unknown;
  id?: string;
  timestamp: string;
}

export interface WebSocketEventMap {
  connected: () => void;
  disconnected: (code?: number, reason?: string) => void;
  error: (error: Error) => void;
  message: (message: WebSocketMessage) => void;
  notification: (notification: Notification) => void;
  documentProcessed: (document: Document) => void;
  ragQueryUpdate: (update: RAGQueryUpdate) => void;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  data?: unknown;
  readAt?: string;
  createdAt: string;
}

export interface RAGQueryUpdate {
  queryId: string;
  status: "processing" | "completed" | "failed";
  progress?: number;
  result?: RAGResponse;
  error?: string;
}

// Error Types
export interface SDLCError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

// Event Types
export interface EventMap {
  [key: string]: (...args: unknown[]) => void;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
