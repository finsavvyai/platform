# Supabase Database Migrations

This directory contains the database schema and migrations for the MCPOverflow platform.

## Migration Files

### Core Migrations

1. **20251102_001_initial_schema.sql** - Initial database schema with:
   - User profiles table
   - Connectors table
   - Jobs table
   - Usage metrics table
   - Job logs table
   - Connector versions table
   - API keys table
   - Row Level Security (RLS) policies
   - Database indexes

2. **20251102_002_database_functions.sql** - Core database functions:
   - User profile management
   - Connector CRUD operations
   - Job processing functions
   - Usage metrics recording
   - Dashboard analytics
   - Search functionality
   - API key management

3. **20251102_003_analytics_functions.sql** - Analytics and monitoring:
   - Connector usage analytics
   - Top performing connectors
   - Daily usage aggregation
   - Job performance metrics
   - System health monitoring
   - User activity summaries
   - Materialized views for performance

4. **20251102_004_triggers_constraints.sql** - Data integrity and automation:
   - Trigger functions for validation
   - Automatic data maintenance
   - Audit logging
   - JSON schema validation
   - Cleanup functions
   - Additional constraints

## Running Migrations

### Local Development

```bash
# Run all migrations
psql -h localhost -U postgres -d mcpoverflow -f supabase/migrate.sql

# Run specific migration
psql -h localhost -U postgres -d mcpoverflow -f supabase/migrations/20251102_001_initial_schema.sql
```

### Supabase CLI

```bash
# Apply migrations to Supabase project
supabase db push

# Generate types
supabase gen types typescript --local > src/types/database.ts

# Check migration status
supabase db diff
```

## Database Schema Overview

### Core Tables

#### `user_profiles`

- Extends Supabase auth.users
- Stores user preferences and profile information
- RLS: Users can only access their own profile

#### `connectors`

- Main entity for MCP connectors
- Links to OpenAPI specifications and generated manifests
- Supports versioning and public/private visibility
- RLS: Users can only access their own connectors + public ones

#### `jobs`

- Tracks generation, deployment, and test jobs
- Supports different job types and priorities
- Includes progress tracking and error handling
- RLS: Users can only access jobs for their connectors

#### `usage_metrics`

- Time-series data for connector performance
- Hourly aggregation of request counts and latency
- Used for analytics and monitoring
- RLS: Users can only access metrics for their connectors

#### `job_logs`

- Detailed logging for job execution
- Structured logs with different severity levels
- Supports debugging and auditing
- RLS: Users can only access logs for their jobs

### Security Features

- **Row Level Security (RLS)** on all tables
- **Audit logging** for sensitive operations
- **API key management** with secure hashing
- **Input validation** and JSON schema constraints
- **Automatic cleanup** functions for data retention

## Data Types

### Enums

- `connector_status`: draft, active, error
- `connector_runtime`: worker-ts, worker-go, download-only
- `auth_mode`: api_key, oauth_client, oauth_code, jwt, none
- `job_status`: pending, running, completed, failed
- `job_type`: generate, deploy, test
- `job_priority`: low, normal, high, critical

## Performance Optimization

### Indexes

- Primary keys and foreign keys
- Frequently queried columns (status, runtime, auth_mode)
- Date-based queries (created_at, date fields)
- Full-text search indexes (name, description)
- GIN indexes for JSON fields

### Materialized Views

- `connector_stats_mv`: Pre-computed connector statistics
- Refreshable for near real-time analytics

## Functions

### User Management

- `upsert_user_profile`: Create/update user profile
- `generate_api_key`: Create new API key with secure hashing
- `validate_api_key`: Validate API key authentication

### Connector Management

- `create_connector`: Create new connector with validation
- `update_connector_version`: Update connector and create version
- `search_connectors`: Full-text search with filtering

### Job Processing

- `create_generation_job`: Create new generation job
- `update_job_status`: Update job status with logging
- `estimate_job_duration`: Estimate job completion time

### Analytics

- `get_connector_analytics`: Time-series usage data
- `get_top_connectors`: Ranking by usage metrics
- `get_system_health_metrics`: System monitoring
- `get_user_dashboard_stats`: User dashboard summary

## Rollback Procedures

Each migration has corresponding rollback functions:

```sql
-- Rollback specific migration
SELECT public.rollback_20251102_004_triggers_constraints();

-- Clean up migration record
DELETE FROM public.schema_migrations WHERE filename = '20251102_004_triggers_constraints.sql';
```

## Migration Tracking

The `schema_migrations` table tracks:

- Migration filename
- File checksum (SHA-256)
- Execution timestamp
- Execution time in milliseconds

## Development Guidelines

1. **Always create rollback functions** for new migrations
2. **Use parameterized queries** in functions to prevent SQL injection
3. **Follow naming conventions**: `table_name_column_name`
4. **Add appropriate constraints** for data integrity
5. **Document complex logic** with comments
6. **Test RLS policies** thoroughly
7. **Use SECURITY DEFINER** for elevated privilege functions
8. **Include performance indexes** for new query patterns

## Monitoring

### Key Metrics to Monitor

- Query performance on usage_metrics table
- Job queue length and processing time
- API key usage and expiration
- Data growth in tables for cleanup planning
- RLS policy performance impact

### Health Checks

```sql
-- Check migration status
SELECT * FROM public.schema_migrations ORDER BY executed_at DESC;

-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries (requires pg_stat_statements)
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

## Backup and Restore

### Backup Schema

```bash
pg_dump -h localhost -U postgres -d mcpoverflow --schema-only > schema_backup.sql
```

### Backup Data

```bash
pg_dump -h localhost -U postgres -d mcpoverflow --data-only > data_backup.sql
```

### Restore

```bash
psql -h localhost -U postgres -d mcpoverflow < backup.sql
```

## Troubleshooting

### Common Issues

1. **RLS Policy Conflicts**: Check policy ordering and conflicts
2. **Migration Failures**: Check constraint violations and dependencies
3. **Performance Issues**: Review query plans and index usage
4. **Permission Errors**: Verify user roles and RLS policies

### Debug Queries

```sql
-- Check current user and role
SELECT current_user, session_user, current_setting('role', true);

-- Test RLS policies
SELECT * FROM public.connectors; -- Should respect RLS

-- Check function permissions
SELECT proname, pronamespace, prosecdef, proconfig
FROM pg_proc
WHERE proname LIKE '%user%';
```
