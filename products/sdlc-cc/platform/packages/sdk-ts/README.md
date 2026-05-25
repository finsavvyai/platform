# SDLC.ai JavaScript SDK

[![npm version](https://badge.fury.io/js/%40sdlc%2Fsdln-js.svg)](https://badge.fury.io/js/%40sdlc%2Fsdln-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Coverage](https://codecov.io/gh/sdlc-ai/sdlc-platform/branch/main/graph/badge.svg?flag=sdln-js)](https://codecov.io/gh/sdlc-ai/sdlc-platform)

The official TypeScript/JavaScript SDK for [SDLC.ai](https://sdlc.cc) Secure Data Learning Platform v3. This SDK provides a complete, type-safe interface for interacting with all SDLC.ai platform features in both Node.js and browser environments.

## Features

- 🚀 **TypeScript First** - Complete TypeScript definitions with full IntelliSense support
- 🔒 **Enterprise Security** - Zero-trust architecture with JWT, OAuth, mTLS, and API keys
- ⚡ **High Performance** - Optimized for tree-shaking with <50KB gzipped bundle size
- 🔄 **Universal Client** - Works seamlessly in Node.js, browser, and edge workers
- 📱 **React Ready** - Production-ready hooks and components for React applications
- 📊 **Real-time Features** - WebSocket support for live updates and streaming responses
- 🎯 **Comprehensive API Coverage** - 100% API coverage with all platform features
- 🧪 **95%+ Test Coverage** - Comprehensive test suite with Jest

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

## Quick Start

### Node.js

```typescript
import { createClient } from '@sdlc/sdln-js';

const client = createClient({
  baseURL: 'https://api.sdlc.cc',
  apiKey: 'your-api-key'
});

// Authenticate
await client.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Upload a document
const document = await client.documents.upload(file, {
  tags: ['contract', 'legal']
});

// Query with RAG
const response = await client.rag.query({
  query: 'What are the key terms in the contract?',
  context: {
    maxDocuments: 5,
    includeCitations: true
  }
});

console.log(response.answer);
```

### Browser

```html
<script type="module">
  import { BrowserClient } from '@sdlc/sdln-js/browser';
  
  const client = new BrowserClient({
    baseURL: 'https://api.sdlc.cc',
    apiKey: 'your-api-key'
  });
  
  // Use the client...
</script>
```

### React

```tsx
import { SDLCProvider, useRAG } from '@sdlc/sdln-js/react';

function App() {
  return (
    <SDLCProvider config={{ baseURL: 'https://api.sdlc.cc' }}>
      <ChatComponent />
    </SDLCProvider>
  );
}

function ChatComponent() {
  const { query, isLoading } = useRAG();
  
  const handleQuery = async (question: string) => {
    const response = await query({ query: question });
    console.log(response.answer);
  };
  
  // ...
}
```

## Documentation

- [Getting Started Guide](https://sdlc.cc/sdk-js/guide/getting-started)
- [API Reference](https://sdlc.cc/sdk-js/api/)
- [React Integration](https://sdlc.cc/sdk-js/react/)
- [Examples](https://sdlc.cc/sdk-js/examples/)
- [Full Documentation](https://sdlc.cc/sdk-js/)

## API Coverage

The SDK provides full coverage of all SDLC.ai platform features:

- **Authentication & Authorization** - JWT, OAuth, MFA, API keys, RBAC
- **User Management** - CRUD operations, bulk operations, permissions
- **Tenant Management** - Multi-tenancy, hierarchy, isolation
- **Document Processing** - Upload, extraction, chunking, metadata
- **RAG Operations** - Query, streaming, context retrieval, citations
- **Vector Search** - Similarity, hybrid search, filtering, ranking
- **Policy Management** - Create, test, deploy, version, impact analysis
- **LLM Gateway** - Chat, streaming, completion, embeddings, cost tracking
- **Monitoring & Analytics** - Metrics, logs, health checks, real-time updates
- **WebSocket** - Live notifications, real-time collaboration

## Environment Support

| Environment | Package | Notes |
|-------------|---------|-------|
| Node.js | `@sdlc/sdln-js` | Auto-detected |
| Browser | `@sdlc/sdln-js` | Auto-detected |
| React | `@sdlc/sdln-js/react` | Additional package |
| Deno | `@sdlc/sdln-js` | Supported via Node.js compatibility |
| Cloudflare Workers | `@sdlc/sdln-js` | Supported via browser compatibility |

## TypeScript Support

The SDK is written entirely in TypeScript with strict type checking:

```typescript
import { Document, RAGResponse } from '@sdlc/sdln-js';

// Full type safety and IntelliSense
const documents: Document[] = await client.documents.list();
const response: RAGResponse = await client.rag.query({ query: '...' });
```

## Security Features

- ✅ Zero-trust architecture
- ✅ Automatic token refresh and rotation
- ✅ Secure credential management
- ✅ CSRF protection
- ✅ Rate limiting with exponential backoff
- ✅ Request/response validation
- ✅ Content Security Policy (CSP) compatible
- ✅ Encrypted storage in browser
- ✅ PII masking and redaction

## Performance

- **Bundle Size**: <50KB gzipped for core SDK
- **Tree Shaking**: Unused code elimination
- **Caching**: Intelligent response caching
- **Connection Pooling**: Reuse HTTP connections
- **Compression**: Automatic response compression
- **Streaming**: Real-time data streaming

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://sdlc.cc/sdk-js/contributing) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/sdlc-ai/sdlc-platform.git
cd sdlc-platform/packages/sdk-ts

# Install dependencies
npm install

# Run tests
npm test

# Build the SDK
npm run build

# Run examples
npm run example:node
npm run example:browser
```

## License

MIT © [SDLC.ai](https://sdlc.cc)

## Support

- 📖 [Documentation](https://sdlc.cc/sdk-js/)
- 🐛 [Issue Tracker](https://github.com/sdlc-ai/sdlc-platform/issues)
- 💬 [Discord Community](https://discord.gg/sdlc)
- 📧 [Email Support](mailto:support@sdlc.cc)