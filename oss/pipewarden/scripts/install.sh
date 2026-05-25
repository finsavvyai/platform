#!/usr/bin/env bash
#
# PipeWarden universal installer.
#
#     curl -fsSL https://pipewarden.io/install | bash
#
# Detects OS + arch, fetches the matching binary from the latest GitHub
# release, verifies the checksum, and installs to /usr/local/bin
# (or ${PIPEWARDEN_INSTALL_DIR} when set). Refuses to clobber an
# existing binary unless --force is passed.

set -euo pipefail

REPO="finsavvyai/pipewarden"
INSTALL_DIR="${PIPEWARDEN_INSTALL_DIR:-/usr/local/bin}"
TAG="${PIPEWARDEN_TAG:-latest}"   # set to vX.Y.Z to pin
FORCE="${PIPEWARDEN_FORCE:-}"
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --dir=*) INSTALL_DIR="${arg#*=}" ;;
    --tag=*) TAG="${arg#*=}" ;;
    -h|--help)
      cat <<'USAGE'
PipeWarden installer

Options:
  --tag=vX.Y.Z          pin to a specific release (default: latest)
  --dir=/path           install directory (default: /usr/local/bin)
  --force               overwrite existing binary

Env equivalents:
  PIPEWARDEN_TAG=vX.Y.Z
  PIPEWARDEN_INSTALL_DIR=/path
  PIPEWARDEN_FORCE=1
USAGE
      exit 0
      ;;
  esac
done

err()  { printf "\033[31m✗\033[0m %s\n" "$*" >&2; }
info() { printf "\033[36mi\033[0m %s\n" "$*"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$*"; }

OS=""
case "$(uname -s)" in
  Linux*)  OS="linux" ;;
  Darwin*) OS="darwin" ;;
  MINGW*|MSYS*|CYGWIN*)
    err "Windows is supported via the GitHub release ZIP, not this script."
    err "Download: https://github.com/${REPO}/releases"
    exit 1
    ;;
  *)
    err "unsupported OS: $(uname -s)"
    exit 1
    ;;
esac

ARCH=""
case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    err "unsupported arch: $(uname -m)"
    exit 1
    ;;
esac

for tool in curl tar shasum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    # macOS calls it shasum; Linux usually has sha256sum.
    if [[ "$tool" == "shasum" ]] && command -v sha256sum >/dev/null 2>&1; then
      continue
    fi
    err "missing required tool: $tool"
    exit 1
  fi
done

if [[ "$TAG" == "latest" ]]; then
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
        | grep -oE '"tag_name": *"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
fi
if [[ -z "$TAG" ]]; then
  err "could not resolve latest release tag"
  exit 1
fi
VERSION="${TAG#v}"
ARCHIVE="pipewarden-${VERSION}-${OS}-${ARCH}.tar.gz"
URL="https://github.com/${REPO}/releases/download/${TAG}/${ARCHIVE}"
SUMS_URL="https://github.com/${REPO}/releases/download/${TAG}/checksums.txt"

info "installing pipewarden ${TAG} (${OS}/${ARCH}) into ${INSTALL_DIR}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

info "fetching ${URL}"
curl -fsSL "$URL" -o "$WORK/$ARCHIVE"

info "verifying checksum"
curl -fsSL "$SUMS_URL" -o "$WORK/checksums.txt"
expected=$(awk -v t="$ARCHIVE" '$2==t {print $1}' "$WORK/checksums.txt")
if [[ -z "$expected" ]]; then
  err "no checksum for ${ARCHIVE} in checksums.txt"
  exit 1
fi
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$WORK/$ARCHIVE" | awk '{print $1}')
else
  actual=$(shasum -a 256 "$WORK/$ARCHIVE" | awk '{print $1}')
fi
if [[ "$expected" != "$actual" ]]; then
  err "checksum mismatch: expected $expected, got $actual"
  exit 1
fi
ok "checksum verified"

tar -xzf "$WORK/$ARCHIVE" -C "$WORK"
if [[ ! -x "$WORK/pipewarden" ]]; then
  err "extracted archive does not contain a pipewarden binary"
  exit 1
fi

DEST="${INSTALL_DIR}/pipewarden"
if [[ -e "$DEST" && -z "$FORCE" ]]; then
  err "${DEST} already exists. Re-run with --force or PIPEWARDEN_FORCE=1 to overwrite."
  exit 1
fi

if [[ -w "$INSTALL_DIR" ]]; then
  install -m 0755 "$WORK/pipewarden" "$DEST"
else
  info "elevation required to write to ${INSTALL_DIR}"
  sudo install -m 0755 "$WORK/pipewarden" "$DEST"
fi

ok "installed ${DEST}"
"${DEST}" --version 2>/dev/null || true
echo
info "next: run \`pipewarden onboard\` to wire your first CI/CD connection,"
info "  or \`pipewarden scan .\` to scan the current repo immediately."
