# Multi-Domain Frontend Architecture

## Overview

MCPOverflow uses a sophisticated multi-domain architecture to serve different aspects of the platform from separate domains while maintaining a cohesive codebase and user experience.

## Domains

### 1. Marketing Website (mcpoverflow.com)
- **Purpose**: Landing page, pricing, features, company information
- **Port**: 3000
- **Type**: Static export (Next.js `output: 'export'`)
- **Features**: SEO optimized, marketing content, lead generation

### 2. Developer Platform (app.mcpoverflow.io)
- **Purpose**: Main application dashboard, API management, connector development
- **Port**: 3001
- **Type**: Server-side rendered (SSR) application
- **Features**: Authentication, API management, real-time features

### 3. AI Platform (mcpoverflow.ai)
- **Purpose**: AI chat interface, workflow automation, agent management
- **Port**: 3002
- **Type**: Server-side rendered (SSR) application
- **Features**: AI integration, 3D visualizations, real-time chat

### 4. Documentation Site (mcpoverflow.dev)
- **Purpose**: API documentation, guides, tutorials, examples
- **Port**: 3003
- **Type**: Static export with MDX support
- **Features**: Documentation search, code examples, interactive demos

## Architecture Components

### 1. Shared Configuration Package (`packages/frontend-config`)

Provides domain-specific Next.js configurations:

```javascript
const { createNextConfig } = require('@mcpoverflow/frontend-config')
const config = createNextConfig('marketing') // or 'developer', 'ai', 'docs'
```

**Features:**
- Automatic domain detection based on hostname
- Domain-specific SEO metadata
- Security headers and CSP policies
- Build optimization per domain type
- Environment variable management

### 2. Shared Hooks Package (`packages/frontend-hooks`)

Reusable React hooks for all domains:

```typescript
import {
  useCurrentDomain,
  useDomainConfig,
  useAuth,
  useAPI,
  useTheme,
  useSEO,
  useWebSocket
} from '@mcpoverflow/frontend-hooks'
```

**Available Hooks:**
- `useCurrentDomain()`: Detects current domain
- `useDomainConfig()`: Provides domain-specific configuration
- `useAuth()`: Authentication and user management
- `useAPI()`: API client with automatic domain routing
- `useTheme()`: Theme management (dark/light mode)
- `useSEO()`: SEO metadata generation
- `useWebSocket()`: Real-time WebSocket connection

### 3. Shared UI Components (`packages/ui`)

Reusable components with domain-specific theming:

```typescript
import { SharedLayout, Navbar, Footer } from '@mcpoverflow/ui'
```

**Components:**
- `SharedLayout`: Consistent layout across domains
- `Navbar`: Domain-specific navigation
- `Footer`: Dynamic footer links per domain
- Form components with validation
- Authentication components
- Loading states and error handling

### 4. Build System (`scripts/build-frontend.sh`)

Comprehensive build script for all domains:

```bash
# Build all domains
./scripts/build-frontend.sh build

# Build specific domain
./scripts/build-frontend.sh domain marketing 3000

# Development mode
./scripts/build-frontend.sh dev
```

**Features:**
- Parallel builds for all domains
- Docker Compose generation
- Deployment configuration
- Build manifest generation
- Error handling and logging

## Domain Detection

The system automatically detects the current domain based on hostname:

```typescript
// Domain detection logic
function getCurrentDomain(): string {
  if (typeof window === 'undefined') return 'marketing'

  const hostname = window.location.hostname

  // Check main domains
  if (hostname === 'mcpoverflow.com' || hostname === 'www.mcpoverflow.com') {
    return 'marketing'
  }
  if (hostname === 'app.mcpoverflow.io') {
    return 'developer'
  }
  if (hostname === 'mcpoverflow.ai' || hostname === 'www.mcpoverflow.ai') {
    return 'ai'
  }
  if (hostname === 'mcpoverflow.dev' || hostname === 'www.mcpoverflow.dev') {
    return 'docs'
  }

  // Check subdomains
  if (hostname.includes('mcpoverflow')) {
    const parts = hostname.split('.')
    const subdomain = parts[0]

    if (['marketing', 'developer', 'ai', 'docs'].includes(subdomain)) {
      return subdomain
    }
  }

  return 'marketing' // Default
}
```

## Cross-Domain Features

### Authentication
- Shared authentication across domains
- JWT tokens with domain-specific claims
- Automatic token refresh
- Session management

### API Routing
- Automatic API endpoint selection based on domain
- CORS configuration for cross-domain requests
- API key management
- Rate limiting per domain

### Theming
- Consistent color scheme across domains
- Domain-specific branding
- Dark/light mode synchronization
- Custom CSS variables

### SEO Optimization
- Domain-specific meta tags
- Open Graph configuration
- Twitter Card support
- Structured data markup

## Development Workflow

### Setting up a new domain
1. Create new app directory in `apps/`
2. Copy and configure `next.config.js` template
3. Update build script with domain configuration
4. Add domain-specific routes and components
5. Configure redirects and headers

### Building and deployment
1. Run build script for all domains
2. Generate Docker Compose configuration
3. Deploy to production environment
4. Monitor build artifacts and logs

### Local development
1. Start development servers for all domains
2. Use `dev` mode for hot reloading
3. Test cross-domain features
4. Validate build artifacts

## Configuration Files

### Domain Configuration (`packages/frontend-config/src/index.ts`)
```typescript
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  marketing: {
    name: 'MCPOverflow Marketing',
    url: 'https://mcpoverflow.com',
    // ... extensive configuration
  },
  developer: {
    name: 'MCPOverflow Developer Platform',
    url: 'https://app.mcpoverflow.io',
    // ... extensive configuration
  },
  ai: {
    name: 'MCPOverflow AI Platform',
    url: 'https://mcpoverflow.ai',
    // ... extensive configuration
  },
  docs: {
    name: 'MCPOverflow Documentation',
    url: 'https://mcpoverflow.dev',
    // ... extensive configuration
  },
}
```

### Environment Variables
```bash
# Domain configuration
NEXT_PUBLIC_DOMAIN_TYPE=marketing|developer|ai|docs
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com

# Build configuration
NODE_ENV=development|production
ANALYZE=true|false
```

## Security Considerations

### Cross-Domain Security
- CORS configuration for each domain
- Content Security Policy (CSP) headers
- X-Frame-Options protection
- XSS protection headers

### Authentication Security
- JWT token validation per domain
- Secure cookie configuration
- CSRF protection
- Session timeout management

### API Security
- API key validation
- Rate limiting per domain
- Request validation
- Error handling without information leakage

## Performance Optimization

### Build Optimization
- Domain-specific package optimizations
- Code splitting per domain
- Image optimization
- CSS and JS minification

### Runtime Optimization
- Caching strategies per domain
- Lazy loading of components
- Optimized bundle sizes
- CDN configuration

## Monitoring and Analytics

### Cross-Domain Analytics
- Unified analytics across domains
- User journey tracking
- Conversion funnels
- Performance metrics

### Error Monitoring
- Centralized error tracking
- Domain-specific error reporting
- Performance monitoring
- User behavior analysis

## Future Enhancements

### Planned Features
- Internationalization (i18n) support
- Progressive Web App (PWA) capabilities
- Advanced A/B testing
- Edge-side includes (ESI)

### Scalability
- Horizontal scaling for each domain
- Load balancing configuration
- CDN integration
- Global deployment strategy

This architecture provides a robust foundation for serving multiple domains while maintaining code reusability and consistency across the MCPOverflow platform.