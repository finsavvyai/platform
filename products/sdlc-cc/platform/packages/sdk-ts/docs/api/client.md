# Client API Reference

The SDK provides two main client types:

- **NodeClient** - For Node.js environments
- **BrowserClient** - For browser environments
- **createClient()** - Factory function that automatically detects the environment

## Core Client

### Constructor Options

```typescript
interface SDLCConfig {
  baseURL: string;           // Required - API base URL
  apiKey?: string;           // API key for authentication
  timeout?: number;          // Request timeout in ms (default: 30000)
  retries?: number;          // Number of retries (default: 3)
  retryDelay?: number;       // Delay between retries in ms (default: 1000)
  environment?: 'development' | 'staging' | 'production';
  headers?: Record<string, string>;
  interceptors?: {
    request?: Array<(config: RequestConfig) => RequestConfig>;
    response?: Array<(response: any) => any>;
    error?: Array<(error: any) => any>;
  };
}
```

### Methods

#### `getConfig()`

Get the current client configuration.

```typescript
const config = client.getConfig();
console.log(config.baseURL);
```

#### `updateConfig(config)`

Update client configuration.

```typescript
client.updateConfig({
  timeout: 60000,
  retries: 5
});
```

#### `healthCheck()`

Check if the API is healthy.

```typescript
const isHealthy = await client.healthCheck();
if (isHealthy) {
  console.log('API is healthy');
}
```

#### `getVersion()`

Get the SDK version.

```typescript
const version = await client.getVersion();
console.log(`SDK version: ${version}`);
```

#### `close()`

Close the client and clean up resources.

```typescript
client.close();
```

## NodeClient

The NodeClient provides Node.js-specific functionality.

```typescript
import { NodeClient } from '@sdlc/sdln-js/node';

const client = new NodeClient({
  baseURL: 'https://api.sdlc.cc',
  apiKey: 'your-api-key'
});
```

### NodeClient-Specific Methods

#### `uploadFileFromPath(filePath, options)`

Upload a file from the filesystem.

```typescript
const document = await client.uploadFileFromPath('/path/to/file.pdf', {
  name: 'Document.pdf',
  metadata: { department: 'legal' },
  onProgress: (progress) => {
    console.log(`${progress.percentage}% uploaded`);
  }
});
```

#### `downloadFileToFile(documentId, filePath, options)`

Download a document to the filesystem.

```typescript
await client.downloadFileToFile('doc-123', '/path/to/save/file.pdf', {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% downloaded`);
  }
});
```

#### `batchProcessDocuments(requests, options)`

Process multiple documents in batches.

```typescript
const documents = await client.batchProcessDocuments([
  { filePath: '/path/to/file1.pdf' },
  { filePath: '/path/to/file2.pdf' }
], {
  concurrency: 3,
  onProgress: (completed, total) => {
    console.log(`Processed ${completed}/${total} documents`);
  }
});
```

#### `streamRAGQuery(query)`

Stream RAG query responses.

```typescript
for await (const update of client.streamRAGQuery({
  query: 'Summarize the documents',
  streaming: true
})) {
  console.log('Update:', update);
}
```

#### `getSystemInfo()`

Get system information.

```typescript
const info = await client.getSystemInfo();
console.log('Platform:', info.platform);
console.log('Node version:', info.nodeVersion);
console.log('Memory:', info.memory);
```

## BrowserClient

The BrowserClient provides browser-specific functionality.

```typescript
import { BrowserClient } from '@sdlc/sdln-js/browser';

const client = new BrowserClient({
  baseURL: 'https://api.sdlc.cc',
  apiKey: 'your-api-key'
});
```

### BrowserClient-Specific Methods

#### `uploadFile(file, options)`

Upload a file from a File object.

```typescript
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

const document = await client.uploadFile(file, {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% uploaded`);
  }
});
```

#### `uploadMultipleFiles(files, options)`

Upload multiple files with drag and drop support.

```typescript
const files = dataTransfer.files;
const documents = await client.uploadMultipleFiles(files, {
  concurrency: 3,
  onFileComplete: (index, document) => {
    console.log(`File ${index} uploaded`);
  },
  onAllComplete: (documents) => {
    console.log('All files uploaded');
  }
});
```

#### `setupDragAndDrop(element, options)`

Setup drag and drop zone for file uploads.

```typescript
const dropZone = document.getElementById('drop-zone');

const cleanup = client.setupDragAndDrop(dropZone, {
  onDrop: (files) => {
    console.log('Files dropped:', files);
  },
  acceptedTypes: ['application/pdf', 'image/*'],
  maxFiles: 10
});

// Clean up when done
cleanup();
```

#### `showNotification(notification)`

Show browser notification.

```typescript
await client.showNotification({
  title: 'Upload Complete',
  body: 'Your document has been uploaded successfully',
  icon: '/icon.png',
  requireInteraction: false
});
```

#### `getBrowserInfo()`

Get browser information.

```typescript
const info = client.getBrowserInfo();
console.log('User agent:', info.userAgent);
console.log('Language:', info.language);
console.log('Screen size:', info.screen);
```

## Events

The client emits various events that you can listen to:

```typescript
client.on('response', (event) => {
  console.log(`Request to ${event.url} completed in ${event.duration}ms`);
});

client.on('error', (error) => {
  console.error('API error:', error);
});

client.on('rateLimited', (info) => {
  console.log(`Rate limited. Retry after ${info.retryAfter} seconds`);
});

client.on('retry', (info) => {
  console.log(`Retrying request (attempt ${info.attempt}/${info.maxRetries})`);
});
```

## Error Handling

All SDK methods throw typed exceptions:

```typescript
import {
  SDLCException,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NotFoundError,
  ValidationError
} from '@sdlc/sdln-js';

try {
  await client.users.get('invalid-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('User not found');
  }
}
```

## HTTP Interceptors

Interceptors allow you to modify requests and responses:

```typescript
const client = createClient({
  baseURL: 'https://api.sdlc.cc',
  interceptors: {
    request: [
      (config) => {
        // Add timestamp to all requests
        config.headers['X-Timestamp'] = Date.now().toString();
        return config;
      }
    ],
    response: [
      (response) => {
        // Log successful responses
        console.log('Response:', response.status);
        return response;
      }
    ],
    error: [
      (error) => {
        // Log errors
        console.error('Request failed:', error);
        throw error;
      }
    ]
  }
});
```

## Performance Tips

1. **Reuse client instances** - Create one client and reuse it
2. **Use streaming for large responses** - Use `streamRAGQuery` for large responses
3. **Batch operations** - Use batch methods for multiple operations
4. **Enable caching** - Enable cache in browser client
5. **Monitor performance** - Listen to events to monitor performance