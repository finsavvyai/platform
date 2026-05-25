#!/usr/bin/env bash
# SDK Generation Script for FinSavvy AI Enterprise Platform
# Generates TypeScript, Python, and Go SDKs from the unified OpenAPI spec.
# Usage: ./generate.sh [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_FILE="${SCRIPT_DIR}/openapi-merged.yaml"
DRY_RUN=false
GENERATOR_CMD=""

# Parse arguments
for arg in "$@"; do
    case "${arg}" in
        --dry-run)
            DRY_RUN=true
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run]"
            echo ""
            echo "Options:"
            echo "  --dry-run   Print actions without executing them"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown argument: ${arg}"
            echo "Usage: $0 [--dry-run]"
            exit 1
            ;;
    esac
done

# Detect openapi-generator-cli
detect_generator() {
    if command -v openapi-generator-cli >/dev/null 2>&1; then
        GENERATOR_CMD="openapi-generator-cli"
    elif command -v openapi-generator >/dev/null 2>&1; then
        GENERATOR_CMD="openapi-generator"
    elif [ -x "${SCRIPT_DIR}/node_modules/.bin/openapi-generator-cli" ]; then
        GENERATOR_CMD="${SCRIPT_DIR}/node_modules/.bin/openapi-generator-cli"
    elif command -v npx >/dev/null 2>&1; then
        GENERATOR_CMD="npx @openapitools/openapi-generator-cli"
    else
        echo "ERROR: openapi-generator-cli not found."
        echo "Install via one of:"
        echo "  npm install @openapitools/openapi-generator-cli -g"
        echo "  brew install openapi-generator"
        echo "  pip install openapi-generator-cli"
        exit 1
    fi
    echo "Using generator: ${GENERATOR_CMD}"
}

# Validate the OpenAPI spec exists
validate_spec() {
    if [ ! -f "${SPEC_FILE}" ]; then
        echo "ERROR: OpenAPI spec not found at ${SPEC_FILE}"
        echo "Run the spec merge step first (Task 3.1)."
        exit 1
    fi
    echo "Spec file: ${SPEC_FILE}"
}

# Clean output directory before generation
clean_output() {
    local dir="$1"
    local name="$2"
    if [ -d "${dir}" ]; then
        if [ "${DRY_RUN}" = true ]; then
            echo "[DRY-RUN] Would remove: ${dir}"
        else
            echo "Cleaning ${name} output: ${dir}"
            rm -rf "${dir}"
        fi
    fi
}

# Generate TypeScript SDK
generate_typescript() {
    local output_dir="${SCRIPT_DIR}/typescript/generated"
    echo ""
    echo "=== TypeScript SDK ==="
    clean_output "${output_dir}" "TypeScript"

    if [ "${DRY_RUN}" = true ]; then
        echo "[DRY-RUN] Would generate TypeScript SDK to ${output_dir}"
        echo "[DRY-RUN] Would run: ${GENERATOR_CMD} generate -g typescript-fetch -i ${SPEC_FILE} -o ${output_dir} -c ${SCRIPT_DIR}/typescript/openapitools.json"
        return
    fi

    ${GENERATOR_CMD} generate \
        -g typescript-fetch \
        -i "${SPEC_FILE}" \
        -o "${output_dir}" \
        --additional-properties=npmName=@finsavvy/sdk,npmVersion=1.0.0,supportsES6=true,typescriptThreePlus=true,withInterfaces=true

    # Post-generation formatting
    if command -v npx >/dev/null 2>&1; then
        echo "Running prettier on generated TypeScript..."
        npx prettier --write "${output_dir}/**/*.ts" 2>/dev/null || true
    fi

    echo "TypeScript SDK generated: ${output_dir}"
    find "${output_dir}" -name '*.ts' | wc -l | xargs echo "  Files generated:"
}

# Generate Python SDK
generate_python() {
    local output_dir="${SCRIPT_DIR}/python/generated"
    echo ""
    echo "=== Python SDK ==="
    clean_output "${output_dir}" "Python"

    if [ "${DRY_RUN}" = true ]; then
        echo "[DRY-RUN] Would generate Python SDK to ${output_dir}"
        echo "[DRY-RUN] Would run: ${GENERATOR_CMD} generate -g python -i ${SPEC_FILE} -o ${output_dir} -c ${SCRIPT_DIR}/python/openapitools.json"
        return
    fi

    ${GENERATOR_CMD} generate \
        -g python \
        -i "${SPEC_FILE}" \
        -o "${output_dir}" \
        --additional-properties=packageName=finsavvy_sdk,projectName=finsavvy-sdk,packageVersion=1.0.0

    # Post-generation formatting
    if command -v ruff >/dev/null 2>&1; then
        echo "Running ruff format on generated Python..."
        ruff format "${output_dir}" 2>/dev/null || true
    fi

    echo "Python SDK generated: ${output_dir}"
    find "${output_dir}" -name '*.py' | wc -l | xargs echo "  Files generated:"
}

# Generate Go SDK
generate_go() {
    local output_dir="${SCRIPT_DIR}/go/generated"
    echo ""
    echo "=== Go SDK ==="
    clean_output "${output_dir}" "Go"

    if [ "${DRY_RUN}" = true ]; then
        echo "[DRY-RUN] Would generate Go SDK to ${output_dir}"
        echo "[DRY-RUN] Would run: ${GENERATOR_CMD} generate -g go -i ${SPEC_FILE} -o ${output_dir} -c ${SCRIPT_DIR}/go/openapitools.json"
        return
    fi

    ${GENERATOR_CMD} generate \
        -g go \
        -i "${SPEC_FILE}" \
        -o "${output_dir}" \
        --additional-properties=packageName=finsavvy,moduleName=github.com/finsavvyai/sdk-go,packageVersion=1.0.0,generateInterfaces=true

    # Post-generation formatting
    if command -v gofmt >/dev/null 2>&1; then
        echo "Running gofmt on generated Go..."
        gofmt -w "${output_dir}" 2>/dev/null || true
    fi

    echo "Go SDK generated: ${output_dir}"
    find "${output_dir}" -name '*.go' | wc -l | xargs echo "  Files generated:"
}

# Print summary
print_summary() {
    echo ""
    echo "========================================="
    echo "  SDK Generation Summary"
    echo "========================================="
    echo "  Spec:       ${SPEC_FILE}"
    echo "  Dry Run:    ${DRY_RUN}"
    echo ""

    if [ "${DRY_RUN}" = true ]; then
        echo "  [DRY-RUN] No files were generated."
        echo "  Re-run without --dry-run to generate SDKs."
    else
        for lang in typescript python go; do
            local dir="${SCRIPT_DIR}/${lang}/generated"
            if [ -d "${dir}" ]; then
                local count
                count=$(find "${dir}" -type f | wc -l | tr -d ' ')
                echo "  ${lang}: ${count} files in ${dir}"
            else
                echo "  ${lang}: not generated"
            fi
        done
    fi

    echo ""
    echo "========================================="
}

# Main execution
main() {
    echo "FinSavvy SDK Generator v1.0.0"
    echo ""

    validate_spec
    detect_generator

    generate_typescript
    generate_python
    generate_go

    print_summary
}

main
