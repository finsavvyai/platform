# A2A Framework — CLAUDE.md

> **Portfolio Tracker**: `portfolio-tracker.html` | **Readiness**: 55% | **Category**: BUILD

## Mission
Open-source framework for agent-to-agent (A2A) communication using JSON-RPC, supporting HTTP/WebSocket/SSE/stdio transports with extensible task-based workflow for AI agents.

## Code Map & Index

### Directory Structure (88 source files across 4 projects)
```
a2a/
├── a2a-server/                       # Main A2A server (Python, ~40 files)
│   ├── src/
│   │   ├── a2a_server/
│   │   │   ├── __init__.py
│   │   │   ├── main.py               # FastAPI app entry, HTTP/WS/SSE routing
│   │   │   ├── config.py             # Configuration from YAML/env
│   │   │   ├── agent_card.py         # Agent Card generation (.well-known/agent.json)
│   │   │   ├── models/               # Core data models (5+ files)
│   │   │   │   ├── task.py           # Task, Message, Artifact types
│   │   │   │   ├── event.py          # Event streaming model
│   │   │   │   └── agent.py          # Agent metadata
│   │   │   ├── handler/              # Task handler system (8+ files)
│   │   │   │   ├── base.py           # TaskHandler abstract base
│   │   │   │   ├── manager.py        # Handler discovery & lifecycle
│   │   │   │   ├── google_adk.py     # Google ADK handler implementation
│   │   │   │   └── streaming.py      # Streaming support for handlers
│   │   │   ├── transport/            # Transport protocol impls (4 files)
│   │   │   │   ├── http_rpc.py       # HTTP JSON-RPC endpoint
│   │   │   │   ├── websocket.py      # WebSocket bidirectional
│   │   │   │   ├── sse.py            # Server-Sent Events for real-time
│   │   │   │   └── stdio.py          # Standard I/O for CLI mode
│   │   │   ├── state/                # Task state management (3 files)
│   │   │   │   ├── store.py          # In-memory/persistent task store
│   │   │   │   ├── events.py         # Event replay system
│   │   │   │   └── artifacts.py      # Artifact tracking
│   │   │   ├── utils/                # Helpers (4 files)
│   │   │   │   ├── logging.py
│   │   │   │   ├── validation.py     # Request validation
│   │   │   │   └── errors.py         # A2A exception types
│   │   │   └── sample_agents/        # Example implementations
│   │   │       ├── pirate_agent.py
│   │   │       ├── chef_agent.py
│   │   │       └── echo_agent.py
│   │   └── tests/                    # pytest unit & integration tests
│   ├── examples/                     # Example configs & usage
│   ├── agent.yaml                    # Agent configuration example
│   ├── Makefile                      # Development commands
│   ├── pyproject.toml                # Python package metadata
│   └── README.md
│
├── a2a-cli/                          # Command-line client (Python, ~25 files)
│   ├── src/
│   │   ├── a2a_cli/
│   │   │   ├── __init__.py
│   │   │   ├── cli.py                # Click CLI commands
│   │   │   ├── config.py             # CLI config management
│   │   │   ├── client.py             # A2A client library
│   │   │   │   ├── http_client.py    # HTTP JSON-RPC client
│   │   │   │   ├── ws_client.py      # WebSocket client
│   │   │   │   └── sse_client.py     # SSE client
│   │   │   ├── commands/             # CLI command modules (8+ files)
│   │   │   │   ├── task.py           # Task management commands
│   │   │   │   ├── agent.py          # Agent introspection
│   │   │   │   ├── call.py           # Direct RPC call
│   │   │   │   └── watch.py          # Real-time task monitoring
│   │   │   └── output/               # Output formatters
│   │   │       ├── json.py
│   │   │       ├── table.py
│   │   │       └── pretty.py
│   │   └── tests/
│   ├── pyproject.toml
│   └── README.md
│
├── a2a-agent-record/                 # Agent definition framework (Python, ~23 files)
│   ├── src/
│   │   ├── a2a_agent_record/
│   │   │   ├── __init__.py
│   │   │   ├── agent.py              # Agent definition class
│   │   │   ├── task.py               # Task registration decorator
│   │   │   ├── types.py              # Type hints & validators
│   │   │   ├── models/               # Data models (3 files)
│   │   │   │   ├── task_model.py
│   │   │   ├── utils/                # Helpers (3 files)
│   │   │   │   ├── validation.py
│   │   │   │   └── schema.py
│   │   │   └── examples/             # Example agents
│   │   │       ├── hello_agent.py
│   │   │       └── counter_agent.py
│   │   └── tests/
│   ├── pyproject.toml
│   └── README.md
│
└── docs/                             # Shared documentation
    ├── protocol.md                   # A2A Protocol specification
    ├── quickstart.md                 # Getting started guide
    └── api.md                        # API reference
```

### Key Files Index (Project Relationships)
| File | Project | Purpose | Type |
|------|---------|---------|------|
| `a2a-server/src/a2a_server/main.py` | a2a-server | FastAPI app entry | Server |
| `a2a-server/src/a2a_server/handler/manager.py` | a2a-server | Handler discovery & lifecycle | Core |
| `a2a-server/src/a2a_server/transport/http_rpc.py` | a2a-server | HTTP JSON-RPC endpoint | Transport |
| `a2a-server/src/a2a_server/transport/websocket.py` | a2a-server | WebSocket bidirectional | Transport |
| `a2a-server/src/a2a_server/transport/sse.py` | a2a-server | Server-Sent Events | Transport |
| `a2a-cli/src/a2a_cli/client.py` | a2a-cli | A2A client library | Client |
| `a2a-cli/src/a2a_cli/cli.py` | a2a-cli | Click CLI commands | CLI |
| `a2a-agent-record/src/a2a_agent_record/agent.py` | a2a-agent-record | Agent definition class | Framework |
| `a2a-agent-record/src/a2a_agent_record/task.py` | a2a-agent-record | Task registration decorator | Framework |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per file** — Split into modules if exceeding.
- **Single Responsibility** — Handler manager handles discovery only. Task execution in handlers.
- **Type Safety** — Pydantic models for all types. Type hints on all functions.
- **Error Handling** — Custom exception hierarchy. Never swallow errors.
- **Naming** — Descriptive: `register_handler` not `reg_hdlr`. Python snake_case throughout.
- **No Magic Values** — Config-driven: timeout values, port numbers, handler packages in `pyproject.toml` or YAML.
- **Dependency Injection** — Constructor injection for fastapi dependency system.
- **Pure Functions** — Handler side effects isolated. Protocol messages immutable.

### Code Review Checklist
- [ ] No file exceeds 200 lines
- [ ] All functions have docstrings with `Args`, `Returns`, `Raises`
- [ ] All type hints present (no untyped params)
- [ ] Error handling explicit: custom exception types, not generic Exception
- [ ] No hardcoded values: use Config class or YAML
- [ ] Pydantic models validate all external input
- [ ] Protocol compliance: Task/Message/Artifact structure correct

## Testing Strategy

### Unit Tests — Full Coverage Required
- **Framework**: pytest with fixtures
- **Coverage Target**: 85%+ lines, 80%+ branches
- **Run**: `make test` or `pytest tests/`
- **Pattern**: Each module has `tests/test_module.py` sibling
- **Mocks**: Mock handler implementations, in-memory state store

### Integration Tests
- **Server + transport**: Test HTTP/WS/SSE endpoints with real FastAPI app
- **Handler lifecycle**: Register → call → task state → artifact → cleanup
- **Protocol compliance**: Valid JSON-RPC requests → proper A2A responses
- **Error cases**: Invalid input, handler not found, timeout, network failure

### CLI Testing
- **Command execution**: `a2a task list` → proper output formatting
- **Client connectivity**: Connect to server, call remote task, stream results
- **Error handling**: Handle connection errors, invalid responses

### Browser Tests — Not Applicable
- A2A is agent-to-agent (server-to-server), no user-facing UI
- CLI client is command-line only
- Web dashboard (if built) would need separate E2E tests

## Commands

```bash
# Development (all projects)
make dev                  # Start A2A server (port 8000)
make install              # Install all deps (a2a-server, a2a-cli, a2a-agent-record)
make test                 # Run all tests with coverage
make lint                 # Run linters (ruff, mypy)
make format               # Auto-format code

# A2A Server
cd a2a-server
uv run a2a-server --host 0.0.0.0 --port 8000
uv run a2a-server --list-handlers
pytest tests/

# A2A CLI
cd a2a-cli
uv run a2a task list                      # List tasks
uv run a2a task call task-name --input foo
uv run a2a agent info                     # Get agent metadata
uv run a2a watch task-id                  # Monitor task in real-time

# A2A Agent Record (framework)
cd a2a-agent-record
python -m a2a_agent_record.examples.hello_agent

# Docker
docker-compose up -d     # Start server, Redis, monitoring
docker logs -f a2a-server
```

## What's Done vs What's Left

### Completed (✅)
- A2A server with HTTP JSON-RPC endpoint (`POST /rpc`)
- WebSocket support for bidirectional communication (`/ws`)
- Server-Sent Events (SSE) for real-time updates (`/events`)
- Stdio mode for CLI applications
- Task-based workflow with state transitions
- Event replay system for reconnecting clients
- Artifact tracking and download
- Handler discovery via entry points
- Agent Card generation (`.well-known/agent.json`)
- A2A CLI client with task management commands
- Agent-record framework for defining agents
- Pydantic models for all types
- pytest test suite with fixtures
- FastAPI app with proper error handling
- Docker setup for local development

### In Progress 🔄
- Advanced streaming for long-running tasks
- Handler lifecycle hooks (pre_execute, post_execute, on_error)
- Task queuing & priority system
- Rate limiting per agent/caller
- Authentication & authorization (API keys, OAuth)
- Task history & audit logging
- Handler versioning & compatibility checks
- CLI improvements (progress bars, colored output)

### Not Started ❌
- Web dashboard for agent management & monitoring
- Studio for visual agent composition
- Task scheduling (cron, recurring tasks)
- Multi-agent orchestration patterns (fan-out, fan-in, workflows)
- Plugin system for custom transports
- gRPC transport implementation
- Message signing & verification
- Performance benchmarking & optimization
- Observability: OpenTelemetry integration
- Production deployment docs & runbook
- CI/CD pipeline (GitHub Actions)
- Package publishing to PyPI
- Documentation site (mkdocs)

## Competitors & Market Context

### Market Position
- **Competitors**: OpenAI Swarm, Anthropic Agents API, LangGraph, AutoGen, CrewAI
- **Differentiation**: Transport-agnostic (HTTP/WS/SSE/stdio), lightweight, A2A Protocol standard, extensible handler system
- **Target**: AI agent developers, LLM engineers, enterprise automation teams
- **Use Cases**: Agent orchestration, inter-service communication, task delegation, workflow automation

### Protocol Positioning
- **A2A Protocol**: Open standard for agent-to-agent communication (like HTTP for web)
- **Simplicity**: JSON-RPC, no heavyweight frameworks required
- **Flexibility**: Choose transport (HTTP, WS, SSE, stdio) per use case
- **Extensibility**: Custom task handlers, custom transports via plugins

### Adoption Strategy
- **Early adopters**: AI/ML engineers building multi-agent systems
- **Distribution**: GitHub, PyPI, AI community (Twitter, Discord)
- **Documentation**: Protocol spec + API reference + examples
- **Partnerships**: Integration with Claude Code, other AI platforms

### Financial Model (Long-term)
- **Open source**: Free server/client/framework
- **Commercial**: Hosted managed service, analytics dashboard, premium support
- **Enterprise**: Custom handlers, integration consulting, SLAs

