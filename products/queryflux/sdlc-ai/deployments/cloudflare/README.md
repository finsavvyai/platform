# SDLC.ai Platform - Complete Cloudflare Infrastructure Setup

This directory contains the complete Cloudflare infrastructure configuration for the SDLC.ai platform, including all necessary configuration files, deployment scripts, and monitoring setup.

## 🏗️ Architecture Overview

The SDLC.ai platform is built on Cloudflare's edge computing platform with the following services:

- **Workers**: Serverless compute for application logic
- **D1**: Serverless SQL database for data persistence
- **KV**: Global key-value store for caching and sessions
- **R2**: S3-compatible object storage for document storage
- **Vectorize**: Vector database for semantic search and embeddings
- **Queues**: Asynchronous message processing
- **Workers AI**: AI model inference for embeddings and generation
- **Analytics Engine**: Real-time analytics and monitoring
- **Durable Objects**: Stateful real-time features

## 📁 Directory Structure

```
cloudflare/
├── wrangler.toml                    # Main platform configuration
├── .env.development.example         # Development environment template
├── .env.staging.example            # Staging environment template
├── .env.production.example         # Production environment template
├── scripts/
│   ├── deploy-all.sh               # Complete platform deployment
│   ├── deploy-service.sh           # Individual service deployment
│   ├── migrate-all.sh              # Database migration management
│   └── monitoring-setup.sh         # Monitoring and observability setup
├── services/
│   ├── gateway/
│   │   └── wrangler.toml           # Gateway service configuration
│   ├── rag/
│   │   └── wrangler.toml           # RAG service configuration
│   ├── vector/
│   │   └── wrangler.toml           # Vector service configuration
│   └── policy/
│       └── wrangler.toml           # Policy service configuration
├── migrations/
│   ├── tenants/
│   ├── auth/
│   ├── documents/
│   ├── vector/
│   └── policies/
├── monitoring/
│   ├── worker-observability.ts     # Observability module
│   ├── dashboards/                 # Monitoring dashboards
│   ├── alerts/                     # Alert configurations
│   ├── logs/                       # Log configuration
│   ├── synthetic/                  # Synthetic monitoring
│   ├── incident-response/          # Incident response templates
│   └── docs/                       # Monitoring documentation
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   wrangler auth login
   ```

3. **Clone and Navigate**:
   ```bash
   cd /Users/shaharsolomon/dev/projects/github/SDLC/deployments/cloudflare
   ```

### Complete Platform Deployment

1. **Set up Environment Variables**:
   ```bash
   # Copy and edit environment files
   cp .env.development.example .env.development
   cp .env.staging.example .env.staging
   cp .env.production.example .env.production
   
   # Edit each file with your actual values
   nano .env.development
   ```

2. **Deploy to Development**:
   ```bash
   chmod +x scripts/deploy-all.sh
   ./scripts/deploy-all.sh development
   ```

3. **Deploy to Staging**:
   ```bash
   ./scripts/deploy-all.sh staging
   ```

4. **Deploy to Production**:
   ```bash
   ./scripts/deploy-all.sh production
   ```

### Individual Service Deployment

Deploy a specific service to an environment:

```bash
# Deploy gateway service to staging
./scripts/deploy-service.sh gateway staging

# Deploy vector service to production
./scripts/deploy-service.sh vector production
```

### Database Migrations

Run database migrations:

```bash
# Migrate all databases in development
./scripts/migrate-all.sh development

# Migrate to specific version
./scripts/migrate-all.sh staging 0002

# Check migration status
./scripts/migrate-all.sh production --status
```

### Monitoring Setup

Set up comprehensive monitoring:

```bash
# Set up monitoring for development
./scripts/monitoring-setup.sh development

# Set up monitoring for production
./scripts/monitoring-setup.sh production
```

## 🔧 Configuration

### Main Platform Configuration

The main `wrangler.toml` configures all Cloudflare services:

- **D1 Databases**: 5 databases (tenants, auth, documents, vector metadata, policies)
- **KV Namespaces**: 5 namespaces (cache, sessions, rate limiting, embeddings, search)
- **R2 Buckets**: 3 buckets (documents, backup archive, temporary uploads)
- **Vectorize Indexes**: 3 indexes (semantic search, document vectors, code vectors)
- **Queues**: 5 queues (document processing, embeddings, DLP scan, notifications, backup)
- **Workers AI**: AI model bindings for embeddings
- **Durable Objects**: 3 objects (real-time manager, rate limiter, processing coordinator)

### Environment Variables

Key environment variables to configure:

#### Authentication & Security
- `JWT_SECRET`: High-entropy secret for JWT tokens
- `API_KEY_ENCRYPTION_KEY`: Encryption key for API keys
- `SESSION_ENCRYPTION_KEY`: Session encryption key
- `MFA_ENCRYPTION_KEY`: Multi-factor authentication encryption

#### External AI Services
- `OPENAI_API_KEY`: OpenAI API key for embeddings and models
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude models
- `COHERE_API_KEY`: Cohere API key for alternative embeddings

#### Monitoring & Observability
- `SENTRY_DSN`: Sentry error tracking DSN
- `DATADOG_API_KEY`: DataDog monitoring API key
- `LOGTAIL_TOKEN`: Logtail logging token

## 📊 Services Overview

### Gateway Service
- **Purpose**: API Gateway, authentication, rate limiting, request routing
- **Technology**: Go with Cloudflare Workers
- **Dependencies**: Auth Database, Sessions KV, Rate Limiting Cache
- **Key Features**: JWT authentication, API key management, request throttling

### RAG Service
- **Purpose**: Document processing, retrieval-augmented generation
- **Technology**: Python with Cloudflare Workers
- **Dependencies**: Documents Database, Document Storage, Document Vectors
- **Key Features**: Document ingestion, chunking, embedding generation, retrieval

### Vector Service
- **Purpose**: Vector operations, semantic search, embeddings management
- **Technology**: Rust with Cloudflare Workers
- **Dependencies**: Vector Metadata Database, Search Cache, Embedding Cache
- **Key Features**: Vector search, similarity matching, embedding management

### Policy Service
- **Purpose**: DLP scanning, policy enforcement, compliance checking
- **Technology**: TypeScript with Cloudflare Workers
- **Dependencies**: Policy Database, DLP Scan Queue
- **Key Features**: Content scanning, policy enforcement, audit logging

## 🔐 Security Configuration

### Authentication Flow
1. User authentication via JWT tokens
2. API key authentication for service-to-service communication
3. Multi-factor authentication support
4. Session management with secure cookies

### Data Protection
- Encryption at rest for all sensitive data
- Encryption in transit for all communications
- Data Loss Prevention (DLP) scanning for document uploads
- Row-level security for multi-tenant data isolation

### Access Control
- Role-based access control (RBAC)
- API key management with granular permissions
- Rate limiting per user and API key
- IP whitelisting for sensitive operations

## 📈 Monitoring & Observability

### Metrics Collection
- **Request Metrics**: Request rate, response time, error rate
- **Performance Metrics**: CPU usage, memory usage, queue backlog
- **Business Metrics**: Documents processed, searches performed, active users
- **Security Metrics**: Authentication attempts, DLP violations, API usage

### Logging
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error with configurable levels
- **Audit Logging**: Security events and compliance tracking
- **Performance Logging**: Operation timing and performance metrics

### Alerting
- **Critical Alerts**: Service down, high error rate, security incidents
- **Warning Alerts**: Performance degradation, resource usage warnings
- **Info Alerts**: Scheduled maintenance, system notifications
- **Multi-channel**: Email, Slack, PagerDuty integration

### Dashboards
- **Platform Overview**: System health and performance at a glance
- **Service Health**: Individual service status and metrics
- **Performance Metrics**: Detailed performance analysis
- **Business Metrics**: User activity and feature usage

## 🔄 Deployment Workflow

### Development Environment
```bash
# 1. Set up environment
cp .env.development.example .env.development
# Edit .env.development with your values

# 2. Deploy all services
./scripts/deploy-all.sh development

# 3. Run migrations
./scripts/migrate-all.sh development

# 4. Set up monitoring
./scripts/monitoring-setup.sh development

# 5. Test deployment
curl https://sdlc-platform-dev.your-subdomain.workers.dev/health
```

### Staging Environment
```bash
# 1. Deploy to staging
./scripts/deploy-all.sh staging

# 2. Run migrations
./scripts/migrate-all.sh staging

# 3. Set up monitoring
./scripts/monitoring-setup.sh staging

# 4. Test thoroughly
curl https://api-staging.sdlc.ai/health
```

### Production Environment
```bash
# 1. Deploy to production (with approval)
./scripts/deploy-all.sh production

# 2. Run migrations
./scripts/migrate-all.sh production

# 3. Set up monitoring
./scripts/monitoring-setup.sh production

# 4. Verify deployment
curl https://api.sdlc.ai/health
```

## 🛠️ Maintenance & Operations

### Regular Tasks
- **Daily**: Check dashboards and alert status
- **Weekly**: Review error rates and performance metrics
- **Monthly**: Update dependencies and review security patches
- **Quarterly**: Security audit and penetration testing

### Database Maintenance
- **Backup**: Daily automatic backups to R2
- **Cleanup**: Weekly cleanup of old logs and temporary data
- **Optimization**: Monthly query performance review
- **Archival**: Quarterly archival of old data

### Security Maintenance
- **Secret Rotation**: Quarterly rotation of all secrets
- **Access Review**: Monthly review of user access and permissions
- **Security Updates**: Immediate application of security patches
- **Compliance Audit**: Annual compliance review and documentation

## 🚨 Incident Response

### Severity Levels
- **Critical**: Service down, data breach, security incident
- **High**: Major feature outage, performance degradation
- **Medium**: Partial feature issues, elevated error rates
- **Low**: Minor issues, documentation updates

### Response Procedures
1. **Immediate Assessment** (0-15 minutes)
2. **Investigation** (15-60 minutes)
3. **Resolution** (1-4 hours)
4. **Post-mortem** (24-48 hours)

### Escalation Policy
- **Level 1**: On-call engineer
- **Level 2**: Technical lead
- **Level 3**: Engineering manager
- **Level 4**: CTO/executive team

## 📚 Additional Documentation

- [Database Schema](../database/docs/SCHEMA_REFERENCE.md)
- [Security Guide](../database/docs/SECURITY_GUIDE.md)
- [Deployment Guide](../database/docs/DEPLOYMENT_GUIDE.md)
- [Monitoring Documentation](monitoring/docs/monitoring-guide-development.md)

## 🆘 Support & Troubleshooting

### Common Issues

1. **Deployment Fails**:
   - Check Wrangler authentication
   - Verify environment variables
   - Review error logs

2. **Database Connection Issues**:
   - Check D1 database IDs
   - Verify migration status
   - Review connection configuration

3. **High Error Rates**:
   - Check resource limits
   - Review recent deployments
   - Monitor external service status

4. **Performance Issues**:
   - Check worker CPU/memory limits
   - Review database query performance
   - Monitor queue processing

### Getting Help

- **Documentation**: Review this README and linked documentation
- **Monitoring**: Check dashboards and alert status
- **Logs**: Review structured logs for error details
- **Team**: Contact on-call engineer via Slack or PagerDuty

## 📄 License

This configuration is part of the SDLC.ai platform. See the main project repository for licensing information.

---

**Last Updated**: October 30, 2025
**Version**: 1.0.0
**Environment**: All (development, staging, production)