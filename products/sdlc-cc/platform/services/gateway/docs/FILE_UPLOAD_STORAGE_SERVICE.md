# File Upload and Storage Service

A comprehensive file handling system for the SDLC.ai platform with multi-format support, secure storage, virus scanning, metadata extraction, access controls, and retention policies.

## Overview

The File Upload and Storage Service provides enterprise-grade file handling capabilities with the following key features:

- **Multi-part Upload Support**: Handle large files efficiently with progress tracking and resumable uploads
- **Secure Cloudflare R2 Storage**: Encrypted storage with tenant isolation
- **Advanced Security**: Real-time virus scanning with ClamAV integration
- **Rich Metadata Extraction**: Comprehensive file analysis for images, documents, and more
- **Granular Access Control**: Role-based permissions and sharing capabilities
- **Automated Retention**: Configurable policies for file lifecycle management
- **Real-time Monitoring**: Comprehensive metrics, analytics, and alerting

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  File Management │───▶│  Cloudflare R2  │
│                 │    │      API         │    │    Storage      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Security &     │
                       │   Validation     │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Metadata       │
                       │   Extraction     │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Access         │
                       │   Control        │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Monitoring     │
                       │   & Analytics    │
                       └──────────────────┘
```

## Components

### 1. Multi-Part Upload Service

**Location**: `internal/domain/services/multipart_upload_service.go`

Handles large file uploads with the following capabilities:

- **Chunked Upload**: Files are split into configurable chunks (default 8MB)
- **Progress Tracking**: Real-time progress updates with callbacks
- **Resumable Uploads**: Resume interrupted uploads from where they left off
- **Parallel Processing**: Upload multiple chunks concurrently
- **Session Management**: Track upload sessions with expiration
- **Error Recovery**: Automatic retry with exponential backoff

**Key Features**:
```go
// Initiate a new upload session
session, err := multipartService.InitiateUpload(ctx, &InitiateUploadRequest{
    TenantID:     tenantID,
    UserID:       userID,
    OriginalName: "large-document.pdf",
    FileSize:     fileSize,
    Checksum:     fileChecksum,
})

// Upload chunks with progress tracking
progressCallback := func(progress *UploadProgress) {
    fmt.Printf("Progress: %.1f%%\n", progress.Progress)
}
multipartService.RegisterProgressCallback(session.ID, progressCallback)

// Upload individual chunks
for i := 0; i < totalChunks; i++ {
    chunkInfo, err := multipartService.UploadChunk(ctx, &UploadChunkRequest{
        SessionID: session.ID,
        ChunkIndex: i,
        Content:    chunkData,
        Checksum:   chunkChecksum,
    })
}

// Complete the upload
response, err := multipartService.CompleteUpload(ctx, session.ID)
```

### 2. Cloudflare R2 Integration

**Location**: `internal/infrastructure/storage/r2_provider.go`

Provides secure, scalable object storage with the following features:

- **Tenant Isolation**: Files are stored in tenant-specific paths
- **Encryption**: Server-side encryption with customer-managed keys
- **Presigned URLs**: Temporary secure access links
- **Multi-part Support**: Efficient handling of large files
- **Metadata Storage**: Rich metadata attached to objects
- **Health Monitoring**: Connection health checks and metrics

**Configuration**:
```yaml
r2:
  account_id: "your-cloudflare-account-id"
  access_key_id: "your-access-key"
  secret_access_key: "your-secret-key"
  bucket_name: "sdlc-files"
  region: "auto"
  enable_encryption: true
  public_url: "https://files.yourdomain.com"
```

### 3. Virus Scanning Service

**Location**: `internal/infrastructure/storage/clamav_scanner.go`

Real-time malware detection with ClamAV integration:

- **Real-time Scanning**: Scan files during upload process
- **Signature Updates**: Automatic virus database updates
- **Batch Processing**: Efficient scanning of multiple files
- **Quarantine**: Automatic isolation of infected files
- **Caching**: Performance optimization with result caching
- **Health Monitoring**: Regular engine health checks

**Configuration**:
```yaml
clamav:
  use_daemon: true
  clamd_socket: "/var/run/clamav/clamd.ctl"
  clamd_host: "localhost"
  clamd_port: 3310
  timeout: "5m"
  max_file_size: "100MB"
  enable_cache: true
  cache_ttl: "1h"
```

### 4. Enhanced Metadata Extractor

**Location**: `internal/infrastructure/storage/enhanced_metadata_extractor.go`

Comprehensive file analysis supporting multiple formats:

**Supported Formats**:
- **Images**: EXIF data, dimensions, camera info, GPS coordinates
- **PDF**: Document properties, page count, author information
- **Office Documents**: Title, author, word count, creation dates
- **Text Files**: Character/word counts, language detection
- **Code Files**: Syntax highlighting, complexity analysis

**Features**:
```go
// Extract comprehensive metadata
metadata, err := extractor.Extract(ctx, fileContent, "application/pdf")

// Result includes:
// - Basic file information
// - Format-specific metadata
// - Text preview (first 500 characters)
// - Content analysis (entropy, readability)
// - Classification and categorization
```

### 5. Access Control System

**Location**: `internal/infrastructure/storage/access_control_service.go`

Granular access control with role-based permissions:

**Access Roles**:
- **Owner**: Full control (read, write, delete, share, download, print, copy)
- **Editor**: Read, write, download, print, copy
- **Viewer**: Read, download
- **Commenter**: Read, download, comment

**Features**:
- **Policy-Based Access**: OPA-style policy evaluation
- **Temporary Access**: Time-limited permissions
- **Share Links**: Secure public access with expiration
- **Audit Logging**: Complete access audit trail
- **Session Management**: User session tracking

**Example Usage**:
```go
// Check access permissions
decision, err := accessControl.CanAccess(ctx, &AccessRequest{
    TenantID:   tenantID,
    UserID:     userID,
    DocumentID: documentID,
    Action:     ActionRead,
    Context: RequestContext{
        IPAddress: "192.168.1.1",
        UserAgent: "Mozilla/5.0...",
    },
})

// Grant access
err = accessControl.GrantAccess(ctx, &GrantAccessRequest{
    TenantID:   tenantID,
    DocumentID: documentID,
    UserID:     targetUserID,
    Role:       "viewer",
    ExpiresAt:  &time.Time{}, // Optional expiration
})

// Generate share link
shareLink, err := accessControl.GenerateShareLink(ctx, &GenerateShareLinkRequest{
    TenantID:    tenantID,
    DocumentID:  documentID,
    Permissions: []string{"read", "download"},
    ExpiresAt:   &time.Now().Add(24 * time.Hour),
})
```

### 6. File Management API

**Location**: `internal/interfaces/http/handlers/file_management.go`

RESTful API endpoints for file operations:

**Endpoints**:
- `POST /api/v1/files/multipart/initiate` - Initiate multipart upload
- `POST /api/v1/files/multipart/{sessionId}/chunks` - Upload chunk
- `POST /api/v1/files/multipart/{sessionId}/complete` - Complete upload
- `GET /api/v1/files/multipart/{sessionId}/progress` - Get upload progress
- `GET /api/v1/files` - List files with filtering
- `GET /api/v1/files/{fileId}` - Get file details
- `PUT /api/v1/files/{fileId}` - Update file metadata
- `DELETE /api/v1/files/{fileId}` - Delete file
- `GET /api/v1/files/{fileId}/download` - Download file
- `GET /api/v1/files/{fileId}/metadata` - Get file metadata
- `POST /api/v1/files/{fileId}/access/grant` - Grant access
- `POST /api/v1/files/{fileId}/access/revoke` - Revoke access
- `GET /api/v1/files/{fileId}/access` - List access permissions

### 7. Retention and Cleanup Service

**Location**: `internal/infrastructure/storage/retention_cleanup_service.go`

Automated file lifecycle management:

**Retention Policies**:
- **Time-based**: Delete files after specified period
- **Content-based**: Rules based on file type, classification, tags
- **Size-based**: Clean up large or old files
- **Access-based**: Remove files not accessed recently
- **Legal Hold**: Preserve files for compliance requirements

**Actions**:
- **Delete**: Permanent file removal
- **Archive**: Move to long-term storage
- **Compress**: Reduce storage footprint
- **Flag**: Mark for review
- **Notify**: Send alerts to administrators

**Example Policy**:
```go
policy := &RetentionPolicy{
    Name:        "Standard Document Retention",
    Description: "Delete old documents after 1 year",
    Rules: []RetentionRule{
        {
            Condition: RetentionCondition{
                ContentTypes:  []string{"application/pdf", "text/plain"},
                CreatedBefore: &time.Time{}, // 1 year ago
            },
            Action: RetentionAction{
                Type:   RetentionActionDelete,
                Backup: true,
                Notify: true,
            },
        },
    },
}
```

### 8. Monitoring and Analytics

**Location**: `internal/infrastructure/storage/monitoring_analytics_service.go`

Comprehensive monitoring and analytics:

**Metrics Collection**:
- **Upload Metrics**: Success rates, file sizes, processing times
- **Storage Metrics**: Usage, growth trends, capacity planning
- **Performance Metrics**: Response times, throughput, error rates
- **Security Metrics**: Virus detection, access patterns
- **User Metrics**: Activity patterns, feature usage

**Real-time Monitoring**:
```go
// Record custom metrics
service.RecordMetric(ctx, &Metric{
    Type:  MetricTypeUpload,
    Name:  "upload_success_rate",
    Value: 98.5,
    Unit:  "percent",
    Tags:  map[string]string{"tenant": tenantID},
})

// Record analytics events
service.RecordEvent(ctx, &AnalyticsEvent{
    Type: "user_action",
    Name: "file_shared",
    Data: map[string]interface{}{
        "file_id":    fileID,
        "share_type": "link",
    },
})

// Get system health
health, err := service.GetSystemHealth(ctx)
```

**Alerting**:
- **Threshold-based**: Configurable alert thresholds
- **Multi-channel**: Email, Slack, webhook notifications
- **Escalation**: Automatic escalation for critical issues
- **Acknowledgment**: Alert acknowledgment and resolution tracking

## Configuration

### Environment Variables

```bash
# R2 Storage Configuration
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=sdlc-files
R2_ENABLE_ENCRYPTION=true

# ClamAV Configuration
CLAMAV_USE_DAEMON=true
CLAMAV_CLAMD_SOCKET=/var/run/clamav/clamd.ctl
CLAMAV_TIMEOUT=300s
CLAMAV_MAX_FILE_SIZE=104857600

# Upload Configuration
UPLOAD_MAX_FILE_SIZE=107374182400  # 100GB
UPLOAD_CHUNK_SIZE=8388608           # 8MB
UPLOAD_MAX_CONCURRENT_CHUNKS=5
UPLOAD_TIMEOUT=7200s                 # 2 hours

# Monitoring Configuration
MONITORING_ENABLED=true
METRICS_INTERVAL=60s
ANALYTICS_INTERVAL=300s
ALERTS_ENABLED=true
```

### Docker Configuration

```yaml
version: '3.8'
services:
  file-service:
    build: .
    environment:
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - CLAMAV_USE_DAEMON=true
      - CLAMAV_CLAMD_SOCKET=/var/run/clamav/clamd.ctl
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
    depends_on:
      - clamav
      - postgres

  clamav:
    image: clamav/clamav:latest
    volumes:
      - clamav_db:/var/lib/clamav
      - /var/run/clamav:/var/run/clamav
```

## Security Considerations

### Encryption
- **In Transit**: TLS 1.3 for all API communications
- **At Rest**: AES-256 encryption for stored files
- **Key Management**: Tenant-specific encryption keys

### Access Control
- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control (RBAC)
- **Audit Trail**: Complete access logging
- **Session Management**: Secure session handling

### Data Protection
- **Virus Scanning**: Real-time malware detection
- **Content Validation**: File type and size validation
- **Privacy**: GDPR compliance features
- **Data Isolation**: Multi-tenant data separation

## Performance Optimization

### Caching
- **Metadata Cache**: Redis-based metadata caching
- **Content Cache**: Temporary file content caching
- **Scan Results**: Virus scan result caching
- **Access Decisions**: Policy decision caching

### Scalability
- **Horizontal Scaling**: Stateless service architecture
- **Load Balancing**: Request distribution across instances
- **Storage Scaling**: R2 auto-scaling capabilities
- **Database Optimization**: Efficient queries and indexing

### Monitoring
- **Real-time Metrics**: OpenTelemetry integration
- **Performance Tracking**: Response time and throughput monitoring
- **Resource Usage**: CPU, memory, and storage monitoring
- **Error Tracking**: Comprehensive error logging and alerting

## Deployment

### Cloudflare Workers Deployment

```bash
# Build the service
go build -o file-service ./cmd/server

# Deploy to Cloudflare Workers
wrangler deploy

# Configure environment variables
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: file-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: file-service
  template:
    metadata:
      labels:
        app: file-service
    spec:
      containers:
      - name: file-service
        image: sdlc/file-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: R2_ACCOUNT_ID
          valueFrom:
            secretKeyRef:
              name: r2-credentials
              key: account-id
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Testing

### Unit Tests

```bash
# Run all tests
go test ./...

# Run specific package tests
go test ./internal/services/...

# Run with coverage
go test -cover ./...
```

### Integration Tests

```bash
# Run integration tests
go test -tags=integration ./tests/integration/...

# Run performance tests
go test -tags=performance ./tests/performance/...
```

### Load Testing

```bash
# Install k6
https://k6.io/docs/getting-started/installation/

# Run load test
k6 run tests/load/file-upload.js
```

## Troubleshooting

### Common Issues

1. **Upload Failures**
   - Check R2 credentials and connectivity
   - Verify file size limits
   - Check virus scanner availability

2. **Slow Performance**
   - Monitor chunk upload settings
   - Check network bandwidth
   - Review caching configuration

3. **Access Denied Errors**
   - Verify user permissions
   - Check policy configurations
   - Review session validity

### Debug Logging

```go
// Enable debug logging
logger.SetLevel(logrus.DebugLevel)

// Trace specific operations
ctx, span := tracer.Start(ctx, "operation-name")
defer span.End()
```

### Health Checks

```bash
# Check service health
curl http://localhost:8080/health

# Check specific components
curl http://localhost:8080/health/storage
curl http://localhost:8080/health/scanner
curl http://localhost:8080/health/monitoring
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under AGPL-3.0-or-later. See the [LICENSE](../../../LICENSE) and [COMMERCIAL.md](../../../COMMERCIAL.md) files.

## Support

- **Documentation**: [docs.sdlc.cc](https://docs.sdlc.cc)
- **Issues**: [GitHub Issues](https://github.com/finsavvyai/sdlc-platform/issues)
- **Support**: support@sdlc.cc