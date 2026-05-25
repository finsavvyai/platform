#!/bin/bash

# Storage Setup Script for Unified FinTech Suite
# Sets up KV namespaces, R2 buckets, and Vectorize indexes

set -e

echo "📦 Setting up Unified FinTech Suite Storage Services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️ Storage Deployment Started - $(date)${NC}"

# KV Namespaces
echo -e "\n${YELLOW}💾 Creating KV Namespaces...${NC}"

echo "Creating API Cache KV namespace..."
npx wrangler kv:namespace create API_CACHE --preview || echo "API_CACHE KV namespace already exists"

echo "Creating Sessions KV namespace..."
npx wrangler kv:namespace create SESSIONS --preview || echo "SESSIONS KV namespace already exists"

echo "Creating Agent Memory KV namespace..."
npx wrangler kv:namespace create AGENT_MEMORY --preview || echo "AGENT_MEMORY KV namespace already exists"

echo "Creating Rate Limits KV namespace..."
npx wrangler kv:namespace create RATE_LIMITS --preview || echo "RATE_LIMITS KV namespace already exists"

# R2 Buckets
echo -e "\n${BLUE}📁 Creating R2 Buckets...${NC}"

echo "Creating Documents bucket..."
npx wrangler r2 bucket create fintech-documents || echo "Documents bucket already exists"

echo "Creating Evidence bucket..."
npx wrangler r2 bucket create compliance-evidence || echo "Evidence bucket already exists"

echo "Creating Templates bucket..."
npx wrangler r2 bucket create billing-templates || echo "Templates bucket already exists"

# Vectorize Indexes
echo -e "\n${YELLOW}🧠 Creating Vectorize Indexes...${NC}"

echo "Creating RAG embeddings index..."
npx wrangler vectorize create fintech-rag-embeddings --dimensions=768 --metric=cosine || echo "RAG embeddings index already exists"

echo "Creating Document embeddings index..."
npx wrangler vectorize create fintech-doc-embeddings --dimensions=768 --metric=cosine || echo "Document embeddings index already exists"

# Get actual IDs
echo -e "\n${YELLOW}🔍 Retrieving Storage IDs...${NC}"

KV_CACHE_ID=$(npx wrangler kv:namespace list --output=json | jq -r '.[] | select(.title=="API_CACHE") | .id')
KV_SESSIONS_ID=$(npx wrangler kv:namespace list --output=json | jq -r '.[] | select(.title=="SESSIONS") | .id')
KV_AGENT_MEMORY_ID=$(npx wrangler kv:namespace list --output=json | jq -r '.[] | select(.title=="AGENT_MEMORY") | .id')
KV_RATE_LIMITS_ID=$(npx wrangler kv:namespace list --output=json | jq -r '.[] | select(.title=="RATE_LIMITS") | .id')

RAG_EMBEDDINGS_ID=$(npx wrangler vectorize list --output=json | jq -r '.[] | select(.name=="fintech-rag-embeddings") | .id')
DOC_EMBEDDINGS_ID=$(npx wrangler vectorize list --output=json | jq -r '.[] | select(.name=="fintech-doc-embeddings") | .id')

echo "Storage IDs retrieved:"
echo "KV Cache: $KV_CACHE_ID"
echo "KV Sessions: $KV_SESSIONS_ID"
echo "KV Agent Memory: $KV_AGENT_MEMORY_ID"
echo "KV Rate Limits: $KV_RATE_LIMITS_ID"
echo "Vectorize RAG: $RAG_EMBEDDINGS_ID"
echo "Vectorize Docs: $DOC_EMBEDDINGS_ID"

# Environment Variables Setup
echo -e "\n${YELLOW}⚙️ Setting up Environment Variables...${NC}"

echo "Creating environment variables for production deployment..."

cat > workers/.env.production << EOF
# Production Environment Variables
ENVIRONMENT=production
LOG_LEVEL=info
API_VERSION=v1
FRONTEND_URL=https://finsavvyai.com
API_BASE_URL=https://api.finsavvyai.com

# Storage IDs
KV_CACHE_ID=$KV_CACHE_ID
KV_SESSIONS_ID=$KV_SESSIONS_ID
KV_AGENT_MEMORY_ID=$KV_AGENT_MEMORY_ID
KV_RATE_LIMITS_ID=$KV_RATE_LIMITS_ID
RAG_EMBEDDINGS_ID=$RAG_EMBEDDINGS_ID
DOC_EMBEDDINGS_ID=$DOC_EMBEDDINGS_ID

# Security
CORS_ORIGINS=https://finsavvyai.com,https://app.finsavvyai.com,https://billing.finsavvyai.com
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000

# AI Configuration
AI_MODEL=@cf/meta/llama-3.1-8b-instruct
EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5
AI_TIMEOUT=30000

# Feature Flags
ENABLE_AI_INSIGHTS=true
ENABLE_RAG_SYSTEM=true
ENABLE_LEARNING_SYSTEM=true
ENABLE_COMPLIANCE_ANALYSIS=true
ENABLE_RISK_MONITORING=true
EOF

echo "Created workers/.env.production with production environment variables"

# Update wrangler.toml with actual IDs
echo -e "\n${YELLOW}📝 Updating wrangler.toml with actual storage IDs...${NC}"
sed -i.bak "s/id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/id = \"$KV_CACHE_ID\"/" workers/wrangler.production.toml
sed -i.bak "s/id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/id = \"$KV_SESSIONS_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/id = \"$KV_AGENT_MEMORY_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/id = \"$KV_RATE_LIMITS_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/index_name = \"fintech-rag-embeddings\"/index_name = \"fintech-rag-embeddings\"/; t" workers/wrangler.production.toml
sed -i.bak "s/index_name = \"fintech-doc-embeddings\"/index_name = \"fintech-doc-embeddings\"/; t" workers/wrangler.production.toml

echo -e "\n${GREEN}🎯 Storage Services Ready for Deployment${NC}"

# Storage Configuration Summary
echo -e "\n${BLUE}📊 Storage Configuration Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "KV Namespaces: 4 (Cache, Sessions, Agent Memory, Rate Limits)"
echo "R2 Buckets: 3 (Documents, Evidence, Templates)"
echo "Vectorize Indexes: 2 (RAG Embeddings, Document Embeddings)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${YELLOW}📋 Storage Setup Complete!${NC}"
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Review workers/.env.production configuration"
echo "2. Test KV storage functionality"
echo "3. Test R2 bucket access"
echo "4. Test Vectorize embeddings"
echo "5. Deploy to staging environment"

echo -e "\n${GREEN}✅ Storage Deployment Complete!${NC}"
