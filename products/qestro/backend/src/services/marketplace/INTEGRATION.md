# Plugin Marketplace Integration Guide

## Overview

The Plugin Marketplace system provides a complete ecosystem for publishing, discovering, and installing test utilities and extensions for Qestro. It consists of four core services working together.

## Architecture

### Services

1. **PluginRegistry** - Manages plugin registration, versioning, and discovery
2. **PluginInstaller** - Handles installation, removal, updates, and dependency resolution
3. **PluginSandbox** - Provides secure execution environment with resource limits
4. **PluginReviewService** - Manages reviews, ratings, and user feedback
5. **Marketplace Routes** - REST API endpoints for all marketplace operations

## Quick Start

### 1. Initialize Services

```typescript
import {
  PluginRegistry,
  PluginInstaller,
  PluginSandbox,
  PluginReviewService,
  createMarketplaceRouter,
} from './services/marketplace/index.js';

const registry = new PluginRegistry();
const installer = new PluginInstaller(registry);
const sandbox = new PluginSandbox({
  cpuTimeLimit: 5000,
  memoryLimit: 256,
  networkTimeout: 3000,
});
const reviewService = new PluginReviewService();

// Mount routes in Express app
app.use('/api/marketplace', createMarketplaceRouter(registry, installer, sandbox, reviewService));
```

### 2. Publish a Plugin

```typescript
const manifest = {
  name: 'Custom Reporter Plugin',
  version: '1.0.0',
  description: 'Generate custom test reports in JSON format',
  author: {
    name: 'John Doe',
    email: 'john@example.com',
  },
  category: 'reporter',
  tags: ['reporting', 'json', 'custom'],
  license: 'MIT',
  requirements: {
    qestroVersion: '^1.0.0',
  },
  keywords: ['report', 'json', 'custom-format'],
};

const plugin = await registry.registerPlugin(manifest, userId);
console.log(`Plugin published: ${plugin.id}`);
```

### 3. Install a Plugin

```typescript
const installation = await installer.installPlugin(projectId, 'custom-reporter-plugin');
console.log(`Plugin installed: ${installation.id}`);
```

### 4. Execute a Plugin

```typescript
const context = {
  projectId,
  userId,
  qestroVersion: '1.0.0',
  environment: { NODE_ENV: 'test' },
  timeout: 5000,
};

const result = await sandbox.executePlugin(installation, context);
if (result.success) {
  console.log('Execution result:', result.data);
} else {
  console.error('Execution failed:', result.error);
}
```

### 5. Add Review

```typescript
const review = await reviewService.addReview(
  pluginId,
  userId,
  5,
  'Excellent plugin, works great!',
  'Jane Doe'
);
```

## API Endpoints

### Search & Discovery

- `GET /api/marketplace/plugins` - Search plugins with filters
- `GET /api/marketplace/plugins/:id` - Get plugin details
- `GET /api/marketplace/featured` - Get featured plugins
- `GET /api/marketplace/popular` - Get popular plugins
- `GET /api/marketplace/categories` - List all categories
- `GET /api/marketplace/categories/:category` - Get category plugins

### Installation & Management

- `POST /api/marketplace/plugins/:id/install` - Install plugin
- `DELETE /api/marketplace/plugins/:id/install` - Uninstall plugin
- `PUT /api/marketplace/plugins/:id/install` - Update plugin
- `GET /api/marketplace/plugins/installed` - Get installed plugins

### Publishing & Reviews

- `POST /api/marketplace/plugins` - Publish new plugin
- `POST /api/marketplace/plugins/:id/reviews` - Add review
- `GET /api/marketplace/plugins/:id/reviews` - Get reviews
- `POST /api/marketplace/plugins/:id/report` - Report plugin

## Plugin Development

### Plugin Manifest

Every plugin must define a `PluginManifest` with:

- **name** - Unique plugin identifier
- **version** - Semantic version (1.0.0)
- **description** - Short description
- **author** - Author metadata
- **category** - One of: runner, reporter, generator, healer, integration, assertion, utility
- **tags** - Search tags
- **license** - Open source license
- **requirements** - Qestro version compatibility
- **hooks** - Lifecycle hooks (onInstall, onUninstall, onUpdate)

### Example Plugin

```typescript
// custom-assertion-plugin.ts
const manifest = {
  name: 'visual-regression-assertion',
  version: '1.0.0',
  description: 'AI-powered visual regression testing',
  author: { name: 'Test Team', email: 'test@example.com' },
  category: 'assertion',
  tags: ['visual', 'regression', 'ai'],
  license: 'MIT',
  requirements: { qestroVersion: '^1.0.0' },
};

// Plugin code (sandboxed execution)
const pluginCode = `
  const compareImages = async (baseline, current) => {
    const diff = calculatePixelDiff(baseline, current);
    return {
      matches: diff < 0.01,
      percentageDiff: (diff * 100).toFixed(2),
    };
  };

  return await compareImages(context.baseline, context.current);
`;
```

### Dependency Management

Plugins can depend on other plugins via `requirements.dependencies`:

```typescript
const manifest = {
  // ...
  requirements: {
    qestroVersion: '^1.0.0',
    dependencies: {
      'base-assertions': '^1.0.0',
      'reporting-utils': '^2.1.0',
    },
  },
};
```

The installer automatically resolves dependencies recursively.

### Lifecycle Hooks

Plugins can define lifecycle hooks as JavaScript code strings:

```typescript
hooks: {
  onInstall: `
    console.log('Installing custom reporter plugin');
    // Initialize configuration, setup directories, etc.
  `,
  onUpdate: `
    console.log('Updating plugin to new version');
    // Migrate configuration, cleanup old files, etc.
  `,
  onUninstall: `
    console.log('Uninstalling plugin');
    // Cleanup resources, remove temporary files, etc.
  `,
}
```

## Security & Sandboxing

### Code Validation

Before execution, all plugin code is validated:

```typescript
const validation = sandbox.validatePluginCode(code);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}
```

### Execution Context

Plugins run in a restricted context with:

- **5 second CPU timeout** (configurable)
- **256 MB memory limit** (configurable)
- **3 second network timeout** (configurable)
- **Allowlisted APIs only** (console, JSON, Math, fetch with restrictions)
- **Internal IP blocking** (no access to localhost, private IPs)
- **No file system access**
- **No process spawning**

### Safe Fetch

Network requests from plugins are validated:

```typescript
// Blocked: localhost, 127.0.0.1, 192.168.*, 10.*, 172.16-31.*
// Allowed: public APIs (https://api.example.com)
fetch('https://api.example.com/data') // OK
fetch('http://localhost:3000/') // Blocked
```

## Categories

Plugins are organized into 7 categories:

- **runner** - Test execution engines (Playwright, Maestro, etc.)
- **reporter** - Result formatters (JUnit, HTML, Allure, etc.)
- **generator** - Test creation utilities (LLM-powered, etc.)
- **healer** - Self-healing assertion utilities
- **integration** - Third-party service integrations
- **assertion** - Custom assertion libraries
- **utility** - General utilities and helpers

## Search & Filtering

### Query Parameters

```
GET /api/marketplace/plugins?
  q=visual&
  category=assertion&
  tags=ai,visual&
  verified=true&
  featured=false&
  sortBy=downloads&
  limit=20&
  offset=0
```

### Sort Options

- `downloads` - Most downloaded first
- `rating` - Highest rated first
- `newest` - Recently published first
- `updated` - Recently updated first

## Reviews & Ratings

### Review Stats

```typescript
const stats = await reviewService.getReviewStats(pluginId);
// {
//   total: 42,
//   average: 4.5,
//   '5': 35,
//   '4': 5,
//   '3': 2,
//   '2': 0,
//   '1': 0,
// }
```

### Moderation

- Plugins can be reported for violations
- Reviews can be flagged and hidden from display
- One review per user per plugin

## Best Practices

1. **Always validate input** - Use TypeScript strict mode
2. **Handle errors gracefully** - Return meaningful error messages
3. **Set reasonable limits** - Don't use entire timeout/memory
4. **Secure network requests** - Validate URLs, use HTTPS
5. **Test thoroughly** - Test in sandbox before publishing
6. **Document code** - Provide clear installation/usage docs
7. **Version carefully** - Follow semver, provide release notes
8. **Maintain plugins** - Keep dependencies updated
