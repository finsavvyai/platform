#!/usr/bin/env bash
# Register a project with the Claw Gateway
# Usage: ./register-project.sh <project-id> <project-name> [provider] [model]
#
# Examples:
#   ./register-project.sh opensyber "OpenSyber" anthropic claude-sonnet-4-6
#   ./register-project.sh mcpoverflow "MCPOverflow" openai gpt-4o
#   ./register-project.sh qestro "Qestro"

set -euo pipefail

PROJECT_ID="${1:?Usage: register-project.sh <project-id> <project-name> [provider] [model]}"
PROJECT_NAME="${2:?Missing project name}"
PROVIDER="${3:-anthropic}"
MODEL="${4:-claude-sonnet-4-6}"

# Generate a random API key
API_KEY="claw_$(openssl rand -hex 32)"

# Hash the API key with SHA-256
API_KEY_HASH=$(echo -n "$API_KEY" | shasum -a 256 | cut -d' ' -f1)

# Build the project config JSON
CONFIG=$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "name": "$PROJECT_NAME",
  "apiKeyHash": "$API_KEY_HASH",
  "defaultProvider": "$PROVIDER",
  "defaultModel": "$MODEL",
  "maxTokensPerRequest": 8192,
  "rateLimitPerMinute": 100,
  "enabled": true
}
EOF
)

echo "=== Claw Gateway Project Registration ==="
echo ""
echo "Project ID:  $PROJECT_ID"
echo "Name:        $PROJECT_NAME"
echo "Provider:    $PROVIDER"
echo "Model:       $MODEL"
echo ""
echo "API Key (save this — it cannot be recovered):"
echo "  $API_KEY"
echo ""

# Store in KV
echo "Storing in KV namespace PROJECT_KEYS..."
wrangler kv key put --binding PROJECT_KEYS "project:$PROJECT_ID" "$CONFIG"

echo ""
echo "Done! Add this to your project's .env:"
echo "  CLAW_API_KEY=$API_KEY"
echo "  CLAW_ENDPOINT=https://claw.opensyber.cloud"
echo "  CLAW_PROJECT_ID=$PROJECT_ID"
