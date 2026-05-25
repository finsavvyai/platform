# Shared Components & Utilities

Shared components, utilities, and infrastructure for the FinTech Enterprise Platform.

**Migrated from:** fintech-go-cloudflare-suite

## Structure

```
shared/
├── ui/              # Shared React components
├── auth/            # Authentication utilities
├── utils/           # Utility functions
├── workers/         # Cloudflare Workers utilities
└── infrastructure/  # Infrastructure configs
```

## Usage

### UI Components

```typescript
import { Button, Card, Modal } from '@fintech-platform/shared/ui';
```

### Authentication

```typescript
import { verifyJWT, generateToken } from '@fintech-platform/shared/auth';
```

### Utilities

```typescript
import { formatCurrency, validateEmail } from '@fintech-platform/shared/utils';
```

### Cloudflare Workers

```typescript
import { authMiddleware, corsMiddleware } from '@fintech-platform/shared/workers';
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## Documentation

See the [main platform README](../../README.md) for complete documentation.
