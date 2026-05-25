# Plugin Marketplace System

A complete community-driven ecosystem for publishing, discovering, and installing test utilities and extensions for Qestro.

## Architecture

### Services (4 Core Components)

1. **PluginRegistry** (194 lines)
   - Plugin registration and versioning (semantic versioning)
   - Search with filters (category, tags, verified, featured)
   - Sorting (downloads, rating, newest, updated)
   - Pagination support
   - Manifest validation

2. **PluginInstaller** (147 lines)
   - Install/uninstall plugins in projects
   - Update to latest versions
   - Recursive dependency resolution
   - Lifecycle hooks (onInstall, onUninstall, onUpdate)
   - Version compatibility checking

3. **PluginSandbox** (139 lines)
   - Secure code validation (blocks dangerous patterns)
   - Timeout enforcement (5 sec default, configurable)
   - Memory limits (256 MB default)
   - Network security (blocks internal IPs, 3 sec timeout)
   - Allowlisted APIs only (console, JSON, Math, fetch, etc.)

4. **PluginReviewService** (99 lines)
   - User reviews and ratings (1-5 stars)
   - Helpful marking for reviews
   - Review moderation and flagging
   - Plugin violation reporting
   - Review statistics by rating distribution

### API Routes (195 lines)

**Discovery**
- `GET /plugins` - Search/list with filters
- `GET /plugins/:id` - Get plugin details
- `GET /featured` - Featured plugins
- `GET /popular` - Popular plugins
- `GET /categories` - List categories
- `GET /categories/:category` - Category plugins

**Installation**
- `POST /plugins/:id/install` - Install plugin
- `DELETE /plugins/:id/install` - Uninstall
- `PUT /plugins/:id/install` - Update to latest
- `GET /plugins/installed` - Get project installations

**Management**
- `POST /plugins` - Publish new plugin
- `POST /plugins/:id/reviews` - Add review
- `GET /plugins/:id/reviews` - Get reviews
- `POST /plugins/:id/report` - Report violation

## Plugin Categories

```typescript
type PluginCategory = 
  | 'runner'       // Test execution engines
  | 'reporter'     // Result formatters
  | 'generator'    // Test creation utilities
  | 'healer'       // Self-healing utilities
  | 'integration'  // Third-party integrations
  | 'assertion'    // Custom assertions
  | 'utility'      // General helpers
```

## Key Features

### Versioning
- Semantic versioning (1.0.0 format)
- Multiple versions per plugin
- Version compatibility ranges
- Automatic current version tracking

### Dependency Management
- Recursive dependency resolution
- Version range validation (semver)
- Circular dependency detection
- Automatic dependency installation

### Security
- Code syntax validation
- Dangerous pattern detection (require, eval, process, etc.)
- Resource limits (CPU timeout, memory)
- Network isolation (blocks internal IPs)
- Allowlisted API access only
- Error handling enforcement checks

### Community Features
- 5-star rating system
- User reviews with helpful marking
- Plugin violation reporting
- Review moderation and flagging
- Download/install statistics
- Weekly popularity tracking

## Example Usage

```typescript
// Initialize services
const registry = new PluginRegistry();
const installer = new PluginInstaller(registry);
const sandbox = new PluginSandbox();
const reviews = new PluginReviewService();

// Publish plugin
const plugin = await registry.registerPlugin({
  name: 'visual-regression',
  version: '1.0.0',
  description: 'AI-powered visual testing',
  author: { name: 'Team', email: 'team@example.com' },
  category: 'assertion',
  tags: ['visual', 'ai'],
  license: 'MIT',
  requirements: { qestroVersion: '^1.0.0' },
}, userId);

// Install plugin
const installation = await installer.installPlugin(projectId, 'visual-regression');

// Execute plugin
const result = await sandbox.executePlugin(installation, {
  projectId,
  userId,
  qestroVersion: '1.0.0',
  environment: {},
  timeout: 5000,
});

// Add review
const review = await reviews.addReview(
  'visual-regression',
  userId,
  5,
  'Amazing plugin!',
  'John'
);
```

## Database Integration (Production)

Recommended Drizzle ORM schema:

```typescript
// plugins table
export const plugins = pgTable('plugins', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(),
  authorId: text('author_id').notNull(),
  currentVersionId: text('current_version_id'),
  featured: boolean('featured').default(false),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// plugin_versions table
export const pluginVersions = pgTable('plugin_versions', {
  id: text('id').primaryKey(),
  pluginId: text('plugin_id').notNull(),
  version: text('version').notNull(),
  releaseNotes: text('release_notes'),
  codeHash: text('code_hash'),
  fileSize: integer('file_size'),
  downloads: integer('downloads').default(0),
  publishedAt: timestamp('published_at').defaultNow(),
});

// reviews table
export const reviews = pgTable('plugin_reviews', {
  id: text('id').primaryKey(),
  pluginId: text('plugin_id').notNull(),
  userId: text('user_id').notNull(),
  rating: smallint('rating'),
  comment: text('comment'),
  helpful: integer('helpful').default(0),
  flagged: boolean('flagged').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## Performance Considerations

- Registry search O(n) filtering - consider indexing for large catalogs
- Category caching reduces lookup time
- User reviews filtered to exclude flagged items
- Dependency resolution uses memoization
- Sandbox execution aborts on timeout

## Security Best Practices

1. Always validate plugin code before execution
2. Set appropriate timeout/memory limits based on plugin type
3. Monitor sandbox execution metrics
4. Review flagged content regularly
5. Implement rate limiting on installation requests
6. Log all plugin installations for audit trails
7. Verify author identity before featuring plugins

## Testing

Recommended test cases:
- Plugin registration with valid/invalid manifests
- Search filters (category, tags, verified, featured)
- Dependency resolution with cycles
- Sandbox code validation (dangerous patterns)
- Timeout enforcement
- Network request blocking
- Review moderation workflow
- Installation on already-installed plugin
- Update to same version (no-op)
