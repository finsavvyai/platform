#!/bin/sh
set -eu

# Autogen PIPEWARDEN_VAULT_KEY if not supplied. Persists to /app/data/.vault_key so
# restarts reuse the same key (credentials stay decryptable).

KEY_PATH="${PIPEWARDEN_VAULT_KEY_PATH:-/app/data/.vault_key}"

if [ -z "${PIPEWARDEN_VAULT_KEY:-}" ]; then
  if [ -f "$KEY_PATH" ]; then
    PIPEWARDEN_VAULT_KEY="$(cat "$KEY_PATH")"
    echo "[entrypoint] loaded existing vault key from $KEY_PATH" >&2
  else
    mkdir -p "$(dirname "$KEY_PATH")"
    PIPEWARDEN_VAULT_KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    printf '%s' "$PIPEWARDEN_VAULT_KEY" > "$KEY_PATH"
    chmod 600 "$KEY_PATH"
    echo "[entrypoint] generated new vault key at $KEY_PATH (keep this volume!)" >&2
  fi
  export PIPEWARDEN_VAULT_KEY
fi

exec "$@"
