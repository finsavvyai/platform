#!/usr/bin/env bash
set -euo pipefail

# Generate Gradle wrapper files using Docker (no local Gradle needed)
# Creates: gradlew, gradlew.bat, gradle/wrapper/gradle-wrapper.jar

GRADLE_VERSION="8.11.1"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Generating Gradle ${GRADLE_VERSION} wrapper via Docker..."

docker run --rm \
  -v "${PROJECT_DIR}:/project" \
  -w /project \
  gradle:${GRADLE_VERSION}-jdk17 \
  gradle wrapper --gradle-version ${GRADLE_VERSION} --no-daemon

chmod +x "${PROJECT_DIR}/gradlew"
echo "Done. Files created: gradlew, gradlew.bat, gradle/wrapper/gradle-wrapper.jar"
