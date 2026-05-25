# Luna OS Architecture

Complete system design, data models, deployment topology, and integration patterns.

## System Overview

Luna OS is a distributed, multi-tier platform for orchestrating AI agents at scale. The system spans 8 repositories with clear separation of concerns.

```
┌─────────────────────────────────────────────┐
│           User Interfaces                   │
│  ┌─────────────┐  ┌─────────────┐ ┌──────┐ │
│  │   Studio    │  │  Dashboard  │ │Mobile│ │
│  │  (React)    │  │  (Next.js)  │ │(RN)  │ │
│  └──────┬──────┘  └──────┬──────┘ └───┬──┘ │
└─────────┼─────────────────┼────────────┼────┘
          │                 │            │
          └─────────────────┼────────────┘
                            │
┌───────────────────────────┼────────────────────┐
│      API Layer (Hono)     │ CLI (Node.js)      │
│  ┌─────────────────────────────────────────┐  │
│  │  REST Endpoints + WebSocket             │  │
│  │  Authentication, Rate Limiting, CORS    │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────┘
                           │
┌──────────────────────────┼──────────────────────┐
│    Orchestration Layer   │                      │
│  ┌─────────────────────┐ │  ┌──────────────────┐│
│  │  LangGraph State    │ │  │  Agent Manager   ││
│  │  Machine            │ │  │  (Spawn/Pause)   ││
│  └─────────────────────┘ │  └──────────────────┘│
│  ┌─────────────────────┐ │  ┌──────────────────┐│
│  │  Workflow Engine    │ │  │  Message Queue   ││
│  │  (Execute/Validate) │ │  │  (Redis)         ││
│  └─────────────────────┘ │  └──────────────────┘│
└──────────────────────────┼──────────────────────┘
                           │
┌──────────────────────────┼──────────────────────┐
│     Data Layer           │                      │
│  ┌──────────────────────────────────────────┐  │
│  │  Prisma ORM                              │  │
│  │  ┌──────────────────┐ ┌────────────────┐ │  │
│  │  │  D1 (SQLite)     │ │  PostgreSQL    │ │  │
│  │  │  Cloudflare      │ │  (optional)    │ │  │
│  │  └──────────────────┘ └────────────────┘ │  │
│  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Core Components

### 1. Engine (`packages/engine`)

**Purpose**: Central orchestration and API gateway

**Tech Stack**:
- Framework: Hono (lightweight, edge-compatible)
- Deployment: Cloudflare Workers
- Database: D1 (SQLite) via Cloudflare or PostgreSQL
- Cache: Durable Objects / Redis
- Message Queue: Durable Objects / Redis

**Key Files**:
```
packages/engine/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── agents.ts (agent CRUD)
│   │   │   ├── workflows.ts (workflow CRUD)
│   │   │   ├── executions.ts (execution control)
│   │   │   └── config.ts (configuration)
│   │   ├── middleware/
│   │   │   ├── auth.ts (JWT verification)
│   │   │   ├── rateLimiter.ts (rate limiting)
│   │   │   └── cors.ts (CORS handling)
│   │   └── main.ts (Hono app)
│   ├── orchestration/
│   │   ├── workflow-engine.ts (LangGraph state machine)
│   │   ├── agent-manager.ts (spawn/lifecycle)
│   │   └── message-broker.ts (inter-agent messaging)
│   ├── models/
│   │   ├── Agent.ts (Prisma schema)
│   │   ├── Workflow.ts
│   │   ├── Execution.ts
│   │   └── Config.ts
│   └── services/
│       ├── auth.ts (JWT)
│       ├── logger.ts (audit/debug logs)
│       └── cache.ts (caching layer)
├── prisma/
│   └── schema.prisma (D1/PostgreSQL schema)
└── tests/
    ├── workflow-builder.test.ts
    ├── agent-orchestration.test.ts
    └── api.integration.test.ts
```

**Workflow Execution Flow**:
1. Request → API endpoint
2. Validation & authentication
3. LangGraph state transition
4. Agent spawning/messaging
5. Execution tracking
6. Result aggregation

### 2. Studio (`packages/studio`)

**Purpose**: 3D visual workflow designer

**Tech Stack**:
- Framework: React 18 + Vite
- 3D Rendering: Three.js + React Three Fiber
- State: Zustand
- UI: Custom + Apple HIG compliance

**Key Features**:
- Drag-and-drop node creation (position with X, Y, Z)
- Connection management with conditions
- Real-time validation
- Export/import as JSON
- Collision detection
- Auto-layout algorithm

**Data Model**:
```typescript
interface WorkflowNode {
  id: string
  type: 'agent' | 'trigger' | 'condition' | 'loop' | 'end'
  name: string
  position: { x: number; y: number; z: number }
  config: Record<string, any>
  metadata: { created: Date; modified: Date }
}

interface Connection {
  id: string
  sourceId: string
  targetId: string
  condition?: string
  delay?: number
  dataMapping?: Record<string, any>
}
```

### 3. Dashboard (`packages/dashboard`)

**Purpose**: Real-time monitoring and control center

**Tech Stack**:
- Framework: Next.js 14 + App Router
- State: TanStack Query (data fetching) + Zustand (UI state)
- UI: Radix UI + Tailwind CSS
- Real-time: WebSocket subscriptions

**Pages**:
- `/dashboard` - Overview & active workflows
- `/agents` - Agent management & monitoring
- `/workflows` - Workflow library & executions
- `/analytics` - Metrics & insights
- `/settings` - Configuration & team management

**Real-time Updates via WebSocket**:
```typescript
// Subscribe to agent status changes
subscribe('agent:agent-1')
// Receive: { type: 'agent:status_changed', data: {...} }

// Subscribe to execution progress
subscribe('execution:exec-123')
// Receive: { type: 'execution:node_completed', data: {...} }
```

### 4. Mobile (`packages/mobile`)

**Purpose**: On-the-go workflow management

**Tech Stack**:
- Framework: Expo (React Native)
- Platform: iOS 14+ / Android 8+
- Storage: Realm + AsyncStorage
- Push: Expo Notifications

**Features**:
- Monitor active workflows (live list)
- Trigger executions (select workflow, confirm)
- View agent status
- Receive push notifications
- Offline capability with local cache

### 5. CLI (`packages/cli`)

**Purpose**: Command-line orchestration with 28 commands

**Tech Stack**:
- Runtime: Node.js 20+
- CLI Framework: Commander.js
- Configuration: Cosmiconfig (JSON + env)
- Output: Chalk + Table formatting

**Commands (28 total)**:
```
Agent (8):
- list, info, spawn, pause, resume, stop, logs, metrics

Workflow (8):
- create, list, show, add-node, connect, validate, execute, delete

Config (4):
- set, get, list, reset

Deployment (4):
- cloud, local, status, rollback

Integrations (2):
- configure, list

Debug (2):
- enable, collect-diagnostics
```

### 6. Agents (`packages/agents`)

**Purpose**: 28 pre-built agent implementations

**Categories (28 total)**:

| Category | Count | Agents |
|----------|-------|--------|
| Code | 4 | Developer, CodeReviewer, Debugger, Architect |
| Research | 4 | Researcher, Analyst, NewsHunter, Summarizer |
| Writing | 4 | Writer, Editor, ContentStrategist, Copywriter |
| Analysis | 4 | DataAnalyst, BusinessAnalyst, SentimentAnalyzer, Forecaster |
| Automation | 4 | Automation, TaskScheduler, MonitoringAgent, AlertManager |
| Integration | 4 | Slack, GitHub, Linear, Notion |
| Utility | 4 | Logger, Cache, Queue, Storage |

**Agent Base Interface**:
```typescript
interface Agent {
  id: string
  name: string
  type: 'worker' | 'trigger' | 'observer'
  capabilities: string[]
  async execute(input: any): Promise<any>
  async initialize(): Promise<void>
  async shutdown(): Promise<void>
}
```

### 7. Infra (`packages/infra`)

**Purpose**: Infrastructure as Code and deployment

**Tech Stack**:
- Containerization: Docker + Docker Compose
- IaC: Terraform (optional for cloud)
- Cloud: Cloudflare (Workers, D1, KV, R2)
- Database: PostgreSQL (self-hosted) or D1

**Deployment Topology**:
```
cloudflare.com
├── Workers (Engine API)
├── D1 (Database)
├── Durable Objects (Cache & Message Queue)
├── KV (Session storage)
└── R2 (Asset storage)

OR

Docker Compose (self-hosted)
├── Engine (Node:20)
├── Dashboard (Node:20)
├── PostgreSQL (postgres:16)
├── Redis (redis:7)
└── Workers Proxy (localhost:8787)
```

### 8. Marketing (`packages/marketing`)

**Purpose**: Landing page and marketing site

**Components**:
- `landing-page/index.html` - Premium marketing page
- Blog (Next.js static generation)
- Documentation site
- Product Hunt launch page

## Data Models

### Agent
```typescript
model Agent {
  id: String @id
  name: String @unique
  type: String // 'worker', 'trigger', 'observer'
  status: String // 'idle', 'running', 'paused', 'terminated'
  config: Json // { timeout, maxRetries, ... }
  pid: Int? // Process ID
  createdAt: DateTime
  updatedAt: DateTime
  messages: Message[]
  executions: Execution[]
}
```

### Workflow
```typescript
model Workflow {
  id: String @id
  name: String @unique
  description: String?
  status: String // 'draft', 'active', 'archived'
  nodes: Json[] // WorkflowNode[]
  connections: Json[] // Connection[]
  executions: Execution[]
  createdAt: DateTime
  updatedAt: DateTime
  ownerId: String
}
```

### Execution
```typescript
model Execution {
  id: String @id
  workflowId: String
  workflow: Workflow
  status: String // 'running', 'completed', 'failed', 'paused'
  nodeExecutions: Json[] // { nodeId, status, output }
  input: Json?
  output: Json?
  startedAt: DateTime
  completedAt: DateTime?
}
```

### Config
```typescript
model Config {
  key: String @id
  value: Json
  updatedAt: DateTime
}
```

## Integration Patterns

### Agent-to-Agent Messaging
```
Agent A → Message Queue → Agent B
├── Serialize input
├── Queue message (with retry policy)
├── Async execution
└── Store result
```

### Workflow Execution
```
1. Validate workflow graph (no cycles, required nodes)
2. Determine execution order (topological sort)
3. For each node:
   a. Fetch agent
   b. Send message
   c. Wait for result (with timeout)
   d. Apply condition (if branching)
   e. Continue to next nodes
4. Aggregate results
5. Store execution record
```

### Real-time Updates
```
WebSocket Client → API → Message Queue → All Subscribed Clients
├── Subscribe to channel
├── Broadcast on state change
├── Deliver via WebSocket
└── Store in audit log
```

## Security Architecture

### Authentication
- JWT tokens (RS256, 7-day expiry)
- Stored in secure httpOnly cookies (browser)
- Refresh token rotation on login

### Authorization
- Role-based access control (RBAC)
- Roles: Admin, Manager, User, Viewer
- Scope: workspace-level

### Data Protection
- Secrets in environment variables (never in code)
- Encrypted database connections
- TLS 1.3 for all network traffic

### Audit Logging
- All API calls logged with user/agent/action
- Execution history retained for 90 days
- Security events (auth failures, config changes)

## Performance Optimization

### Caching
- Agent listings: 5-min TTL
- Workflow definitions: 1-hour TTL
- Execution results: Permanent
- User config: Session cache

### Database Optimization
- Indexes on frequent queries (agentId, workflowId, status)
- Connection pooling (Prisma)
- Pagination on list endpoints

### Message Queue Optimization
- Priority queues (high-priority agents first)
- Message batching (where applicable)
- Dead letter queue for failed messages

### Scaling Strategy
- Horizontal scaling of Worker instances
- Database read replicas (optional)
- Distributed cache across zones
- Agent load balancing

## Deployment Checklist

- [ ] Environment variables configured (.env)
- [ ] Database migrations run (Prisma)
- [ ] JWT secrets generated and stored
- [ ] CORS origins configured per environment
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Backups scheduled (database)
- [ ] SSL certificates configured
- [ ] Health checks enabled
- [ ] Logging aggregation setup

## Future Extensions

- Multi-cloud support (AWS, Azure, GCP)
- Kubernetes orchestration (via Helm charts)
- Advanced scheduling (cron, recurring)
- Custom agent framework (SDK)
- AI-powered workflow suggestions
- Real-time collaboration on workflows
- Workflow versioning and rollback
- Advanced analytics and forecasting
