# Self-Hosting Guide

For enterprise or custom deployments.

## Quick Setup

```bash
git clone https://github.com/shacharsol/js-package-manager-mcp.git
cd js-package-manager-mcp
npm install
npm run build
npm start
```

## Via npx (Recommended)

```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "command": "npx",
      "args": ["-y", "npmplus-mcp-server"]
    }
  }
}
```

## Local Development

```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "command": "node",
      "args": ["./dist/index.js"],
      "cwd": "/path/to/js-package-manager-mcp"
    }
  }
}
```

## Web Deployment (Netlify, Vercel, etc.)

```bash
# Run the automated setup script
./deployment/setup-deployment.sh

# Customize the deployment URLs
nano scripts/test-deployment.sh

# Deploy to your own infrastructure
npm run deploy:netlify
```

> **Security Note**: The production service at `api.npmplus.dev` has automatic deployments disabled. Only the maintainer can deploy to production using `npm run deploy:production`.

See [deployment/README.md](../deployment/README.md) for detailed deployment instructions.

## Version Management & Publishing

```bash
# Bump version only (patch/minor/major)
npm run bump

# Full production deployment (maintainer only)
npm run deploy:production
```

**Production deployment includes:**
- Prerequisites check (npm login, netlify login, clean git)
- Interactive version bumping (patch/minor/major)
- Automated testing
- NPM package publishing
- Git tagging and pushing
- Netlify deployment
- Endpoint health checks

## Testing & Validation

```bash
# Test deployment health
npm run test:deployment

# Run unit tests  
npm test

# Development mode
npm run dev
```

## Analytics & Monitoring

NPM Plus includes optional analytics for self-hosted deployments:

- **Basic tracking** - Console logging for debugging and monitoring
- **Tool usage** - Track which MCP tools are being used
- **Performance metrics** - Response times and success rates
- **Privacy-first** - Minimal data collection, IP hashing
- **Configurable** - Enable via environment variables

### Enable Analytics (Optional)

```bash
ENABLE_ANALYTICS=true
ANALYTICS_SALT=your-random-salt
```
