#!/usr/bin/env bash
set -euo pipefail

MAX_LINES="${MAX_LINES:-200}"
CHANGED_ONLY="${CHANGED_ONLY:-0}"
BASE_REF="${BASE_REF:-origin/main}"
DIFF_BASE=""

if ! [[ "$MAX_LINES" =~ ^[0-9]+$ ]]; then
  echo "MAX_LINES must be a positive integer, got: $MAX_LINES"
  exit 2
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This script requires a git worktree."
  exit 2
fi

collect_files() {
  if [[ "$CHANGED_ONLY" == "1" ]]; then
    if [[ -n "$DIFF_BASE" ]]; then
      git diff --name-only "${DIFF_BASE}"...HEAD
      return
    fi
  fi
  git ls-files
}

if [[ "$CHANGED_ONLY" == "1" ]]; then
  if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
    DIFF_BASE="$(git merge-base HEAD "$BASE_REF")"
  elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    DIFF_BASE="HEAD~1"
  fi
fi

violations=0
checked=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  case "$file" in
    *.py|*.js|*.ts|*.tsx|*.jsx|*.go|*.swift) ;;
    *) continue
      ;;
  esac

  case "$file" in
    node_modules/*|.venv/*|build/*|dist/*|playwright-report/*|test-results/*)
      continue
      ;;
    *.min.js|*.d.ts|*.generated.*|*.snap)
      continue
      ;;
  esac

  if [[ ! -f "$file" ]]; then
    continue
  fi

  checked=$((checked + 1))
  line_count=$(wc -l <"$file")
  if (( line_count > MAX_LINES )); then
    if [[ "$CHANGED_ONLY" == "1" && -n "$DIFF_BASE" ]] && git cat-file -e "${DIFF_BASE}:${file}" 2>/dev/null; then
      base_line_count=$(git show "${DIFF_BASE}:${file}" | wc -l)
      if (( base_line_count > MAX_LINES && line_count <= base_line_count )); then
        echo "Legacy oversized file not increased: ${file} (${base_line_count} -> ${line_count})"
        continue
      fi
      echo "File exceeds ${MAX_LINES} lines: ${file} (${base_line_count} -> ${line_count})"
      violations=1
      continue
    fi
    echo "File exceeds ${MAX_LINES} lines: ${file} (${line_count})"
    violations=1
  fi
done < <(collect_files)

if (( violations > 0 )); then
  scope="all tracked files"
  [[ "$CHANGED_ONLY" == "1" ]] && scope="changed files only"
  echo "File-length gate failed (${scope}). Checked: ${checked}"
  exit 1
fi

scope="all tracked files"
[[ "$CHANGED_ONLY" == "1" ]] && scope="changed files only"
echo "File-length gate passed (max ${MAX_LINES} lines, ${scope}). Checked: ${checked}"
