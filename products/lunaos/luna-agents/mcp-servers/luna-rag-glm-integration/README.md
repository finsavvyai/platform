# Luna Vision RAG™ - Cloud MCP Server

**Context-Aware GUI Testing Platform**

## 🚀 Quick Deploy

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
npm run deploy
```

## 📋 API Endpoints

### Health Check
```bash
GET /health
```

### RAG Endpoints
- `POST /api/rag/setup` - Configure RAG system
- `POST /api/rag/query` - Query code context
- `POST /api/rag/index` - Index codebase

### GLM Vision Endpoints
- `POST /api/glm/capture` - Capture screenshots
- `POST /api/glm/analyze` - Analyze UI
- `POST /api/glm/test` - Run UI tests

### Integration Endpoints
- `POST /api/integration/validate` - Validate UI against code
- `POST /api/integration/generate` - Generate tests
- `POST /api/integration/report` - Generate reports

## 🔧 Configuration

Edit `wrangler.toml` to configure:
- KV namespaces for caching
- R2 buckets for storage
- D1 database
- Environment variables

## 📊 Monitoring

View logs:
```bash
npm run tail
```

## 🌐 Deployment

- **Staging**: `npm run deploy:staging`
- **Production**: `npm run deploy:production`

## 📚 Documentation

Full docs: https://docs.lunavisionrag.com
