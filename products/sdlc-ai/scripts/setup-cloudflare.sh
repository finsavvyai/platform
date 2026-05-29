#!/bin/bash

# SDLC.ai Cloudflare Infrastructure Setup Script
# This script sets up all required Cloudflare resources for the SDLC platform

set -e

echo "🚀 SDLC.ai Cloudflare Infrastructure Setup"
echo "==========================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "📋 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please log in to Cloudflare:"
    wrangler login
fi

# Get account ID
ACCOUNT_ID=$(wrangler whoami | grep "Account ID" | awk '{print $3}')
echo "✅ Using Cloudflare Account: $ACCOUNT_ID"
echo ""

# Create D1 Database
echo "📊 Creating D1 Database..."
D1_DB_NAME="sdlc-production"
wrangler d1 create $D1_DB_NAME || echo "Database may already exist"
D1_DATABASE_ID=$(wrangler d1 list | grep $D1_DB_NAME | awk '{print $2}')
echo "✅ D1 Database ID: $D1_DATABASE_ID"
echo ""

# Create R2 Buckets
echo "🗄️  Creating R2 Buckets..."
R2_BUCKETS=("sdlc-documents" "sdlc-embeddings" "sdlc-audit-logs" "sdlc-backups")
for bucket in "${R2_BUCKETS[@]}"; do
    wrangler r2 bucket create $bucket || echo "Bucket $bucket may already exist"
    echo "✅ Created R2 bucket: $bucket"
done
echo ""

# Create KV Namespaces
echo "🔑 Creating KV Namespaces..."
KV_NAMESPACES=("sdlc-cache" "sdlc-sessions" "sdlc-rate-limits" "sdlc-config")
for namespace in "${KV_NAMESPACES[@]}"; do
    wrangler kv:namespace create $namespace || echo "Namespace $namespace may already exist"
    echo "✅ Created KV namespace: $namespace"
done
echo ""

# Create Vectorize Index
echo "🧮 Creating Vectorize Index..."
VECTORIZE_INDEX="sdlc-embeddings"
wrangler vectorize create $VECTORIZE_INDEX \
    --dimensions=1536 \
    --metric=cosine || echo "Vectorize index may already exist"
echo "✅ Created Vectorize index: $VECTORIZE_INDEX"
echo ""

# Create Queue
echo "📬 Creating Queue..."
QUEUE_NAME="sdlc-processing-queue"
wrangler queues create $QUEUE_NAME || echo "Queue may already exist"
echo "✅ Created Queue: $QUEUE_NAME"
echo ""

# Generate .env.production file
echo "📝 Generating .env.production file..."
cat > .env.production << EOF
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID
CLOUDFLARE_API_TOKEN=<YOUR_API_TOKEN>

# D1 Database
D1_DATABASE_ID=$D1_DATABASE_ID

# R2 Buckets
R2_DOCUMENTS_BUCKET=sdlc-documents
R2_EMBEDDINGS_BUCKET=sdlc-embeddings
R2_AUDIT_LOGS_BUCKET=sdlc-audit-logs
R2_BACKUPS_BUCKET=sdlc-backups

# KV Namespaces (Get IDs from: wrangler kv:namespace list)
KV_CACHE_ID=<GET_FROM_WRANGLER>
KV_SESSIONS_ID=<GET_FROM_WRANGLER>
KV_RATE_LIMITS_ID=<GET_FROM_WRANGLER>
KV_CONFIG_ID=<GET_FROM_WRANGLER>

# Vectorize
VECTORIZE_INDEX_ID=$VECTORIZE_INDEX

# Queue
QUEUE_NAME=$QUEUE_NAME

# AI Services
OPENAI_API_KEY=<YOUR_OPENAI_KEY>
ANTHROPIC_API_KEY=<YOUR_ANTHROPIC_KEY>

# Authentication
JWT_SECRET=<GENERATE_RANDOM_SECRET>
JWT_EXPIRY=24h

# Application
NODE_ENV=production
LOG_LEVEL=info
EOF

echo "✅ Created .env.production file"
echo ""

# Get KV namespace IDs
echo "📋 Fetching KV Namespace IDs..."
wrangler kv:namespace list

echo ""
echo "✅ Infrastructure setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update .env.production with your API keys"
echo "2. Get KV namespace IDs from the list above and update .env.production"
echo "3. Run database migrations: npm run db:migrate"
echo "4. Deploy services: npm run deploy:production"
echo ""
echo "📚 Documentation: https://docs.sdlc.ai/setup"
