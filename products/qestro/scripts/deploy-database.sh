#!/bin/bash

# Database deployment script for Questro platform
# Applies the complete schema to D1 database

set -e

echo "🚀 Starting database deployment for Questro platform..."

DB_NAME="upm-plus-config"
SCHEMA_FILE="scripts/create-complete-schema.sql"

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Schema file not found: $SCHEMA_FILE"
    exit 1
fi

echo "📋 Applying database schema from $SCHEMA_FILE to $DB_NAME..."

# Apply the schema using wrangler
npx wrangler d1 execute $DB_NAME --file=$SCHEMA_FILE --remote

echo "✅ Database schema applied successfully!"
echo "🔍 Verifying database structure..."

# List tables to verify
npx wrangler d1 execute $DB_NAME --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --remote

echo "🎉 Database deployment completed!"
