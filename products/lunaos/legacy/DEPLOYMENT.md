# LunaForge v2.4.0 Deployment Guide

## Overview
This guide covers deploying LunaForge v2.4.0, which includes the new backend worker infrastructure for premium AI features.

## Prerequisites
- Node.js 16+ and npm
- Cloudflare account (for worker deployment)
- Wrangler CLI: `npm install -g wrangler`

## Local Development

### 1. Build All Packages
```bash
cd /path/to/lunaforge
npm install
npm run build
```

### 2. Start Worker Locally (Optional)
```bash
cd workers/agent-brain
npm run dev
```

The worker will be available at `http://localhost:8787`.

### 3. Test Extension
1. Open the `lunaforge` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Open any project and test LunaForge commands

## Production Deployment

### 1. Configure Cloudflare Worker

Edit `workers/agent-brain/wrangler.toml`:
```toml
name = "lunaforge-agent-brain-worker"
main = "src/index.ts"
compatibility_date = "2024-10-01"

[vars]
LUNAFORGE_PROVIDERS = "anthropic,openai"
OPENAI_API_BASE = "https://api.openai.com/v1"
ANTHROPIC_API_BASE = "https://api.anthropic.com/v1"
```

### 2. Set API Keys (Secrets)
```bash
cd workers/agent-brain
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

### 3. Deploy Worker
```bash
npm run deploy
```

Note the deployed worker URL (e.g., `https://lunaforge-agent-brain-worker.your-account.workers.dev`).

### 4. Package Extension
```bash
cd packages/lunaforge-extension
npm run compile
vsce package
```

This creates `lunaforge-extension-2.4.0.vsix`.

### 5. Publish to Marketplace
```bash
vsce publish
```

Or upload the `.vsix` file manually to the [VS Code Marketplace](https://marketplace.visualstudio.com/manage).

## Configuration

### Extension Settings
Users can configure the worker URL in VS Code settings:

```json
{
  "lunaforge.apiBaseUrl": "https://lunaforge-agent-brain-worker.your-account.workers.dev",
  "lunaforge.enableEarlyAccess": true
}
```

### Premium Features
Premium modes require:
1. `enableEarlyAccess: true` in settings
2. Valid worker URL configured
3. LLM API keys set in worker secrets

## Testing Premium Features

### Enable Early Access
1. Open VS Code Settings (`Ctrl+,`)
2. Search for "LunaForge"
3. Enable "Enable Early Access"
4. Set "API Base URL" to your worker URL

### Test Commands
- `LunaForge: Request Analysis Plan` - Tests `/v1/plan`
- Activate Dream mode - Tests `/v1/dream`
- Activate Mythic mode - Tests `/v1/mythic`

## Monitoring

### Worker Logs
```bash
wrangler tail
```

### Extension Logs
1. Open Output panel in VS Code
2. Select "LunaForge" from dropdown

## Rollback

If issues occur:
1. Revert to previous extension version in Marketplace
2. Roll back worker: `wrangler rollback`

## Support
- GitHub Issues: https://github.com/lunaforge/lunaforge/issues
- Email: support@lunaos.ai
