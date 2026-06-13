#!/usr/bin/env python3
# a2a_cli/chat/commands/help/text.py
"""
Static help text sections rendered by the /help command.
"""

GENERAL_HELP = """
## A2A Client Commands

A2A Client provides several commands that map directly to A2A protocol methods:

- `/send <text>`: Send a task with the given text (tasks/send)
- `/get <id>`: Get task details by ID (tasks/get)
- `/cancel <id>`: Cancel a task (tasks/cancel)
- `/resubscribe <id>`: Subscribe to updates for an existing task (tasks/resubscribe)
- `/send_subscribe <text>`: Send a task and subscribe to its updates (tasks/sendSubscribe)

Use `/help <command>` for detailed help on any specific command.
"""

TASK_COMMANDS_HELP = """
## Task Commands

A2A Client provides commands that map directly to A2A protocol methods:

- `/send <text>`: Send a task with the given text (tasks/send)
  - Example: `/send Hello, please summarize this conversation`

- `/get <id>`: Get task details by ID (tasks/get)
  - Example: `/get 123e4567-e89b-12d3-a456-426614174000`

- `/cancel <id>`: Cancel a running task (tasks/cancel)
  - Example: `/cancel 123e4567-e89b-12d3-a456-426614174000`

- `/resubscribe <id>`: Subscribe to updates for an existing task (tasks/resubscribe)
  - Example: `/resubscribe 123e4567-e89b-12d3-a456-426614174000`
  - Alias: `/watch <id>` (backward compatibility)

- `/send_subscribe <text>`: Send a task and subscribe to its updates (tasks/sendSubscribe)
  - Example: `/send_subscribe Tell me a joke`
  - Aliases: `/sendsubscribe <text>`, `/watch_text <text>` (backward compatibility)
"""

CONNECTION_COMMANDS_HELP = """
## Connection Commands

A2A Client provides commands for managing connections:

- `/connect <url>`: Connect to a specific A2A server
  - Example: `/connect http://localhost:8000/pirate_agent`

- `/server`: Show current server connection information

- `/servers`: List all available preconfigured servers

- `/use <name>`: Switch to a different preconfigured server
  - Example: `/use chef_agent`
"""

DISPLAY_COMMANDS_HELP = """
## Display Commands

A2A Client provides commands for controlling the display:

- `/verbose` or `/v`: Toggle verbose mode (showing full JSON responses)

- `/clear`: Clear the screen

- `/history`: Show command history

- `/debug_info`: Show detailed connection and debugging information

- `/exit` or `/quit`: Exit the client
"""

PROTOCOL_INFO = """
## A2A Protocol Methods

The A2A client commands are designed to align with the A2A protocol's JSON-RPC methods:

| Command | Protocol Method | Description |
|---------|-----------------|-------------|
| `/send` | tasks/send | Send a new task to the agent |
| `/get` | tasks/get | Retrieve a task by ID |
| `/cancel` | tasks/cancel | Cancel a running task |
| `/resubscribe` | tasks/resubscribe | Subscribe to updates for an existing task |
| `/send_subscribe` | tasks/sendSubscribe | Send a task and subscribe to its updates |

This consistent naming makes it easier to understand how the CLI maps to the underlying protocol.
"""
