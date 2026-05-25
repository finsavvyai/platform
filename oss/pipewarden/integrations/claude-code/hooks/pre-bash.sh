#!/usr/bin/env bash
#
# preToolUse hook for Claude Code: refuse obviously-dangerous shell.
#
# Wire in ~/.claude/settings.json under hooks.preToolUse, matcher="Bash".
# Claude Code passes the candidate command as JSON on stdin; we
# inspect it and exit with:
#
#   0  → allow
#   1  → deny (Claude shows the reason to the user)
#
# Set PIPEWARDEN_HOOK_DISABLED=1 to make this a no-op.
set -euo pipefail

if [[ "${PIPEWARDEN_HOOK_DISABLED:-}" == "1" ]]; then
  exit 0
fi

payload=$(cat)
# Claude Code preToolUse JSON: {"tool_input":{"command":"...","description":"..."}}
cmd=$(printf '%s' "$payload" | python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("tool_input",{}).get("command",""))' 2>/dev/null || true)

if [[ -z "$cmd" ]]; then
  exit 0
fi

deny() {
  local reason="$1"
  printf 'pipewarden: refusing command — %s\n' "$reason" >&2
  printf 'Override with PIPEWARDEN_HOOK_DISABLED=1 if you really mean it.\n' >&2
  exit 1
}

# 1. Whole-disk destructive removes.
if [[ "$cmd" =~ rm[[:space:]]+(-[a-zA-Z]*[rRf][a-zA-Z]*[[:space:]]+)+(/[[:space:]]*$|/[[:space:]]+\*|/[[:space:]]*$|~[[:space:]]*$) ]]; then
  deny "rm -rf on / or ~ root"
fi

# 2. curl | bash from non-pipewarden host.
if [[ "$cmd" =~ (curl|wget).*\|[[:space:]]*(bash|sh|zsh) ]]; then
  if ! [[ "$cmd" =~ pipewarden\.io|finsavvyai\.com|brew\.sh|sh\.rustup\.rs|get\.docker\.com ]]; then
    deny "curl … | bash from an unvetted host"
  fi
fi

# 3. AWS / GCP / Azure root credential echoes.
if [[ "$cmd" =~ AKIA[A-Z0-9]{16} ]]; then
  deny "appears to contain an AWS access key ID — never echo secrets to shell"
fi
if [[ "$cmd" =~ AIza[0-9A-Za-z_-]{35} ]]; then
  deny "appears to contain a Google API key"
fi
if [[ "$cmd" =~ ghp_[0-9A-Za-z]{36} ]]; then
  deny "appears to contain a GitHub Personal Access Token"
fi
if [[ "$cmd" =~ sk-ant-api03-[A-Za-z0-9_-]{20,} ]]; then
  deny "appears to contain an Anthropic API key"
fi
if [[ "$cmd" =~ xox[baprs]-[0-9A-Za-z-]{10,} ]]; then
  deny "appears to contain a Slack token"
fi

# 4. Force-push to main/master.
if [[ "$cmd" =~ git[[:space:]]+push.*(-f|--force).*[[:space:]](main|master) ]]; then
  deny "force-push to main/master"
fi

# 5. Pipe stdin into root install scripts running as root.
if [[ "$cmd" =~ sudo[[:space:]].*\|[[:space:]]*(bash|sh) ]]; then
  deny "sudo … | bash — install scripts should not also be elevated"
fi

exit 0
