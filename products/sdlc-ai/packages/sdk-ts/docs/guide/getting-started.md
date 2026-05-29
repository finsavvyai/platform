# Getting Started

This guide will help you get up and running with the SDLC.ai JavaScript SDK.

## Prerequisites

- Node.js 16+ or modern browser with ES2020+ support
- SDLC.ai account and API credentials
- Basic knowledge of TypeScript/JavaScript

## Installation

::: code-group

```bash [npm]
npm install @sdlc/sdln-js
```

```bash [yarn]
yarn add @sdlc/sdln-js
```

```bash [pnpm]
pnpm add @sdlc/sdln-js
```

:::

## Initial Configuration

### 1. Create a Client Instance

The SDK automatically detects the environment and provides the appropriate client:

```typescript
import { createClient } from '@sdlc/sdln-js';

const client = createClient({
  baseURL: 'https://api.sdlc.ai',
  apiKey: 'your-api-key',
  timeout: 30000,
  retries: 3,
  environment: 'production' // 'development' | 'staging' | 'production'
});
```

### 2. Environment-Specific Clients

You can also explicitly create clients for specific environments:

```typescript
// Node.js client
import { NodeClient } from '@sdlc/sdln-js/node';

const nodeClient = new NodeClient({
  baseURL: 'https://api.sdlc.ai',
  apiKey: 'your-api-key',
  // Node.js specific options
  keepAlive: true,
  maxSockets: 50,
  tempDir: '/tmp/sdlc'
});

// Browser client
import { BrowserClient } from '@sdlc/sdln-js/browser';

const browserClient = new BrowserClient({
  baseURL: 'https://api.sdlc.ai',
  apiKey: 'your-api-key',
  // Browser specific options
  storageType: 'localStorage',
  enableServiceWorker: true,
  enableWebWorkers: true
});
```

## Authentication

The SDK supports multiple authentication methods:

### API Key Authentication (Simple)

```typescript
const client = createClient({
  baseURL: 'https://api.sdlc.ai',
  apiKey: 'your-api-key'
});
```

### JWT Authentication (Recommended)

```typescript
// Login with email and password
const { user, tokens } = await client.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

console.log('Logged in as:', user.firstName);
console.log('Access token:', tokens.accessToken);

// Check authentication status
if (client.auth.isAuthenticated()) {
  console.log('User is authenticated');
}

// Get current user
const currentUser = await client.auth.getCurrentUser();
```

### OAuth 2.0

```typescript
// Initialize OAuth flow
const oauthUrl = client.auth.getOAuthUrl({
  provider: 'google',
  redirectUri: 'https://yourapp.com/callback',
  scopes: ['email', 'profile']
});

// Handle OAuth callback
const tokens = await client.auth.handleOAuthCallback(code);
```

### API Key as User

```typescript
// Login with API key for programmatic access
const user = await client.auth.loginWithApiKey({
  keyId: 'key_123456',
  keySecret: 'secret_789012'
});
```

## Making Your First API Call

### List Users

```typescript
try {
  const users = await client.users.list({
    page: 1,
    pageSize: 20,
    search: 'john',
    isActive: true
  });
  
  console.log(`Found ${users.total} users`);
  users.items.forEach(user => {
    console.log(`- ${user.firstName} ${user.lastName} (${user.email})`);
  });
} catch (error) {
  console.error('Failed to fetch users:', error);
}
```

### Upload a Document

```typescript
// Browser upload
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

const document = await client.documents.upload(file, {
  name: 'Contract.pdf',
  metadata: {
    department: 'legal',
    type: 'contract'
  },
  tags: ['legal', 'contract'],
  onProgress: (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
  }
});

console.log('Document uploaded:', document.id);

// Node.js upload
const fs = require('fs');
const document = await client.uploadFileFromPath('/path/to/file.pdf', {
  name: 'Contract.pdf',
  metadata: {
    department: 'legal'
  }
});
```

### Perform RAG Query

```typescript
const response = await client.rag.query({
  query: 'What are the payment terms in the contract?',
  context: {
    maxDocuments: 5,
    maxChunks: 10,
    strategy: 'hybrid',
    includeCitations: true,
    relevanceThreshold: 0.7
  },
  filters: {
    documentTypes: ['pdf'],
    tags: ['contract'],
    dateRange: {
      start: '2024-01-01',
      end: '2024-12-31'
    }
  }
});

console.log('Answer:', response.answer);
console.log('Sources:', response.sources);
console.log('Citations:', response.citations);
```

### Streaming RAG Query

```typescript
for await (const update of client.rag.streamQuery({
  query: 'Summarize the quarterly reports',
  streaming: true
})) {
  if (update.status === 'processing') {
    console.log(`Progress: ${update.progress?.percentage}%`);
  } else if (update.status === 'completed') {
    console.log('Answer:', update.result?.answer);
    break;
  }
}
```

## Error Handling

The SDK provides comprehensive error handling:

```typescript
import { 
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NotFoundError,
  ValidationError
} from '@sdlc/sdln-js';

try {
  const user = await client.users.get('user-id');
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle authentication error
    console.log('Please log in again');
  } else if (error instanceof AuthorizationError) {
    // Handle authorization error
    console.log('You do not have permission');
  } else if (error instanceof RateLimitError) {
    // Handle rate limiting
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof NotFoundError) {
    // Handle not found
    console.log('User not found');
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Options

### Client Configuration

```typescript
const client = createClient({
  // Required
  baseURL: 'https://api.sdlc.ai',
  
  // Optional
  apiKey: 'your-api-key',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  environment: 'production',
  
  // Custom headers
  headers: {
    'X-Custom-Header': 'value'
  },
  
  // Interceptors
  interceptors: {
    request: [
      (config) => {
        // Modify request
        config.headers['X-Timestamp'] = Date.now().toString();
        return config;
      }
    ],
    response: [
      (response) => {
        // Modify response
        return response;
      }
    ],
    error: [
      (error) => {
        // Handle errors
        console.error('Request failed:', error);
        return error;
      }
    ]
  }
});
```

### Node.js Specific Options

```typescript
const nodeClient = new NodeClient({
  baseURL: 'https://api.sdlc.ai',
  
  // Connection pooling
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  
  // File system
  tempDir: '/tmp/sdlc',
  maxFileSize: 100 * 1024 * 1024, // 100MB
  chunkSize: 1024 * 1024, // 1MB
  
  // TLS options
  ca: '/path/to/ca.pem',
  cert: '/path/to/cert.pem',
  key: '/path/to/key.pem',
  rejectUnauthorized: true,
  
  // Proxy
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    protocol: 'http',
    auth: {
      username: 'user',
      password: 'pass'
    }
  }
});
```

### Browser Specific Options

```typescript
const browserClient = new BrowserClient({
  baseURL: 'https://api.sdlc.ai',
  
  // Storage
  storageType: 'localStorage', // 'localStorage' | 'sessionStorage' | 'memory'
  
  // Features
  enableServiceWorker: true,
  enableWebWorkers: true,
  enableWebAssembly: true,
  
  // Security
  enableCSRFProtection: true,
  csrfTokenHeader: 'X-CSRF-Token',
  
  // Performance
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
  enableCompression: true,
  
  // CORS
  withCredentials: false
});
```

## Next Steps

- [Authentication Guide](/guide/authentication) - Learn about authentication methods
- [API Reference](/api/) - Explore all available APIs
- [React Integration](/react/) - Build React applications
- [Examples](/examples/) - See real-world code examples