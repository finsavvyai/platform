#!/usr/bin/env bash
# stage-llamafile.sh
#
# Fetches pinned llamafile binaries listed in
# scripts/airgap/llamafile-pins.txt and stages them under <dst-dir>/ as
# llamafile-amd64 and llamafile-arm64. Each binary's SHA256 is verified
# against the inline `<filename> <sha256>` record in the pins file before
# the file is staged; mismatch is fatal.
#
# Usage: stage-llamafile.sh <dst-dir>
#
# When scripts/airgap/llamafile-pins.txt is missing or empty the script
# exits 0 with a warning so a fresh checkout never blocks `make build`.

set -euo pipefail

DST="${1:-dist/airgap}"
PINS="scripts/airgap/llamafile-pins.txt"

mkdir -p "$DST"

if [ ! -s "$PINS" ]; then
  echo "[airgap-stage] $PINS is empty — skipping llamafile stage." >&2
  echo "[airgap-stage] populate it with lines: <arch>\\t<filename>\\t<sha256>\\t<url>" >&2
  exit 0
fi

if command -v sha256sum >/dev/null 2>&1; then
  HASHER=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  HASHER=(shasum -a 256)
else
  echo "[airgap-stage] sha256sum or shasum required" >&2
  exit 1
fi

while IFS=$'\t' read -r arch filename sha url; do
  case "$arch" in
    \#*|"") continue ;;
  esac
  out="$DST/llamafile-$arch"
  echo "[airgap-stage] fetching $filename for $arch" >&2
  curl -fsSL -o "$out.tmp" "$url"
  got="$(${HASHER[@]} "$out.tmp" | awk '{print $1}')"
  if [ "$got" != "$sha" ]; then
    echo "[airgap-stage] sha256 mismatch for $filename: got $got expected $sha" >&2
    rm -f "$out.tmp"
    exit 2
  fi
  chmod +x "$out.tmp"
  mv "$out.tmp" "$out"
  echo "[airgap-stage] staged $out" >&2
done < "$PINS"
