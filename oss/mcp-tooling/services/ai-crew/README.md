# MCPOverflow AI Crew Service

Multi-agent AI orchestration service for autonomous MCP connector generation.

## Overview

This Python microservice uses **CrewAI** and **LangGraph** to orchestrate multiple AI agents that work together to:

1. **Analyze** API specifications
2. **Generate** production-ready MCP connector code
3. **Create** comprehensive test suites
4. **Validate** quality and security
5. **Self-heal** when tests fail

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Crew Service                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FastAPI Server (port 8090)                                 │
│  ├── POST /api/crew/generate-connector                      │
│  ├── POST /api/crew/validate-and-heal                       │
│  └── GET  /api/crew/jobs/{id}                               │
│                                                              │
│  CrewAI Agents                                               │
│  ┌──────────────────────┐ ┌──────────────────────┐         │
│  │ 🔍 API Analyst       │ │ ⚙️ Connector Generator│         │
│  └──────────────────────┘ └──────────────────────┘         │
│  ┌──────────────────────┐ ┌──────────────────────┐         │
│  │ 🧪 Test Engineer     │ │ ✅ QA Validator      │         │
│  └──────────────────────┘ └──────────────────────┘         │
│  ┌──────────────────────┐                                   │
│  │ 🔧 Self Healer       │                                   │
│  └──────────────────────┘                                   │
│                                                              │
│  LangGraph Workflow                                          │
│  generate → test → [if failed] → analyze → fix → retry     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.10+
- OpenAI or Anthropic API key

### Installation

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -e .

# Copy environment config
cp .env.example .env
# Edit .env and add your API keys
```

### Running

```bash
# Development mode
AI_CREW_DEV=true python -m src.main

# Production mode
python -m uvicorn src.main:app --host 0.0.0.0 --port 8090
```

### Docker

```bash
# Build
docker build -t mcpoverflow-ai-crew .

# Run
docker run -p 8090:8090 \
  -e OPENAI_API_KEY=sk-... \
  mcpoverflow-ai-crew
```

## API Usage

### Generate Connector

```bash
curl -X POST http://localhost:8090/api/crew/generate-connector \
  -H "Content-Type: application/json" \
  -d '{
    "api_spec": {
      "openapi": "3.0.0",
      "info": {"title": "Example API", "version": "1.0.0"},
      "paths": {
        "/users": {
          "get": {"summary": "List users"}
        }
      }
    },
    "language": "typescript",
    "runtime": "cloudflare",
    "user_id": "user-123"
  }'
```

Response:
```json
{
  "job_id": "abc123",
  "status": "queued",
  "status_url": "/api/crew/jobs/abc123"
}
```

### Poll Job Status

```bash
curl http://localhost:8090/api/crew/jobs/abc123
```

Response:
```json
{
  "id": "abc123",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "connector_code": {...},
    "test_code": {...},
    "validation": {...}
  }
}
```

## Agent Roles

| Agent | Role | Capabilities |
|-------|------|--------------|
| **API Analyst** | Analyze specifications | Auth detection, rate limiting, caching strategy |
| **Connector Generator** | Generate code | TypeScript/Go, full types, error handling |
| **Test Engineer** | Write tests | Unit, integration, edge cases, 90%+ coverage |
| **QA Validator** | Validate quality | Security, performance, MCP compliance |
| **Self Healer** | Fix issues | Error analysis, targeted fixes, max 3 attempts |

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `DEFAULT_LLM` | Default LLM model | `claude-3-sonnet` |
| `AI_CREW_PORT` | Server port | `8090` |
| `MAX_HEAL_ATTEMPTS` | Self-healing max attempts | `3` |

## Integration with Go Backend

The MCPOverflow Go backend calls this service via HTTP:

```go
// services/api-service/internal/crew/client.go
client := crew.NewCrewClient("http://ai-crew:8090")
result, err := client.GenerateConnector(req)
```

## Development

```bash
# Run tests
pytest

# Format code
black src/
ruff src/

# Type check
mypy src/
```

## License

Proprietary - MCPOverflow
