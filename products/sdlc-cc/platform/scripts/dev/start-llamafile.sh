#!/usr/bin/env bash
# Boot a local llamafile in OpenAI-compatible server mode so dev /
# CI runs of the LLM gateway don't need a live API key.
#
# Usage:
#   scripts/dev/start-llamafile.sh                      # foreground, port 8081
#   PORT=8090 scripts/dev/start-llamafile.sh           # custom port
#   MODEL_URL=https://... scripts/dev/start-llamafile.sh
#
# Then export:
#   export LLAMAFILE_BASE_URL=http://localhost:8081
#
# The OpenAI provider in services/gateway/internal/infrastructure/llm/openai.go
# picks this up automatically when no explicit baseURL is passed.
#
# llamafile project: https://github.com/mozilla-ai/llamafile
# Model defaults to Qwen2.5-0.5B (fast, ~400MB) — fine for HTTP shape
# tests; swap MODEL_URL for a bigger one when you actually want
# coherent generations.

set -euo pipefail

PORT="${PORT:-8081}"
CACHE_DIR="${LLAMAFILE_CACHE:-${HOME}/.cache/llamafile}"
MODEL_URL="${MODEL_URL:-https://huggingface.co/Mozilla/Qwen2.5-0.5B-Instruct-llamafile/resolve/main/Qwen2.5-0.5B-Instruct-Q6_K.llamafile}"
MODEL_FILE="${CACHE_DIR}/$(basename "$MODEL_URL")"

mkdir -p "$CACHE_DIR"

if [[ ! -x "$MODEL_FILE" ]]; then
  echo "[llamafile] downloading $(basename "$MODEL_URL") to $CACHE_DIR ..." >&2
  curl -fsSL --retry 3 -o "$MODEL_FILE" "$MODEL_URL"
  chmod +x "$MODEL_FILE"
fi

echo "[llamafile] starting on :$PORT  (set LLAMAFILE_BASE_URL=http://localhost:$PORT)" >&2
exec "$MODEL_FILE" --server --host 0.0.0.0 --port "$PORT" --nobrowser
