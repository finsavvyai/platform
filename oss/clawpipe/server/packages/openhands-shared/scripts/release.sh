#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

python -m build
python -m twine check dist/*

echo
if [[ "${1:-}" == "--publish" ]]; then
  : "${TWINE_USERNAME:?TWINE_USERNAME is required (usually __token__)}"
  : "${TWINE_PASSWORD:?TWINE_PASSWORD is required (PyPI token)}"
  python -m twine upload dist/*
  echo "Published to PyPI."
else
  echo "Release artifacts validated."
  echo "To publish:"
  echo "  TWINE_USERNAME=__token__ TWINE_PASSWORD=<pypi-token> ./scripts/release.sh --publish"
fi
