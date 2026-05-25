#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_FILE="${ROOT_DIR}/scripts/max-lines-baseline.txt"
MAX_LINES="${MAX_LINES:-200}"

if [[ ! -f "${BASELINE_FILE}" ]]; then
  echo "Missing baseline file: ${BASELINE_FILE}" >&2
  exit 1
fi

is_baselined() {
  local candidate="$1"
  grep -Fxq "${candidate}" "${BASELINE_FILE}"
}

violations=0
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  lines="$(wc -l < "${ROOT_DIR}/${file}" | tr -d ' ')"
  if [[ "${lines}" -le "${MAX_LINES}" ]]; then
    continue
  fi

  if is_baselined "${file}"; then
    continue
  fi

  echo "New line-limit violation: ${file} (${lines} > ${MAX_LINES})"
  violations=$((violations + 1))
done < <(
  cd "${ROOT_DIR}"
  find apps packages -type f \
    \( -path '*/src/*' -o -path '*/app/*' -o -path '*/lib/*' \) \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' \) \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/build/*' \
    | sed 's#^\./##' \
    | sort
)

if [[ "${violations}" -gt 0 ]]; then
  echo "check-max-lines failed with ${violations} new violations."
  echo "To intentionally accept debt, add file paths to ${BASELINE_FILE}."
  exit 1
fi

echo "check-max-lines passed (no new >${MAX_LINES}-line source files outside baseline)."
