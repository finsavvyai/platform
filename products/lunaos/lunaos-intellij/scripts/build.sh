#!/usr/bin/env bash
set -euo pipefail

# Build the plugin using Docker (no local JDK or Gradle needed)
# Outputs: build/distributions/LunaOS-*.zip

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Generate wrapper if missing
if [ ! -f "${PROJECT_DIR}/gradlew" ]; then
  echo "gradlew not found, generating wrapper..."
  bash "${PROJECT_DIR}/scripts/generate-wrapper.sh"
fi

echo "Building LunaOS IntelliJ plugin..."

docker run --rm \
  -v "${PROJECT_DIR}:/project" \
  -v lunaos-intellij-gradle-cache:/root/.gradle \
  -w /project \
  gradle:8.11.1-jdk17 \
  ./gradlew buildPlugin --no-daemon "$@"

echo ""
echo "Build complete. Plugin ZIP:"
ls -lh "${PROJECT_DIR}/build/distributions/"*.zip 2>/dev/null || echo "  (check build/distributions/)"
