# Ultimate Database Manager

A premium, AI-powered database management application with beautiful Apple Glass design and comprehensive multi-database support.

**Single Premium Interface:**
- Beautiful Apple Glass connection dialog with 3D effects
- Multi-database support (PostgreSQL, MySQL, MongoDB, Redis, SQLite, Oracle, SQL Server, and more)
- Premium themes (Toad, Sublime, Sequel Pro, SQLyog, Cursor, Kiro)
- AI-powered query analysis and optimization
- Audio feedback system for operations
- Advanced schema visualization

**Legacy CLI Interface:**
- Command-line interface (`pgdesk`) for terminal users
- Textual TUI for terminal-based management
- Optional LangGraph agent for natural-language SQL (read-only)

## Features

- Database list/create/import/export
- Execute custom SQL and browse tables (GUI)
- Safer dump import via `psql` with confirmation and size guard
- Auto-persist PostgreSQL connection settings
- Optional AI agent: generate safe, read-only SQL via LangGraph
- Run as native GUI, TUI, or Docker

## Quick Start

**Launch the Ultimate Database Manager:**

```bash
./launch_ultimate_db_manager.sh
```

**Or run directly with Python:**

```bash
python launch_glass_db_manager.py
```

**Legacy CLI Installation:**

```bash
pip install .
pgdesk --help
```

## Docker

CLI image:

```
docker build -t pgdesk -f Dockerfile.cli .
docker run --rm -it \
  -e PGHOST=host.docker.internal -e PGUSER=postgres -e PGPASSWORD=postgres \
  pgdesk tui
```

## Dependencies

- Python 3.9+
- Core: `psycopg2-binary`, `requests`
- TUI: `textual` (optional extra: `pip install .[tui]`)
- Agent: `langgraph`, `langchain-openai`, `pydantic` (optional extra: `pip install .[agent]`)

## Configuration

Reads `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`. Also supports legacy `.pg_tool_config`.
Copy `.env.example` to `.env` for local development.
For the agent, set `OPENAI_API_KEY`.

Telemetry (optional, off by default):

```
export PGDESK_TELEMETRY=1
```

Writes JSON lines to `~/.config/pgdesk/logs/events.jsonl` (no data rows, hashes for prompts/SQL).

## Commands

- `pgdesk gui` – Run Tkinter GUI
- `pgdesk tui` – Run Textual TUI
- `pgdesk agent` – Run LangGraph agent (read-only SQL)
  - The GUI also includes an "Agent (Pro)" tab for a point-and-click flow.
- `pgdesk agent schema refresh --db <name>` – Build/update schema cache
- `pgdesk agent schema show --db <name>` – Show cached schema summary
- `pgdesk agent --serve --port 8080` – Local HTTP API

HTTP API (local, Pro):
- POST `/v1/nl2sql` with `{ "db": "postgres", "prompt": "..." }` → `{ sql, result? , error? }`
- GET `/v1/schema?db=postgres` → cached schema JSON (run refresh first)

## Licensing

The Agent is a “Pro” feature and requires a license.

Activate a license (stored under `~/.config/pgdesk/license.key`):

```
pgdesk license activate DEV-<token>
pgdesk license status
```

Supported formats:

- Development: `DEV-...` (all features enabled; for internal/dev use)
- Trial: `TRIAL-YYYYMMDD` (expires on UTC date)
- Signed: `LIC:<base64url-payload>.<base64url-signature>` with `PGDESK_LICENSE_PUBKEY` env and `pynacl` installed.

Run the agent after activation:

```
pgdesk agent
```

For issuing signed licenses and managing keys, see `docs/distribution.md` and the admin tool `scripts/license_issuer.py`.

## Security Notes

- Importing dumps: the TUI uses `psql -f` with a size limit and confirmation. Review dumps before import.
- The agent only attempts read-only SQL generation with `SELECT` and `LIMIT` but always review generated SQL.

## Credits

GUI built with Tkinter; TUI built with Textual.
Optional AI agent powered by LangGraph.
