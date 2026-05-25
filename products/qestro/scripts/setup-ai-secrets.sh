#!/bin/bash

# Qestro AI Secrets Setup Script
# This script configures AI API keys for Cloudflare Workers
#
# USAGE: Set these environment variables before running:
#   export OPENAI_KEY="your-key-here"
#   export ANTHROPIC_KEY="your-key-here"
#   export HUGGING_FACE_KEY="your-key-here"
#   bash scripts/setup-ai-secrets.sh

echo "🚀 Setting up Qestro AI API secrets..."

# Validate that keys are provided via environment
if [ -z "$OPENAI_KEY" ] || [ -z "$ANTHROPIC_KEY" ] || [ -z "$HUGGING_FACE_KEY" ]; then
  echo "❌ Error: Required environment variables not set."
  echo ""
  echo "Please export the following before running:"
  echo "  export OPENAI_KEY=\"your-openai-key\""
  echo "  export ANTHROPIC_KEY=\"your-anthropic-key\""
  echo "  export HUGGING_FACE_KEY=\"your-huggingface-key\""
  exit 1
fi

echo "📝 Configuring Cloudflare Workers secrets..."

# Set OpenAI API key
echo "Setting OPENAI_API_KEY..."
echo "$OPENAI_KEY" | wrangler secret put OPENAI_API_KEY --env production

# Set Anthropic API key
echo "Setting ANTHROPIC_API_KEY..."
echo "$ANTHROPIC_KEY" | wrangler secret put ANTHROPIC_API_KEY --env production

# Set Hugging Face API key
echo "Setting HUGGING_FACE_API_KEY..."
echo "$HUGGING_FACE_KEY" | wrangler secret put HUGGING_FACE_API_KEY --env production

# Also set for development environment
echo "Setting secrets for development environment..."

echo "$OPENAI_KEY" | wrangler secret put OPENAI_API_KEY --env dev
echo "$ANTHROPIC_KEY" | wrangler secret put ANTHROPIC_API_KEY --env dev
echo "$HUGGING_FACE_KEY" | wrangler secret put HUGGING_FACE_API_KEY --env dev

# Set JWT secret (generate a new one)
echo "Generating and setting JWT_SECRET..."
JWT_SECRET=$(openssl rand -base64 32)

echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env production
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env dev

echo "✅ AI secrets configuration completed!"
echo ""
echo "🔑 Configured secrets:"
echo "  - OPENAI_API_KEY ✓"
echo "  - ANTHROPIC_API_KEY ✓"
echo "  - HUGGING_FACE_API_KEY ✓"
echo "  - JWT_SECRET ✓"
echo ""
echo "🌍 Environments:"
echo "  - Production ✓"
echo "  - Development ✓"
echo ""
echo "🚀 Your Qestro AI services are now ready to use!"
