# MCPoverflow Technical Guidelines

## Code Standards
- Follow `golangci-lint`
- Use dependency injection
- Write unit tests for all modules

## Testing
- `go test ./...`
- Load test via `k6`
- Mock Cloudflare endpoints

## Repository Structure
```
/cmd
/internal
  /parser
  /generator
  /deployer
  /agentkit
/templates
```

## CI/CD
- GitHub Actions pipeline
- Build → Test → Deploy
- Auto rollback on failure
