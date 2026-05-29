import { z } from 'zod';

export const ClientSurfaceSchema = z.enum(['web', 'desktop', 'mobile', 'mcp']);
export type ClientSurface = z.infer<typeof ClientSurfaceSchema>;

export const EnvironmentSchema = z.enum(['local', 'development', 'staging', 'production']);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const OperationRiskSchema = z.enum(['safe', 'review', 'dangerous']);
export type OperationRisk = z.infer<typeof OperationRiskSchema>;

export const AgentPermissionSchema = z.enum([
  'schema:read',
  'query:generate',
  'query:execute:readonly',
  'migration:propose',
  'migration:validate',
  'artifact:generate',
  'safety:check',
]);
export type AgentPermission = z.infer<typeof AgentPermissionSchema>;

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Workspace name is required'),
  slug: z.string().min(1),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceMemberSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'builder', 'viewer']),
  createdAt: z.string(),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

export const DatabaseConnectionRefSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb', 'redis']),
  environment: EnvironmentSchema,
  surface: ClientSurfaceSchema,
  readOnlyDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DatabaseConnectionRef = z.infer<typeof DatabaseConnectionRefSchema>;

export const SchemaColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  nullable: z.boolean(),
  primaryKey: z.boolean().optional(),
  foreignKey: z
    .object({
      table: z.string().min(1),
      column: z.string().min(1),
    })
    .optional(),
  comment: z.string().optional(),
});
export type SchemaColumn = z.infer<typeof SchemaColumnSchema>;

export const SchemaTableSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['table', 'view']),
  columns: z.array(SchemaColumnSchema),
  estimatedRows: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
});
export type SchemaTable = z.infer<typeof SchemaTableSchema>;

export const SchemaSnapshotSchema = z.object({
  id: z.string().min(1),
  connectionId: z.string().min(1),
  environment: EnvironmentSchema,
  tables: z.array(SchemaTableSchema),
  capturedAt: z.string(),
});
export type SchemaSnapshot = z.infer<typeof SchemaSnapshotSchema>;

export const QueryIntentSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string().min(1),
  connectionId: z.string().min(1),
  question: z.string().min(1, 'Question is required'),
  generatedSql: z.string().optional(),
  explanation: z.string().optional(),
  risk: OperationRiskSchema,
  readOnly: z.boolean(),
  createdBy: z.object({
    type: z.enum(['human', 'agent']),
    id: z.string().min(1),
  }),
  createdAt: z.string().optional(),
});
export type QueryIntent = z.infer<typeof QueryIntentSchema>;

export const QueryExecutionModeSchema = z.enum(['readonly', 'approved-write']);
export type QueryExecutionMode = z.infer<typeof QueryExecutionModeSchema>;

export const QueryExecutionRequestSchema = z.object({
  workspaceId: z.string().min(1),
  connectionId: z.string().min(1),
  sql: z.string().min(1, 'SQL is required'),
  mode: QueryExecutionModeSchema,
  source: ClientSurfaceSchema,
  approvalId: z.string().optional(),
});
export type QueryExecutionRequest = z.infer<typeof QueryExecutionRequestSchema>;

export const GeneratedArtifactTypeSchema = z.enum([
  'api-route',
  'typescript-types',
  'validation-schema',
  'migration',
  'seed-data',
  'test-fixture',
  'documentation',
]);
export type GeneratedArtifactType = z.infer<typeof GeneratedArtifactTypeSchema>;

export const GeneratedArtifactSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  connectionId: z.string().min(1),
  type: GeneratedArtifactTypeSchema,
  title: z.string().min(1),
  language: z.string().min(1),
  content: z.string().min(1),
  sourceQueryIntentId: z.string().optional(),
  createdAt: z.string(),
});
export type GeneratedArtifact = z.infer<typeof GeneratedArtifactSchema>;

export const AgentProfileSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(['cursor', 'claude', 'codex', 'windsurf', 'other']),
  permissions: z.array(AgentPermissionSchema),
  allowedConnectionIds: z.array(z.string()),
  allowedEnvironments: z.array(EnvironmentSchema),
  requiresApprovalFor: z.array(OperationRiskSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

export const AuditActionSchema = z.enum([
  'workspace.created',
  'connection.created',
  'schema.inspected',
  'query.generated',
  'query.executed',
  'artifact.generated',
  'migration.proposed',
  'approval.requested',
  'approval.resolved',
  'agent.tool_called',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  actor: z.object({
    type: z.enum(['human', 'agent', 'system']),
    id: z.string().min(1),
    label: z.string().optional(),
  }),
  action: AuditActionSchema,
  target: z.object({
    type: z.string().min(1),
    id: z.string().min(1),
  }),
  risk: OperationRiskSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const ApiRouteSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  auth: z.enum(['required', 'agent', 'optional']),
  surfaces: z.array(ClientSurfaceSchema),
});
export type ApiRoute = z.infer<typeof ApiRouteSchema>;

export const QUERYFLUX_API_ROUTES = {
  workspaces: {
    list: { method: 'GET', path: '/api/v1/workspaces', auth: 'required', surfaces: ['web', 'desktop', 'mobile'] },
    create: { method: 'POST', path: '/api/v1/workspaces', auth: 'required', surfaces: ['web'] },
    members: { method: 'GET', path: '/api/v1/workspaces/:workspaceId/members', auth: 'required', surfaces: ['web'] },
  },
  connections: {
    list: { method: 'GET', path: '/api/v1/workspaces/:workspaceId/connections', auth: 'required', surfaces: ['web', 'desktop', 'mobile'] },
    create: { method: 'POST', path: '/api/v1/workspaces/:workspaceId/connections', auth: 'required', surfaces: ['web', 'desktop'] },
    inspectSchema: { method: 'GET', path: '/api/v1/connections/:connectionId/schema', auth: 'required', surfaces: ['web', 'desktop', 'mcp'] },
  },
  query: {
    generate: { method: 'POST', path: '/api/v1/query/generate', auth: 'required', surfaces: ['web', 'desktop', 'mcp'] },
    execute: { method: 'POST', path: '/api/v1/query/execute', auth: 'required', surfaces: ['web', 'desktop', 'mobile', 'mcp'] },
    save: { method: 'POST', path: '/api/v1/query/saved', auth: 'required', surfaces: ['web', 'desktop'] },
  },
  artifacts: {
    generate: { method: 'POST', path: '/api/v1/artifacts/generate', auth: 'required', surfaces: ['web', 'desktop', 'mcp'] },
    list: { method: 'GET', path: '/api/v1/workspaces/:workspaceId/artifacts', auth: 'required', surfaces: ['web', 'desktop'] },
  },
  agents: {
    listProfiles: { method: 'GET', path: '/api/v1/workspaces/:workspaceId/agents', auth: 'required', surfaces: ['web'] },
    upsertProfile: { method: 'POST', path: '/api/v1/workspaces/:workspaceId/agents', auth: 'required', surfaces: ['web'] },
    toolCall: { method: 'POST', path: '/api/v1/agents/tool-call', auth: 'agent', surfaces: ['mcp'] },
  },
  audit: {
    list: { method: 'GET', path: '/api/v1/workspaces/:workspaceId/audit-events', auth: 'required', surfaces: ['web'] },
  },
} as const satisfies Record<string, Record<string, ApiRoute>>;

export const CONTRACT_SCHEMAS = {
  ClientSurface: ClientSurfaceSchema,
  Environment: EnvironmentSchema,
  OperationRisk: OperationRiskSchema,
  Workspace: WorkspaceSchema,
  WorkspaceMember: WorkspaceMemberSchema,
  DatabaseConnectionRef: DatabaseConnectionRefSchema,
  SchemaSnapshot: SchemaSnapshotSchema,
  QueryIntent: QueryIntentSchema,
  QueryExecutionRequest: QueryExecutionRequestSchema,
  GeneratedArtifact: GeneratedArtifactSchema,
  AgentProfile: AgentProfileSchema,
  AuditEvent: AuditEventSchema,
  ApiRoute: ApiRouteSchema,
};

