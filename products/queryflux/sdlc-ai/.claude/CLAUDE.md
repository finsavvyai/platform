# SDLC.ai Platform - Claude Instructions

## Project Overview
This is the SDLC.ai Platform - an enterprise-grade AI/ML platform with zero-trust security, compliance, and multi-tenant architecture built on Cloudflare's edge infrastructure.

## Task Management
- Always mark completed tasks with `[x]` in task lists
- When working with tasks in `.kiro/specs/`, mark them complete using `x` inside brackets
- Track progress in task files and update them as work progresses

## Code Standards

### Language-Specific Guidelines
- **Go**: Follow standard Go conventions, use `gofmt`, write idiomatic Go code
- **Python**: Follow PEP 8, use type hints, document with docstrings
- **Rust**: Follow Rust naming conventions, leverage the type system
- **TypeScript/JavaScript**: Use ESLint config, prefer TypeScript for type safety

### Security Requirements
- **Never** commit credentials, API keys, or secrets
- Always validate inputs and sanitize outputs
- Follow zero-trust principles in all code
- Implement proper error handling without exposing sensitive info
- Consider OWASP Top 10 vulnerabilities in all implementations

### Compliance Considerations
- GDPR: Handle PII appropriately, implement right-to-delete
- HIPAA: Encrypt PHI, maintain audit logs
- PCI-DSS: Secure payment data, never log card numbers
- FINRA: Maintain immutable audit trails

## Development Workflow

### Before Making Changes
1. Read relevant documentation in `docs/`
2. Check existing implementations for patterns
3. Review tests to understand expected behavior
4. Consider impact on multi-tenant isolation

### Making Changes
1. Create feature branches from `main`
2. Write tests alongside implementation
3. Update documentation as needed
4. Ensure backwards compatibility for APIs

### After Changes
1. Run relevant test suites
2. Update CHANGELOG if applicable
3. Check for security implications
4. Verify compliance requirements are met

## Project Structure Notes

### Key Directories
- `apps/` - Main application services (Go, Python)
- `core/` - High-performance Rust libraries
- `packages/` - Reusable SDKs and libraries
- `services/` - Microservices
- `compliance-platform/` - Compliance and policy management
- `deployments/` - Deployment configurations
- `docs/` - All documentation

### Database
- Migrations in `database/migrations/`
- Always create reversible migrations
- Test migrations on staging before production
- Document schema changes in `database/docs/`

### Configuration
- `.config/docker/` - Docker Compose configs
- `.config/deployment/` - Deployment configs
- `.config/monitoring/` - Grafana, Prometheus configs

## Testing Strategy
- **Unit tests**: Test individual functions/methods
- **Integration tests**: Test service interactions
- **E2E tests**: Test complete user flows
- **Performance tests**: Benchmark critical paths
- **Security tests**: Scan for vulnerabilities

## Deployment Notes
- Use staging environment for testing (`npm run docker:staging`)
- Follow blue-green deployment for production
- Always run smoke tests post-deployment
- Monitor logs and metrics after deployment

## Common Commands
```bash
# Development
npm run dev                 # Start all services
npm run dev:gateway        # Start gateway only
npm run dev:rag            # Start RAG service

# Testing
npm run test               # All tests
npm run test:gateway       # Gateway tests
npm run security:scan      # Security scanning

# Docker
npm run docker:dev         # Dev environment
npm run docker:staging     # Staging environment
npm run docker:prod        # Production-like environment

# Deployment
./scripts/deployment/deploy.sh production
```

## Documentation References
- [Quick Start](docs/guides/QUICK_START.md)
- [Architecture](docs/architecture/system-overview.md)
- [API Reference](docs/api/openapi.yaml)
- [Production Deployment](docs/guides/PRODUCTION_READINESS_REPORT.md)
- [Database Guide](database/docs/README.md)
- [Security Implementation](database/docs/SECURITY_IMPLEMENTATION.md)

## When Working on Features
1. Check if similar functionality exists elsewhere
2. Reuse shared packages from `packages/` directory
3. Consider multi-language support (Go, Python, Rust, TS)
4. Document APIs with OpenAPI/Swagger specs
5. Add integration tests for new endpoints
6. Update SDK clients if APIs change

## Tech Stack Reference
- **Backend**: Go, Python, Rust
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Database**: PostgreSQL + pgvector, Redis
- **Infrastructure**: Cloudflare Workers, D1, R2, KV
- **Security**: OPA, Presidio, Zero-Trust
- **Monitoring**: Grafana, Prometheus, OpenTelemetry

## Important Notes
- This is a multi-tenant platform - always consider tenant isolation
- All data access must be authorized and audited
- Performance matters - use appropriate data structures and algorithms
- Cloudflare Workers have size and time limits - optimize accordingly
- Follow the established patterns in existing services

## Support
- Documentation: See `docs/` directory
- Issues: Track in GitHub Issues
- Questions: Reference existing docs or ask for clarification
