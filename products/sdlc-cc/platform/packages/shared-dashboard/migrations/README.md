# AutoBoot Database Migrations

This directory contains D1 database migrations for the AutoBoot unified dashboard.

## Files

### Migration Files (Run in Order)

1. **0001_create_users_table.sql** - Users table with OAuth support
   - Stores user accounts (email/password + OAuth)
   - Supports Google and GitHub OAuth
   - Role-based access control (admin, user, viewer)
   - Organization membership

2. **0002_create_sessions_table.sql** - Session management
   - JWT session tracking
   - IP address and user agent logging
   - Session expiration and activity tracking

3. **0003_create_api_keys_table.sql** - API key management
   - User-scoped API keys
   - Rate limiting per key
   - Scoped permissions
   - Key expiration

4. **0004_create_organizations_table.sql** - Multi-tenancy support
   - Organization management
   - Subscription plans (free, pro, enterprise)
   - LemonSqueezy integration
   - Trial period tracking

5. **0005_create_audit_logs_table.sql** - Audit logging
   - Security and compliance tracking
   - Action history
   - Resource access logs
   - IP address tracking

### Reference Files

- **schema.sql** - Complete database schema for reference
  - Contains all tables in one file
  - Useful for understanding full schema
  - Not used for migrations (use 000X files instead)

## Running Migrations

### Production

```bash
npm run db:migrate
```

This runs all migrations against the production D1 database.

### Development

```bash
npm run db:migrate:dev
```

This runs migrations against the development database.

### Manual Migration

```bash
# Run script directly
bash ./scripts/migrate.sh production

# Or for development
bash ./scripts/migrate.sh development
```

## Testing Migrations

Playwright tests validate that:
- All migration files exist
- Migration script is executable
- Database schema is correct
- All tables and indexes are created

```bash
npm run test:e2e -- database-migrations.spec.ts
```

## Migration Script Details

The `scripts/migrate.sh` script:
1. Checks for Wrangler CLI
2. Validates environment
3. Runs migrations in order (0001 → 0005)
4. Shows database tables after completion
5. Provides colored output for status

## Database Schema

### Tables Created

- `dashboard_users` - User accounts and authentication
- `dashboard_organizations` - Multi-tenant organizations
- `dashboard_sessions` - Active user sessions
- `dashboard_api_keys` - API keys for programmatic access
- `dashboard_audit_logs` - Audit trail for compliance

### Indexes Created

Performance indexes are automatically created for:
- Email lookups
- OAuth provider searches
- Token validation
- Session expiration checks
- Organization membership
- Audit log queries

### Triggers Created

Auto-update triggers for:
- `updated_at` timestamps
- `last_activity_at` on sessions

## Schema Design

### Users Table
- Supports both email/password and OAuth authentication
- Unique constraint on (oauth_provider, oauth_id)
- Role-based permissions with JSON array
- Email verification status

### Sessions Table
- Links to users via foreign key
- Tracks IP address and user agent
- Auto-expires with timestamp
- Token hash for security

### API Keys Table
- Scoped permissions (JSON array)
- Rate limiting per hour
- Optional expiration
- Key prefix for display (ab_12345678...)

### Organizations Table
- Owner relationship to users
- Subscription management
- LemonSqueezy integration fields
- Trial period support

### Audit Logs Table
- Tracks all user actions
- Resource-level logging
- Status tracking (success/failure/warning)
- Retention for compliance

## Adding New Migrations

1. Create a new file: `0006_description.sql`
2. Add your SQL DDL statements
3. Run the migration script
4. Update this README

## Rollback

D1 doesn't support automatic rollbacks. To rollback:
1. Create a new migration that reverses changes
2. Run the new migration

## Best Practices

- Always use `IF NOT EXISTS` for CREATE statements
- Add indexes for foreign keys
- Use CHECK constraints for enums
- Set default values where appropriate
- Document complex constraints

## Support

For migration issues:
1. Check Wrangler logs: `wrangler tail --env production`
2. Validate schema: `wrangler d1 execute DB_NAME --command "PRAGMA table_info(table_name)"`
3. Review audit logs in the database
