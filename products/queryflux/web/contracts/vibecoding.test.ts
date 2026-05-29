import { describe, expect, it } from 'vitest';
import {
  AgentProfileSchema,
  AuditEventSchema,
  GeneratedArtifactSchema,
  QUERYFLUX_API_ROUTES,
  QueryExecutionRequestSchema,
  QueryIntentSchema,
  SchemaSnapshotSchema,
  WorkspaceSchema,
} from './vibecoding';

describe('vibecoding product contract', () => {
  it('validates a workspace', () => {
    const result = WorkspaceSchema.safeParse({
      id: 'ws_1',
      name: 'Acme Builder Workspace',
      slug: 'acme',
      plan: 'team',
      createdAt: '2026-05-22T00:00:00Z',
      updatedAt: '2026-05-22T00:00:00Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unsafe query execution without an approved mode', () => {
    const result = QueryExecutionRequestSchema.safeParse({
      workspaceId: 'ws_1',
      connectionId: 'conn_1',
      sql: 'DROP TABLE users',
      mode: 'write',
      source: 'mcp',
    });

    expect(result.success).toBe(false);
  });

  it('accepts readonly query execution from every client surface', () => {
    for (const source of ['web', 'desktop', 'mobile', 'mcp']) {
      const result = QueryExecutionRequestSchema.safeParse({
        workspaceId: 'ws_1',
        connectionId: 'conn_1',
        sql: 'SELECT * FROM users LIMIT 10',
        mode: 'readonly',
        source,
      });

      expect(result.success).toBe(true);
    }
  });

  it('models a generated query intent from an agent', () => {
    const result = QueryIntentSchema.safeParse({
      workspaceId: 'ws_1',
      connectionId: 'conn_1',
      question: 'Show users who signed up this week',
      generatedSql: "SELECT * FROM users WHERE created_at >= now() - interval '7 days'",
      explanation: 'Filters users by creation timestamp.',
      risk: 'safe',
      readOnly: true,
      createdBy: {
        type: 'agent',
        id: 'agent_cursor',
      },
    });

    expect(result.success).toBe(true);
  });

  it('requires agent permissions to be explicit', () => {
    const result = AgentProfileSchema.safeParse({
      id: 'agent_1',
      workspaceId: 'ws_1',
      name: 'Cursor local agent',
      provider: 'cursor',
      permissions: ['schema:read', 'query:execute:readonly', 'database:drop'],
      allowedConnectionIds: ['conn_1'],
      allowedEnvironments: ['local', 'development'],
      requiresApprovalFor: ['review', 'dangerous'],
      createdAt: '2026-05-22T00:00:00Z',
      updatedAt: '2026-05-22T00:00:00Z',
    });

    expect(result.success).toBe(false);
  });

  it('validates schema snapshots for agent and UI context', () => {
    const result = SchemaSnapshotSchema.safeParse({
      id: 'schema_1',
      connectionId: 'conn_1',
      environment: 'development',
      capturedAt: '2026-05-22T00:00:00Z',
      tables: [
        {
          name: 'users',
          kind: 'table',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
            { name: 'email', type: 'text', nullable: false },
          ],
          estimatedRows: 42,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('validates generated backend artifacts', () => {
    const result = GeneratedArtifactSchema.safeParse({
      id: 'artifact_1',
      workspaceId: 'ws_1',
      connectionId: 'conn_1',
      type: 'typescript-types',
      title: 'User row type',
      language: 'typescript',
      content: 'export interface UserRow { id: string; email: string }',
      createdAt: '2026-05-22T00:00:00Z',
    });

    expect(result.success).toBe(true);
  });

  it('records audit events for human and agent activity', () => {
    const result = AuditEventSchema.safeParse({
      id: 'audit_1',
      workspaceId: 'ws_1',
      actor: {
        type: 'agent',
        id: 'agent_1',
        label: 'Cursor local agent',
      },
      action: 'agent.tool_called',
      target: {
        type: 'connection',
        id: 'conn_1',
      },
      risk: 'safe',
      metadata: {
        tool: 'inspect_schema',
      },
      createdAt: '2026-05-22T00:00:00Z',
    });

    expect(result.success).toBe(true);
  });

  it('keeps mcp tool calls behind agent auth only', () => {
    expect(QUERYFLUX_API_ROUTES.agents.toolCall.auth).toBe('agent');
    expect(QUERYFLUX_API_ROUTES.agents.toolCall.surfaces).toEqual(['mcp']);
  });

  it('keeps mobile execution constrained to the shared query endpoint', () => {
    expect(QUERYFLUX_API_ROUTES.query.execute.surfaces).toContain('mobile');
    expect(QUERYFLUX_API_ROUTES.query.generate.surfaces).not.toContain('mobile');
    expect(QUERYFLUX_API_ROUTES.artifacts.generate.surfaces).not.toContain('mobile');
  });
});

