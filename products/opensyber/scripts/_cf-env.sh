#!/usr/bin/env bash
# Shared Cloudflare credentials helper. SOURCE this file, do not execute it.
#
#   source "$(dirname "${BASH_SOURCE[0]}")/_cf-env.sh"
#
# Exports:
#   CLOUDFLARE_API_TOKEN   — from macOS Keychain item `cf-write-token`
#   CLOUDFLARE_ACCOUNT_ID  — from repo-root .env (single var, no other secrets)
#
# Every OpenSyber deploy/tail/secret script pulls from the SAME keychain item
# so rotating the token is a one-command change, not a sweep across N scripts.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "error: _cf-env.sh must be sourced, not executed" >&2
  exit 1
fi

__CF_ENV_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! __CF_TOKEN="$(security find-generic-password -s cf-write-token -w 2>/dev/null)"; then
  echo "error: keychain item 'cf-write-token' not found." >&2
  echo "  add with: security add-generic-password -s cf-write-token -a \"\$USER\" -w <token>" >&2
  return 1 2>/dev/null || exit 1
fi
export CLOUDFLARE_API_TOKEN="$__CF_TOKEN"
unset __CF_TOKEN

if [[ -f "$__CF_ENV_REPO_ROOT/.env" ]]; then
  __CF_ACCOUNT="$(grep -E '^CLOUDFLARE_ACCOUNT_ID=' "$__CF_ENV_REPO_ROOT/.env" | head -1 | cut -d= -f2-)"
fi
if [[ -z "${__CF_ACCOUNT:-}" ]]; then
  echo "error: CLOUDFLARE_ACCOUNT_ID not found in $__CF_ENV_REPO_ROOT/.env" >&2
  return 1 2>/dev/null || exit 1
fi
export CLOUDFLARE_ACCOUNT_ID="$__CF_ACCOUNT"
unset __CF_ACCOUNT
unset __CF_ENV_REPO_ROOT
