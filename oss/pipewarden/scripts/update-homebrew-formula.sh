#!/usr/bin/env bash
#
# update-homebrew-formula.sh — bump packaging/homebrew/pipewarden.rb to a
# new release. Run AFTER `goreleaser release` has published the archives
# to a GitHub release tagged like v1.2.3.
#
# Usage:
#     scripts/update-homebrew-formula.sh v1.2.3
#
# Output: rewrites packaging/homebrew/pipewarden.rb in place with the
# new version + sha256 values pulled from the GitHub release's
# checksums.txt. Diff + commit + push the result into the tap repo.

set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "usage: $0 <vX.Y.Z>" >&2
  exit 64
fi
VERSION="${TAG#v}"
REPO="finsavvyai/pipewarden"
FORMULA="packaging/homebrew/pipewarden.rb"

if [[ ! -f "$FORMULA" ]]; then
  echo "missing $FORMULA — run from repo root" >&2
  exit 66
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

checksums_url="https://github.com/${REPO}/releases/download/${TAG}/checksums.txt"
echo "fetching $checksums_url"
curl -fsSL "$checksums_url" -o "$WORK/checksums.txt"

sha_for() {
  local arch_file="$1"
  awk -v t="$arch_file" '$2==t {print $1}' "$WORK/checksums.txt"
}

DA_AMD=$(sha_for "pipewarden-${VERSION}-darwin-amd64.tar.gz")
DA_ARM=$(sha_for "pipewarden-${VERSION}-darwin-arm64.tar.gz")
LX_AMD=$(sha_for "pipewarden-${VERSION}-linux-amd64.tar.gz")
LX_ARM=$(sha_for "pipewarden-${VERSION}-linux-arm64.tar.gz")

for v in "$DA_AMD" "$DA_ARM" "$LX_AMD" "$LX_ARM"; do
  if [[ -z "$v" ]]; then
    echo "ERROR: at least one archive checksum is missing from checksums.txt" >&2
    cat "$WORK/checksums.txt" >&2
    exit 70
  fi
done

# Mac sed uses -i '' ; GNU sed uses -i. Detect.
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

sed_inplace -E "s/^  version \".*\"/  version \"${VERSION}\"/" "$FORMULA"

# Walk the formula and replace each placeholder sha256 with the matching
# real value, in declared order: darwin/arm, darwin/intel, linux/arm, linux/intel.
python3 - "$FORMULA" "$DA_ARM" "$DA_AMD" "$LX_ARM" "$LX_AMD" <<'PY'
import re, sys
formula_path, da_arm, da_amd, lx_arm, lx_amd = sys.argv[1:]
shas = iter([da_arm, da_amd, lx_arm, lx_amd])
with open(formula_path) as f:
    text = f.read()
text = re.sub(
    r'sha256 "0+"',
    lambda _: f'sha256 "{next(shas)}"',
    text,
)
with open(formula_path, "w") as f:
    f.write(text)
PY

echo "updated $FORMULA to ${TAG}:"
grep -E '^\s+(version|url|sha256)' "$FORMULA"
