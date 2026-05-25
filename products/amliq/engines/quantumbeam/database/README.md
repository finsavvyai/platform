# QuantumBeam.io Database Setup

This directory contains all database-related configurations, schemas, and maintenance scripts for the QuantumBeam.io platform.

## Overview

The database architecture includes:
- **PostgreSQL 16** with time-based partitioning for high-volume transaction data
- **PgBouncer** for connection pooling and performance optimization
- **Redis** for caching and session storage
- **InfluxDB** for time-series metrics
- **Elasticsearch** for search and analytics
- **ClickHouse** for analytical data warehousing

## Directory Structure

```
database/
├── config/                     # Configuration files
│   ├── postgresql.conf        # PostgreSQL configuration
│   ├── pgbouncer.ini          # PgBouncer configuration
│   └── userlist.txt           # PgBouncer user authentication
├── schemas/                    # Database schema files
│   └── 001_initial_schema.sql # Initial database schema
├── seeds/                      # Seed data files
│   └── 001_initial_seed_data.sql # Initial seed data
├── extensions/                 # PostgreSQL extensions
│   └── 001_install_extensions.sql # Extension installation script
├── migrations/                 # Migration files (auto-generated)
└── scripts/                    # Utility scripts
    ├── init-databases.sh      # Database initialization
    ├── migrate.sh             # Migration runner
    ├── partition-maintenance.sh # Partition maintenance
    └── test-database.sh       # Database testing
```

## Quick Start

### 1. Initialize the Database

```bash
# Copy environment configuration
cp .env.example .env

# Start database services
make db-up

# Run migrations and seed data
make init
```

### 2. Verify Setup

```bash
# Run comprehensive tests
make test-connection
./scripts/test-database.sh

# Check database status
make db-status
```

### 3. Connect to Database

```bash
# Connect directly to PostgreSQL
make db-shell

# Connect via PgBouncer
make db-shell-pgbouncer
```

## Database Schema

### Core Tables

1. **organizations** - Organization/tenant data
2. **users** - User accounts and authentication
3. **api_keys** - API key management
4. **transactions** - Financial transactions (partitioned by month)
5. **fraud_rules** - Fraud detection rules
6. **quantum_models** - Quantum model configurations
7. **audit_log** - Audit trail (partitioned by timestamp)

### Partitioning Strategy

- **transactions**: Monthly partitions with 12-month retention
- **audit_log**: Monthly partitions with 24-month retention
- Automatic partition creation and cleanup scheduled via pg_cron

### Security Features

- Row Level Security (RLS) enabled on sensitive tables
- Multi-tenant isolation
- Audit logging for all DML operations
- Encrypted password storage
- API key authentication

## Performance Optimizations

### PostgreSQL Configuration

- **shared_buffers**: 256MB (adjust based on RAM)
- **effective_cache_size**: 1GB
- **work_mem**: 4MB per query
- **maintenance_work_mem**: 64MB
- **checkpoint_completion_target**: 0.9
- Connection pooling with PgBouncer

### Indexes

- Primary keys on all tables
- Foreign key indexes
- B-tree indexes on frequently queried columns
- GIN indexes on JSONB fields
- BRIN indexes on time-series data
- Trigram indexes for text search

### Partitioning Benefits

- Improved query performance through partition pruning
- Efficient maintenance operations
- Parallel query execution
- Easier backup and archival

## Migration Management

### Using Migrate Script

```bash
# Apply all pending migrations
./scripts/migrate.sh up

# Rollback last migration
./scripts/migrate.sh down

# Create new migration
./scripts/migrate.sh create add_new_table

# Check migration status
./scripts/migrate.sh status

# Reset all migrations (destructive)
./scripts/migrate.sh reset
```

### Using Makefile

```bash
# Run migrations
make db-migrate

# Create migration
make db-migrate-create NAME=add_feature

# Rollback migration
make db-migrate-down
```

## Maintenance Operations

### Partition Management

```bash
# Create new partitions
./scripts/partition-maintenance.sh create-monthly transactions 3

# Drop old partitions
./scripts/partition-maintenance.sh drop-old transactions 12

# Check partition health
./scripts/partition-maintenance.sh health transactions

# Run full maintenance
./scripts/partition-maintenance.sh maintenance-all
```

### Database Maintenance

```bash
# Update statistics
make db-analyze

# Reindex tables
make db-reindex

# Vacuum and analyze
make db-vacuum
```

### Backup and Restore

```bash
# Create backup
make db-backup NAME=backup-name

# Restore from backup
make db-restore FILE=backup.sql

# Production backup
make prod-backup
```

## Monitoring

### Connection Monitoring

```bash
# Check active connections
make monitor-connections

# Check PgBouncer stats
./scripts/migrate.sh status
```

### Performance Monitoring

```bash
# Check table sizes
make monitor-sizes

# Check slow queries
make monitor-queries

# Run performance tests
make test-performance
```

### Health Checks

```bash
# Comprehensive health check
make health-check

# Test connectivity
make test-connection
```

## Testing

### Database Tests

```bash
# Run comprehensive database tests
./scripts/test-database.sh

# Test migration rollback
make test-migration

# Benchmark performance
make benchmark-db
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=quantumbeam

# PgBouncer
PGBOUNCER_PORT=6432
USE_PGBOUNCER=true

# Partitions
DEFAULT_RETENTION_MONTHS=12
AUTO_PARTITION_CREATE=true
```

### PostgreSQL Tuning

Edit `database/config/postgresql.conf` to adjust:
- Memory settings
- Checkpoint configuration
- WAL settings
- Connection limits
- Query planner parameters

### PgBouncer Tuning

Edit `database/config/pgbouncer.ini` to adjust:
- Pool mode (transaction/session/statement)
- Pool sizes
- Connection limits
- Timeout settings

## Security Best Practices

1. **Authentication**
   - Use strong passwords
   - Rotate API keys regularly
   - Enable MFA for admin users

2. **Network Security**
   - Use SSL/TLS connections
   - Restrict access by IP
   - Enable PgBouncer authentication

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use column-level encryption for PII
   - Regular security audits

4. **Access Control**
   - Principle of least privilege
   - Role-based access control
   - Regular permission reviews

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check logs
   make db-logs
   ```

2. **Migration Fails**
   ```bash
   # Check migration status
   ./scripts/migrate.sh status
   
   # Force version if needed
   ./scripts/migrate.sh force <version>
   ```

3. **Slow Queries**
   ```bash
   # Check slow queries
   make monitor-queries
   
   # Update statistics
   make db-analyze
   ```

4. **PgBouncer Issues**
   ```bash
   # Check PgBouncer logs
   make db-logs-pgbouncer
   
   # Reset connections
   docker-compose restart pgbouncer
   ```

### Performance Tips

1. **Monitoring**
   - Regularly check `pg_stat_statements`
   - Monitor index usage
   - Track query performance

2. **Optimization**
   - Use EXPLAIN ANALYZE for slow queries
   - Consider partition pruning
   - Optimize connection pooling

3. **Maintenance**
   - Regular VACUUM and ANALYZE
   - Monitor bloat
   - Rebuild indexes when needed

## Development Workflow

1. **Setup**
   ```bash
   # Initialize development environment
   make dev-setup
   ```

2. **Schema Changes**
   ```bash
   # Create migration
   make db-migrate-create NAME=add_new_feature
   
   # Edit migration file
   # Apply migration
   make db-migrate
   ```

3. **Testing**
   ```bash
   # Test changes
   make test-db
   
   # Verify connectivity
   make test-connection
   ```

4. **Reset**
   ```bash
   # Reset development database
   make dev-reset
   ```

## Production Deployment

### Pre-deployment Checklist

- [ ] Review and optimize configuration
- [ ] Set up monitoring alerts
- [ ] Configure backup strategy
- [ ] Test failover procedures
- [ ] Document emergency procedures

### Deployment Steps

1. Configure production environment variables
2. Set up database in production
3. Run migrations with `make db-migrate`
4. Load seed data if needed
5. Verify all tests pass
6. Enable monitoring

## Support

For database-related issues:
1. Check logs in `./logs/`
2. Run health check with `make health-check`
3. Review troubleshooting section
4. Check monitoring dashboards

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [Partitioning Guide](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Performance Tuning Guide](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)