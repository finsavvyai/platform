# A2A Agent Record — CLAUDE.md

> **Portfolio Tracker**: `../portfolio-tracker.html` | **Readiness**: 45% | **Category**: BUILD

## Mission
Framework for defining A2A-compatible agents with automatic task registration, type validation, and decorator-based task handlers.

## Code Map

```
a2a-agent-record/src/a2a_agent_record/
├── agent.py               # Agent definition class
├── task.py                # Task registration decorator
├── types.py               # Type hints & validators
├── models/
│   └── task_model.py      # Task data structure
├── utils/
│   ├── validation.py      # Input/output validation
│   └── schema.py          # JSON schema generation
└── examples/
    ├── hello_agent.py     # Simple example
    └── counter_agent.py   # Stateful example
```

## Quick Start

```bash
from a2a_agent_record import Agent, task

agent = Agent(
    name="MyAgent",
    description="An example A2A agent",
    version="0.1.0"
)

@agent.task
def greet(name: str) -> str:
    """Greet a person by name."""
    return f"Hello, {name}!"

if __name__ == "__main__":
    agent.run()  # Starts A2A server
```

## Development

```bash
make test                   # pytest suite
make lint                   # Ruff + mypy
python -m a2a_agent_record.examples.hello_agent
```

## Status

### Done (✅)
- Agent class with metadata
- @task decorator for registering handlers
- Type hint validation with Pydantic
- Example agents (hello, counter)
- JSON schema generation for tasks

### In Progress 🔄
- Async task support
- Streaming artifacts
- Error recovery
- Task lifecycle hooks

### TODO ❌
- Agent composition (task chaining)
- Tool use / function calling
- Memory/state management
- Integration with Claude/other LLMs
- Plugin system for custom validators
- CLI for generating agent boilerplate
