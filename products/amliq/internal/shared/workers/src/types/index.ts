/**
 * Unified FinTech Suite - Core Type Definitions
 * Revolutionary AI-powered financial technology platform
 */

export interface Env {
  // AI and Machine Learning
  AI: any;
  AI_MODEL: string;
  EMBEDDING_MODEL: string;

  // D1 Databases
  DB_BILLING_US: D1Database;
  DB_BILLING_EU: D1Database;
  DB_COMPLIANCE_US: D1Database;
  DB_COMPLIANCE_EU: D1Database;
  DB_INTELLIGENCE_US: D1Database;
  DB_RISK_US: D1Database;

  // KV Storage
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  AGENT_MEMORY: KVNamespace;
  RATE_LIMITS: KVNamespace;

  // R2 Storage
  DOCUMENTS: R2Bucket;
  EVIDENCE: R2Bucket;
  TEMPLATES: R2Bucket;

  // Vectorize
  RAG_EMBEDDINGS: VectorizeIndex;
  DOCUMENT_EMBEDDINGS: VectorizeIndex;

  // Durable Objects
  AGENT_ORCHESTRATOR: DurableObjectNamespace;
  BILLING_AGENT: DurableObjectNamespace;
  COMPLIANCE_AGENT: DurableObjectNamespace;
  INTELLIGENCE_AGENT: DurableObjectNamespace;
  RISK_AGENT: DurableObjectNamespace;

  // Queues
  AI_PROCESSING_QUEUE: Queue<any>;
  COMPLIANCE_QUEUE: Queue<any>;
  RISK_ANALYSIS_QUEUE: Queue<any>;
  BILLING_QUEUE: Queue<any>;

  // Environment
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

// Core User and Organization Types
export interface User {
  id: string;
  email: string;
  organization_id: string;
  role: UserRole;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
  last_login: string;
  is_active: boolean;
}

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  region: "US" | "EU";
  subscription_tier: "free" | "starter" | "professional" | "enterprise";
  settings: OrganizationSettings;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  ai_features_enabled: boolean;
  autonomous_agents_enabled: boolean;
  data_retention_days: number;
  custom_compliance_rules: boolean;
  advanced_analytics: boolean;
  multi_region: boolean;
}

export type UserRole =
  | "admin"
  | "finance"
  | "compliance"
  | "auditor"
  | "viewer";
export type Permission =
  | "billing.read"
  | "billing.write"
  | "billing.delete"
  | "compliance.read"
  | "compliance.write"
  | "compliance.delete"
  | "intelligence.read"
  | "intelligence.write"
  | "risk.read"
  | "risk.write"
  | "risk.delete"
  | "users.read"
  | "users.write"
  | "organization.read"
  | "organization.write";

// AI and Agent Types
export interface AgentMessage {
  id: string;
  agent_id: string;
  user_id: string;
  organization_id: string;
  type: "command" | "query" | "response" | "notification";
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
  parent_id?: string;
}

export interface AgentState {
  id: string;
  agent_type: AgentType;
  user_id: string;
  organization_id: string;
  status: "idle" | "processing" | "waiting" | "error";
  current_task?: AgentTask;
  memory: AgentMemory;
  capabilities: AgentCapability[];
  created_at: string;
  updated_at: string;
}

export type AgentType =
  | "billing"
  | "compliance"
  | "intelligence"
  | "risk"
  | "orchestrator";

export interface AgentTask {
  id: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  input: any;
  output?: any;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
}

export interface AgentMemory {
  short_term: Record<string, any>;
  long_term: Record<string, any>;
  context: AgentContext;
  learning: AgentLearning;
}

export interface AgentContext {
  current_session: string;
  user_preferences: Record<string, any>;
  organization_context: Record<string, any>;
  recent_interactions: AgentMessage[];
  active_workflows: string[];
}

export interface AgentLearning {
  patterns: Record<string, number>;
  user_feedback: AgentFeedback[];
  performance_metrics: AgentMetrics;
  adaptation_rules: AdaptationRule[];
}

export interface AgentFeedback {
  id: string;
  task_id: string;
  rating: number; // 1-5
  comment?: string;
  timestamp: string;
  user_id: string;
}

export interface AgentMetrics {
  tasks_completed: number;
  success_rate: number;
  average_completion_time: number;
  user_satisfaction_score: number;
  error_rate: number;
  learning_progress: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  enabled: boolean;
  configuration: Record<string, any>;
  permissions: Permission[];
}

export interface AdaptationRule {
  id: string;
  condition: string;
  action: string;
  confidence: number;
  usage_count: number;
  last_applied: string;
}

// Product-Specific Types

// Billing Types
export interface Invoice {
  id: string;
  organization_id: string;
  customer_id: string;
  number: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  currency: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  due_date: string;
  items: InvoiceItem[];
  metadata: InvoiceMetadata;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
  product_id?: string;
  category: string;
}

export interface InvoiceMetadata {
  purchase_order?: string;
  contract_id?: string;
  project_id?: string;
  department?: string;
  cost_center?: string;
  ai_generated_notes?: string;
  auto_categorization?: string;
}

// Compliance Types
export interface KYCRequest {
  id: string;
  organization_id: string;
  customer_id: string;
  type: "individual" | "business";
  status:
    | "pending"
    | "in_review"
    | "approved"
    | "rejected"
    | "requires_more_info";
  risk_level: "low" | "medium" | "high" | "critical";
  documents: KYCDocument[];
  screenings: ScreeningResult[];
  created_at: string;
  updated_at: string;
}

export interface KYCDocument {
  id: string;
  type:
    | "passport"
    | "id_card"
    | "driving_license"
    | "proof_of_address"
    | "business_document";
  status: "pending" | "verified" | "rejected";
  url: string;
  checksum: string;
  extracted_data: Record<string, any>;
  ai_analysis: DocumentAnalysis;
  uploaded_at: string;
}

export interface DocumentAnalysis {
  confidence_score: number;
  extracted_fields: Record<string, any>;
  anomalies: string[];
  recommendations: string[];
  processing_time: number;
}

export interface ScreeningResult {
  id: string;
  type: "sanctions" | "pep" | "adverse_media";
  provider: "complyadvantage" | "opensanctions" | "internal";
  status: "clear" | "potential_match" | "confirmed_match";
  risk_score: number;
  matches: ScreeningMatch[];
  created_at: string;
}

export interface ScreeningMatch {
  id: string;
  name: string;
  match_score: number;
  source: string;
  reason: string;
  details: Record<string, any>;
}

// Intelligence Types
export interface Transaction {
  id: string;
  organization_id: string;
  account_id: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  subcategory?: string;
  date: string;
  type: "income" | "expense" | "transfer";
  counterparty: string;
  ai_categorization: AICategorization;
  created_at: string;
}

export interface AICategorization {
  primary_category: string;
  confidence: number;
  alternative_categories: Array<{
    category: string;
    confidence: number;
  }>;
  reasoning: string;
  learning_feedback: boolean;
}

export interface FinancialMetrics {
  organization_id: string;
  period: string;
  cash_position: number;
  monthly_recurring_revenue: number;
  churn_rate: number;
  days_sales_outstanding: number;
  burn_rate: number;
  runway_days: number;
  expense_categories: ExpenseCategory[];
  revenue_streams: RevenueStream[];
  forecasts: FinancialForecast[];
}

export interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
  trend: "increasing" | "decreasing" | "stable";
  ai_insights: string[];
}

export interface RevenueStream {
  name: string;
  amount: number;
  growth_rate: number;
  customer_count: number;
  churn_rate: number;
}

export interface FinancialForecast {
  metric: string;
  current_value: number;
  predicted_value: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  time_horizon: string;
  accuracy_score: number;
}

// Risk Types
export interface RiskEvent {
  id: string;
  organization_id: string;
  transaction_id?: string;
  user_id?: string;
  type: "transaction" | "user_behavior" | "pattern_anomaly" | "external_threat";
  severity: "low" | "medium" | "high" | "critical";
  risk_score: number;
  features: RiskFeatures;
  decision: RiskDecision;
  created_at: string;
}

export interface RiskFeatures {
  velocity_metrics: VelocityMetrics;
  behavioral_patterns: BehavioralPattern[];
  network_analysis: NetworkFeatures;
  historical_context: HistoricalFeatures;
}

export interface VelocityMetrics {
  amount_velocity_1h: number;
  amount_velocity_24h: number;
  count_velocity_1h: number;
  count_velocity_24h: number;
  device_velocity_1h: number;
  ip_velocity_1h: number;
}

export interface BehavioralPattern {
  pattern_id: string;
  description: string;
  deviation_score: number;
  baseline: number;
  current: number;
  significance: "low" | "medium" | "high";
}

export interface NetworkFeatures {
  connection_count: number;
  suspicious_connections: number;
  graph_anomaly_score: number;
  social_clustering: number;
}

export interface HistoricalFeatures {
  user_history_length: number;
  historical_risk_score: number;
  past_incidents: number;
  trust_score: number;
}

export interface RiskDecision {
  action: "approve" | "decline" | "manual_review" | "enhanced_monitoring";
  reason: string;
  confidence: number;
  reviewer_id?: string;
  reviewed_at?: string;
}

// RAG and Knowledge Base Types
export interface KnowledgeEntry {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  type: "regulation" | "policy" | "procedure" | "faq" | "best_practice";
  category: string;
  tags: string[];
  embedding: number[];
  metadata: KnowledgeMetadata;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeMetadata {
  source: string;
  author?: string;
  last_reviewed?: string;
  review_frequency_days: number;
  confidence_score: number;
  relevance_score: number;
  usage_count: number;
}

export interface RAGQuery {
  query: string;
  organization_id: string;
  context?: string;
  max_results: number;
  similarity_threshold: number;
  filters?: Record<string, any>;
}

export interface RAGResult {
  entry: KnowledgeEntry;
  similarity_score: number;
  relevance_explanation: string;
  highlighted_content: string[];
}

// API Request/Response Types
export interface APIRequest<T = any> {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: T;
  query: Record<string, string>;
  user?: User;
  organization?: Organization;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: ResponseMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  request_id: string;
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
  duration_ms: number;
  version: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// Subdomain and Product Context
export interface ProductContext {
  subdomain: "billing" | "compliance" | "intelligence" | "risk" | "api" | "www";
  product: ProductType;
  region: "US" | "EU";
  organization_id?: string;
  user_id?: string;
  permissions: Permission[];
  features: ProductFeature[];
}

export type ProductType =
  | "smart-billing"
  | "enterprise-compliance"
  | "financial-intelligence"
  | "risk-investigator";

export interface ProductFeature {
  name: string;
  enabled: boolean;
  configuration: Record<string, any>;
  permissions: Permission[];
}

// Event and Queue Types
export interface PlatformEvent {
  id: string;
  type: string;
  source: string;
  data: any;
  user_id?: string;
  organization_id?: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface QueueMessage<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  max_attempts: number;
  created_at: string;
  scheduled_at?: string;
}

// Analytics and Monitoring Types
export interface PerformanceMetrics {
  request_count: number;
  error_count: number;
  average_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  throughput: number;
  cpu_usage: number;
  memory_usage: number;
}

export interface AIAnalytics {
  model_inference_count: number;
  average_confidence: number;
  user_satisfaction_score: number;
  task_completion_rate: number;
  learning_progress: number;
  error_recovery_rate: number;
}

// Subscription Management Types
export interface Subscription {
  id: string;
  organization_id: string;
  customer_id: string;
  plan_id: string;
  status:
    | "trialing"
    | "active"
    | "paused"
    | "canceled"
    | "incomplete"
    | "past_due"
    | "unpaid";
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  quantity: number;
  billing_cycle: "monthly" | "yearly" | "quarterly";
  amount: number;
  currency: string;
  cancel_at_period_end: boolean;
  paused_at?: string;
  resume_at?: string;
  canceled_at?: string;
  ended_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly" | "quarterly";
  features: string[];
  metadata: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionEvent {
  id: string;
  subscription_id: string;
  type:
    | "created"
    | "updated"
    | "canceled"
    | "renewed"
    | "payment_succeeded"
    | "payment_failed"
    | "trial_started"
    | "trial_ended";
  data?: Record<string, any>;
  created_at: string;
}

export interface SubscriptionMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  active_subscriptions: number;
  churn_rate: number;
  ltv: number; // Lifetime Value
  trial_conversions: number;
  cancellations: number;
  upgrades: number;
  downgrades: number;
}

export interface SubscriptionProration {
  amount: number;
  credit: number;
  description: string;
  period_start: string;
  period_end: string;
}
