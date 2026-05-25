
# LunaOS — The Agent Operating System

Inspired by Luna, a one‑eyed rescue cat who sees more clearly than most.

LunaOS is an AI‑native backend-as-a-service for building, orchestrating, and deploying autonomous AI agents and intelligent workflows.  
It includes:

- Agent runtime  
- Workflow engine  
- Plugin system  
- Luna Studio visual builder  
- Integrations  
- Templates  
- Deployment and CLI  

## Architecture
LunaOS consists of:

- **Agent Runtime** (Python-based)
- **Orchestrator** (pipeline executor)
- **Plugin System**
- **API Gateway**
- **Luna Studio** (node-based workflow builder)

## MVP Scope
The MVP includes:

- Python agent execution with lifecycle hooks  
- Workflow builder connected to backend  
- Slack / HTTP / Notion / Postgres plugins  
- Integrations manager  
- CLI  
- 10 workflow templates  

## Development Plan (A→B→C→D)

### A. Agent Runtime
- Build agent manifest loader  
- Implement Agent class (on_message/on_http/on_event/on_cron)  
- Runtime executor  
- Local dev server with hot reload  
- Logging and context  

### B. Workflow Engine
- pipeline.json schema  
- Node executor  
- Trigger manager  
- Run storage  

### C. Plugin System
- plugin.json schema  
- Plugin registry  
- HTTP / Slack / Notion / Email / Postgres plugins  
- Integrations manager  

### D. Luna Studio
- Connect Studio to backend API  
- Import/export pipeline.json  
- Plugin palette  
- Run monitor  
- Template gallery  

## Folder Structure
```
lunaos/
  apps/
    agent-runtime/
    orchestrator/
    api-gateway/
    integrations/
    plugins/
  studio/
```

## Templates
10 templates shipped with MVP:
- Slack summarizer  
- Notion sync  
- Webhook → Agent workflows  
- RAG bot  
- Email tagging  
- More...  

## Brand
LunaOS branding is inspired by Luna:
- One-eyed crescent mark  
- Calico palette  
- Futuristic warm UI  
- Mascot animations  

## Vision
Become the **operating system for autonomous AI agents**.


## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/lunaos-ai/lunaos-studio.git
cd lunaos-studio
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration. See [Environment Setup Guide](docs/ENVIRONMENT_SETUP.md) for details.

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## Configuration

Luna Studio uses environment variables for configuration. Key variables include:

- `VITE_NODE_ENV` - Environment (development/staging/production)
- `VITE_API_URL` - Backend API URL
- `VITE_SENTRY_DSN` - Error tracking (optional)
- `VITE_LOG_LEVEL` - Logging verbosity

For complete configuration documentation, see [Environment Setup Guide](docs/ENVIRONMENT_SETUP.md).

## Documentation

- [Environment Setup Guide](docs/ENVIRONMENT_SETUP.md) - Configuration and environment variables
- [Build Guide](BUILD.md) - Build and deployment instructions

## Security

Luna Studio implements security best practices:

- Content Security Policy (CSP) headers
- Input sanitization for all user inputs
- HTTPS enforcement in production
- Secure environment variable management

For security concerns, please email security@lunaos.ai
