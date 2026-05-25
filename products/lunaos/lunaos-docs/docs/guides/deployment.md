# Luna RAG + GLM Vision Cloud Deployment Guide

**Last Updated**: November 5, 2025  
**Status**: Production Ready  
**Platform**: Cloudflare Workers + Cloud Vector Databases

---

## 🌐 Cloud Architecture Overview

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Global Network                 │
│                  (200+ Cities Worldwide)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │     Cloudflare Workers (Serverless)     │
        │   - Luna RAG MCP Server                 │
        │   - Luna GLM Vision MCP Server          │
        │   - Integration Layer                   │
        └─────────────────────────────────────────┘
                ↓                    ↓
    ┌──────────────────┐  ┌──────────────────┐
    │  Cloud Vector DB │  │  Cloudflare R2   │
    │  (Pinecone/      │  │  (Object Storage)│
    │   Weaviate/      │  │  - Screenshots   │
    │   Qdrant)        │  │  - Test Reports  │
    └──────────────────┘  └──────────────────┘
                ↓                    ↓
    ┌──────────────────┐  ┌──────────────────┐
    │  Cloudflare KV   │  │  Cloudflare D1   │
    │  (Cache/Config)  │  │  (SQLite DB)     │
    └──────────────────┘  └──────────────────┘
```

### Benefits of Cloud Deployment

- ✅ **Zero Infrastructure Management** - No servers to maintain
- ✅ **Global Distribution** - Sub-50ms latency worldwide
- ✅ **Auto-Scaling** - Handle 0 to millions of requests
- ✅ **Cost-Effective** - Pay only for what you use
- ✅ **High Availability** - 99.99% uptime SLA
- ✅ **Built-in Security** - DDoS protection, SSL/TLS
- ✅ **Easy Deployment** - Single command deployment

---

## 📦 Prerequisites

### Required Accounts

1. **Cloudflare Account** (Free tier available)
   - Sign up at: https://dash.cloudflare.com/sign-up
   - Verify email and complete setup

2. **Vector Database** (Choose one)
   - **Pinecone** (Recommended): https://www.pinecone.io/
   - **Weaviate Cloud**: https://console.weaviate.cloud/
   - **Qdrant Cloud**: https://cloud.qdrant.io/

3. **AI Provider** (Choose one)
   - **OpenAI**: https://platform.openai.com/
   - **Anthropic**: https://console.anthropic.com/
   - **Cohere**: https://dashboard.cohere.com/

4. **GLM API**
   - Sign up at: https://open.bigmodel.cn/

### Required Tools

```bash
# Install Wrangler CLI (Cloudflare Workers CLI)
npm install -g wrangler

# Verify installation
wrangler --version

# Login to Cloudflare
wrangler login
```

---

## 🚀 Quick Start Deployment

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/shacharsol/luna-agents.git
cd luna-agents

# Navigate to cloud deployment
cd mcp-servers/cloud-deployment

# Install dependencies
npm install
```

### Step 2: Configure Environment

Create `.env` file:

```bash
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Vector Database (Pinecone)
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX_NAME=luna-rag-context

# OpenAI (for embeddings)
OPENAI_API_KEY=your_openai_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# GLM Vision
GLM_API_KEY=your_glm_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.5v

# R2 Storage
R2_BUCKET_NAME=luna-test-reports
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
```

### Step 3: Deploy to Cloudflare

```bash
# Deploy RAG MCP Server
wrangler deploy --name luna-rag-mcp

# Deploy GLM Vision MCP Server
wrangler deploy --name luna-glm-vision-mcp

# Deploy Integration Layer
wrangler deploy --name luna-integration-mcp
```

### Step 4: Verify Deployment

```bash
# Test RAG endpoint
curl https://luna-rag-mcp.your-subdomain.workers.dev/health

# Test GLM Vision endpoint
curl https://luna-glm-vision-mcp.your-subdomain.workers.dev/health

# Test Integration endpoint
curl https://luna-integration-mcp.your-subdomain.workers.dev/health
```

---

## 🔧 Detailed Configuration

### 1. Cloudflare Workers Setup

#### Create Workers

```bash
# Create RAG Worker
wrangler init luna-rag-mcp
cd luna-rag-mcp

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "luna-rag-mcp"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "luna-context-storage"

[env.production]
name = "luna-rag-mcp"
route = "https://rag.luna-agents.com/*"
EOF
```

#### Worker Code Structure

```javascript
// src/index.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { PineconeClient } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';

export default {
  async fetch(request, env, ctx) {
    // Initialize MCP Server
    const server = new Server({
      name: 'luna-rag-mcp-cloud',
      version: '2.0.0'
    });

    // Initialize Pinecone
    const pinecone = new PineconeClient({
      apiKey: env.PINECONE_API_KEY,
      environment: env.PINECONE_ENVIRONMENT
    });

    // Initialize OpenAI Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: env.OPENAI_EMBEDDING_MODEL
    });

    // Handle MCP requests
    return handleMCPRequest(request, server, pinecone, embeddings, env);
  }
};

async function handleMCPRequest(request, server, pinecone, embeddings, env) {
  const url = new URL(request.url);
  
  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // MCP tool handlers
  if (url.pathname === '/tools/query_context') {
    return await handleQueryContext(request, pinecone, embeddings, env);
  }

  if (url.pathname === '/tools/setup_rag') {
    return await handleSetupRAG(request, pinecone, embeddings, env);
  }

  return new Response('Not Found', { status: 404 });
}
```

### 2. Vector Database Setup

#### Pinecone Configuration

```javascript
// Initialize Pinecone index
const pinecone = new PineconeClient({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT
});

// Create index (one-time setup)
await pinecone.createIndex({
  name: 'luna-rag-context',
  dimension: 1536, // OpenAI text-embedding-3-small
  metric: 'cosine',
  pods: 1,
  replicas: 1,
  podType: 'p1.x1'
});

// Get index
const index = pinecone.Index('luna-rag-context');

// Upsert vectors
await index.upsert({
  vectors: [
    {
      id: 'context-1',
      values: embedding,
      metadata: {
        filePath: 'src/components/Auth.tsx',
        type: 'component',
        language: 'typescript'
      }
    }
  ]
});

// Query vectors
const results = await index.query({
  vector: queryEmbedding,
  topK: 5,
  includeMetadata: true
});
```

#### Weaviate Cloud Configuration

```javascript
import weaviate from 'weaviate-ts-client';

const client = weaviate.client({
  scheme: 'https',
  host: 'your-cluster.weaviate.network',
  apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
  headers: {
    'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY
  }
});

// Create schema
await client.schema
  .classCreator()
  .withClass({
    class: 'CodeContext',
    vectorizer: 'text2vec-openai',
    properties: [
      { name: 'content', dataType: ['text'] },
      { name: 'filePath', dataType: ['string'] },
      { name: 'language', dataType: ['string'] },
      { name: 'type', dataType: ['string'] }
    ]
  })
  .do();

// Add objects
await client.data
  .creator()
  .withClassName('CodeContext')
  .withProperties({
    content: 'function login() { ... }',
    filePath: 'src/auth/login.ts',
    language: 'typescript',
    type: 'function'
  })
  .do();

// Query
const result = await client.graphql
  .get()
  .withClassName('CodeContext')
  .withNearText({ concepts: ['authentication'] })
  .withLimit(5)
  .withFields('content filePath language type')
  .do();
```

### 3. Cloudflare R2 Storage Setup

#### Create R2 Bucket

```bash
# Create bucket for screenshots
wrangler r2 bucket create luna-screenshots

# Create bucket for test reports
wrangler r2 bucket create luna-test-reports

# List buckets
wrangler r2 bucket list
```

#### R2 Integration in Worker

```javascript
export default {
  async fetch(request, env, ctx) {
    // Upload screenshot to R2
    if (request.method === 'POST' && url.pathname === '/upload-screenshot') {
      const formData = await request.formData();
      const file = formData.get('screenshot');
      
      const key = `screenshots/${Date.now()}-${file.name}`;
      await env.SCREENSHOTS.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type
        }
      });

      return new Response(JSON.stringify({ 
        success: true, 
        url: `https://screenshots.luna-agents.com/${key}` 
      }));
    }

    // Retrieve screenshot from R2
    if (request.method === 'GET' && url.pathname.startsWith('/screenshots/')) {
      const key = url.pathname.slice(1);
      const object = await env.SCREENSHOTS.get(key);
      
      if (!object) {
        return new Response('Not Found', { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata.contentType,
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    }
  }
};
```

### 4. Cloudflare KV for Caching

```javascript
// Store in KV
await env.CACHE.put('context:login-component', JSON.stringify(context), {
  expirationTtl: 3600 // 1 hour
});

// Retrieve from KV
const cached = await env.CACHE.get('context:login-component', 'json');
if (cached) {
  return cached;
}

// Delete from KV
await env.CACHE.delete('context:login-component');

// List keys
const keys = await env.CACHE.list({ prefix: 'context:' });
```

---

## 🔐 Security Configuration

### API Key Management

```bash
# Set secrets in Cloudflare Workers
wrangler secret put PINECONE_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put GLM_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY

# List secrets
wrangler secret list
```

### CORS Configuration

```javascript
// Add CORS headers
function addCORSHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Handle OPTIONS requests
if (request.method === 'OPTIONS') {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
```

### Rate Limiting

```javascript
// Implement rate limiting with KV
async function checkRateLimit(clientId, env) {
  const key = `ratelimit:${clientId}`;
  const limit = 100; // requests per minute
  const window = 60; // seconds

  const current = await env.CACHE.get(key, 'json') || { count: 0, resetAt: Date.now() + window * 1000 };

  if (Date.now() > current.resetAt) {
    current.count = 0;
    current.resetAt = Date.now() + window * 1000;
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - Date.now()) / 1000) };
  }

  current.count++;
  await env.CACHE.put(key, JSON.stringify(current), { expirationTtl: window });

  return { allowed: true, remaining: limit - current.count };
}
```

---

## 📊 Monitoring & Observability

### Cloudflare Analytics

```javascript
// Log analytics events
export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    
    try {
      const response = await handleRequest(request, env);
      
      // Log successful request
      ctx.waitUntil(logAnalytics(env, {
        timestamp: new Date().toISOString(),
        path: new URL(request.url).pathname,
        method: request.method,
        status: response.status,
        duration: Date.now() - startTime,
        success: true
      }));
      
      return response;
    } catch (error) {
      // Log error
      ctx.waitUntil(logAnalytics(env, {
        timestamp: new Date().toISOString(),
        path: new URL(request.url).pathname,
        method: request.method,
        error: error.message,
        duration: Date.now() - startTime,
        success: false
      }));
      
      throw error;
    }
  }
};

async function logAnalytics(env, data) {
  await env.ANALYTICS.put(
    `log:${Date.now()}:${Math.random()}`,
    JSON.stringify(data),
    { expirationTtl: 86400 * 30 } // 30 days
  );
}
```

### Custom Metrics

```javascript
// Track custom metrics
class MetricsCollector {
  constructor(env) {
    this.env = env;
  }

  async trackQueryLatency(duration) {
    const key = `metrics:query_latency:${new Date().toISOString().split('T')[0]}`;
    const current = await this.env.CACHE.get(key, 'json') || { count: 0, total: 0, min: Infinity, max: 0 };
    
    current.count++;
    current.total += duration;
    current.min = Math.min(current.min, duration);
    current.max = Math.max(current.max, duration);
    current.avg = current.total / current.count;
    
    await this.env.CACHE.put(key, JSON.stringify(current), { expirationTtl: 86400 * 7 });
  }

  async trackEmbeddingCost(tokens) {
    const key = `metrics:embedding_cost:${new Date().toISOString().split('T')[0]}`;
    const current = await this.env.CACHE.get(key, 'json') || { tokens: 0, cost: 0 };
    
    current.tokens += tokens;
    current.cost = (current.tokens / 1000000) * 0.02; // $0.02 per 1M tokens
    
    await this.env.CACHE.put(key, JSON.stringify(current), { expirationTtl: 86400 * 30 });
  }
}
```

---

## 💰 Cost Optimization

### Pricing Breakdown

#### Cloudflare Workers
- **Free Tier**: 100,000 requests/day
- **Paid Plan**: $5/month for 10M requests
- **Additional**: $0.50 per million requests

#### Cloudflare R2
- **Storage**: $0.015/GB/month
- **Class A Operations**: $4.50 per million
- **Class B Operations**: $0.36 per million
- **Free Egress**: No bandwidth charges

#### Cloudflare KV
- **Free Tier**: 100,000 reads/day, 1,000 writes/day
- **Paid**: $0.50 per million reads, $5 per million writes

#### Vector Databases

**Pinecone**:
- **Starter**: Free (1 pod, 5M vectors)
- **Standard**: $70/month (1 pod)
- **Enterprise**: Custom pricing

**Weaviate Cloud**:
- **Sandbox**: Free (limited)
- **Standard**: $25/month
- **Business**: $200/month

**Qdrant Cloud**:
- **Free**: 1GB storage
- **Starter**: $25/month
- **Pro**: $95/month

### Cost Optimization Strategies

```javascript
// 1. Implement aggressive caching
async function getCachedOrFetch(key, fetchFn, ttl = 3600) {
  const cached = await env.CACHE.get(key, 'json');
  if (cached) return cached;
  
  const data = await fetchFn();
  await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
  return data;
}

// 2. Batch operations
async function batchEmbeddings(texts) {
  // Process in batches of 100 to reduce API calls
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }
  
  const results = await Promise.all(
    batches.map(batch => generateEmbeddings(batch))
  );
  
  return results.flat();
}

// 3. Use cheaper embedding models for non-critical queries
function selectEmbeddingModel(priority) {
  if (priority === 'high') {
    return 'text-embedding-3-large'; // More expensive, higher quality
  }
  return 'text-embedding-3-small'; // Cheaper, good quality
}

// 4. Implement request deduplication
const pendingRequests = new Map();

async function deduplicatedRequest(key, fn) {
  if (pendingRequests.has(key)) {
    return await pendingRequests.get(key);
  }
  
  const promise = fn();
  pendingRequests.set(key, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    pendingRequests.delete(key);
  }
}
```

---

## 🧪 Testing Cloud Deployment

### Local Development

```bash
# Run local development server
wrangler dev

# Test locally
curl http://localhost:8787/health
```

### Staging Environment

```bash
# Deploy to staging
wrangler deploy --env staging

# Test staging
curl https://luna-rag-mcp-staging.workers.dev/health
```

### Production Deployment

```bash
# Deploy to production
wrangler deploy --env production

# Verify production
curl https://luna-rag-mcp.workers.dev/health
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy to Cloudflare Workers

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
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
```

---

## 📞 Support & Resources

### Documentation
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Pinecone: https://docs.pinecone.io/
- Weaviate: https://weaviate.io/developers/weaviate
- OpenAI: https://platform.openai.com/docs/

### Community
- Luna Agents Discord: [Join here]
- GitHub Issues: https://github.com/shacharsol/luna-agents/issues
- Stack Overflow: Tag `luna-agents`

---

**Status**: ✅ Production Ready  
**Last Updated**: November 5, 2025  
**Version**: 2.0.0
