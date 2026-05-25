# Offline Sync and Caching Features

QueryFlux Mobile includes comprehensive offline functionality that allows users to continue working even without an internet connection, with automatic synchronization when connectivity is restored.

## Overview

The offline system consists of three main components:

1. **SyncService** - Handles synchronization of pending operations
2. **CacheService** - Manages local data caching with expiration
3. **OfflineQueueService** - Queues operations for later execution

## Features

### ✅ Offline Data Caching
- Automatic caching of API responses and user data
- Configurable cache size and expiration times
- LRU (Least Recently Used) eviction policy
- Memory-efficient storage with automatic cleanup

### ✅ Operation Queuing
- Queue database operations when offline
- Priority-based processing (critical, high, normal, low)
- Automatic retry with exponential backoff
- Batch processing for efficiency

### ✅ Data Synchronization
- Background sync when network is available
- Conflict resolution strategies
- Progress tracking and status updates
- Manual sync capabilities

### ✅ Real-time Status
- Live offline/online status indicators
- Queue and sync status monitoring
- Cache statistics and management
- Visual indicators throughout the app

## Architecture

### Core Services

```typescript
// Offline Manager - Coordinates all offline services
const offlineManager = new OfflineManager({
  sync: { maxRetries: 3, retryDelay: 5000 },
  cache: { maxSize: 20, maxAge: 7 * 24 * 60 * 60 * 1000 },
  queue: { maxQueueSize: 1000, batchSize: 10 }
});
```

### Data Flow

1. **Online Mode**: API calls cache responses for offline use
2. **Offline Mode**: Operations are queued and data is served from cache
3. **Reconnection**: Pending operations are synchronized automatically

## Usage Examples

### Caching Data

```typescript
import { offlineManager } from '../services/offline';

// Cache data with 5-minute expiration
await offlineManager.cacheData('user_connections', connections, 5 * 60 * 1000);

// Retrieve cached data
const cachedConnections = await offlineManager.getCachedData('user_connections');
```

### Using React Hooks

```typescript
import { useCachedData } from '../hooks/useCachedData';

const { data, isLoading, isError, refetch } = useCachedData({
  cacheKey: 'dashboard_metrics',
  fetcher: () => api.getMetrics(),
  staleTime: 2 * 60 * 1000, // 2 minutes
});
```

### Queueing Operations

```typescript
// Queue a query for offline execution
const operationId = await offlineManager.queueOperation(
  'query',
  { query: 'SELECT * FROM users', connectionId: 'conn_123' },
  'normal' // priority
);
```

### Offline-Aware Components

```typescript
import OfflineIndicator from '../components/offline/OfflineIndicator';

// Show offline status
<OfflineIndicator showDetails={true} onSyncPress={handleManualSync} />
```

## Configuration

### Sync Service Configuration

```typescript
interface SyncConfig {
  maxRetries: number;        // Maximum retry attempts (default: 3)
  retryDelay: number;        // Base retry delay in ms (default: 5000)
  batchSize: number;         // Operations per batch (default: 10)
  syncInterval: number;      // Auto-sync interval in ms (default: 30000)
  offlineStorageLimit: number; // Storage limit in MB (default: 50)
}
```

### Cache Service Configuration

```typescript
interface CacheConfig {
  maxSize: number;           // Maximum cache size in MB (default: 20)
  maxAge: number;            // Default entry age in ms (default: 7 days)
  cleanupInterval: number;   // Cleanup interval in ms (default: 1 hour)
  compressionEnabled: boolean; // Enable compression (default: true)
}
```

### Queue Service Configuration

```typescript
interface QueueConfig {
  maxQueueSize: number;      // Maximum queue size (default: 1000)
  retryDelay: number;        // Retry delay in ms (default: 5000)
  batchSize: number;         // Batch processing size (default: 10)
  processInterval: number;   // Processing interval in ms (default: 10000)
  maxRetries: number;        // Maximum retries per item (default: 3)
}
```

## Storage Management

### AsyncStorage Structure

```
AsyncStorage Keys:
├── sync_operations          // Pending sync operations
├── cache_*                   // Cached data entries
├── cache_stats              // Cache statistics
├── offline_queue            // Operation queue
└── last_sync_timestamp      // Last successful sync
```

### Data Persistence

- **Critical Data**: User preferences, saved queries (persisted across sessions)
- **Temporary Data**: Query results, metrics (cached with expiration)
- **Queue Data**: Pending operations (persisted until completed)

## Error Handling

### Sync Failures
- Automatic retry with exponential backoff
- Failed operations are marked and retried later
- Permanent failures are logged for user review

### Cache Failures
- Graceful fallback to network when cache is unavailable
- Automatic cache cleanup on storage errors
- User notification for critical cache failures

### Queue Failures
- Operations are retried based on priority
- Failed operations can be manually retried
- Queue overflow protection with size limits

## Performance Optimizations

### Memory Management
- Automatic cache eviction when storage limits are reached
- Efficient data serialization and compression
- Background cleanup of expired entries

### Network Efficiency
- Batch processing of queued operations
- Delta sync for changed data only
- Intelligent retry timing based on network conditions

### Battery Optimization
- Adaptive sync intervals based on battery level
- Background processing limits
- Efficient storage operations

## Security Considerations

### Data Protection
- Sensitive data is encrypted before caching
- Authentication tokens are handled securely
- Automatic cleanup of sensitive cache entries

### Privacy
- User data is only cached locally
- No data transmission during offline mode
- Clear data deletion on user request

## Troubleshooting

### Common Issues

**Sync Not Working:**
1. Check network connectivity
2. Verify authentication status
3. Clear cache and retry
4. Review sync logs in console

**Cache Not Updating:**
1. Check cache expiration settings
2. Verify cache key consistency
3. Clear cache manually
4. Check storage space availability

**Queue Not Processing:**
1. Verify network connection
2. Check queue size limits
3. Review operation priority settings
4. Restart app to reinitialize services

### Debug Tools

```typescript
// Get offline status
const status = await offlineManager.getOfflineStatus();
console.log('Offline Status:', status);

// Clear all offline data (for testing)
await offlineManager.clearAllOfflineData();

// Force immediate sync
const success = await offlineManager.syncNow();
```

## Best Practices

### Development
- Always handle offline states gracefully
- Provide loading indicators for sync operations
- Test offline functionality thoroughly
- Monitor cache size and cleanup

### User Experience
- Show clear offline status indicators
- Provide manual sync options
- Explain offline behavior to users
- Offer data management options

### Performance
- Configure appropriate cache sizes
- Set reasonable expiration times
- Monitor storage usage
- Optimize data serialization

## Future Enhancements

### Planned Features
- [ ] Background sync with WorkManager
- [ ] Delta sync for large datasets
- [ ] Conflict resolution UI
- [ ] Advanced caching strategies
- [ ] Offline analytics and reporting

### Advanced Features
- [ ] Predictive data preloading
- [ ] Intelligent cache warming
- [ ] Multi-device synchronization
- [ ] Offline collaboration features
- [ ] Progressive Web App support

---

## Support

For issues related to offline functionality:

1. Check the troubleshooting section above
2. Review console logs for error messages
3. Test with different network conditions
4. Contact development team with detailed error reports

This offline system ensures that QueryFlux Mobile provides a seamless experience regardless of network conditions, with robust data management and synchronization capabilities.