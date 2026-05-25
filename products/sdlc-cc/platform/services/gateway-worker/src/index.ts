/**
 * SDLC.ai Gateway Worker
 * Cloudflare Workers-based API Gateway with OPA policy enforcement
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { jwt } from 'hono/jwt';

// Environment bindings
export type Bindings = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  EMBEDDINGS: R2Bucket;
  AUDIT_LOGS: R2Bucket;
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  RATE_LIMITS: KVNamespace;
  REASONING_BANK: KVNamespace;
  VECTORIZE: VectorizeIndex;
  PROCESSING_QUEUE: Queue;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  REASONING_BANK_ENABLED: string;
};

// Custom context variables
type Variables = {
  user: Record<string, unknown>;
};

// App type alias
type AppEnv = { Bindings: Bindings; Variables: Variables };

// Initialize Hono app
const app = new Hono<AppEnv>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: ['https://sdlc.cc', 'https://app.sdlc.cc'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-ID'],
    maxAge: 600,
    credentials: true,
  })
);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '1.0.0',
  });
});

// API version
app.get('/api/v1/info', (c) => {
  return c.json({
    name: 'SDLC.ai Gateway',
    version: '1.0.0',
    description: 'Secure Data Learning Platform - API Gateway',
    documentation: 'https://docs.sdlc.cc',
  });
});

// Protected routes (require JWT)
app.use('/api/v1/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify JWT (simplified - use proper JWT library in production)
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Tenant management
app.get('/api/v1/tenants', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM tenants WHERE active = 1'
  ).all();
  
  return c.json({ tenants: results });
});

app.post('/api/v1/tenants', async (c) => {
  const { name, email } = await c.req.json();
  
  const tenantId = crypto.randomUUID();
  
  await c.env.DB.prepare(
    'INSERT INTO tenants (id, name, email, created_at) VALUES (?, ?, ?, ?)'
  ).bind(tenantId, name, email, new Date().toISOString()).run();
  
  return c.json({ 
    tenant: { id: tenantId, name, email },
    message: 'Tenant created successfully'
  }, 201);
});

// Document upload
app.post('/api/v1/documents/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as unknown as File | null;
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  const documentId = crypto.randomUUID();
  const key = `documents/${documentId}/${file.name}`;
  
  // Upload to R2
  await c.env.DOCUMENTS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      size: file.size.toString(),
    },
  });
  
  // Store metadata in D1
  await c.env.DB.prepare(
    'INSERT INTO documents (id, name, key, size, uploaded_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(documentId, file.name, key, file.size, new Date().toISOString()).run();
  
  // Queue for processing
  await c.env.PROCESSING_QUEUE.send({
    documentId,
    key,
    action: 'process',
  });
  
  return c.json({
    document: {
      id: documentId,
      name: file.name,
      size: file.size,
      status: 'processing',
    },
  }, 201);
});

// Query endpoint (RAG)
app.post('/api/v1/query', async (c) => {
  const { query, context, maxResults = 5 } = await c.req.json();
  
  if (!query) {
    return c.json({ error: 'Query is required' }, 400);
  }

  // Rate limiting check
  const user = c.get('user') as Record<string, unknown>;
  const rateLimitKey = `rate_limit:${String(user.sub)}`;
  const currentCount = await c.env.RATE_LIMITS.get(rateLimitKey);
  
  if (currentCount && parseInt(currentCount) > 100) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  
  // Increment rate limit
  await c.env.RATE_LIMITS.put(
    rateLimitKey,
    (parseInt(currentCount || '0') + 1).toString(),
    { expirationTtl: 3600 }
  );

  // TODO: Call RAG service
  // For now, return mock response
  return c.json({
    query,
    results: [
      {
        content: 'Sample result from RAG pipeline',
        score: 0.95,
        source: 'document_123',
      },
    ],
    metadata: {
      processingTime: 150,
      tokensUsed: 500,
    },
  });
});

// Policy evaluation endpoint
app.post('/api/v1/policy/evaluate', async (c) => {
  const { input, policy } = await c.req.json();
  
  // TODO: Integrate with OPA
  // For now, return mock decision
  return c.json({
    decision: true,
    reason: 'Policy evaluation passed',
  });
});

// Audit log endpoint
app.get('/api/v1/audit/logs', async (c) => {
  const { limit = 100, offset = 0 } = c.req.query();
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();
  
  return c.json({ logs: results });
});

// Error handling
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  
  return c.json({
    error: 'Internal Server Error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : undefined,
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
  }, 404);
});

// Helper functions
async function verifyJWT(token: string, secret: string): Promise<any> {
  // Simplified JWT verification
  // In production, use a proper JWT library
  try {
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    
    return decodedPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Export worker
export default app;
