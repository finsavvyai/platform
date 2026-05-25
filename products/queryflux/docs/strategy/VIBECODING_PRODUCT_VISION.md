# QueryFlux Vibecoding Product Vision

## Positioning

QueryFlux is the AI-native database workspace for builders shipping apps with agents.

The product is not just a database GUI. It is the database layer for the vibecoding era: a workspace where developers, founders, and AI agents can understand data, generate backend logic, validate changes, and ship database-backed applications safely.

Short positioning options:

- Cursor for your database layer.
- Talk to your database. Generate your backend. Ship safely.
- The AI database workspace for vibecoders.
- From idea to schema to API.

## Primary Users

QueryFlux should optimize first for builders who move quickly from idea to app:

- Solo founders building with Cursor, Claude, Codex, Windsurf, Bolt, Lovable, Replit, or similar tools.
- Full-stack developers who need to inspect, migrate, and debug app data quickly.
- Small product teams using AI agents in daily development.
- Technical operators who need safe production visibility without a heavy DBA workflow.

DBAs and enterprise data teams remain important, but they are secondary until the builder workflow is excellent.

## Core Promise

QueryFlux lets builders and AI agents work with real databases safely:

1. Understand a database instantly.
2. Ask questions in natural language.
3. Generate SQL, schemas, migrations, seed data, APIs, types, dashboards, and docs.
4. Connect AI agents to database context with scoped permissions.
5. Move from prototype to production without losing safety controls.

## Product Pillars

### 1. Talk To Your Database

Users should be able to ask:

- What tables exist?
- What does this schema mean?
- Why is this query slow?
- Which records look wrong?
- Generate the query for this product question.

Required capabilities:

- Schema-aware chat.
- Natural language to SQL.
- SQL explanation and repair.
- Query optimization suggestions.
- Safe read-only execution.
- Result summaries and charts.

### 2. Generate The Backend

QueryFlux should convert database context into production app building blocks:

- REST endpoints from tables.
- TypeScript types.
- Prisma, Drizzle, SQLAlchemy, or GORM models.
- Migrations.
- Seed data.
- Validation schemas.
- API docs.
- Test fixtures.

This is the bridge from database tool to app-building workspace.

### 3. Ship Safely

Fast AI workflows need guardrails by default:

- Read-only mode by default.
- Destructive-query detection.
- Query diff previews.
- Migration plans before execution.
- Environment awareness: local, staging, production.
- Approval flows for risky changes.
- Rollback suggestions.
- Audit logs for humans and agents.

### 4. Agent-Ready Data Layer

The MCP server is a flagship product surface, not a side integration.

First-class agent tools should include:

- `list_databases`
- `inspect_schema`
- `explain_table`
- `generate_query`
- `run_readonly_query`
- `propose_migration`
- `validate_migration`
- `generate_api`
- `generate_types`
- `check_prod_safety`

Agent access must be scoped by workspace, database, environment, operation type, and risk level.

### 5. Cross-Platform Workspace

Each client has a distinct job:

- Web: SaaS control plane for teams, saved context, AI workflows, generated artifacts, billing, and collaboration.
- Desktop: Secure local/private database bridge with OS credential storage, SSH tunnels, local execution, and native packaging.
- Mobile: Production pulse companion for alerts, approvals, read-only checks, and incident response.
- MCP: Agent interface for Cursor, Claude, Codex, Windsurf, and other AI coding tools.

## MVP Scope

The vibecoding MVP should be narrow and powerful:

1. Connect a PostgreSQL database.
2. Inspect schema and explain tables.
3. Ask natural-language questions.
4. Generate and run safe read-only SQL.
5. Save generated queries.
6. Generate backend code from schema.
7. Connect an AI coding agent through MCP.
8. Log every human and agent action.

Do not make the first mobile app a full SQL IDE. Do not make the first desktop app a full enterprise DBA suite. Win the builder workflow first.

## Platform Product Roles

### Web App

The web app is the AI database control plane.

It should own:

- Workspace onboarding.
- Team and account management.
- Cloud database connections.
- Schema explorer.
- QueryLens chat.
- Saved queries and generated artifacts.
- Agent permissions.
- Billing and plan limits.
- Collaboration and audit logs.

### Desktop App

The desktop app is the secure local execution client.

It should own:

- Local Postgres, MySQL, SQLite, and private network access.
- SSH tunnels.
- Credential storage in OS keychain.
- Local-first query execution.
- Desktop notifications.
- Safe bridge between AI agents and private databases.

Desktop matters because vibecoders often work against local development databases and private project databases that a browser app cannot reach safely.

### Mobile App

The mobile app is the production companion.

It should own:

- Alerts.
- Connection health.
- Slow query notifications.
- Saved read-only queries.
- Approval/rejection for risky changes.
- Lightweight incident checks.

Mobile should be intentionally constrained: fast visibility and control, not full database administration.

### MCP Server

The MCP server is the AI-agent surface.

It should own:

- Agent-safe schema context.
- Read-only query execution.
- Code generation tools.
- Migration proposal and validation.
- Permission checks.
- Audit logging.

## Implementation Sequence

### Milestone 1: Product Backbone

- Define shared API contracts for auth, workspaces, connections, schema, queries, generated artifacts, and audit logs.
- Share TypeScript client types across web, desktop, mobile, and MCP where possible.
- Keep PushCI as the release gate.

### Milestone 2: Web Vibecoding MVP

- Real backend-backed auth.
- Connection management.
- Schema explorer.
- QueryLens natural-language query bar.
- Safe query execution.
- Saved queries.
- Generated backend code panel.

### Milestone 3: MCP Agent Workflow

- Ship scoped MCP tools for schema inspection, read-only queries, SQL generation, and type/API generation.
- Add agent permission profiles.
- Add audit logs for agent calls.

### Milestone 4: Desktop Secure Bridge

- Package Tauri desktop client.
- Add secure credential storage.
- Add local/private database execution path.
- Add SSH tunnel support.
- Reuse the same workbench UI as web where practical.

### Milestone 5: Mobile Production Pulse

- Build mobile companion around alerts, approvals, and read-only checks.
- Add push notifications.
- Keep query execution constrained and read-only by default.

### Milestone 6: Launch Readiness

- Billing.
- Onboarding.
- Templates for common app stacks.
- E2E tests for the golden builder journey.
- Documentation for agent setup.
- Store/package release flow.

## Golden Builder Journey

The product is launch-ready when this journey is smooth:

1. User connects a local or cloud database.
2. QueryFlux explains the schema.
3. User asks for a feature-specific data query in plain English.
4. QueryFlux generates safe SQL and explains it.
5. User runs the query and saves it.
6. QueryFlux generates types, API route, validation schema, and seed/test data.
7. User connects Cursor/Claude/Codex through MCP.
8. Agent can inspect schema and generate code, but cannot mutate production without approval.
9. Mobile receives an alert or approval request for risky production activity.

That is the vibecoding-era product.
