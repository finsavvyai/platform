#!/bin/bash

# AutoBoot Database Migration Script
# Runs D1 migrations for the unified dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🗄️  AutoBoot Database Migration"
echo "================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found!"
    echo "Please install it: npm install -g wrangler"
    exit 1
fi

print_success "Wrangler CLI found"
echo ""

# Get environment
ENV=${1:-production}
print_info "Environment: $ENV"
echo ""

# Database name based on environment
if [ "$ENV" = "production" ]; then
    DB_NAME="unified-dashboard-prod"
elif [ "$ENV" = "development" ]; then
    DB_NAME="unified-dashboard-dev"
else
    print_error "Invalid environment. Use 'production' or 'development'"
    exit 1
fi

print_info "Database: $DB_NAME"
echo ""

# Get the migrations directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    print_error "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

print_success "Found migrations directory"
echo ""

# Run migrations in order
print_info "Running migrations..."
echo ""

for migration in "$MIGRATIONS_DIR"/0*.sql; do
    if [ -f "$migration" ]; then
        MIGRATION_NAME=$(basename "$migration")
        print_info "Applying: $MIGRATION_NAME"

        if wrangler d1 execute "$DB_NAME" --file="$migration" --env="$ENV"; then
            print_success "Applied: $MIGRATION_NAME"
        else
            print_error "Failed to apply: $MIGRATION_NAME"
            exit 1
        fi
        echo ""
    fi
done

print_success "All migrations completed successfully! 🎉"
echo ""

# Show table info
print_info "Database tables:"
wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --env="$ENV"

echo ""
print_info "Migration complete!"
echo ""
