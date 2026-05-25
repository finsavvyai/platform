/**
 * Domain Events - Event-Driven Architecture Implementation
 *
 * Defines all domain events that can be published and subscribed to
 * throughout the QueryFlux application.
 */

import { DomainEvent, AggregateType } from './index';

// User Events
export interface UserRegisteredEvent extends DomainEvent {
  eventType: 'UserRegistered';
  eventData: {
    userId: string;
    email: string;
    name: string;
    registrationSource: string;
    inviteCode?: string;
  };
}

export interface UserLoggedInEvent extends DomainEvent {
  eventType: 'UserLoggedIn';
  eventData: {
    userId: string;
    loginMethod: string;
    ipAddress: string;
    userAgent: string;
    sessionId: string;
  };
}

export interface UserLoggedOutEvent extends DomainEvent {
  eventType: 'UserLoggedOut';
  eventData: {
    userId: string;
    sessionId: string;
    duration: number;
  };
}

export interface UserUpdatedEvent extends DomainEvent {
  eventType: 'UserUpdated';
  eventData: {
    userId: string;
    changes: Record<string, any>;
    updatedBy: string;
  };
}

export interface UserDeletedEvent extends DomainEvent {
  eventType: 'UserDeleted';
  eventData: {
    userId: string;
    deletedBy: string;
    reason: string;
  };
}

export interface PasswordChangedEvent extends DomainEvent {
  eventType: 'PasswordChanged';
  eventData: {
    userId: string;
    changedBy: string;
    ipAddress: string;
  };
}

export interface TwoFactorEnabledEvent extends DomainEvent {
  eventType: 'TwoFactorEnabled';
  eventData: {
    userId: string;
    method: 'totp' | 'sms' | 'email';
    enabledBy: string;
  };
}

// Connection Events
export interface ConnectionCreatedEvent extends DomainEvent {
  eventType: 'ConnectionCreated';
  eventData: {
    connectionId: string;
    name: string;
    databaseType: string;
    userId: string;
    projectId?: string;
    isTestConnection: boolean;
  };
}

export interface ConnectionTestStartedEvent extends DomainEvent {
  eventType: 'ConnectionTestStarted';
  eventData: {
    connectionId: string;
    userId: string;
    testType: 'connectivity' | 'authentication' | 'performance';
  };
}

export interface ConnectionTestCompletedEvent extends DomainEvent {
  eventType: 'ConnectionTestCompleted';
  eventData: {
    connectionId: string;
    userId: string;
    success: boolean;
    latency?: number;
    errorMessage?: string;
    metrics?: ConnectionTestMetrics;
  };
}

export interface ConnectionConnectedEvent extends DomainEvent {
  eventType: 'ConnectionConnected';
  eventData: {
    connectionId: string;
    userId: string;
    connectionMethod: string;
    ipAddress: string;
    sessionDuration?: number;
  };
}

export interface ConnectionDisconnectedEvent extends DomainEvent {
  eventType: 'ConnectionDisconnected';
  eventData: {
    connectionId: string;
    userId: string;
    reason: 'user_initiated' | 'timeout' | 'error' | 'server_initiated';
    sessionDuration: number;
    bytesTransferred: number;
    queriesExecuted: number;
  };
}

export interface ConnectionUpdatedEvent extends DomainEvent {
  eventType: 'ConnectionUpdated';
  eventData: {
    connectionId: string;
    userId: string;
    changes: Record<string, any>;
    updatedBy: string;
  };
}

export interface ConnectionDeletedEvent extends DomainEvent {
  eventType: 'ConnectionDeleted';
  eventData: {
    connectionId: string;
    userId: string;
    deletedBy: string;
    reason: string;
  };
}

export interface ConnectionErrorEvent extends DomainEvent {
  eventType: 'ConnectionError';
  eventData: {
    connectionId: string;
    userId: string;
    errorType: string;
    errorMessage: string;
    errorCode?: string;
    recoverable: boolean;
    retryCount: number;
  };
}

export interface ConnectionPoolCreatedEvent extends DomainEvent {
  eventType: 'ConnectionPoolCreated';
  eventData: {
    connectionId: string;
    poolSize: number;
    maxConnections: number;
    timeoutSettings: any;
  };
}

export interface ConnectionPoolMetricsEvent extends DomainEvent {
  eventType: 'ConnectionPoolMetrics';
  eventData: {
    connectionId: string;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalRequests: number;
    averageWaitTime: number;
  };
}

// Query Events
export interface QueryCreatedEvent extends DomainEvent {
  eventType: 'QueryCreated';
  eventData: {
    queryId: string;
    name: string;
    connectionId: string;
    userId: string;
    projectId?: string;
    isTemplate: boolean;
    isPublic: boolean;
  };
}

export interface QueryExecutionStartedEvent extends DomainEvent {
  eventType: 'QueryExecutionStarted';
  eventData: {
    queryId: string;
    executionId: string;
    connectionId: string;
    userId: string;
    queryType: string;
    parameters: any[];
    estimatedCost?: number;
  };
}

export interface QueryExecutionCompletedEvent extends DomainEvent {
  eventType: 'QueryExecutionCompleted';
  eventData: {
    queryId: string;
    executionId: string;
    connectionId: string;
    userId: string;
    success: boolean;
    rowCount: number;
    executionTime: number;
    bytesTransferred: number;
    warnings?: string[];
    cacheHit: boolean;
  };
}

export interface QueryExecutionFailedEvent extends DomainEvent {
  eventType: 'QueryExecutionFailed';
  eventData: {
    queryId: string;
    executionId: string;
    connectionId: string;
    userId: string;
    errorType: string;
    errorMessage: string;
    errorCode?: string;
    stackTrace?: string;
    executionTime: number;
    parameters: any[];
  };
}

export interface QueryCancelledEvent extends DomainEvent {
  eventType: 'QueryCancelled';
  eventData: {
    queryId: string;
    executionId: string;
    connectionId: string;
    userId: string;
    reason: 'user_initiated' | 'timeout' | 'admin_cancelled';
    executionTime: number;
  };
}

export interface QueryScheduledEvent extends DomainEvent {
  eventType: 'QueryScheduled';
  eventData: {
    queryId: string;
    userId: string;
    schedule: string;
    timezone: string;
    nextRun: Date;
    notificationChannels: string[];
  };
}

export interface QueryUpdatedEvent extends DomainEvent {
  eventType: 'QueryUpdated';
  eventData: {
    queryId: string;
    userId: string;
    changes: Record<string, any>;
    updatedBy: string;
    version: number;
  };
}

export interface QueryDeletedEvent extends DomainEvent {
  eventType: 'QueryDeleted';
  eventData: {
    queryId: string;
    userId: string;
    deletedBy: string;
    reason: string;
  };
}

export interface QuerySharedEvent extends DomainEvent {
  eventType: 'QueryShared';
  eventData: {
    queryId: string;
    userId: string;
    sharedWith: string[];
    permissionLevel: 'view' | 'edit' | 'execute';
    shareType: 'user' | 'team' | 'public';
  };
}

// Project Events
export interface ProjectCreatedEvent extends DomainEvent {
  eventType: 'ProjectCreated';
  eventData: {
    projectId: string;
    name: string;
    ownerId: string;
    isPublic: boolean;
    color: string;
  };
}

export interface ProjectUpdatedEvent extends DomainEvent {
  eventType: 'ProjectUpdated';
  eventData: {
    projectId: string;
    userId: string;
    changes: Record<string, any>;
    updatedBy: string;
  };
}

export interface ProjectDeletedEvent extends DomainEvent {
  eventType: 'ProjectDeleted';
  eventData: {
    projectId: string;
    userId: string;
    deletedBy: string;
    reason: string;
  };
}

export interface ProjectMemberAddedEvent extends DomainEvent {
  eventType: 'ProjectMemberAdded';
  eventData: {
    projectId: string;
    memberId: string;
    role: string;
    addedBy: string;
    invitedBy?: string;
  };
}

export interface ProjectMemberRemovedEvent extends DomainEvent {
  eventType: 'ProjectMemberRemoved';
  eventData: {
    projectId: string;
    memberId: string;
    removedBy: string;
    reason: string;
  };
}

export interface ProjectMemberRoleChangedEvent extends DomainEvent {
  eventType: 'ProjectMemberRoleChanged';
  eventData: {
    projectId: string;
    memberId: string;
    oldRole: string;
    newRole: string;
    changedBy: string;
  };
}

// Team Events
export interface TeamCreatedEvent extends DomainEvent {
  eventType: 'TeamCreated';
  eventData: {
    teamId: string;
    name: string;
    ownerId: string;
    isPublic: boolean;
  };
}

export interface TeamUpdatedEvent extends DomainEvent {
  eventType: 'TeamUpdated';
  eventData: {
    teamId: string;
    userId: string;
    changes: Record<string, any>;
    updatedBy: string;
  };
}

export interface TeamDeletedEvent extends DomainEvent {
  eventType: 'TeamDeleted';
  eventData: {
    teamId: string;
    userId: string;
    deletedBy: string;
    reason: string;
  };
}

export interface TeamMemberInvitedEvent extends DomainEvent {
  eventType: 'TeamMemberInvited';
  eventData: {
    teamId: string;
    inviterId: string;
    inviteeEmail: string;
    role: string;
    inviteCode: string;
    expiresAt: Date;
  };
}

export interface TeamMemberJoinedEvent extends DomainEvent {
  eventType: 'TeamMemberJoined';
  eventData: {
    teamId: string;
    memberId: string;
    role: string;
    invitedBy: string;
    inviteCode?: string;
  };
}

export interface TeamMemberRemovedEvent extends DomainEvent {
  eventType: 'TeamMemberRemoved';
  eventData: {
    teamId: string;
    memberId: string;
    removedBy: string;
    reason: string;
  };
}

export interface TeamMemberRoleChangedEvent extends DomainEvent {
  eventType: 'TeamMemberRoleChanged';
  eventData: {
    teamId: string;
    memberId: string;
    oldRole: string;
    newRole: string;
    changedBy: string;
  };
}

// Security Events
export interface LoginAttemptEvent extends DomainEvent {
  eventType: 'LoginAttempt';
  eventData: {
    email: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
    userId?: string;
  };
}

export interface SuspiciousActivityEvent extends DomainEvent {
  eventType: 'SuspiciousActivity';
  eventData: {
    userId: string;
    activityType: string;
    description: string;
    ipAddress: string;
    userAgent: string;
    riskScore: number;
    requiresAction: boolean;
  };
}

export interface SecurityAlertEvent extends DomainEvent {
  eventType: 'SecurityAlert';
  eventData: {
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedUsers: string[];
    ipAddress?: string;
    requiresImmediateAction: boolean;
  };
}

export interface AccessDeniedEvent extends DomainEvent {
  eventType: 'AccessDenied';
  eventData: {
    userId?: string;
    resource: string;
    action: string;
    ipAddress: string;
    userAgent: string;
    reason: string;
  };
}

export interface PrivilegeEscalationEvent extends DomainEvent {
  eventType: 'PrivilegeEscalation';
  eventData: {
    userId: string;
    oldRole: string;
    newRole: string;
    grantedBy: string;
    reason: string;
    approvedBy?: string;
  };
}

// Subscription Events
export interface SubscriptionCreatedEvent extends DomainEvent {
  eventType: 'SubscriptionCreated';
  eventData: {
    subscriptionId: string;
    userId: string;
    plan: string;
    status: string;
    trialEndsAt?: Date;
  };
}

export interface SubscriptionUpdatedEvent extends DomainEvent {
  eventType: 'SubscriptionUpdated';
  eventData: {
    subscriptionId: string;
    userId: string;
    oldPlan: string;
    newPlan: string;
    reason: string;
    effectiveAt: Date;
  };
}

export interface SubscriptionCancelledEvent extends DomainEvent {
  eventType: 'SubscriptionCancelled';
  eventData: {
    subscriptionId: string;
    userId: string;
    reason: string;
    cancelledBy: string;
    effectiveAt: Date;
    refundIssued: boolean;
  };
}

export interface PaymentFailedEvent extends DomainEvent {
  eventType: 'PaymentFailed';
  eventData: {
    subscriptionId: string;
    userId: string;
    amount: number;
    currency: string;
    failureReason: string;
    retryAttempt: number;
    nextRetryDate?: Date;
  };
}

export interface PaymentSucceededEvent extends DomainEvent {
  eventType: 'PaymentSucceeded';
  eventData: {
    subscriptionId: string;
    userId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    billingPeriod: string;
  };
}

// System Events
export interface SystemMetricsEvent extends DomainEvent {
  eventType: 'SystemMetrics';
  eventData: {
    timestamp: Date;
    metrics: {
      activeUsers: number;
      activeConnections: number;
      queriesPerSecond: number;
      averageResponseTime: number;
      errorRate: number;
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      networkIO: number;
    };
  };
}

export interface HealthCheckEvent extends DomainEvent {
  eventType: 'HealthCheck';
  eventData: {
    service: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime: number;
    lastCheck: Date;
    details?: any;
  };
}

export interface ErrorReportedEvent extends DomainEvent {
  eventType: 'ErrorReported';
  eventData: {
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    userId?: string;
    requestId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    context?: any;
  };
}

export interface PerformanceAlertEvent extends DomainEvent {
  eventType: 'PerformanceAlert';
  eventData: {
    metric: string;
    threshold: number;
    currentValue: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    service: string;
    description: string;
  };
}

export interface BackupCompletedEvent extends DomainEvent {
  eventType: 'BackupCompleted';
  eventData: {
    backupId: string;
    type: 'full' | 'incremental';
    size: number;
    duration: number;
    status: 'success' | 'failed' | 'partial';
    location: string;
    encrypted: boolean;
  };
}

export interface DataExportRequestedEvent extends DomainEvent {
  eventType: 'DataExportRequested';
  eventData: {
    userId: string;
    exportType: string;
    format: string;
    filters: any;
    requestedAt: Date;
    expiresAt: Date;
  };
}

export interface DataExportCompletedEvent extends DomainEvent {
  eventType: 'DataExportCompleted';
  eventData: {
    exportId: string;
    userId: string;
    status: 'success' | 'failed';
    fileUrl?: string;
    size?: number;
    recordCount?: number;
    completedAt: Date;
  };
}

// Integration Events
export interface WebhookTriggeredEvent extends DomainEvent {
  eventType: 'WebhookTriggered';
  eventData: {
    webhookId: string;
    url: string;
    event: string;
    payload: any;
    responseStatus: number;
    responseTime: number;
    success: boolean;
    retryCount: number;
  };
}

export interface ThirdPartyIntegrationEvent extends DomainEvent {
  eventType: 'ThirdPartyIntegration';
  eventData: {
    provider: string;
    action: string;
    userId: string;
    success: boolean;
    responseTime: number;
    errorMessage?: string;
    metadata?: any;
  };
}

// Type Guards and Utilities
export function isUserEvent(event: DomainEvent): event is UserRegisteredEvent | UserLoggedInEvent | UserLoggedOutEvent | UserUpdatedEvent | UserDeletedEvent | PasswordChangedEvent | TwoFactorEnabledEvent {
  return event.aggregateType === AggregateType.USER;
}

export function isConnectionEvent(event: DomainEvent): event is ConnectionCreatedEvent | ConnectionTestStartedEvent | ConnectionTestCompletedEvent | ConnectionConnectedEvent | ConnectionDisconnectedEvent | ConnectionUpdatedEvent | ConnectionDeletedEvent | ConnectionErrorEvent | ConnectionPoolCreatedEvent | ConnectionPoolMetricsEvent {
  return event.aggregateType === AggregateType.CONNECTION;
}

export function isQueryEvent(event: DomainEvent): event is QueryCreatedEvent | QueryExecutionStartedEvent | QueryExecutionCompletedEvent | QueryExecutionFailedEvent | QueryCancelledEvent | QueryScheduledEvent | QueryUpdatedEvent | QueryDeletedEvent | QuerySharedEvent {
  return event.aggregateType === AggregateType.QUERY;
}

export function isProjectEvent(event: DomainEvent): event is ProjectCreatedEvent | ProjectUpdatedEvent | ProjectDeletedEvent | ProjectMemberAddedEvent | ProjectMemberRemovedEvent | ProjectMemberRoleChangedEvent {
  return event.aggregateType === AggregateType.PROJECT;
}

export function isTeamEvent(event: DomainEvent): event is TeamCreatedEvent | TeamUpdatedEvent | TeamDeletedEvent | TeamMemberInvitedEvent | TeamMemberJoinedEvent | TeamMemberRemovedEvent | TeamMemberRoleChangedEvent {
  return event.aggregateType === AggregateType.TEAM;
}

export function isSecurityEvent(event: DomainEvent): event is LoginAttemptEvent | SuspiciousActivityEvent | SecurityAlertEvent | AccessDeniedEvent | PrivilegeEscalationEvent {
  return event.eventType.includes('Login') ||
         event.eventType.includes('Suspicious') ||
         event.eventType.includes('Security') ||
         event.eventType.includes('Access') ||
         event.eventType.includes('Privilege');
}

export function isPerformanceEvent(event: DomainEvent): event is SystemMetricsEvent | HealthCheckEvent | PerformanceAlertEvent {
  return event.eventType.includes('Metrics') ||
         event.eventType.includes('Health') ||
         event.eventType.includes('Performance');
}

// Helper Interfaces
export interface ConnectionTestMetrics {
  connectionTime: number;
  authenticationTime: number;
  queryTime: number;
  totalLatency: number;
  bytesReceived: number;
  bytesSent: number;
}

export interface EventFilter {
  aggregateTypes?: AggregateType[];
  eventTypes?: string[];
  userId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: Record<string, string>;
}

export interface EventSubscription {
  id: string;
  filter: EventFilter;
  handler: EventHandler;
  active: boolean;
  createdAt: Date;
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

// Event Store Interface
export interface EventStore {
  save(event: DomainEvent): Promise<void>;
  saveBatch(events: DomainEvent[]): Promise<void>;
  findById(eventId: string): Promise<DomainEvent | null>;
  findByAggregateId(aggregateId: string, options?: EventFilter): Promise<DomainEvent[]>;
  findByFilter(filter: EventFilter, options?: { limit?: number; offset?: number }): Promise<DomainEvent[]>;
  subscribe(filter: EventFilter, handler: EventHandler): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  getEventStats(filter?: EventFilter): Promise<EventStats>;
}

export interface EventStats {
  totalEvents: number;
  eventTypes: Record<string, number>;
  aggregateTypes: Record<string, number>;
  timeRange: {
    earliest: Date;
    latest: Date;
  };
  errors: number;
  warnings: number;
}

// Export all event types
export {
  UserRegisteredEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  PasswordChangedEvent,
  TwoFactorEnabledEvent,
  ConnectionCreatedEvent,
  ConnectionTestStartedEvent,
  ConnectionTestCompletedEvent,
  ConnectionConnectedEvent,
  ConnectionDisconnectedEvent,
  ConnectionUpdatedEvent,
  ConnectionDeletedEvent,
  ConnectionErrorEvent,
  ConnectionPoolCreatedEvent,
  ConnectionPoolMetricsEvent,
  QueryCreatedEvent,
  QueryExecutionStartedEvent,
  QueryExecutionCompletedEvent,
  QueryExecutionFailedEvent,
  QueryCancelledEvent,
  QueryScheduledEvent,
  QueryUpdatedEvent,
  QueryDeletedEvent,
  QuerySharedEvent,
  ProjectCreatedEvent,
  ProjectUpdatedEvent,
  ProjectDeletedEvent,
  ProjectMemberAddedEvent,
  ProjectMemberRemovedEvent,
  ProjectMemberRoleChangedEvent,
  TeamCreatedEvent,
  TeamUpdatedEvent,
  TeamDeletedEvent,
  TeamMemberInvitedEvent,
  TeamMemberJoinedEvent,
  TeamMemberRemovedEvent,
  TeamMemberRoleChangedEvent,
  LoginAttemptEvent,
  SuspiciousActivityEvent,
  SecurityAlertEvent,
  AccessDeniedEvent,
  PrivilegeEscalationEvent,
  SubscriptionCreatedEvent,
  SubscriptionUpdatedEvent,
  SubscriptionCancelledEvent,
  PaymentFailedEvent,
  PaymentSucceededEvent,
  SystemMetricsEvent,
  HealthCheckEvent,
  ErrorReportedEvent,
  PerformanceAlertEvent,
  BackupCompletedEvent,
  DataExportRequestedEvent,
  DataExportCompletedEvent,
  WebhookTriggeredEvent,
  ThirdPartyIntegrationEvent,
};
