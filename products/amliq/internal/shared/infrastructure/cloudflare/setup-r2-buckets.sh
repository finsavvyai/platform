#!/bin/bash

# Cloudflare R2 Storage Setup Script
# This script provisions R2 buckets with lifecycle policies for the FinTech Suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Bucket configuration
BUCKETS=(
    "fintech-documents-storage:Document storage for invoices, KYC documents, and evidence"
    "fintech-backups-storage:Database backups and system backups"
    "fintech-evidence-storage:Compliance evidence and case evidence storage"
    "fintech-ai-models-storage:AI model files and training data"
)

echo -e "${BLUE}🪣 Setting up Cloudflare R2 buckets for FinTech Suite...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Function to create bucket if it doesn't exist
create_bucket() {
    local bucket_name="$1"
    local bucket_description="$2"

    echo -e "${YELLOW}🪣 Creating bucket: ${bucket_name}${NC}"

    # Create the bucket
    wrangler r2 bucket create "${bucket_name}" || {
        echo -e "${RED}❌ Failed to create bucket ${bucket_name}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully created bucket: ${bucket_name}${NC}"
    echo -e "   ${bucket_description}"
    echo ""
}

# Create all buckets
for bucket_info in "${BUCKETS[@]}"; do
    IFS=':' read -r bucket_name bucket_description <<< "$bucket_info"
    create_bucket "$bucket_name" "$bucket_description"
done

# List all buckets after creation
echo -e "${BLUE}📋 Current R2 buckets:${NC}"
wrangler r2 bucket list

echo -e "${GREEN}🎉 R2 bucket setup completed!${NC}"

# Create lifecycle policy configuration file
echo -e "${BLUE}⚙️  Creating lifecycle policy configurations...${NC}"

# Documents bucket lifecycle policy
cat > infrastructure/cloudflare/lifecycle-documents.json << 'EOF'
{
  "Rules": [
    {
      "ID": "DocumentLifecycleRule",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
EOF

# Backups bucket lifecycle policy
cat > infrastructure/cloudflare/lifecycle-backups.json << 'EOF'
{
  "Rules": [
    {
      "ID": "BackupLifecycleRule",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Transitions": [
        {
          "Days": 7,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 90,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
EOF

# Evidence bucket lifecycle policy (longer retention for compliance)
cat > infrastructure/cloudflare/lifecycle-evidence.json << 'EOF'
{
  "Rules": [
    {
      "ID": "EvidenceLifecycleRule",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Transitions": [
        {
          "Days": 365,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 1825,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 3650
      }
    }
  ]
}
EOF

# AI Models bucket lifecycle policy
cat > infrastructure/cloudflare/lifecycle-ai-models.json << 'EOF'
{
  "Rules": [
    {
      "ID": "AIModelsLifecycleRule",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 1825
      }
    }
  ]
}
EOF

echo -e "${GREEN}✅ Lifecycle policy configurations created in infrastructure/cloudflare/${NC}"
echo -e "${YELLOW}📝 Note: Apply these policies manually through the Cloudflare Dashboard or using AWS CLI-compatible tools.${NC}"
