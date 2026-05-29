# SDLC.ai Platform

> Secure Data Learning Platform - Enterprise-grade AI/ML platform with zero-trust security, compliance, and multi-tenant architecture.

## Overview

SDLC.ai is a comprehensive platform for secure AI data interactions, built on Cloudflare's edge infrastructure with enterprise-grade security, compliance (GDPR, HIPAA, PCI-DSS), and multi-tenancy support.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development services
npm run dev

# Or use Docker
npm run docker:dev
```

For detailed setup instructions, see [Quick Start Guide](docs/guides/QUICK_START.md).

## Project Structure

```
sdlc-ai/
├── .config/              # Configuration files
│   ├── docker/          # Docker Compose configurations
│   ├── deployment/      # Deployment configurations
│   └── monitoring/      # Monitoring configs (Grafana, Prometheus)
│
├── apps/                # Application services
│   ├── gateway-go/      # API Gateway (Go)
│   ├── llm-gateway-go/  # LLM Gateway (Go)
│   └── rag-py/          # RAG Service (Python)
│
├── compliance-platform/ # Compliance & policy management
│   ├── dashboard/       # Compliance monitoring UI
│   ├── policies/        # GDPR, HIPAA, PCI-DSS, FINRA
│   └── gateway/         # Policy enforcement gateway
│
├── core/                # Core libraries
│   └── retrieval-rs/    # High-performance vector search (Rust)
│
├── database/            # Database layer
│   ├── migrations/      # SQL migrations
│   ├── schema/          # Database schema
│   ├── scripts/         # Utility scripts
│   └── docs/            # Database documentation
│
├── deployments/         # Deployment configurations
│   ├── cloudflare/      # Cloudflare Workers deployment
│   ├── production/      # Production orchestration
│   ├── terraform/       # Infrastructure as Code
│   └── docker/          # Docker configurations
│
├── developer-portal/    # Developer documentation portal
│
├── docs/                # Documentation
│   ├── architecture/    # System architecture docs
│   ├── api/            # API documentation
│   ├── guides/         # User guides
│   └── tutorials/      # Tutorials
│
├── packages/            # Reusable packages & SDKs
│   ├── sdk-go/         # Go SDK
│   ├── sdk-py/         # Python SDK
│   ├── sdk-ts/         # TypeScript/JavaScript SDK
│   ├── api-gateway/    # API Gateway library
│   ├── policies/       # Policy definitions (OPA/Rego)
│   └── dlp/            # Data Loss Prevention
│
├── scripts/             # Utility scripts
│   ├── deployment/     # Deployment scripts
│   ├── setup/          # Setup scripts
│   └── database/       # Database utilities
│
├── services/            # Microservices
│   ├── admin-ui/       # Admin dashboard (Next.js)
│   ├── gateway/        # API Gateway service
│   ├── rag/            # RAG service
│   └── vector-core/    # Vector search service
│
└── tests/               # Test suites
    ├── integration/    # Integration tests
    ├── e2e/           # End-to-end tests
    └── performance/    # Performance tests
```

## Tech Stack

### Backend
- **Go** - High-performance API gateways
- **Python** - RAG service, ML pipelines
- **Rust** - Vector search core
- **PostgreSQL** - Primary database with pgvector
- **Redis** - Caching layer

### Frontend
- **Next.js** - Admin UI & landing pages
- **React** - Component library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Styling

### Infrastructure
- **Cloudflare Workers** - Edge computing
- **Cloudflare D1** - Distributed SQL
- **Cloudflare R2** - Object storage
- **Cloudflare KV** - Key-value storage
- **Terraform** - Infrastructure as Code

### Security & Compliance
- **OPA (Open Policy Agent)** - Policy enforcement
- **Presidio** - Data Loss Prevention
- **Zero-Trust Architecture** - Security model
- **Multi-tenant isolation** - Data segregation

## Development

### Prerequisites

- Node.js >= 18.0.0
- Go >= 1.21.0
- Python >= 3.11.0
- Rust >= 1.75.0
- Docker & Docker Compose
- Wrangler CLI (Cloudflare)

### Development Workflow

```bash
# Run all services
npm run dev

# Run specific service
npm run dev:gateway   # Go gateway
npm run dev:rag       # Python RAG service
npm run dev:vector    # Rust vector core
npm run dev:admin     # Admin UI

# Run tests
npm run test          # All tests
npm run test:gateway  # Gateway tests
npm run test:rag      # RAG tests
npm run test:vector   # Vector tests
npm run test:admin    # Admin UI tests

# Build for production
npm run build

# Lint code
npm run lint
```

### Docker Development

```bash
# Development environment
npm run docker:dev

# Production-like environment
npm run docker:prod

# Staging environment
npm run docker:staging
```

## Deployment

### Cloudflare Workers

```bash
# Deploy all services
cd deployments/cloudflare
./scripts/deploy-all.sh

# Deploy specific service
./scripts/deploy-gateway.sh
./scripts/deploy-rag.sh
```

### Production Deployment

See [Production Deployment Guide](docs/guides/PRODUCTION_READINESS_REPORT.md) for detailed instructions.

```bash
# Run deployment script
./scripts/deployment/deploy.sh production

# Or use the production orchestrator
cd deployments/production
node deploy-orchestrator.js --env=production
```

## Documentation

- [Quick Start Guide](docs/guides/QUICK_START.md) - Get started in 5 minutes
- [Production Deployment](docs/guides/PRODUCTION_READINESS_REPORT.md) - Production deployment guide
- [Staging Guide](docs/guides/STAGING_GUIDE.md) - Staging environment setup
- [Architecture](docs/architecture/system-overview.md) - System architecture
- [API Reference](docs/api/openapi.yaml) - API documentation
- [Database Guide](database/docs/README.md) - Database documentation
- [Contributing](CONTRIBUTING.md) - Contribution guidelines

## SDKs

### Go SDK

```go
import "github.com/sdlc-ai/sdk-go/pkg/sdln"

client := sdln.NewClient("your-api-key")
result, err := client.Query(ctx, &sdln.QueryRequest{
    Query: "search query",
})
```

See [Go SDK docs](packages/sdk-go/README.md) for details.

### Python SDK

```python
from sdlc_sdk import SDLCClient

client = SDLCClient(api_key="your-api-key")
result = client.query("search query")
```

See [Python SDK docs](packages/sdk-py/README.md) for details.

### TypeScript SDK

```typescript
import { SDLCClient } from '@sdlc/sdk-ts';

const client = new SDLCClient({ apiKey: 'your-api-key' });
const result = await client.query('search query');
```

See [TypeScript SDK docs](packages/sdk-ts/README.md) for details.

## Monitoring & Observability

- **Grafana** - Dashboards and visualization
- **Prometheus** - Metrics collection
- **OpenTelemetry** - Distributed tracing
- **Alertmanager** - Alert management

Access monitoring:
```bash
# Start monitoring stack
npm run docker:prod

# Access Grafana: http://localhost:3000
# Access Prometheus: http://localhost:9090
```

## Security

This project implements enterprise-grade security:

- 🔒 **Zero-Trust Architecture**
- 🛡️ **Data Loss Prevention (DLP)**
- 📋 **Compliance** - GDPR, HIPAA, PCI-DSS, FINRA
- 🔐 **Multi-tenant Isolation**
- 🔑 **JWT & API Key Authentication**
- 🚨 **Real-time Security Monitoring**

See [Security Guide](database/docs/SECURITY_IMPLEMENTATION.md) for details.

## Testing

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:gateway  # Gateway tests
npm run test:rag      # RAG tests
npm run test:vector   # Vector tests
npm run test:admin    # Admin UI tests

# Security scanning
npm run security:scan

# Lint all code
npm run lint

# Clean build artifacts
npm run clean
```

## CI/CD

GitHub Actions workflows:
- `.github/workflows/ci.yml` - Continuous integration
- `.github/workflows/production-deploy.yml` - Production deployment
- `.github/workflows/blue-green-deploy.yml` - Blue-green deployment

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Business Source License 1.1 (BUSL-1.1)

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: GitHub Issues
- **Email**: support@sdlc.ai
- **Website**: https://sdlc.ai

---

Built with ❤️ by the SDLC.ai team
