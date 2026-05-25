# Utility Scripts

General utility and maintenance scripts for the Questro project.

## Available Scripts

### System Validation
- **`validate-env.sh`** - Validate environment configuration
- **`validate-production.sh`** - Validate production setup
- **`status.sh`** - Check overall system status

### Code Maintenance
- **`fix-imports.sh`** - Fix import statements in code
- **`cleanup-docs.sh`** - Clean up documentation files

### Marketing and Launch
- **`marketing-launch.sh`** - Marketing and launch utilities

## Usage Examples

### Environment Validation
```bash
# Validate local environment
./scripts/utilities/validate-env.sh

# Validate production setup
./scripts/utilities/validate-production.sh

# Check system status
./scripts/utilities/status.sh
```

### Code Maintenance
```bash
# Fix import statements
./scripts/utilities/fix-imports.sh

# Clean up documentation
./scripts/utilities/cleanup-docs.sh
```

### Marketing Tools
```bash
# Run marketing utilities
./scripts/utilities/marketing-launch.sh
```

## Validation Scripts

### Environment Validation (`validate-env.sh`)
Checks for:
- Required environment variables
- Service connectivity
- Database access
- API key validity
- Port availability

### Production Validation (`validate-production.sh`)
Verifies:
- Production environment configuration
- SSL certificate validity
- Domain configuration
- Service health
- Performance benchmarks

### System Status (`status.sh`)
Reports on:
- Service status (running/stopped)
- Resource usage (CPU, memory, disk)
- Database connections
- Cache status
- Recent errors

## Maintenance Scripts

### Import Fixer (`fix-imports.sh`)
- Fixes TypeScript import paths
- Updates relative imports to absolute
- Resolves circular dependencies
- Standardizes import formatting

### Documentation Cleanup (`cleanup-docs.sh`)
- Removes outdated documentation
- Fixes broken links
- Standardizes formatting
- Updates table of contents

## Marketing Tools (`marketing-launch.sh`)

### Features
- Generate marketing assets
- Update social media content
- Create launch announcements
- Prepare press releases

### Usage
```bash
# Generate all marketing materials
./scripts/utilities/marketing-launch.sh --all

# Generate specific assets
./scripts/utilities/marketing-launch.sh --social
./scripts/utilities/marketing-launch.sh --press
```

## System Monitoring

### Health Checks
```bash
# Quick health check
./scripts/utilities/status.sh --quick

# Detailed system report
./scripts/utilities/status.sh --detailed

# Continuous monitoring
./scripts/utilities/status.sh --watch
```

### Performance Monitoring
- Response time measurements
- Resource utilization tracking
- Database performance metrics
- Cache hit rates

### Error Detection
- Application error scanning
- Log analysis
- Performance anomaly detection
- Security event monitoring

## Automation

### Scheduled Tasks
These utilities can be scheduled with cron:
```bash
# Daily environment validation
0 6 * * * /path/to/questro/scripts/utilities/validate-env.sh

# Hourly status check
0 * * * * /path/to/questro/scripts/utilities/status.sh --log

# Weekly cleanup
0 0 * * 0 /path/to/questro/scripts/utilities/cleanup-docs.sh
```

### CI/CD Integration
- Pre-deployment validation
- Post-deployment verification
- Automated maintenance tasks
- Performance regression detection

## Configuration

### Environment Variables
```bash
# Validation settings
VALIDATION_STRICT=true
VALIDATION_TIMEOUT=30

# Status reporting
STATUS_FORMAT=json
STATUS_INCLUDE_METRICS=true

# Cleanup settings
CLEANUP_DRY_RUN=false
CLEANUP_BACKUP=true
```

### Logging
- Structured JSON logging
- Configurable log levels
- Automatic log rotation
- Error aggregation

## Troubleshooting

### Common Issues

#### Validation Failures
```bash
# Check specific validation
./scripts/utilities/validate-env.sh --verbose

# Fix common issues
./scripts/utilities/validate-env.sh --fix
```

#### Status Check Errors
```bash
# Debug status issues
DEBUG=true ./scripts/utilities/status.sh

# Check individual services
./scripts/utilities/status.sh --service backend
```

#### Import Fixing Issues
```bash
# Dry run to see changes
./scripts/utilities/fix-imports.sh --dry-run

# Fix specific directory
./scripts/utilities/fix-imports.sh --path src/components
```

### Recovery Procedures
- Backup before running maintenance scripts
- Test in development environment first
- Monitor system after running utilities
- Keep rollback procedures ready

## Best Practices

### Regular Maintenance
- Run validation scripts daily
- Monitor system status continuously
- Clean up documentation weekly
- Update marketing materials monthly

### Error Handling
- Always check script exit codes
- Log all utility operations
- Provide clear error messages
- Include recovery suggestions

### Performance
- Cache validation results
- Use parallel processing where possible
- Optimize for common use cases
- Monitor script execution time