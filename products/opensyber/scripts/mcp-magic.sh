#!/usr/bin/env bash
# Launch the 21st.dev Magic MCP server with the API key sourced from .env.
#
# Called by .mcp.json so Claude Code / Cursor / Windsurf / Cline can reach
# Magic without the secret ever being pasted into a committed config file.
# The .env file is gitignored; this wrapper is not.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "mcp-magic: $ENV_FILE not found — add 21ST_DEV_API_KEY=<your-key>" >&2
  exit 1
fi

# Read the value directly with grep/cut. `21ST_DEV_API_KEY` is not a legal
# shell identifier (starts with a digit), so we can't `export` it — but we
# can still parse the .env line and re-export under a legal name.
MAGIC_KEY="$(grep -E '^21ST_DEV_API_KEY=' "$ENV_FILE" | head -n1 | cut -d= -f2- | sed 's/^"//;s/"$//;s/^'"'"'//;s/'"'"'$//')"

if [ -z "$MAGIC_KEY" ]; then
  echo "mcp-magic: 21ST_DEV_API_KEY is empty in $ENV_FILE" >&2
  exit 1
fi

# Magic MCP expects API_KEY in the environment.
export API_KEY="$MAGIC_KEY"

exec npx -y @21st-dev/magic@latest "$@"
