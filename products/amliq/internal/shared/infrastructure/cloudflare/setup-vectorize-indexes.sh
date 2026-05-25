#!/bin/bash

# Cloudflare Vectorize Index Setup Script
# This script provisions Vectorize indexes for the RAG system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vectorize index configuration
INDEXES=(
    "fintech-rag-index:Primary RAG index for financial documents and knowledge base"
    "fintech-document-index:Document index for transaction descriptions and merchant data"
)

# Model configuration
EMBEDDING_MODEL="@cf/baai/bge-base-en-v1.5"
DIMENSIONS=768
DISTANCE_METRIC="cosine"

echo -e "${BLUE}🔍 Setting up Cloudflare Vectorize indexes for FinTech Suite RAG system...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Function to create Vectorize index if it doesn't exist
create_vectorize_index() {
    local index_name="$1"
    local index_description="$2"

    echo -e "${YELLOW}🔍 Creating Vectorize index: ${index_name}${NC}"

    # Check if index already exists
    if wrangler vectorize list --json | grep -q "\"name\":\"${index_name}\""; then
        echo -e "${GREEN}✅ Vectorize index ${index_name} already exists${NC}"
        return 0
    fi

    # Create the index
    wrangler vectorize create "${index_name}" \
        --dimensions="${DIMENSIONS}" \
        --distance-metric="${DISTANCE_METRIC}" || {
        echo -e "${RED}❌ Failed to create Vectorize index ${index_name}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully created Vectorize index: ${index_name}${NC}"
    echo -e "   ${index_description}"
    echo -e "   Dimensions: ${DIMENSIONS}"
    echo -e "   Distance Metric: ${DISTANCE_METRIC}"
    echo -e "   Embedding Model: ${EMBEDDING_MODEL}"
    echo ""
}

# Create all indexes
for index_info in "${INDEXES[@]}"; do
    IFS=':' read -r index_name index_description <<< "$index_info"
    create_vectorize_index "$index_name" "$index_description"
done

# List all indexes after creation
echo -e "${BLUE}📋 Current Vectorize indexes:${NC}"
wrangler vectorize list

echo -e "${GREEN}🎉 Vectorize index setup completed!${NC}"
echo -e "${YELLOW}📝 Note: Update your wrangler.toml with the correct index IDs returned by the creation commands.${NC}"

# Create index configuration documentation
echo -e "${BLUE}📚 Creating index configuration documentation...${NC}"

cat > infrastructure/vectorize-index-config.md << 'EOF'
# Vectorize Index Configuration

## Primary RAG Index (fintech-rag-index)

**Purpose**: Primary knowledge base for financial documents, regulations, and policies
- **Dimensions**: 768 (BGE-base-en-v1.5)
- **Distance Metric**: Cosine similarity
- **Use Cases**:
  - Financial regulation queries
  - Compliance policy searches
  - Best practices and guidelines
  - Risk assessment procedures

**Document Types**:
- Regulatory documents (SEC filings, Federal Register)
- Compliance policies and procedures
- Risk management frameworks
- Best practices documentation
- Industry guidelines and standards

**Metadata Schema**:
```json
{
  "document_id": "string",
  "title": "string",
  "source": "string",
  "jurisdiction": "US|EU|GLOBAL",
  "category": "regulation|policy|case_law|market_data|best_practice",
  "priority": "high|medium|low",
  "last_updated": "ISO 8601 date",
  "content_hash": "string",
  "classification": "public|internal|confidential|restricted"
}
```

## Document Index (fintech-document-index)

**Purpose**: Transaction and merchant data for semantic search and categorization
- **Dimensions**: 768 (BGE-base-en-v1.5)
- **Distance Metric**: Cosine similarity
- **Use Cases**:
  - Transaction description similarity
  - Merchant categorization
  - Duplicate transaction detection
  - Pattern recognition

**Document Types**:
- Transaction descriptions
- Merchant names and descriptions
- Category mappings
- Historical transaction patterns

**Metadata Schema**:
```json
{
  "transaction_id": "string",
  "organization_id": "string",
  "description": "string",
  "merchant_name": "string",
  "category": "string",
  "subcategory": "string",
  "amount_cents": "integer",
  "currency": "string",
  "date": "ISO 8601 date",
  "confidence_score": "float (0-1)"
}
```

## Index Usage Patterns

### Query Patterns
1. **Semantic Search**: Use natural language queries to find relevant documents
2. **Hybrid Search**: Combine keyword search with vector similarity
3. **Filtering**: Apply metadata filters for jurisdiction, category, or classification
4. **Personalization**: Include user context and organization-specific data

### Performance Considerations
- **Batch Size**: Process documents in batches of 100-500 for optimal performance
- **Indexing Strategy**: Use separate indexes for different data types
- **Caching**: Cache frequent queries to reduce API calls
- **Monitoring**: Track search accuracy and performance metrics

### Scaling Strategy
1. **Initial Index**: Start with essential documents and regulations
2. **Iterative Expansion**: Add more data sources over time
3. **Quality Control**: Implement human review for critical data
4. **Continuous Learning**: Update embeddings based on user feedback
EOF

echo -e "${GREEN}✅ Vectorize index documentation created: infrastructure/vectorize-index-config.md${NC}"
