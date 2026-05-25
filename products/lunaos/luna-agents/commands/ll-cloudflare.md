# luna-cloudflare-auto - Automated Cloudflare Deployment with Wrangler

## Command Overview

The `luna-cloudflare-auto` command provides fully automated Cloudflare deployment with integrated Wrangler CLI, MCP server integration, and zero-configuration setup. It handles everything from project analysis to production deployment automatically.

## What This Command Does

- **Automated Setup**: Installs and configures Wrangler CLI automatically
- **Project Analysis**: Analyzes your project and determines optimal Cloudflare services
- **Zero Configuration**: Generates all configuration files automatically
- **MCP Integration**: Integrates with Luna MCP server for enhanced capabilities
- **One-Command Deployment**: Deploy entire stack with a single command
- **CI/CD Ready**: Generates GitHub Actions and deployment workflows

## Usage Instructions

### Full Automated Deployment
```bash
luna-cloudflare-auto
```
Analyzes project and deploys everything automatically.

### Quick Deploy (Skip Analysis)
```bash
luna-cloudflare-auto --quick
```
Uses cached analysis for faster deployment.

### Specific Service Deployment
```bash
luna-cloudflare-auto --service [workers|pages|d1|r2|all]
```
Deploys specific Cloudflare service.

### Setup Only (No Deployment)
```bash
luna-cloudflare-auto --setup-only
```
Configures Wrangler and generates files without deploying.

### CI/CD Generation
```bash
luna-cloudflare-auto --ci-cd
```
Generates CI/CD workflows for automated deployments.

## Automated Features

### 1. Wrangler CLI Management
- **Auto-Installation**: Installs Wrangler if not present
- **Version Management**: Ensures latest compatible version
- **Authentication**: Handles Cloudflare authentication automatically
- **Configuration**: Generates wrangler.toml automatically

### 2. Project Detection
- **Framework Detection**: Identifies React, Vue, Svelte, Next.js, etc.
- **Backend Detection**: Detects Express, Fastify, Hono, etc.
- **Database Detection**: Identifies database requirements
- **Asset Detection**: Finds static assets and media files

### 3. Service Provisioning
- **Workers**: Automatically creates and deploys Workers
- **Pages**: Sets up Pages with optimal build configuration
- **D1**: Creates database and migrates schema
- **R2**: Creates storage buckets and uploads assets
- **KV**: Sets up key-value storage for caching
- **Queues**: Configures background job processing

### 4. MCP Integration
- **Luna RAG**: Integrates semantic code search
- **Context Awareness**: Uses project context for smart decisions
- **Automated Fixes**: Applies fixes based on deployment feedback
- **Monitoring**: Sets up monitoring through MCP

## Deployment Workflow

### Phase 1: Pre-Flight Checks (Automated)
```
✓ Check Wrangler CLI installation
✓ Verify Cloudflare authentication
✓ Analyze project structure
✓ Detect framework and dependencies
✓ Identify required services
✓ Check for existing deployments
```

### Phase 2: Configuration Generation (Automated)
```
✓ Generate wrangler.toml
✓ Create deployment scripts
✓ Configure environment variables
✓ Set up database migrations
✓ Configure build process
✓ Generate CI/CD workflows
```

### Phase 3: Service Provisioning (Automated)
```
✓ Create Workers service
✓ Set up Pages project
✓ Create D1 database
✓ Create R2 buckets
✓ Configure KV namespaces
✓ Set up Queues
```

### Phase 4: Deployment (Automated)
```
✓ Build project
✓ Deploy Workers
✓ Deploy Pages
✓ Migrate database
✓ Upload assets to R2
✓ Configure domains
✓ Set up SSL/TLS
```

### Phase 5: Post-Deployment (Automated)
```
✓ Run smoke tests
✓ Verify endpoints
✓ Check database connectivity
✓ Test asset delivery
✓ Configure monitoring
✓ Generate deployment report
```

## Wrangler Configuration (Auto-Generated)

### Workers Configuration
```toml
name = "my-app-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"
node_compat = true

[env.production]
name = "my-app-worker-prod"
workers_dev = false
route = "api.example.com/*"

[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "auto-generated"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "my-app-assets"

[[kv_namespaces]]
binding = "CACHE"
id = "auto-generated"

[observability]
enabled = true
```

### Pages Configuration
```toml
name = "my-app-pages"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"
cwd = "."
watch_dir = "src"

[build.upload]
format = "service-worker"
dir = "dist"
main = "./index.js"

[[env_vars]]
name = "API_URL"
value = "https://api.example.com"
```

## MCP Server Integration

### Luna RAG Integration
The command integrates with Luna MCP server for:
- **Code Search**: Find similar deployment patterns
- **Context Retrieval**: Get relevant configuration examples
- **Error Resolution**: Automatically fix deployment issues
- **Best Practices**: Apply learned patterns from codebase

### MCP Tools Used
```javascript
// Automatically used during deployment
- index_codebase: Index project for context
- search_context: Find deployment patterns
- get_similar_implementations: Find similar configs
- get_coding_patterns: Apply best practices
```

## Automated Scripts Generated

### Deployment Script
```bash
#!/bin/bash
# Auto-generated by luna-cloudflare-auto

set -e

echo "🚀 Starting automated Cloudflare deployment..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Run tests
echo "🧪 Running tests..."
npm test

# 3. Build project
echo "🔨 Building project..."
npm run build

# 4. Deploy Workers
echo "⚡ Deploying Workers..."
wrangler deploy --env production

# 5. Deploy Pages
echo "📄 Deploying Pages..."
wrangler pages deploy dist --project-name my-app

# 6. Migrate database
echo "🗄️  Migrating database..."
wrangler d1 migrations apply my-app-db --remote

# 7. Upload assets
echo "📁 Uploading assets to R2..."
wrangler r2 object put my-app-assets/assets --file=./assets

# 8. Verify deployment
echo "✅ Verifying deployment..."
curl -f https://my-app.pages.dev || exit 1

echo "🎉 Deployment complete!"
```

### Database Migration Script
```bash
#!/bin/bash
# Auto-generated database migration

echo "🗄️  Running database migrations..."

# Create tables
wrangler d1 execute my-app-db --remote --command="
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"

# Create indexes
wrangler d1 execute my-app-db --remote --command="
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
"

echo "✅ Database migration complete!"
```

### CI/CD Workflow (GitHub Actions)
```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build project
        run: npm run build
        
      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
          
      - name: Deploy Pages
        run: npx wrangler pages deploy dist
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Environment Variables Management

### Auto-Detection
The command automatically detects and configures:
- Database connection strings
- API endpoints
- Authentication tokens
- Third-party service keys
- Build-time variables

### Secure Storage
```bash
# Automatically stores secrets in Cloudflare
wrangler secret put DATABASE_URL
wrangler secret put API_KEY
wrangler secret put JWT_SECRET
```

## Framework-Specific Optimizations

### Next.js
```toml
[build]
command = "npm run build"
cwd = "."

[build.upload]
format = "service-worker"
dir = ".next"
```

### React/Vite
```toml
[build]
command = "npm run build"
cwd = "."

[build.upload]
format = "service-worker"
dir = "dist"
```

### SvelteKit
```toml
[build]
command = "npm run build"
cwd = "."

[build.upload]
format = "service-worker"
dir = "build"
```

## Monitoring & Observability

### Auto-Configured Monitoring
```javascript
// Automatically added to Workers
export default {
  async fetch(request, env, ctx) {
    const start = Date.now();
    
    try {
      const response = await handleRequest(request, env);
      
      // Auto-logging
      console.log({
        method: request.method,
        url: request.url,
        status: response.status,
        duration: Date.now() - start
      });
      
      return response;
    } catch (error) {
      // Auto-error tracking
      console.error({
        error: error.message,
        stack: error.stack,
        url: request.url
      });
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
```

### Analytics Integration
```javascript
// Automatically configured
export default {
  async fetch(request, env, ctx) {
    ctx.waitUntil(
      env.ANALYTICS.writeDataPoint({
        blobs: [request.url, request.method],
        doubles: [Date.now()],
        indexes: [request.cf.colo]
      })
    );
    
    return handleRequest(request, env);
  }
};
```

## Rollback & Recovery

### Automatic Rollback
```bash
# Auto-generated rollback script
#!/bin/bash

echo "🔄 Rolling back deployment..."

# Get previous version
PREV_VERSION=$(wrangler deployments list --json | jq -r '.[1].id')

# Rollback Workers
wrangler rollback $PREV_VERSION

# Rollback Pages
wrangler pages deployment list --project-name my-app | head -2 | tail -1

echo "✅ Rollback complete!"
```

### Backup Strategy
```bash
# Automatic database backup before migration
wrangler d1 export my-app-db --output=backup-$(date +%Y%m%d-%H%M%S).sql
```

## Cost Optimization

### Auto-Configured Limits
```toml
[limits]
cpu_ms = 50
memory_mb = 128

[caching]
always_cache = true
cache_ttl = 3600

[compression]
gzip = true
brotli = true
```

### Resource Optimization
- Automatic code splitting
- Tree shaking enabled
- Minification and compression
- Image optimization
- Edge caching configured

## Troubleshooting

### Auto-Fix Common Issues
The command automatically detects and fixes:
- Missing dependencies
- Incorrect build commands
- Configuration errors
- Authentication issues
- Network problems
- Deployment failures

### Debug Mode
```bash
luna-cloudflare-auto --debug
```
Provides detailed logging and troubleshooting information.

## Integration with Luna Ecosystem

Works seamlessly with:
- **`luna-ui-convert`** - Deploy converted UI
- **`luna-ui-test`** - Test before deployment
- **`luna-monitor`** - Set up monitoring
- **`luna-shortcuts`** - Quick deployment shortcuts
- **Luna MCP Server** - Context-aware deployment

## Output Files

### Generated Files
```
.luna/{project}/cloudflare/
├── wrangler.toml              # Wrangler configuration
├── deploy.sh                  # Deployment script
├── rollback.sh                # Rollback script
├── migrate.sh                 # Database migration
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD workflow
├── workers/
│   └── index.js               # Worker code
├── d1/
│   └── schema.sql             # Database schema
└── deployment-report.md       # Deployment summary
```

## Success Criteria

After deployment, you'll see:
```
✅ Deployment Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 URLs:
  • Frontend: https://my-app.pages.dev
  • API: https://api.my-app.workers.dev
  • Custom Domain: https://example.com

📊 Services:
  • Workers: ✓ Deployed
  • Pages: ✓ Deployed
  • D1 Database: ✓ Created & Migrated
  • R2 Storage: ✓ Configured
  • KV Cache: ✓ Configured

⚡ Performance:
  • Build Time: 45s
  • Deploy Time: 23s
  • First Response: <50ms
  • Global CDN: ✓ Active

🔒 Security:
  • SSL/TLS: ✓ Configured
  • CORS: ✓ Configured
  • Rate Limiting: ✓ Active
  • DDoS Protection: ✓ Active

📈 Monitoring:
  • Analytics: ✓ Enabled
  • Error Tracking: ✓ Enabled
  • Performance Monitoring: ✓ Enabled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Deployment complete! Your app is live.
```

## Quick Start Examples

### Deploy Full-Stack App
```bash
luna-cloudflare-auto
# Analyzes and deploys everything automatically
```

### Deploy with Custom Domain
```bash
luna-cloudflare-auto --domain example.com
# Configures custom domain automatically
```

### Deploy with CI/CD
```bash
luna-cloudflare-auto --ci-cd
# Generates and commits CI/CD workflows
```

### Quick Redeploy
```bash
luna-cloudflare-auto --quick
# Fast deployment using cached configuration
```

Transform your deployment process with fully automated Cloudflare deployment! ☁️🚀⚡
