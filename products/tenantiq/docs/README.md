# TenantIQ: AI-Powered Microsoft 365 Security & License Optimization

TenantIQ is a comprehensive platform for MSPs and enterprises to monitor, secure, and optimize Microsoft 365 tenants with AI-powered intelligence and automated remediation.

## Overview

TenantIQ provides:
- **Unified Security Monitoring** across multiple M365 tenants with real-time threat detection
- **License Optimization** with ML-powered usage analysis and cost-saving recommendations
- **Compliance Management** automated reporting for GDPR, HIPAA, SOC 2, and CIS benchmarks
- **Claude AI Scoring** for advanced anomaly detection and security recommendations
- **Automated Remediation** via Cloudflare edge compute with approval workflows

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (Neon recommended)
- Microsoft Azure AD app registration for Graph API access
- Cloudflare Workers account
- Claude API key

### Installation

```bash
# Clone repository
git clone https://github.com/yourdomain/tenantiq.git
cd tenantiq

# Install dependencies
pnpm install

# Configure environment
cp deploy/.env.example .env
# Edit .env with your credentials

# Run migrations
pnpm run db:migrate

# Start development server
pnpm run dev
```

### MSP Onboarding Flow

1. **Create MSP Account**: Register at app.tenantiq.io with company details
2. **Configure Azure AD**: Create app registration with Microsoft Graph permissions
3. **Connect First Tenant**: Paste tenant ID and credentials to establish Graph API connection
4. **Enable Monitoring**: Select features (security, licensing, compliance)
5. **Set Up Alerts**: Configure email/webhook recipients for security events
6. **Invite Team**: Add team members with role-based access control
7. **Run Initial Scan**: Perform baseline security and license assessment

## Key Features

### Security Monitoring
- **Microsoft Secure Score Tracking**: Real-time fetching and trend analysis
- **CIS Benchmark Validation**: Automated compliance checks against CIS Microsoft 365 recommendations
- **Conditional Access Analysis**: Review and optimize conditional access policies
- **MFA Adoption Tracking**: Monitor and incentivize MFA enrollment
- **Audit Logging Verification**: Ensure audit trail is enabled and retained

### License Optimization
- **Usage Analysis**: Track per-user, per-app, and tenant-wide utilization
- **Downgrade Recommendations**: Identify underutilized E5/E3 licenses
- **Cost Forecasting**: Predict and optimize licensing spend
- **Inactive User Detection**: Identify and remove unused licenses
- **Department-Level Breakdown**: Analyze costs by organizational unit

### Compliance Management
- **Compliance Scoring**: GDPR, HIPAA, SOC 2, CIS benchmark tracking
- **Automated Reports**: Generate audit-ready compliance documentation
- **Policy Attestation**: Demonstrate control implementation with evidence
- **Drift Detection**: Alert on security configuration changes

### AI-Powered Intelligence
- **Claude AI Insights**: Contextual analysis of security posture and recommendations
- **Anomaly Detection**: Identify unusual security patterns and user behavior
- **Risk Scoring**: Proprietary ML model for tenant risk assessment
- **Remediation Guidance**: Step-by-step fix recommendations with estimated impact

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SvelteKit Frontend                        │
│           (SvelteKit 2.15, Svelte 5, Tailwind CSS)          │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
    ┌────────▼─────────┐           ┌─────────▼──────────┐
    │   API (Hono)     │           │  Static Content    │
    │ Cloudflare Workers│           │ (Cloudflare Pages) │
    └────────┬─────────┘           └────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │     Microservices Packages    │
    │ ┌──────────┬──────────┬──────┐│
    │ │  Graph   │   AI     │  DB  ││
    │ │  Module  │ Engine   │ Sync ││
    │ └──────────┴──────────┴──────┘│
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────────────┐
    │      External Integrations                │
    │ ┌──────────┬────────────┬────────────────┐│
    │ │Microsoft │  Claude   │ PostgreSQL/    ││
    │ │ Graph    │    AI      │ Neon DB        ││
    │ │  API     │   API      │                ││
    │ └──────────┴────────────┴────────────────┘│
    └────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 2.15, Svelte 5, Tailwind CSS |
| Backend | Hono, Cloudflare Workers, Durable Objects |
| Database | PostgreSQL (Neon), Drizzle ORM |
| AI | Claude API, OpenClaw |
| Cloud | Cloudflare Workers, KV, D1 |
| API Integration | Microsoft Graph API |

## Deployment

### Production Deployment

```bash
# Build application
pnpm run build

# Deploy to Cloudflare Workers
pnpm run deploy:workers

# Deploy landing page to Cloudflare Pages
pnpm run deploy:pages

# Deploy database migrations
pnpm run db:migrate:prod
```

### Configuration for Production

See `deploy/wrangler.toml` for Workers configuration and `deploy/.env.example` for required environment variables.

### Monitoring & Observability

- **Sentry** for error tracking
- **Datadog** for performance monitoring
- **Custom audit logging** for compliance tracking

## API Documentation

Complete API documentation available at [docs/API.md](./API.md).

### Key Endpoints

```
POST   /api/auth/login              - Authenticate user
POST   /api/tenants                 - Create tenant
GET    /api/tenants/:id             - Get tenant details
GET    /api/tenants/:id/security    - Get security score
GET    /api/tenants/:id/licenses    - Get license analysis
POST   /api/remediation             - Trigger automated fix
GET    /api/compliance/:id/report   - Generate compliance report
```

## Development

### Project Structure

```
├── apps/
│   ├── api/                        # Hono API backend
│   └── web/                        # SvelteKit frontend
├── packages/
│   ├── graph/                      # MS Graph API client
│   ├── ai/                         # AI/ML services
│   ├── db/                         # Database & ORM
│   ├── intel/                      # Security intelligence
│   ├── remediation/                # Automated fixes
│   ├── openclaw-skill/             # AI skill definitions
│   └── shared/                     # Shared types & utils
├── tests/                          # Integration & E2E tests
├── migrations/                     # Database migrations
└── deploy/                         # Deployment configs
```

### Running Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests (Playwright)
pnpm test:e2e

# Coverage
pnpm test -- --coverage
```

### Code Quality

```bash
# Linting
pnpm lint

# Type checking
pnpm check

# Format code
pnpm format
```

## File Size Compliance

All source files adhere to the 200-line maximum to ensure maintainability:
- Core modules split by responsibility
- Large services decomposed into smaller units
- Tests organized by feature area
- Each file has a single, clear purpose

## Security & Compliance

- **No hardcoded secrets**: All credentials loaded from environment
- **Encryption**: All sensitive data encrypted at rest and in transit
- **RBAC**: Role-based access control with tenant isolation
- **Audit Logging**: Complete audit trail of all actions
- **Secure Headers**: CSP, HSTS, X-Frame-Options configured
- **Input Validation**: Zod schemas for all API inputs

## Licensing & Pricing

TenantIQ is available in three tiers:

| Plan | Price | Features |
|------|-------|----------|
| **Starter** | $5/tenant/mo | Security monitoring, basic compliance |
| **Professional** | $10/tenant/mo | License optimization, weekly insights, priority support |
| **Enterprise** | $15/tenant/mo | Automated remediation, real-time alerts, custom integrations |

Free trial available for 14 days.

## Support & Resources

- **Documentation**: https://docs.tenantiq.io
- **API Reference**: See [docs/API.md](./API.md)
- **Architecture Guide**: See [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- **Email Support**: support@tenantiq.io
- **Status Page**: status.tenantiq.io

## Contributing

Pull requests welcome. Please ensure:
1. All tests pass: `pnpm test`
2. Code formatted: `pnpm format`
3. Types check: `pnpm check`
4. Linting passes: `pnpm lint`
5. Under 200 lines per file

## License

Proprietary. See LICENSE file.

---

**Ready to get started?** [Create an account](https://app.tenantiq.io/signup) or [contact sales](mailto:sales@tenantiq.io).
