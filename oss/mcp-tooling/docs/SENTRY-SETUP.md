# Sentry Error Tracking Setup Guide

This guide walks you through setting up Sentry error tracking for the MCPOverflow platform.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Backend Setup (Go)](#backend-setup-go)
- [Frontend Setup (React)](#frontend-setup-react)
- [Configuration](#configuration)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Overview

Sentry provides real-time error tracking and performance monitoring for both the frontend and backend of MCPOverflow.

**Features Implemented:**
- Error capture and stack traces
- Performance monitoring (transactions & spans)
- Session replay for debugging
- User context tracking
- Custom tags and breadcrumbs
- Sensitive data filtering

## Prerequisites

1. **Create a Sentry Account**
   - Go to [sentry.io](https://sentry.io) and create an account
   - Create a new project for MCPOverflow

2. **Get Your DSN**
   - After creating the project, copy the DSN (Data Source Name)
   - Format: `https://<key>@<organization>.ingest.sentry.io/<project-id>`

## Backend Setup (Go)

### 1. Install Sentry SDK

```bash
cd services/api-service
go get github.com/getsentry/sentry-go
go get github.com/getsentry/sentry-go/gin
```

### 2. Update `cmd/main.go`

Add Sentry initialization after loading config:

```go
import (
    "github.com/mcpoverflow/api-service/internal/monitoring"
)

func main() {
    // Load configuration
    cfg := config.Load()

    // Initialize Sentry
    sentryConfig := monitoring.SentryConfig{
        DSN:              os.Getenv("SENTRY_DSN"),
        Environment:      cfg.Environment,
        Release:          "mcpoverflow@0.1.4",
        TracesSampleRate: 0.1, // 10% of transactions
        Debug:            cfg.Environment == "development",
        AttachStacktrace: true,
    }

    if err := monitoring.InitSentry(sentryConfig); err != nil {
        log.Printf("Warning: Failed to initialize Sentry: %v", err)
    }
    defer monitoring.Flush(2 * time.Second)

    // ... rest of setup

    // Add Sentry middleware AFTER error handler
    router.Use(middleware.ErrorHandler())
    router.Use(monitoring.SentryMiddleware())
    router.Use(middleware.CORS())
    // ... rest of middleware
}
```

### 3. Use Sentry in Handlers

```go
import "github.com/mcpoverflow/api-service/internal/monitoring"

func (h *Handler) CreateConnector(c *gin.Context) {
    // Add breadcrumb
    monitoring.AddBreadcrumb(c, "Creating connector", "connector", sentry.LevelInfo)

    // Capture errors
    if err := someOperation(); err != nil {
        monitoring.CaptureGinError(c, err)
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    // Set user context
    if userID, exists := c.Get("user_id"); exists {
        monitoring.SetUser(c, userID.(string), user.Email, user.Username)
    }

    // Performance monitoring
    span := monitoring.StartSpan(c, "db.query", "Fetch connector data")
    defer monitoring.FinishSpan(span)

    // ... handler logic
}
```

### 4. Environment Variables

Add to `.env` or environment:

```bash
SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=mcpoverflow@0.1.4
```

## Frontend Setup (React)

### 1. Install Sentry SDK

```bash
npm install @sentry/react
```

### 2. Initialize in `src/main.tsx`

```typescript
import { initSentry, createErrorBoundary, setUser } from '@/utils/sentry';

// Initialize Sentry before React
initSentry();

const ErrorBoundary = createErrorBoundary();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{ padding: '2rem' }}>
          <h1>Something went wrong</h1>
          <pre>{error.message}</pre>
          <button onClick={resetError}>Try again</button>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

### 3. Set User Context in AuthContext

```typescript
import { setUser } from '@/utils/sentry';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user;
      setUserState(currentUser);

      // Update Sentry user context
      setUser(currentUser);
    });
  }, []);

  // ...
}
```

### 4. Track Errors in Components

```typescript
import { captureException, addBreadcrumb, captureAPIError } from '@/utils/sentry';

function MyComponent() {
  const handleSubmit = async () => {
    try {
      addBreadcrumb('User submitted form', 'user-action', 'info');

      const response = await fetch('/api/connectors', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create connector');
      }
    } catch (error) {
      captureAPIError(
        error as Error,
        '/api/connectors',
        'POST',
        response?.status
      );
      // Show error to user
    }
  };
}
```

### 5. Environment Variables

Add to `.env`:

```bash
VITE_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
VITE_ENVIRONMENT=production
VITE_RELEASE=mcpoverflow@0.1.4
VITE_SENTRY_DEBUG=false
```

## Configuration

### Production Configuration

**Backend (Go):**
```go
sentryConfig := monitoring.SentryConfig{
    DSN:              os.Getenv("SENTRY_DSN"),
    Environment:      "production",
    Release:          "mcpoverflow@" + version,
    TracesSampleRate: 0.1,  // 10% of transactions
    Debug:            false,
    AttachStacktrace: true,
}
```

**Frontend (React):**
```typescript
Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    release: 'mcpoverflow@0.1.4',
    tracesSampleRate: 0.1,  // 10% of transactions
    replaysSessionSampleRate: 0.1,  // 10% of sessions
    replaysOnErrorSampleRate: 1.0,  // 100% on errors
});
```

### Development Configuration

**Backend:**
```go
sentryConfig := monitoring.SentryConfig{
    DSN:              os.Getenv("SENTRY_DSN"),
    Environment:      "development",
    Release:          "mcpoverflow@dev",
    TracesSampleRate: 1.0,  // 100% of transactions
    Debug:            true,
    AttachStacktrace: true,
}
```

**Frontend:**
```typescript
Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'development',
    tracesSampleRate: 1.0,  // 100% of transactions
    // Don't send in dev unless explicitly enabled
    beforeSend: (event) => {
        return import.meta.env.VITE_SENTRY_DEBUG ? event : null;
    },
});
```

## Testing

### 1. Test Backend Error Capture

```bash
curl -X POST http://localhost:8080/api/test/sentry-error
```

Or add a test endpoint:

```go
router.GET("/test/sentry-error", func(c *gin.Context) {
    err := errors.New("Test Sentry error from backend")
    monitoring.CaptureGinError(c, err)
    c.JSON(500, gin.H{"error": "Test error sent to Sentry"})
})
```

### 2. Test Frontend Error Capture

Add a test button in development:

```typescript
import { captureException } from '@/utils/sentry';

function TestSentry() {
  const triggerError = () => {
    try {
      throw new Error('Test Sentry error from frontend');
    } catch (error) {
      captureException(error as Error, {
        test: {
          timestamp: new Date().toISOString(),
          browser: navigator.userAgent,
        },
      });
    }
  };

  return <button onClick={triggerError}>Test Sentry</button>;
}
```

### 3. Verify in Sentry Dashboard

1. Go to your Sentry project dashboard
2. Navigate to Issues
3. Check that errors appear with:
   - Stack traces
   - User context
   - Breadcrumbs
   - Custom context

## Best Practices

### 1. Sensitive Data Filtering

Both frontend and backend automatically filter:
- Authorization headers
- API keys
- Passwords
- Session tokens
- Cookie values

### 2. Error Context

Always add context when capturing errors:

```typescript
captureException(error, {
  component: 'ConnectorForm',
  action: 'submit',
  connectorId: connector.id,
});
```

### 3. Breadcrumbs

Use breadcrumbs to track user actions:

```typescript
addBreadcrumb('User clicked generate button', 'user-action', 'info');
addBreadcrumb('API request started', 'api', 'info', { endpoint: '/api/generate' });
```

### 4. Performance Monitoring

Track performance for critical operations:

```typescript
const transaction = startTransaction('connector-generation', 'task');
try {
  await generateConnector();
} finally {
  finishTransaction(transaction);
}
```

### 5. Sampling Rates

- **Production**: 10% of transactions (reduce costs)
- **Development**: 100% of transactions (catch all issues)
- **Errors**: Always 100% (don't miss any errors)

### 6. Release Tracking

Always set the release version:
```bash
SENTRY_RELEASE=mcpoverflow@$(git describe --tags)
```

This enables:
- Tracking which version has issues
- Regression detection
- Deploy tracking

### 7. Source Maps

Upload source maps for better stack traces:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Upload source maps after build
sentry-cli releases files mcpoverflow@0.1.4 upload-sourcemaps ./dist
```

## GitHub Actions Integration

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Create Sentry release
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: mcpoverflow
  run: |
    curl -sL https://sentry.io/get-cli/ | bash
    export SENTRY_RELEASE=mcpoverflow@${{ github.sha }}
    sentry-cli releases new "$SENTRY_RELEASE"
    sentry-cli releases set-commits "$SENTRY_RELEASE" --auto
    sentry-cli releases finalize "$SENTRY_RELEASE"
```

## Troubleshooting

### Errors Not Appearing

1. Check DSN is correct
2. Verify network connectivity to sentry.io
3. Check environment filters in `beforeSend`
4. Look for initialization errors in console

### Too Many Events

1. Increase sampling rates carefully
2. Use `beforeSend` to filter noisy errors
3. Set up quota management in Sentry dashboard

### Missing Stack Traces

1. Enable `AttachStacktrace: true`
2. Upload source maps for frontend
3. Use `-ldflags` for Go debugging symbols

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Sentry Go SDK](https://docs.sentry.io/platforms/go/)
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)

## Support

For issues with Sentry integration:
1. Check this documentation
2. Review Sentry dashboard for configuration issues
3. Open an issue in the MCPOverflow repository
4. Contact Sentry support for platform issues
