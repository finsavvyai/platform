# SDLC.ai Production Deployment Orchestrator

## Overview

The Production Deployment Orchestrator is a comprehensive, automated deployment pipeline that orchestrates the transition from development to production environments. It provides automated validation, sequential deployment, health verification, and automatic rollback capabilities.

## Features

- **Automated Pre-Deployment Validation**: Validates all prerequisites before deployment
- **Configuration Management**: Flexible configuration via files or environment variables
- **State Management**: Tracks deployment progress and maintains state
- **Colored Logging**: Rich console output with color-coded messages
- **Dry Run Mode**: Test deployments without making changes
- **Automatic Rollback**: Reverts failed deployments automatically
- **Phase-Based Execution**: Organized deployment in sequential phases
- **Audit Trail**: Complete logging of all deployment activities

## Installation

```bash
cd deployments/production
npm install
```

## Usage

### Basic Deployment

```bash
# Deploy to development environment
node deploy-orchestrator.js --environment development

# Deploy to staging environment
node deploy-orchestrator.js --environment staging

# Deploy to production environment
node deploy-orchestrator.js --environment production
```

### Advanced Options

```bash
# Dry run (simulate without making changes)
node deploy-orchestrator.js --environment production --dry-run

# Skip specific steps
node deploy-orchestrator.js --environment staging --skip-steps health-check,benchmarking

# Disable automatic rollback
node deploy-orchestrator.js --environment production --no-rollback

# Use custom configuration file
node deploy-orchestrator.js --config ./custom-config.json
```

### NPM Scripts

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod

# Dry run
npm run deploy:dry-run
```

## Configuration

### Environment Variables

The orchestrator uses the following environment variables:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CUSTOM_DOMAIN`: Optional custom domain for deployment

### Configuration File

You can provide a custom configuration file in JSON format:

```json
{
  "environment": "production",
  "region": "auto",
  "accountId": "your-account-id",
  "apiToken": "your-api-token",
  "customDomain": "api.example.com",
  "enableSSL": true,
  "services": [
    {
      "name": "gateway",
      "path": "./services/gateway",
      "healthCheck": "/api/health"
    }
  ]
}
```

## Deployment Phases

The orchestrator executes the following phases in order:

1. **Pre-Deployment Validation**: Validates prerequisites and configuration
2. **Infrastructure Provisioning**: Creates Cloudflare resources (D1, R2, KV, Vectorize, Queues)
3. **Secret Management**: Securely stores API keys and credentials
4. **Service Deployment**: Deploys Workers services in dependency order
5. **Database Migration**: Applies database schema migrations
6. **Policy Loading**: Loads compliance policies (HIPAA, GDPR, PCI DSS, FINRA)
7. **Health Check**: Verifies all services are operational
8. **Performance Benchmarking**: Measures deployment performance
9. **Documentation Generation**: Generates deployment documentation
10. **Audit Trail Recording**: Records deployment activities

## State Management

The orchestrator maintains deployment state in `.deployment-state/` directory:

- Tracks deployment progress
- Records completed phases
- Stores resource IDs
- Enables recovery on failure
- Maintains deployment history

## Logging

### Log Levels

- **DEBUG**: Detailed execution information (development only)
- **INFO**: Phase completion and progress (development and staging)
- **WARN**: Non-critical issues (all environments)
- **ERROR**: Failures requiring attention (all environments)

### Log Files

Logs are written to `logs/deployment-{timestamp}.log` with:

- Timestamp for each entry
- Log level indicator
- Detailed message
- Error stack traces (when applicable)

### Console Output

The orchestrator provides rich console output with:

- Color-coded messages (success=green, error=red, warning=yellow, info=cyan)
- Progress indicators
- Phase headers
- Summary tables

## Error Handling

### Automatic Rollback

When a deployment fails, the orchestrator automatically:

1. Detects the failure point
2. Initiates rollback procedures
3. Restores previous Worker versions
4. Restores database backups
5. Restores previous policies
6. Verifies system stability

### Manual Rollback

You can disable automatic rollback with `--no-rollback` flag and handle rollback manually.

## Command-Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--environment` | `-e` | Deployment environment (development\|staging\|production) | development |
| `--config` | `-c` | Path to configuration file | None |
| `--dry-run` | - | Simulate deployment without changes | false |
| `--skip-steps` | - | Comma-separated list of steps to skip | [] |
| `--no-rollback` | - | Disable automatic rollback | false |
| `--help` | `-h` | Show help message | - |

## Examples

### Development Deployment

```bash
node deploy-orchestrator.js --environment development
```

### Staging Deployment with Dry Run

```bash
node deploy-orchestrator.js --environment staging --dry-run
```

### Production Deployment with Custom Config

```bash
node deploy-orchestrator.js \
  --environment production \
  --config ./prod-config.json
```

### Skip Health Checks and Benchmarking

```bash
node deploy-orchestrator.js \
  --environment staging \
  --skip-steps health-check,performance-benchmarking
```

## Architecture

```
deploy-orchestrator.js          # Main entry point
├── lib/
│   ├── cli-parser.js          # Command-line argument parser
│   ├── config-parser.js       # Configuration file parser
│   ├── state-manager.js       # Deployment state management
│   └── logger.js              # Logging and output formatting
├── .deployment-state/         # Deployment state storage
│   ├── development.json
│   ├── staging.json
│   └── production.json
└── logs/                      # Deployment logs
    └── deployment-*.log
```

## Requirements

- Node.js >= 18.0.0
- Wrangler CLI >= 3.0.0
- Cloudflare account with appropriate permissions

## Security

- Secrets are never logged or displayed
- API tokens are stored securely using Wrangler
- Audit trail maintained for all deployments
- TLS 1.3 enforced for all connections

## Troubleshooting

### Deployment Fails at Validation

Check that:
- Wrangler CLI is installed and up to date
- Node.js version is 18 or higher
- Environment variables are set correctly
- Cloudflare authentication is valid

### Service Deployment Fails

Check that:
- Service paths are correct
- Dependencies are installed
- Build process completes successfully
- Cloudflare account has sufficient resources

### Health Check Fails

Check that:
- Services are deployed successfully
- Health check endpoints are correct
- Network connectivity is available
- Services have started properly

## Support

For issues or questions:
1. Check the deployment logs in `logs/` directory
2. Review the deployment state in `.deployment-state/`
3. Run with `--dry-run` to test without changes
4. Consult the main project documentation

## License

MIT
