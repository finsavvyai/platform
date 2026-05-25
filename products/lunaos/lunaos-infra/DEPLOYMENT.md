# Deployment Runbook

## Environments
- development
- staging
- production

## Pre-deploy Checks
1. CI is green.
2. DB migrations reviewed.
3. Secrets configured.
4. Rollback artifact ready.

## Deploy Steps
1. Build release artifact.
2. Deploy to staging and validate smoke tests.
3. Promote to production.
4. Verify health checks, logs, and metrics.

## Rollback
1. Re-deploy previous known-good artifact.
2. Restore previous configuration if needed.
3. Verify service health and data integrity.
