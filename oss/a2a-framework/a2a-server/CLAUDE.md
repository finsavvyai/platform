# A2A Server — CLAUDE.md

> **Portfolio Tracker**: `../portfolio-tracker.html` | **Readiness**: 60% | **Category**: BUILD

## Mission
Production-ready JSON-RPC server for agent-to-agent communication with HTTP/WebSocket/SSE transports and extensible task handler system.

## Code Map

```
a2a-server/src/a2a_server/
├── main.py                 # FastAPI app with 3 transports
├── config.py              # Config from YAML/environment
├── agent_card.py          # Agent Card (.well-known/agent.json)
├── models/
│   ├── task.py            # Task, Message, Artifact (Pydantic)
│   ├── event.py           # Event streaming
│   └── agent.py           # Agent metadata
├── handler/
│   ├── base.py            # TaskHandler abstract base
│   ├── manager.py         # Discovery & lifecycle
│   ├── google_adk.py      # Example handler
│   └── streaming.py       # Streaming support
├── transport/
│   ├── http_rpc.py        # HTTP JSON-RPC (POST /rpc)
│   ├── websocket.py       # WebSocket (WS /ws)
│   ├── sse.py             # Server-Sent Events (GET /events)
│   └── stdio.py           # Stdio for CLI (--stdio)
├── state/
│   ├── store.py           # Task state store
│   ├── events.py          # Event replay
│   └── artifacts.py       # Artifact tracking
└── utils/
    ├── logging.py
    ├── validation.py
    └── errors.py          # A2A exceptions
```

## Quick Start

```bash
# Install & run
uv sync
uv run a2a-server --port 8000

# Test
pytest tests/ --cov

# Example handler
uv run a2a-server --log-level debug
curl -X POST http://localhost:8000/rpc -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"create_task","params":{"handler":"pirate_agent"}}'
```

## Development Guidelines

### Standards
- **Max 200 lines per file** — Split if exceeding
- **Type Safety** — All type hints, Pydantic models, no `any`
- **Error Handling** — Custom exceptions, never swallow errors
- **Naming** — Descriptive snake_case: `register_handler`, `execute_task`
- **Config** — No hardcoded values; use `config.py` or agent.yaml

### Code Review
- [ ] No file >200 lines
- [ ] All functions documented with docstrings
- [ ] All type hints present
- [ ] Errors logged with context
- [ ] Pydantic validates all external input

## Testing

```bash
make test                   # All tests with coverage
pytest tests/test_handler_manager.py -v
pytest tests/ -s --log-cli-level=DEBUG
```

## Commands

```bash
# Development
make dev                    # Start with auto-reload
make lint                   # Ruff + mypy
make format                 # Auto-format

# Server
uv run a2a-server --port 8000
uv run a2a-server --list-handlers
uv run a2a-server --stdio             # CLI mode
```

## Status

### Done (✅)
- FastAPI server (HTTP/WS/SSE/stdio)
- Handler manager with auto-discovery
- Pydantic models for A2A Protocol
- Task state store (in-memory)
- Agent Card generation
- Example handlers
- pytest suite
- Docker support

### In Progress 🔄
- Persistent state store (database)
- Handler lifecycle hooks
- Rate limiting
- Auth/authorization (API keys)

### TODO ❌
- gRPC transport
- Message signing
- TLS/mTLS
- Kubernetes integration
- OpenTelemetry
- Production runbook
- Performance benchmarks
- CI/CD pipeline
- PyPI publication
