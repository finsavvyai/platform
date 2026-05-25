#!/usr/bin/env bash
# mcp_handshake.sh — verify the MCP server responds to JSON-RPC initialize.
set -u
set -o pipefail

fails=0
note() { printf "  %s\n" "$*"; }

# macOS ships BSD `timeout` only if coreutils is installed (as gtimeout).
# Fall back to a backgrounded kill.
if command -v timeout >/dev/null 2>&1; then TIMEOUT=timeout
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT=gtimeout
else TIMEOUT=""
fi

req='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"audit","version":"1.0"}}}'
tmp_out="$(mktemp)"
trap "rm -f '$tmp_out'" EXIT

if [ -n "$TIMEOUT" ]; then
  ( printf "%s\n" "$req"; sleep 2 ) | $TIMEOUT 6 "$PUSHCI" mcp >"$tmp_out" 2>&1 || true
else
  # Portable fallback: start pushci, feed one line, give it 3s, then kill.
  ( printf "%s\n" "$req"; sleep 3 ) | "$PUSHCI" mcp >"$tmp_out" 2>&1 &
  pid=$!
  sleep 4
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
fi

resp="$(grep -E '^\{.*jsonrpc' "$tmp_out" | head -1)"

if [ -z "$resp" ]; then
  note "✗ MCP server did not respond to initialize"
  note "  (raw output, first 5 lines):"
  head -5 "$tmp_out" | sed 's/^/    /'
  exit 1
fi
if printf "%s" "$resp" | python3 -c 'import json,sys; r=json.loads(sys.stdin.read()); assert r["id"]==1; assert "result" in r; assert "tools" in r["result"].get("capabilities",{})' 2>/dev/null; then
  note "✓ MCP initialize roundtrip OK, tools capability advertised"
  if printf "%s" "$resp" | grep -qE '"version":"0\.[0-9]+\.[0-9]+"'; then
    note "⚠ MCP serverInfo.version appears hardcoded (0.x) separate from CLI version"
  fi
else
  note "✗ MCP response malformed: $resp"
  fails=$((fails+1))
fi

exit $fails
