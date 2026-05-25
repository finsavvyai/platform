# Configuration System

QueryFlux uses a comprehensive configuration system built with [Viper](https://github.com/spf13/viper) that supports:

- Environment variable overrides
- YAML configuration files
- Environment-specific configurations
- Template variable substitution
- Configuration validation
- Secure defaults

## Configuration Files

The system looks for configuration files in the following order:

1. `config.yaml` - Default configuration
2. `config.{ENVIRONMENT}.yaml` - Environment-specific overrides
3. Environment variables - Final overrides

### Search Paths

Configuration files are searched in:
- Current directory (`./`)
- `./config/` directory
- `$HOME/.queryflux/` directory

## Environment Variables

All configuration can be overridden using environment variables with the `QUERYFLUX_` prefix:

```bash
# Server Configuration
QUERYFLUX_PORT=8080
QUERYFLUX_HOST=localhost
QUERYFLUX_LOG_LEVEL=info
QUERYFLUX_TIMEOUT=30s
QUERYFLUX_ENVIRONMENT=development
QUERYFLUX_DEBUG=true

# Database Configuration
QUERYFLUX_DATABASE_URL=postgres://localhost:5432/queryflux?sslmode=disable
QUERYFLUX_REDIS_URL=redis://localhost:6379
QUERYFLUX_DATABASE_POOL_SIZE=10
QUERYFLUX_DATABASE_TIMEOUT=30s

# JWT Configuration
QUERYFLUX_JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
QUERYFLUX_JWT_EXPIRATION=24h
QUERYFLUX_JWT_REFRESH_EXPIRY=168h
QUERYFLUX_JWT_ISSUER=queryflux

# AI Service Configuration
QUERYFLUX_OPENAI_API_KEY=your-openai-api-key
QUERYFLUX_CLAUDE_API_KEY=your-claude-api-key
QUERYFLUX_AI_TIMEOUT=60s
QUERYFLUX_AI_RATE_LIMIT_RPS=10
QUERYFLUX_AI_MODEL=gpt-4

# External Services
QUERYFLUX_LEMONSQUEEZY_API_KEY=your-lemonsqueezy-api-key
QUERYFLUX_LEMONSQUEEZY_STORE_ID=your-store-id
QUERYFLUX_LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# Security Configuration
QUERYFLUX_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
QUERYFLUX_RATE_LIMIT_RPS=100
QUERYFLUX_MAX_REQUEST_SIZE_MB=10
QUERYFLUX_ENABLE_REQUEST_LOGGING=true
```

## Template Variables

Configuration files support template variable substitution using `${VAR}` or `${VAR:default}` syntax:

```yaml
# config.yaml
DATABASE_URL: "${DATABASE_URL:postgres://localhost:5432/queryflux?sslmode=disable}"
REDIS_URL: "${REDIS_URL:redis://localhost:6379}"
JWT_SECRET: "${JWT_SECRET}"
OPENAI_API_KEY: "${OPENAI_API_KEY}"
CORS_ORIGINS:
  - "${CORS_ORIGIN:http://localhost:3000}"
  - "${CORS_ORIGIN:http://localhost:5173}"
```

## Environment-Specific Configurations

### Development (`config.development.yaml`)

```yaml
# Development-specific settings
PORT: "8080"
HOST: "localhost"
LOG_LEVEL: "debug"
DEBUG: true

# Relaxed security for development
CORS_ORIGINS:
  - "http://localhost:3000"
  - "http://localhost:5173"
  - "http://127.0.0.1:3000"
  - "http://127.0.0.1:5173"
RATE_LIMIT_RPS: 1000
```

### Production (`config.production.yaml`)

```yaml
# Production-specific settings
LOG_LEVEL: "info"
DEBUG: false

# Secure defaults
CORS_ORIGINS:
  - "https://queryflux.ai"
  - "https://www.queryflux.ai"
  - "https://app.queryflux.ai"

# Use environment variables for secrets
JWT_SECRET: "${JWT_SECRET}"
DATABASE_URL: "${DATABASE_URL}"
OPENAI_API_KEY: "${OPENAI_API_KEY}"
```

### Test (`config.test.yaml`)

```yaml
# Test environment settings
PORT: "8081"
LOG_LEVEL: "error"
DEBUG: false

# Test database
DATABASE_URL: "postgres://localhost:5432/queryflux_test?sslmode=disable"
REDIS_URL: "redis://localhost:6379/1"

# Short-lived tokens for testing
JWT_EXPIRATION: "5m"
JWT_REFRESH_EXPIRY: "1h"

# Mock settings
MOCK_EXTERNAL_SERVICES: true
SKIP_AUTHORIZATION: true
```

## Configuration Loading

### Basic Loading

```go
import "queryflux-backend/internal/config"

// Load configuration with environment detection
cfg, err := config.Load()
if err != nil {
    log.Fatalf("Failed to load configuration: %v", err)
}
```

### Loading with Template Support

```go
// Load configuration with template variable substitution
cfg, err := config.LoadWithTemplates()
if err != nil {
    log.Fatalf("Failed to load configuration: %v", err)
}
```

### Loading from Specific File

```go
// Load configuration from a specific file
cfg, err := config.LoadFromFile("/path/to/config.yaml")
if err != nil {
    log.Fatalf("Failed to load configuration: %v", err)
}
```

## Configuration Validation

The configuration system includes comprehensive validation:

- **Required fields**: JWT secret, database URL
- **Format validation**: Database URLs, Redis URLs, port numbers
- **Security validation**: JWT secret length (minimum 32 characters)
- **Environment validation**: Valid log levels, environment names
- **Production validation**: At least one AI provider required in production

## Utility Functions

```go
// Environment checks
if config.IsDevelopment(cfg) {
    // Development-specific logic
}

if config.IsProduction(cfg) {
    // Production-specific logic
}

// URL getters with fallbacks
dbURL := config.GetDatabaseURL(cfg)
redisURL := config.GetRedisURL(cfg)
jwtSecret := config.GetJWTSecret(cfg)

// AI provider checks
if config.HasAIProvider(cfg) {
    provider := config.GetPrimaryAIProvider(cfg)
    // Use primary AI provider
}
```

## Security Best Practices

### JWT Secret Management

```bash
# Generate a secure JWT secret
openssl rand -base64 32

# Set in environment
export QUERYFLUX_JWT_SECRET="your-generated-secret-here"
```

### Database Security

```yaml
# Use SSL in production
DATABASE_URL: "postgres://localhost:5432/queryflux?sslmode=require"

# Use connection pooling
DATABASE_POOL_SIZE: 20

# Set appropriate timeouts
DATABASE_TIMEOUT: "30s"
```

### AI API Keys

```bash
# Set AI provider keys
export QUERYFLUX_OPENAI_API_KEY="sk-..."
export QUERYFLUX_CLAUDE_API_KEY="sk-ant-..."
```

## Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your configuration:
   ```bash
   # Required minimum configuration
   QUERYFLUX_JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
   QUERYFLUX_DATABASE_URL="postgres://localhost:5432/queryflux_dev?sslmode=disable"
   ```

3. Run the application:
   ```bash
   go run cmd/server/main.go
   ```

## Production Deployment

1. Set environment variables:
   ```bash
   export QUERYFLUX_ENVIRONMENT=production
   export QUERYFLUX_JWT_SECRET="your-production-jwt-secret"
   export QUERYFLUX_DATABASE_URL="your-production-database-url"
   export QUERYFLUX_OPENAI_API_KEY="your-openai-api-key"
   ```

2. Use `config.production.yaml` for production-specific overrides

3. Ensure all required secrets are set as environment variables

## Testing

The configuration system includes comprehensive tests:

```bash
# Run configuration tests
go test ./internal/config/...

# Run with coverage
go test -cover ./internal/config/...
```

## Troubleshooting

### Common Issues

1. **"JWT_SECRET is required"**
   - Set `QUERYFLUX_JWT_SECRET` environment variable
   - Ensure it's at least 32 characters long

2. **"invalid DATABASE_URL"**
   - Check database URL format: `scheme://host:port/database`
   - Ensure scheme is included (postgres, mysql, mongodb, etc.)

3. **"at least one AI provider API key must be configured in production"**
   - Set either `QUERYFLUX_OPENAI_API_KEY` or `QUERYFLUX_CLAUDE_API_KEY`
   - Or both for fallback support

4. **"No config file found"**
   - Create `config.yaml` in the current directory
   - Or set environment variables instead of using config files

### Debug Mode

Enable debug mode to see configuration loading details:

```bash
export QUERYFLUX_DEBUG=true
export QUERYFLUX_LOG_LEVEL=debug
```

### Configuration Validation

Use the built-in validation to check your configuration:

```go
cfg, err := config.Load()
if err != nil {
    log.Printf("Configuration error: %v", err)
    // Handle validation errors
}
```