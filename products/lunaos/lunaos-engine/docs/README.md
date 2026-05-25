# Luna OS - Documentation

The operating system for your AI workforce. Full-stack AI agent development platform with 3D visual workflow builder, web dashboard, mobile companion, CLI, and comprehensive documentation.

## Product Overview

Luna OS enables teams to:
- Design complex AI workflows visually with 3D builder
- Deploy and manage 28+ pre-built agents
- Monitor execution in real-time via web dashboard
- Manage workflows on-the-go with mobile companion
- Automate via powerful CLI with 28 agent commands
- Scale from prototype to enterprise deployment

## Multi-Repo Architecture

Luna OS spans 8 repositories:

### 1. **Engine** (`packages/engine`)
Core orchestration engine. Manages agent lifecycle, workflow execution, message passing, and state management. Built with Hono and deployed to Cloudflare Workers.

- API: REST + WebSocket on Cloudflare Workers
- Orchestration: LangGraph-based state machine
- Database: Prisma + D1 (SQLite via Cloudflare)
- Cache: Durable Objects for session state

### 2. **Studio** (`packages/studio`)
3D visual workflow builder. React 18 + Three.js for real-time 3D rendering. Drag-and-drop node creation, connection management, and execution flow visualization.

- Framework: React 18 + Vite
- 3D: Three.js with Fiber
- UI: Apple HIG compliant design
- Export: JSON workflow definitions

### 3. **Dashboard** (`packages/dashboard`)
Web dashboard for real-time monitoring. Next.js 14 with TypeScript. View active agents, workflow history, analytics, settings, and team management.

- Framework: Next.js 14 + App Router
- State: TanStack Query + Zustand
- UI: Radix UI + Tailwind CSS
- Real-time: WebSocket subscriptions

### 4. **Mobile** (`packages/mobile`)
Native iOS/Android companion app. Expo + React Native for cross-platform support. Monitor workflows, trigger executions, manage agents.

- Framework: Expo (React Native)
- Platform: iOS 14+ / Android 8+
- Push: Expo Notifications
- Storage: AsyncStorage + Realm

### 5. **CLI** (`packages/cli`)
Command-line interface with 28 agent commands. Node.js + TypeScript. Full workflow orchestration from terminal.

- Commands: 28 agent/workflow management commands
- Config: JSON-based with env overrides
- Deployment: Local and cloud (Cloudflare)
- REPL: Interactive mode with history

### 6. **Agents** (`packages/agents`)
28 pre-built agent implementations. Each agent has specific capabilities (code, research, analysis, etc.).

Included agents:
- **Code**: Developer, CodeReviewer, Debugger, Architect
- **Research**: Researcher, Analyst, NewsHunter, ResearchSummarizer
- **Writing**: Writer, Editor, ContentStrategist, Copywriter
- **Analysis**: DataAnalyst, BusinessAnalyst, SentimentAnalyzer, TrendForecaster
- **Automation**: Automation, TaskScheduler, MonitoringAgent, AlertManager
- **Integration**: Slack, GitHub, Linear, Notion integrators
- **Utility**: Logger, Cache, Queue, Storage

### 7. **Infra** (`packages/infra`)
Infrastructure as Code. Terraform + Docker Compose for deployment.

- Cloud: Cloudflare (Workers, D1, KV, R2)
- Database: PostgreSQL (optional self-hosted) or D1
- Cache: Redis or Durable Objects
- Container: Docker Compose for local development

### 8. **Marketing** (`packages/marketing`)
Marketing site and landing page. Next.js with Markdown content.

- Site: landing-page/index.html (premium dark theme)
- Blog: Next.js static generation
- Product Hunt ready

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (optional, for containerized deployment)
- Cloudflare account (for Workers/D1 deployment)

### Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/luna-os.git
cd luna-os
pnpm install

# Setup environment
cp deploy/.env.example .env
# Edit .env with your credentials

# Development
pnpm dev
# Engine: http://localhost:8040
# Dashboard: http://localhost:3000
# Studio: http://localhost:3001

# Production deployment
pnpm build
docker-compose -f deploy/docker-compose.prod.yml up
```

## Key Features

### 3D Visual Workflow Builder
- Drag-and-drop node creation (Agent, Trigger, Condition, Loop, End)
- Real-time 3D positioning (X, Y, Z coordinates)
- Connection management with conditions and data flow
- Auto-layout and collision detection
- Export/import as JSON

### Web Dashboard
- Real-time agent status (Running, Paused, Idle, Terminated)
- Workflow history with detailed execution logs
- Analytics: uptime, success rate, avg response time
- Team management and role-based access
- Dark mode with Apple HIG design

### Mobile Companion
- Monitor active workflows (iOS/Android)
- Trigger executions from mobile
- Push notifications for workflow events
- Settings and preference sync
- Offline capability with local cache

### CLI with 28 Commands

**Agent Commands (8)**
- `agents list` - List all agents
- `agents info` - Show agent details
- `agents spawn` - Spawn new instance
- `agents pause` - Pause execution
- `agents resume` - Resume execution
- `agents stop` - Terminate agent
- `agents logs` - View agent logs
- `agents metrics` - Get performance metrics

**Workflow Commands (8)**
- `workflow create` - Create workflow
- `workflow list` - List workflows
- `workflow show` - Show details
- `workflow add-node` - Add node
- `workflow connect` - Connect nodes
- `workflow validate` - Validate workflow
- `workflow execute` - Execute workflow
- `workflow delete` - Delete workflow

**Configuration Commands (4)**
- `config set` - Set value
- `config get` - Get value
- `config list` - List all
- `config reset` - Reset defaults

**Deployment Commands (4)**
- `deploy cloud` - Deploy to cloud
- `deploy local` - Deploy locally
- `deploy status` - Check status
- `deploy rollback` - Rollback

**Integration Commands (2)**
- `integrations configure` - Configure service
- `integrations list` - List integrations

**Debugging Commands (2)**
- `debug enable` - Enable debug mode
- `debug collect-diagnostics` - Collect logs

### 28 Pre-built Agents

| Category | Agents |
|----------|--------|
| **Code** | Developer, CodeReviewer, Debugger, Architect |
| **Research** | Researcher, Analyst, NewsHunter, Summarizer |
| **Writing** | Writer, Editor, ContentStrategist, Copywriter |
| **Analysis** | DataAnalyst, BusinessAnalyst, SentimentAnalyzer, Forecaster |
| **Automation** | Automation, TaskScheduler, MonitoringAgent, AlertManager |
| **Integration** | Slack, GitHub, Linear, Notion |
| **Utility** | Logger, Cache, Queue, Storage |

## Deployment

### Local Development
```bash
pnpm dev
# All services on localhost
```

### Docker Compose Production
```bash
docker-compose -f deploy/docker-compose.prod.yml up
# Full stack: Engine, Dashboard, DB, Redis, Workers
```

### Cloudflare Workers (Recommended)
```bash
pnpm deploy:workers
# Engine deployed to CF Workers
# Database: D1
# Cache: Durable Objects / KV
# Assets: R2
```

## Testing

All packages maintain 95%+ code coverage:

```bash
pnpm test
pnpm test:coverage
pnpm test:integration
```

## Security

- JWT-based authentication
- CORS configuration per environment
- Secrets via environment variables (no hardcoding)
- Bandit security scanning
- Rate limiting on API endpoints

## API Documentation

See [API.md](./API.md) for complete REST + WebSocket API reference.

## Architecture Details

See [ARCHITECTURE.md](./ARCHITECTURE.md) for in-depth system design, data models, and integration patterns.

## Support

- Documentation: https://docs.luna-os.com
- Issues: GitHub Issues
- Community: Discord
- Email: support@luna-os.com

## License

MIT License. See LICENSE file for details.
