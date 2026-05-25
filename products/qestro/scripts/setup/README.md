# Setup Scripts

Scripts for initial project setup, configuration, and service integration.

## Available Scripts

### Quick Setup
- **`quick-setup.sh`** - Complete project setup in one command

### Database Setup
- **`setup-supabase.sh`** - Configure Supabase database and authentication
- **`backend-setup-supabase.sh`** - Backend-specific Supabase configuration

### Service Integration
- **`setup-accounts.sh`** - Set up external service accounts
- **`setup-lemonsqueezy.sh`** - Configure LemonSqueezy payment processing
- **`setup-render.sh`** - Configure Render deployment platform

## Usage Examples

### Initial Project Setup
```bash
# Complete setup (recommended for new installations)
./scripts/setup/quick-setup.sh
```

### Individual Service Setup
```bash
# Database setup
./scripts/setup/setup-supabase.sh

# Payment processing
./scripts/setup/setup-lemonsqueezy.sh

# Deployment platform
./scripts/setup/setup-render.sh

# External accounts
./scripts/setup/setup-accounts.sh
```

### Backend-Specific Setup
```bash
# Backend database configuration
./scripts/setup/backend-setup-supabase.sh
```

## Setup Process

### 1. Prerequisites
Before running setup scripts:
- Install Node.js 18+
- Install PostgreSQL 14+ (or use Supabase)
- Install Redis 6+
- Create accounts for external services

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 3. Service Accounts
Required accounts:
- **Supabase**: Database and authentication
- **LemonSqueezy**: Payment processing
- **Render**: Deployment platform
- **OpenAI**: AI features

### 4. API Keys and Secrets
Configure in `.env`:
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Payment
LEMONSQUEEZY_API_KEY=your-lemonsqueezy-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# AI
OPENAI_API_KEY=your-openai-key

# Security
JWT_SECRET=your-secure-random-string
```

## Setup Validation

### Database Connection
```bash
# Test database connectivity
./scripts/testing/backend-test-supabase-connection.sh
```

### Service Health
```bash
# Check all services
./scripts/utilities/status.sh

# Validate environment
./scripts/utilities/validate-env.sh
```

### Development Environment
```bash
# Start development servers
./scripts/development/start-dev.sh
```

## Service-Specific Setup

### Supabase Setup
1. Create Supabase project
2. Configure authentication providers
3. Set up database schema
4. Configure row-level security
5. Generate API keys

### LemonSqueezy Setup
1. Create LemonSqueezy account
2. Set up products and pricing
3. Configure webhooks
4. Generate API keys
5. Test payment flow

### Render Setup
1. Create Render account
2. Connect GitHub repository
3. Configure build settings
4. Set environment variables
5. Configure custom domains

## Troubleshooting

### Common Setup Issues

#### Database Connection
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://your-project.supabase.co/rest/v1/
```

#### Environment Variables
```bash
# Validate all required variables
./scripts/utilities/validate-env.sh

# Check specific variables
echo $SUPABASE_URL
echo $LEMONSQUEEZY_API_KEY
```

#### Service Connectivity
```bash
# Test external service connections
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

### Reset and Retry
```bash
# Clean setup (removes configuration)
rm .env
rm -rf node_modules

# Retry setup
./scripts/setup/quick-setup.sh
```

## Security Considerations

### API Key Management
- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate keys regularly
- Use different keys for different environments

### Database Security
- Enable row-level security
- Use least-privilege access
- Regular security audits
- Backup encryption

### Network Security
- Use HTTPS for all connections
- Configure firewall rules
- Enable VPN for sensitive operations
- Monitor access logs