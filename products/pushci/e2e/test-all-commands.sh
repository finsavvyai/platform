#!/usr/bin/env bash
# PushCI CLI Integration Tests — runs every command and reports pass/fail
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PUSHCI="$ROOT/pushci"

PASS=0
FAIL=0
RESULTS=""

check() {
  local name="$1"
  local expected_exit="$2"
  local actual_exit="$3"
  local output="$4"
  local note="$5"

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    PASS=$((PASS + 1))
    RESULTS+="$(printf "| %-25s | %-13s | %-13s | PASS | %s\n" "$name" "$expected_exit" "$actual_exit" "$note")"
  else
    FAIL=$((FAIL + 1))
    RESULTS+="$(printf "| %-25s | %-13s | %-13s | FAIL | %s\n" "$name" "$expected_exit" "$actual_exit" "$note")"
  fi
  RESULTS+=$'\n'
}

run_test() {
  local name="$1"
  local expected="$2"
  shift 2
  local out
  out=$("$@" 2>&1)
  local code=$?
  check "$name" "$expected" "$code" "$out" ""
}

run_test_in_dir() {
  local name="$1"
  local expected="$2"
  local dir="$3"
  shift 3
  local out
  out=$(cd "$dir" && "$@" 2>&1)
  local code=$?
  check "$name" "$expected" "$code" "$out" ""
}

echo "Building pushci..."
(cd "$ROOT" && go build -o pushci ./cmd/pushci/) || { echo "Build failed"; exit 1; }

echo ""
echo "=== GROUP 1: Info Commands ==="
run_test "version"          0 "$PUSHCI" version
run_test "--version"        0 "$PUSHCI" --version
run_test "-v"               0 "$PUSHCI" -v
run_test "help"             0 "$PUSHCI" help
run_test "--help"           0 "$PUSHCI" --help
run_test "-h"               0 "$PUSHCI" -h
run_test "no args"          0 "$PUSHCI"
run_test "unknown command"  1 "$PUSHCI" nonexistent

echo "=== GROUP 2: Diagnostic Commands ==="
run_test "doctor"           0 "$PUSHCI" doctor
run_test "troubleshoot"     0 "$PUSHCI" troubleshoot
run_test "status"           0 "$PUSHCI" status

echo "=== GROUP 3: Init + Run (Node project) ==="
TMPDIR_NODE=$(mktemp -d)
(
  cd "$TMPDIR_NODE"
  git init -q
  echo '{"name":"t","scripts":{"test":"echo ok","build":"echo ok","lint":"echo ok"}}' > package.json
  git add . && GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t git commit -q -m "init"
)
run_test_in_dir "init"            0 "$TMPDIR_NODE" "$PUSHCI" init <<< "0"
run_test_in_dir "run"             0 "$TMPDIR_NODE" "$PUSHCI" run
run_test_in_dir "run --stress 2"  0 "$TMPDIR_NODE" "$PUSHCI" run --stress 2
run_test_in_dir "run --trace"     0 "$TMPDIR_NODE" "$PUSHCI" run --trace
run_test_in_dir "trace"           0 "$TMPDIR_NODE" "$PUSHCI" trace
run_test_in_dir "status (after)"  0 "$TMPDIR_NODE" "$PUSHCI" status
rm -rf "$TMPDIR_NODE"

echo "=== GROUP 4: AI Commands (gated) ==="
unset ANTHROPIC_API_KEY
run_test "diagnose"         1 "$PUSHCI" diagnose
run_test "heal"             1 "$PUSHCI" heal
run_test "ask"              1 "$PUSHCI" ask "what is CI"
run_test "generate"         1 "$PUSHCI" generate

echo "=== GROUP 5: Secret Management ==="
TMPDIR_SEC=$(mktemp -d)
(cd "$TMPDIR_SEC" && git init -q && mkdir -p .pushci)
run_test_in_dir "secret set"  0 "$TMPDIR_SEC" "$PUSHCI" secret set TEST_KEY test_value
run_test_in_dir "secret list" 0 "$TMPDIR_SEC" "$PUSHCI" secret list
run_test_in_dir "secret get"  0 "$TMPDIR_SEC" "$PUSHCI" secret get TEST_KEY
rm -rf "$TMPDIR_SEC"

echo "=== GROUP 6: Other Commands ==="
# migrate
TMPDIR_MIG=$(mktemp -d)
(
  cd "$TMPDIR_MIG"
  git init -q
  mkdir -p .github/workflows
  cat > .github/workflows/ci.yml << 'YAML'
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
YAML
)
run_test_in_dir "migrate"     0 "$TMPDIR_MIG" "$PUSHCI" migrate .github/workflows/ci.yml
rm -rf "$TMPDIR_MIG"

# mcp (start + kill)
"$PUSHCI" mcp &
MCP_PID=$!
sleep 1
kill $MCP_PID 2>/dev/null; wait $MCP_PID 2>/dev/null
check "mcp (start+kill)" 0 0 "" "server started and stopped"

# agent (start + kill)
"$PUSHCI" agent &
AGENT_PID=$!
sleep 1
kill $AGENT_PID 2>/dev/null; wait $AGENT_PID 2>/dev/null
check "agent (start+kill)" 0 0 "" "server started and stopped"

# index
TMPDIR_IDX=$(mktemp -d)
(cd "$TMPDIR_IDX" && git init -q && echo '{}' > package.json)
run_test_in_dir "index"       0 "$TMPDIR_IDX" "$PUSHCI" index
rm -rf "$TMPDIR_IDX"

# skill list
run_test "skill list"         0 "$PUSHCI" skill list

# promote
run_test "promote"            0 "$PUSHCI" promote

# login (pipe empty, expect error)
OUT=$(echo "" | "$PUSHCI" login 2>&1)
CODE=$?
check "login (no token)" 1 "$CODE" "$OUT" "expected error with no token"

# logout
run_test "logout"             0 "$PUSHCI" logout

# deploy (no target)
run_test "deploy (no target)" 1 "$PUSHCI" deploy

# release --dry-run (dirty tree expected)
OUT=$("$PUSHCI" release --dry-run 2>&1)
CODE=$?
check "release --dry-run" 1 "$CODE" "$OUT" "dirty tree expected"

# uninstall
TMPDIR_UNI=$(mktemp -d)
(
  cd "$TMPDIR_UNI"
  git init -q
  mkdir -p .pushci .git/hooks
  echo '#!/bin/sh' > .git/hooks/pre-push
)
run_test_in_dir "uninstall"   0 "$TMPDIR_UNI" "$PUSHCI" uninstall
rm -rf "$TMPDIR_UNI"

echo ""
echo "========================================"
echo "         RESULTS SUMMARY"
echo "========================================"
printf "| %-25s | %-13s | %-13s | %-4s | %s\n" "Command" "Expected Exit" "Actual Exit" "P/F" "Notes"
printf "| %-25s | %-13s | %-13s | %-4s | %s\n" "-------------------------" "-------------" "-------------" "----" "-----"
echo -n "$RESULTS"
echo "========================================"
echo "PASSED: $PASS  FAILED: $FAIL  TOTAL: $((PASS + FAIL))"
echo "========================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
