#!/usr/bin/env bash
# fleet-report.sh — run `pushci init` over a fleet of repos and emit a
# Markdown report. Built for the Norlys pilot pre-DPA dry-run pass
# (S1.5) and reusable for any multi-repo capability survey.
#
# Usage:
#   fleet-report.sh <repos.txt> [out_dir]
#
# Format of repos.txt: one absolute repo path per line (already cloned).
# Lines starting with # are ignored.
#
# Output: <out_dir>/fleet-report-YYYYMMDD.md plus per-repo dirs with
# generated pushci.yml + diffs.
#
# Pre-conditions: `pushci` on PATH, repos already cloned + writable.
# Does NOT clone repos — keep that step under DPA gate.

set -euo pipefail

REPOS_FILE="${1:-}"
OUT_DIR="${2:-$HOME/dev/norlys/fleet-reports}"
[ -z "$REPOS_FILE" ] && { echo "usage: $0 <repos.txt> [out_dir]" >&2; exit 2; }
[ -f "$REPOS_FILE" ] || { echo "not found: $REPOS_FILE" >&2; exit 2; }
command -v pushci >/dev/null || { echo "pushci not on PATH" >&2; exit 2; }

mkdir -p "$OUT_DIR"
ts=$(date +%Y%m%d-%H%M%S)
report="$OUT_DIR/fleet-report-$ts.md"
work_root="$OUT_DIR/work-$ts"
mkdir -p "$work_root"

cat > "$report" <<EOF
# Fleet dry-run report — $(date -u +%Y-%m-%dT%H:%M:%SZ)

| repo | stack | framework | existing CI | pushci would emit | size before/after | notes |
|---|---|---|---|---|---|---|
EOF

while IFS= read -r repo; do
  case "$repo" in ''|\#*) continue ;; esac
  [ -d "$repo" ] || { echo "skip (not a dir): $repo" >&2; continue; }
  name=$(basename "$repo")
  workdir="$work_root/$name"
  cp -R "$repo" "$workdir"

  # detect existing CI before init (set -e safe: use if-blocks)
  existing="none"
  if [ -d "$workdir/.github/workflows" ]; then
    n=$(find "$workdir/.github/workflows" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
    existing="github-actions($n)"
  fi
  if [ -f "$workdir/Jenkinsfile" ]; then existing="$existing+jenkins"; fi
  if [ -f "$workdir/.gitlab-ci.yml" ]; then existing="$existing+gitlab"; fi
  if [ -f "$workdir/azure-pipelines.yml" ] || [ -f "$workdir/azure-pipelines.yaml" ]; then
    existing="$existing+azure"
  fi
  before_size=0
  if [ -f "$workdir/pushci.yml" ]; then
    before_size=$(wc -c < "$workdir/pushci.yml" | tr -d ' ')
  fi

  # run pushci init non-interactively (empty stdin → defaults)
  pushd "$workdir" >/dev/null
  init_out=$(pushci init --force </dev/null 2>&1 || true)
  popd >/dev/null

  after_size=0
  if [ -f "$workdir/pushci.yml" ]; then
    after_size=$(wc -c < "$workdir/pushci.yml" | tr -d ' ')
  fi

  # extract stack/framework from init output (best-effort, set-e safe)
  # pushci init prints `[N/M] <stack>  (<path>)` per detected project.
  # Strip ANSI codes first so grep matches across colors.
  plain=$(printf '%s' "$init_out" | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g')
  stack=$(printf '%s' "$plain" | grep -oE '\[[0-9]+/[0-9]+\] +[a-z]+' | head -1 | awk '{print $NF}' || true)
  if [ -z "$stack" ]; then stack="?"; fi
  framework=$(printf '%s' "$plain" | grep -oE '(framework|fw):[ ]*[a-zA-Z-]+' | head -1 | awk -F'[: ]+' '{print $NF}' || true)
  if [ -z "$framework" ]; then framework="-"; fi

  notes=""
  if [ "$after_size" -eq 0 ]; then notes="init failed"; fi
  if [ "$before_size" -gt 0 ] && [ "$after_size" -gt 0 ]; then notes="overwrote existing pushci.yml"; fi

  echo "| $name | $stack | $framework | $existing | $after_size B | $before_size/$after_size | $notes |" >> "$report"
done < "$REPOS_FILE"

cat >> "$report" <<EOF

## Summary

- Fleet size: $(grep -cv '^[#[:space:]]*$' "$REPOS_FILE")
- Reports + generated pushci.yml under: \`$work_root\`
- Re-run this report: \`$0 $REPOS_FILE $OUT_DIR\`

## Provenance

- Tool: \`scripts/fleet-report.sh\`
- pushci version: $(pushci version 2>&1 | head -1)
- Read-only against source repos (copies before mutation)
EOF

echo
echo "✓ report: $report"
echo "✓ work:   $work_root"
