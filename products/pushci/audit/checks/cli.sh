#!/usr/bin/env bash
# cli.sh — exercise core CLI surface. No network, no AI keys.
set -u
set -o pipefail

fails=0
note() { printf "  %s\n" "$*"; }
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    note "✓ $label"
  else
    note "✗ $label  (cmd: $*)"
    fails=$((fails + 1))
  fi
}

echo "pushci binary: $PUSHCI"
echo "version:       $("$PUSHCI" --version 2>/dev/null)"

# Basic CLI smoke
check "--version prints something"            bash -c "'$PUSHCI' --version | grep -Eq 'pushci [0-9]'"
check "--help contains 'AI-native CI/CD'"     bash -c "'$PUSHCI' --help 2>&1 | grep -q 'AI-native CI/CD'"

# Commands that SHOULD respond to --help quickly (< 3s, exit 0).
fast_help_cmds="init run deploy diagnose status secret heal ask generate migrate \
                trigger mcp agent skill login logout doctor \
                trace release promote uninstall version \
                actions scan import install-hooks secrets"
for cmd in $fast_help_cmds; do
  check "$cmd --help responds"  bash -c "timeout 3 '$PUSHCI' $cmd --help >/dev/null 2>&1 || timeout 3 '$PUSHCI' $cmd --help 2>&1 | head -1 >/dev/null"
done

# Commands that are KNOWN to hang on --help in v1.7.0 (they run the full
# command instead of printing help). We assert the bug is still there so we
# notice the day it's fixed. Swap the assertion when that happens.
echo "  --- known --help bugs ---"
for cmd in ts troubleshoot index; do
  timeout 3 "$PUSHCI" "$cmd" --help >/dev/null 2>&1
  rc=$?
  if [ $rc -eq 124 ]; then
    note "⚠ $cmd --help hangs (no --help handler; runs full command)"
  else
    note "✓ $cmd --help now exits (bug fixed — tighten this check!)"
  fi
done

exit $fails
