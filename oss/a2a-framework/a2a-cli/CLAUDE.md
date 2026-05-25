# A2A CLI — CLAUDE.md

> **Portfolio Tracker**: `../portfolio-tracker.html` | **Readiness**: 50% | **Category**: BUILD

## Mission
Command-line client for interacting with A2A servers—list tasks, call handlers, monitor progress, inspect agent metadata.

## Code Map

```
a2a-cli/src/a2a_cli/
├── cli.py                 # Click CLI entry point
├── config.py              # Config management
├── client.py              # A2A protocol client
│   ├── http_client.py     # HTTP JSON-RPC client
│   ├── ws_client.py       # WebSocket client
│   └── sse_client.py      # SSE client
├── commands/              # CLI command modules
│   ├── task.py            # Task management (create, list, cancel)
│   ├── agent.py           # Agent introspection
│   ├── call.py            # Direct RPC call
│   └── watch.py           # Real-time monitoring
└── output/                # Output formatters
    ├── json.py
    ├── table.py
    └── pretty.py
```

## Quick Start

```bash
uv sync
uv run a2a task list
uv run a2a task call pirate_agent --input "hello world"
uv run a2a watch task-id-123
```

## Commands

```bash
# Task management
a2a task list                           # List all tasks
a2a task call handler-name --input foo # Call remote task
a2a task get task-id                   # Get task status
a2a task cancel task-id                # Cancel task
a2a task delete task-id                # Delete task

# Agent introspection
a2a agent info                          # Get agent metadata
a2a agent handlers                      # List available handlers
a2a agent describe handler-name         # Get handler description

# Monitoring
a2a watch task-id                       # Real-time task status
a2a logs task-id                        # View task logs
a2a artifacts task-id                   # List task artifacts

# Configuration
a2a config set server http://localhost:8000
a2a config show
```

## Development

```bash
make dev                    # Start server for testing
make test                   # pytest suite
make lint                   # Ruff + mypy
```

## Status

### Done (✅)
- Click CLI framework
- HTTP JSON-RPC client
- WebSocket client
- Basic commands (task list, call, get)
- Table/JSON output formatting
- Config file support

### In Progress 🔄
- SSE client implementation
- Real-time monitoring (watch)
- Progress bars
- Colored output

### TODO ❌
- gRPC client
- Batch operations (multiple tasks)
- Query/filtering (--filter, --sort)
- Export (CSV, JSON)
- Shell completion (bash/zsh)
- Man page generation
- Interactive REPL mode
