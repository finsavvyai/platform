# MCPoverflow — Technical Requirements Document
## 1. Product Context
Turn any API into a Model Context Protocol (MCP) server for LLMs in minutes.

## 2. Goals
- Parse and generate MCP manifests from OpenAPI/GraphQL specs.
- Zero-ops hosting on Cloudflare Workers.
- OAuth2 + API key auth modes.
- Metrics and monitoring built-in.

## 3. Non-Goals
- No full schema coverage for exotic OpenAPI constructs (MVP).

## 4. Constraints
- Cloudflare-based, 100% serverless.
- R2 for artifacts, KV for metadata, D1 for registry.
