# @shared/analytics

Enterprise-grade analytics package for cross-product usage tracking across the SDLC platform.

## Features

- 🚀 **Cross-Product Analytics**: Unified tracking across all 6 products
- 🔒 **GDPR Compliant**: Built-in privacy controls and data protection
- ☁️ **Cloudflare Native**: Optimized for Cloudflare Workers, KV, and D1
- 📊 **Real-Time Metrics**: Live dashboard with customizable widgets
- 🎯 **Conversion Tracking**: Monitor user journeys and conversions
- 📱 **Multi-Platform**: Web, mobile, API, and worker support
- 🔍 **Advanced Filtering**: Flexible queries and segmentation
- 🛡️ **Privacy First**: Data anonymization and consent management

## Quick Start

```typescript
import { createAnalytics } from '@shared/analytics';

// Initialize analytics
const analytics = createAnalytics({
  productId: 'sdlc-platform',
  version: '1.0.0',
  environment: 'production',
  batchSize: 10,
  flushInterval: 5000
});

// Track page views
await analytics.trackPageView('/pricing');

// Track user actions
await analytics.trackUserAction('button_click', 'demo_request_cta');

// Track form submissions
await analytics.trackFormSubmit('demo_request', formData, true);

// Track conversions
await analytics.trackConversion('demo_scheduled', 1, 'USD');

// Get metrics
const metrics = await analytics.getMetrics({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});
```

## Configuration

### Basic Configuration

```typescript
const config = {
  productId: 'your-product-id',
  version: '1.0.0',
  environment: 'production',
  batchSize: 10,
  flushInterval: 5000,
  enableDebug: false,
  enableSampling: false,
  samplingRate: 1.0
};
```

### GDPR Configuration

```typescript
const gdpr = {
  enabled: true,
  consentRequired: false,
  anonymizeIP: true,
  dataRetentionDays: 365,
  cookiePolicy: 'strict',
  doNotTrack: false,
  regionalRestrictions: ['EU']
};
```

## Event Types

### Page Views
```typescript
await analytics.trackPageView('/pricing', 'Pricing Plans');
```

### User Actions
```typescript
await analytics.trackUserAction('click', 'demo-button', { source: 'header' });
```

### Form Submissions
```typescript
await analytics.trackFormSubmit('contact', formData, true, 1500);
```

### API Calls
```typescript
await analytics.trackApiCall('/api/users', 'POST', 201, 1200);
```

### Errors
```typescript
await analytics.trackError(error, { context: 'user-registration' }, 'high');
```

### Performance
```typescript
await analytics.trackPerformance('page_load', 850, 'ms');
```

### Conversions
```typescript
await analytics.trackConversion('signup', 99, 'USD', { plan: 'pro' });
```

### Feature Usage
```typescript
await analytics.trackFeatureUsage('analytics_dashboard', 'export_csv');
```

## Providers

### Cloudflare Provider (Production)
- Uses Cloudflare KV for event storage
- D1 database for structured queries
- Analytics Engine for real-time metrics
- Automatic scaling and global distribution

### Memory Provider (Development)
- In-memory storage for testing
- No external dependencies
- Instant setup for local development

```typescript
import { CloudflareProvider, MemoryProvider } from '@shared/analytics';

// Production
const analytics = new Analytics(config, gdpr, new CloudflareProvider());

// Development
const analytics = new Analytics(config, gdpr, new MemoryProvider());
```

## Data Models

### Analytics Event
```typescript
interface AnalyticsEvent {
  id: string;
  type: EventType;
  userId?: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, any>;
  metadata: EventMetadata;
}
```

### Analytics Metrics
```typescript
interface AnalyticsMetrics {
  totalEvents: number;
  uniqueUsers: number;
  totalSessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: Array<{ path: string; views: number }>;
  topEvents: Array<{ type: string; count: number }>;
  conversionRate: number;
  errorRate: number;
  performanceMetrics: Record<string, number>;
}
```

## GDPR Compliance

### Data Anonymization
- IP addresses automatically anonymized
- User IDs hashed for privacy
- Sensitive form fields redacted
- Configurable data retention periods

### Consent Management
```typescript
// Check consent
const hasConsent = localStorage.getItem('sdlc_analytics_consent') === 'granted';

// Set user consent
analytics.setUserConsent(true);

// Update GDPR settings
analytics.updateGDPRSettings({
  consentRequired: true,
  anonymizeIP: true,
  dataRetentionDays: 90
});
```

### Regional Restrictions
```typescript
const gdpr = {
  regionalRestrictions: ['EU', 'CA', 'BR'],
  enabled: true
};
```

## Cloudflare Integration

### Environment Setup
```typescript
// wrangler.toml
[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "analytics_kv_namespace"

[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "sdlc-analytics"
database_id = "analytics_database_id"
```

### Worker Integration
```typescript
// In your Cloudflare Worker
import { Analytics } from '@shared/analytics';

export default {
  async fetch(request, env, ctx) {
    const analytics = new Analytics(config, gdpr);
    await analytics.initialize();

    // Track API calls automatically
    const response = await handleRequest(request);

    await analytics.trackApiCall(
      request.url,
      request.method,
      response.status,
      Date.now() - start
    );

    return response;
  }
};
```

## Dashboard Integration

### Real-time Metrics
```typescript
// Get real-time metrics
const metrics = await analytics.getMetrics({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  eventTypes: ['page_view', 'conversion']
});

// Top performing pages
console.log(metrics.topPages);

// Conversion funnel
const conversionMetrics = await analytics.getMetrics({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  customFilters: {
    funnel: ['page_view', 'form_submit', 'conversion']
  }
});
```

## Advanced Usage

### Custom Events
```typescript
await analytics.track('custom_event', {
  action: 'feature_used',
  feature: 'advanced_analytics',
  parameters: {
    report_type: 'conversion_funnel',
    date_range: '30_days'
  }
});
```

### Batch Processing
```typescript
// Enable batch mode for high-volume tracking
const config = {
  batchSize: 100,
  flushInterval: 10000, // 10 seconds
  enableSampling: true,
  samplingRate: 0.1 // 10% sampling
};
```

### Session Management
```typescript
// Get current session
const session = await analytics.getSession();

// Update session manually
await analytics.sessionManager.updateSession({
  userId: 'user-123',
  pageView: true
});

// End session
await analytics.endSession();
```

## Error Handling

```typescript
try {
  await analytics.trackPageView('/pricing');
} catch (error) {
  console.error('Analytics tracking failed:', error);

  // Fallback to local storage
  localStorage.setItem('analytics_error', error.message);
}
```

## Performance Considerations

- **Sampling**: Enable sampling for high-traffic applications
- **Batching**: Configure appropriate batch sizes
- **Edge Runtime**: Use Edge Runtime for optimal performance
- **Caching**: Leverage Cloudflare's CDN for dashboard data
- **Compression**: Events are automatically compressed

## Security

- **Data Encryption**: All data encrypted in transit and at rest
- **Access Controls**: Role-based access to analytics data
- **Audit Logs**: Complete audit trail of data access
- **Compliance**: SOC 2, GDPR, CCPA compliant

## Monitoring

### Health Checks
```typescript
// Check analytics health
const isHealthy = analytics.isInitialized;
const queueSize = analytics.getEventQueueSize();
```

### Debug Mode
```typescript
const config = {
  enableDebug: true,
  environment: 'development'
};

// Console will show detailed tracking information
```

## Migration Guide

### From Google Analytics
```typescript
// Old GA code
gtag('config', 'GA_MEASUREMENT_ID');
gtag('event', 'page_view', { page_path: '/pricing' });

// New @shared/analytics code
await analytics.trackPageView('/pricing');
```

### From Custom Analytics
```typescript
// Gradual migration
const legacyAnalytics = new LegacyAnalytics();
const newAnalytics = createAnalytics(config, gdpr);

// Track both during transition
await Promise.all([
  legacyAnalytics.track('page_view', { path }),
  newAnalytics.trackPageView(path)
]);
```

## Troubleshooting

### Common Issues

1. **Events not appearing**: Check provider initialization and network connectivity
2. **GDPR blocking**: Verify consent requirements and regional settings
3. **Performance issues**: Enable sampling and adjust batch sizes
4. **Data inconsistencies**: Check timezone handling and event ordering

### Debug Information
```typescript
// Enable debug mode
analytics.updateConfig({ enableDebug: true });

// Check event queue
const queueSize = analytics.getEventQueueSize();
console.log(`Events in queue: ${queueSize}`);

// Check session info
const session = await analytics.getSession();
console.log('Current session:', session);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- 📖 [Documentation](https://docs.sdlc.cc/analytics)
- 🐛 [Issue Tracker](https://github.com/sdlc/analytics/issues)
- 💬 [Community](https://community.sdlc.cc)
- 📧 [Support](mailto:support@sdlc.cc)