/**
 * Domain Models - Shared Entities for QueryFlux
 *
 * These models represent the core business entities and are used
 * across all layers of the application (UI, services, adapters).
 */

import { DatabaseType } from '../../../types/database';

// Base Entity Interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isActive: boolean;
}

// User Domain Model
export interface User extends BaseEntity {
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  subscriptionTier: SubscriptionTier;
  preferences: UserPreferences;
  lastLoginAt?: Date;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
}

// Connection Domain Model
export interface Connection extends BaseEntity {
  name: string;
  description?: string;
  databaseType: DatabaseType;
  config: DatabaseConfig;
  status: ConnectionStatus;
  ownerId: string;
  projectId?: string;
  tags: string[];
  metadata: ConnectionMetadata;
  securityLevel: SecurityLevel;
  lastConnectedAt?: Date;
  connectionCount: number;
  errorCount: number;
  isFavorite: boolean;
}

// Database Configuration
export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string; // Encrypted at rest
  sslEnabled: boolean;
  sslCert?: string; // Encrypted
  connectionString?: string; // Encrypted
  sshTunnel?: SSHTunnelConfig;
  connectionTimeout: number;
  maxConnections: number;
  idleTimeout: number;
  properties: Record<string, any>;
}

// SSH Tunnel Configuration
export interface SSHTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  privateKey?: string; // Encrypted
  password?: string; // Encrypted
  localPort: number;
}

// Connection Metadata
export interface ConnectionMetadata {
  version: string;
  driverVersion: string;
  serverVersion?: string;
  characterSet: string;
  timezone: string;
  maxAllowedPacket?: number;
  customProperties: Record<string, any>;
}

// Query Domain Model
export interface Query extends BaseEntity {
  name: string;
  description?: string;
  content: string;
  connectionId: string;
  authorId: string;
  type: QueryType;
  parameters: QueryParameter[];
  tags: string[];
  isPublic: boolean;
  isTemplate: boolean;
  executionCount: number;
  avgExecutionTime: number;
  lastExecutedAt?: Date;
  schedule?: QuerySchedule;
  version: number;
  parentId?: string; // For versioned queries
}

// Query Execution Model
export interface QueryExecution extends BaseEntity {
  queryId: string;
  connectionId: string;
  executorId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  affectedRows?: number;
  returnedRows?: number;
  errorMessage?: string;
  stackTrace?: string;
  parameters: any[];
  executionContext: ExecutionContext;
  resourceUsage: ResourceUsage;
}

// Query Parameters
export interface QueryParameter {
  name: string;
  type: ParameterType;
  defaultValue?: any;
  required: boolean;
  description?: string;
  validation?: ParameterValidation;
}

// Query Schedule
export interface QuerySchedule {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  nextRun?: Date;
  lastRun?: Date;
  notificationChannels: NotificationChannel[];
  retryPolicy: RetryPolicy;
}

// Execution Context
export interface ExecutionContext {
  ipAddress: string;
  userAgent: string;
  requestId: string;
  sessionId: string;
  environment: Environment;
  metadata: Record<string, any>;
}

// Resource Usage
export interface ResourceUsage {
  cpuTime: number;
  memoryUsage: number;
  networkIO: number;
  diskIO: number;
  connectionCount: number;
}

// Project Domain Model
export interface Project extends BaseEntity {
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
  settings: ProjectSettings;
  connectionIds: string[];
  queryIds: string[];
  isPublic: boolean;
  color: string;
  icon?: string;
  tags: string[];
}

// Team Domain Model
export interface Team extends BaseEntity {
  name: string;
  description?: string;
  ownerId: string;
  memberIds: TeamMember[];
  projectIds: string[];
  settings: TeamSettings;
  subscription: TeamSubscription;
  isPublic: boolean;
  inviteCode?: string;
}

// Team Member
export interface TeamMember {
  userId: string;
  role: TeamRole;
  permissions: Permission[];
  joinedAt: Date;
  invitedBy: string;
  isActive: boolean;
}

// Event Domain Model
export interface DomainEvent extends BaseEntity {
  aggregateId: string;
  aggregateType: AggregateType;
  eventType: string;
  eventData: any;
  eventId: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  metadata: EventMetadata;
  version: number;
}

// Event Metadata
export interface EventMetadata {
  source: string;
  version: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  tags: Record<string, string>;
}

// API Key Domain Model
export interface ApiKey extends BaseEntity {
  name: string;
  keyHash: string;
  keyPrefix: string;
  userId: string;
  permissions: Permission[];
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  rateLimit: RateLimit;
  isActive: boolean;
  allowedIPs: string[];
}

// Subscription Domain Model
export interface Subscription extends BaseEntity {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: Date;
  usage: SubscriptionUsage;
  billingAddress?: BillingAddress;
  paymentMethod?: PaymentMethod;
  features: SubscriptionFeature[];
}

// Enum Definitions
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
  DEVELOPER = 'developer',
  ANALYST = 'analyst'
}

export enum Permission {
  READ_CONNECTIONS = 'read_connections',
  WRITE_CONNECTIONS = 'write_connections',
  DELETE_CONNECTIONS = 'delete_connections',
  EXECUTE_QUERIES = 'execute_queries',
  MANAGE_QUERIES = 'manage_queries',
  SHARE_QUERIES = 'share_queries',
  MANAGE_TEAMS = 'manage_teams',
  MANAGE_USERS = 'manage_users',
  VIEW_LOGS = 'view_logs',
  MANAGE_BILLING = 'manage_billing',
  ADMIN_PANEL = 'admin_panel'
}

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  TEAM = 'team',
  ENTERPRISE = 'enterprise'
}

export enum ConnectionStatus {
  PENDING = 'pending',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

export enum SecurityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

export enum QueryType {
  SELECT = 'select',
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  DDL = 'ddl',
  DML = 'dml',
  PROCEDURE = 'procedure',
  FUNCTION = 'function'
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  JSON = 'json',
  ARRAY = 'array',
  NULL = 'null'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

export enum AggregateType {
  USER = 'user',
  CONNECTION = 'connection',
  QUERY = 'query',
  PROJECT = 'project',
  TEAM = 'team',
  SUBSCRIPTION = 'subscription'
}

export enum SubscriptionPlan {
  FREE = 'free',
  PRO_MONTHLY = 'pro_monthly',
  PRO_YEARLY = 'pro_yearly',
  TEAM_MONTHLY = 'team_monthly',
  TEAM_YEARLY = 'team_yearly',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  UNPAID = 'unpaid'
}

// Value Objects
export interface UserPreferences {
  theme: string;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  defaultQueryLimit: number;
  autoSaveQueries: boolean;
  enableNotifications: boolean;
  enableVoiceCommands: boolean;
  enableAIAssistance: boolean;
  customSettings: Record<string, any>;
}

export interface ProjectSettings {
  defaultConnectionId?: string;
  querySharing: boolean;
  allowPublicQueries: boolean;
  requireApproval: boolean;
  retentionDays: number;
  customSettings: Record<string, any>;
}

export interface TeamSettings {
  allowPublicProjects: boolean;
  requireApprovalForNewMembers: boolean;
  defaultMemberRole: TeamRole;
  querySharing: boolean;
  customSettings: Record<string, any>;
}

export interface ParameterValidation {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  allowedValues?: any[];
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: BackoffStrategy;
  maxDelay: number;
}

export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential'
}

export interface NotificationChannel {
  type: NotificationType;
  config: any;
  enabled: boolean;
}

export enum NotificationType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  IN_APP = 'in_app'
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface SubscriptionUsage {
  queriesExecuted: number;
  connectionsActive: number;
  storageUsed: number;
  bandwidthUsed: number;
  apiCalls: number;
  teamMembers: number;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentMethod {
  type: PaymentType;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand: string;
  isDefault: boolean;
}

export enum PaymentType {
  CREDIT_CARD = 'credit_card',
  BANK_ACCOUNT = 'bank_account',
  PAYPAL = 'paypal'
}

export interface SubscriptionFeature {
  name: string;
  enabled: boolean;
  limits: Record<string, number>;
}

// Result Types
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: Error;
  message?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedResult<T> extends Result<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  affectedRows?: number;
  warnings?: string[];
  metadata: QueryResultMetadata;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
  autoIncrement?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface QueryResultMetadata {
  database: string;
  schema?: string;
  table?: string;
  queryType: QueryType;
  cacheHit: boolean;
  indexUsed?: string;
  explainPlan?: string;
}

// Error Types
export class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number = 500, metadata?: Record<string, any>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', 400, { field, value });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`, 'NOT_FOUND', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, resource?: string, field?: string) {
    super(message, 'CONFLICT_ERROR', 409, { resource, field });
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends DomainError {
  constructor(message: string, database?: string, query?: string) {
    super(message, 'DATABASE_ERROR', 500, { database, query });
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends DomainError {
  constructor(message: string, service?: string) {
    super(message, 'NETWORK_ERROR', 503, { service });
    this.name = 'NetworkError';
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string = 'Rate limit exceeded', resetTime?: Date) {
    super(message, 'RATE_LIMIT_ERROR', 429, { resetTime });
    this.name = 'RateLimitError';
  }
}

// Export all types and enums
export * from './events';
