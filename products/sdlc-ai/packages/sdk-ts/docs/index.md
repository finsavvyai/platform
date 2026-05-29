---
home: true
title: SDLC.ai JavaScript SDK
heroImage: /logo.png
tagline: TypeScript/JavaScript SDK for SDLC.ai Secure Data Learning Platform v3
actions:
  - theme: brand
    text: Get Started
    link: /guide/getting-started
  - theme: alt
    text: View on GitHub
    link: https://github.com/sdlc-ai/sdlc-platform
features:
  - title: 🚀 TypeScript First
    details: Complete TypeScript definitions with full IntelliSense support and strict typing.
  - title: 🔒 Enterprise Security
    details: Zero-trust architecture with JWT, OAuth, mTLS, API keys, and comprehensive audit logging.
  - title: ⚡ High Performance
    details: Optimized for tree-shaking with <50KB gzipped bundle size and <100ms API calls.
  - title: 🔄 Universal Client
    details: Works seamlessly in both Node.js and browser environments with a single API.
  - title: 🎯 React Ready
    details: Production-ready hooks and components for React applications.
  - title: 📊 Real-time Features
    details: WebSocket support for live updates and streaming responses.
---

## Quick Start

### Installation

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

### Basic Usage

```typescript
import { createClient } from '@sdlc/sdln-js';

// Initialize client
const sdlc = createClient({
  baseURL: 'https://api.sdlc.ai',
  apiKey: 'your-api-key'
});

// Authenticate
await sdlc.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Upload a document
const document = await sdlc.documents.upload(file, {
  tags: ['contract', 'legal']
});

// Query with RAG
const response = await sdlc.rag.query({
  query: 'What are the key terms in the contract?',
  context: {
    maxDocuments: 5,
    includeCitations: true
  }
});

console.log(response.answer);
console.log(response.sources);
```

### React Integration

```tsx
import { SDLCProvider, useRAG } from '@sdlc/sdln-js/react';

function App() {
  return (
    <SDLCProvider config={{ baseURL: 'https://api.sdlc.ai' }}>
      <ChatInterface />
    </SDLCProvider>
  );
}

function ChatInterface() {
  const { query, isLoading } = useRAG();

  const handleQuery = async (question: string) => {
    const response = await query({ query: question });
    console.log(response.answer);
  };

  // ... render UI
}
```

## Why SDLC.ai SDK?

- **🛡️ Secure by Design**: Built with zero-trust principles and enterprise-grade security
- **📦 Tiny Bundle**: Optimized for tree-shaking with minimal impact on your bundle size
- **🔄 Environment Agnostic**: Same API works in Node.js, browser, and edge workers
- **⚛️ React Native**: First-class React integration with hooks and components
- **🌍 TypeScript Native**: Full type safety and excellent developer experience
- **📈 Production Ready**: Battle-tested with 99.9% uptime and comprehensive monitoring

## Features

### Authentication & Authorization
- JWT with automatic refresh
- OAuth 2.0 and OpenID Connect
- Multi-factor authentication (MFA)
- API key management
- Role-based access control (RBAC)

### Document Management
- Multi-format support (PDF, DOCX, TXT, etc.)
- Secure file uploads with progress tracking
- Metadata extraction and indexing
- Version control and audit trails

### RAG & AI Features
- Advanced context retrieval
- Streaming responses
- Citation tracking
- Hybrid search (semantic + keyword)
- Real-time query updates

### Vector Search
- High-performance similarity search
- Hybrid search capabilities
- Advanced filtering options
- Real-time index updates

### Policy Management
- Visual policy builder
- Rego support (OPA)
- Policy testing and simulation
- Impact analysis

### Monitoring & Analytics
- Real-time metrics
- Usage tracking
- Performance monitoring
- Custom alerts

## Next Steps

- [Get Started](/guide/getting-started) - Learn the basics
- [API Reference](/api/) - Explore all APIs
- [Examples](/examples/) - See real-world usage
- [React Guide](/react/) - Build React apps
- [Security Best Practices](/guide/security) - Secure your integration