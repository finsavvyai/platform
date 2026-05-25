# MCPoverflow Technical Design

## Architecture
- Core written in **Go 1.23**
- Parser: OpenAPI + GraphQL using `go-openapi` + `graphql-go`
- Template engine: `text/template`
- Deployment: Cloudflare Workers via Wrangler
- CI/CD: GitHub Actions + GoReleaser

### Data Flow
1. Upload → Parse spec → Generate code → Deploy → Register to AgentKit

### Key Modules
- `/cmd`: CLI entrypoint
- `/internal/parser`: Spec parsing
- `/internal/generator`: Template rendering
- `/internal/deployer`: Wrangler integration
- `/internal/agentkit`: AgentKit registration
