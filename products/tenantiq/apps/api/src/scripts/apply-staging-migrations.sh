#!/bin/bash
# Apply all D1 migrations to staging environment
# Prerequisites: Replace STAGING_D1_ID_PLACEHOLDER in wrangler.toml first
set -e
echo "Applying migrations to tenantiq-staging..."
npx wrangler d1 migrations apply tenantiq-staging --env staging
echo "Verifying tables..."
npx wrangler d1 execute tenantiq-staging --env staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
echo "Done."
