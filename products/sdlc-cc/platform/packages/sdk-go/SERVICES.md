# SDLC.ai Go SDK Services

This document provides an overview of all services implemented in the SDLC.ai Go SDK.

## Overview

The Go SDK provides comprehensive access to all SDLC.ai platform APIs through idiomatic Go interfaces. All services follow consistent patterns and provide:

- **Context-aware operations** with proper cancellation and timeouts
- **Structured error handling** with detailed error types
- **Type safety** with strongly typed requests and responses
- **Concurrent-safe operations** suitable for high-performance applications
- **Comprehensive retry logic** with exponential backoff
- **Middleware support** for cross-cutting concerns

## Available Services

### 1. Users Service (`UserService`)

Handles user management operations including CRUD operations, bulk operations, and user activity tracking.

**Key Features:**
- User creation, update, deletion
- Bulk operations for multiple users
- Password management (change, reset)
- User suspension/unsuspension
- Activity tracking and reporting
- Email-based user lookup

**Key Methods:**
- `Create(ctx, *CreateUserRequest) (*User, error)`
- `Get(ctx, userID) (*User, error)`
- `GetByEmail(ctx, email) (*User, error)`
- `List(ctx, *ListOptions) (*PaginatedResponse[User], error)`
- `Update(ctx, userID, *UpdateUserRequest) (*User, error)`
- `BulkCreate(ctx, []*CreateUserRequest) (*BulkResult[User], error)`
- `ChangePassword(ctx, userID, currentPassword, newPassword) error`

### 2. Tenants Service (`TenantService`)

Manages multi-tenant architecture including hierarchy management, usage tracking, and configuration.

**Key Features:**
- Tenant CRUD operations
- Hierarchical tenant structures
- Usage statistics and monitoring
- Settings management
- Tenant suspension/unsuspension
- Child tenant management

**Key Methods:**
- `Create(ctx, *CreateTenantRequest) (*Tenant, error)`
- `Get(ctx, tenantID) (*Tenant, error)`
- `GetByDomain(ctx, domain) (*Tenant, error)`
- `GetHierarchy(ctx, tenantID) (*TenantHierarchy, error)`
- `GetUsage(ctx, tenantID) (*TenantUsage, error)`
- `CreateChild(ctx, parentID, *CreateTenantRequest) (*Tenant, error)`
- `UpdateSettings(ctx, tenantID, *TenantSettings) error`

### 3. Documents Service (`DocumentService`)

Handles document upload, processing, content extraction, and management.

**Key Features:**
- File upload with multipart form data
- Content extraction and chunking
- Document search and filtering
- Batch operations
- Processing status tracking
- Document download

**Key Methods:**
- `Upload(ctx, *UploadRequest) (*Document, error)`
- `UploadFromPath(ctx, filePath, tenantID, DocumentMetadata) (*Document, error)`
- `Get(ctx, documentID) (*Document, error)`
- `GetContent(ctx, documentID) (*DocumentContent, error)`
- `Search(ctx, query, *SearchOptions) (*SearchResponse[Document], error)`
- `BatchDelete(ctx, []string) (*BulkDeleteResult, error)`
- `Download(ctx, documentID) (io.ReadCloser, *DocumentInfo, error)`

### 4. RAG Service (`RAGService`)

Provides Retrieval-Augmented Generation capabilities with advanced query processing and conversation management.

**Key Features:**
- Query processing with context retrieval
- Streaming responses for real-time interaction
- Conversation management
- Citation generation
- Feedback collection
- Advanced search strategies

**Key Methods:**
- `Query(ctx, *QueryRequest) (*RAGResponse, error)`
- `QueryStream(ctx, *QueryRequest) (<-chan *StreamingRAGResponse, error)`
- `CreateConversation(ctx, tenantID, userID, metadata) (*Conversation, error)`
- `GetHistory(ctx, conversationID, *ListOptions) (*PaginatedResponse[ConversationMessage], error)`
- `SubmitFeedback(ctx, queryID, *FeedbackRequest) error`
- `BatchEvaluate(ctx, []PolicyEvaluationRequest) ([]*PolicyEvaluationResult, error)`

### 5. Vector Service (`VectorService`)

Manages vector database operations including indexing, similarity search, and namespace management.

**Key Features:**
- Vector creation and upsertion
- Similarity search with multiple algorithms
- Index management (HNSW, IVF, Flat)
- Namespace isolation
- Batch operations
- Performance optimization

**Key Methods:**
- `Create(ctx, *VectorCreateRequest) (*VectorCreateResult, error)`
- `Upsert(ctx, *VectorCreateRequest) (*VectorCreateResult, error)`
- `Search(ctx, *SearchRequest) (*SearchResponse, error)`
- `BatchSearch(ctx, []SearchRequest) ([]*SearchResponse, error)`
- `CreateIndex(ctx, *CreateIndexRequest) (*Index, error)`
- `CreateNamespace(ctx, tenantID, name, description) (*Namespace, error)`
- `GetStats(ctx, tenantID, namespace) (*VectorStats, error)`

**Utility Functions:**
- `CosineSimilarity(a, b []float64) (float64, error)`
- `EuclideanDistance(a, b []float64) (float64, error)`
- `DotProduct(a, b []float64) (float64, error)`

### 6. Policies Service (`PoliciesService`)

Handles policy management, evaluation, and compliance monitoring.

**Key Features:**
- Policy CRUD operations
- Policy evaluation engine
- Template-based policy creation
- Usage tracking and metrics
- Policy testing
- Batch evaluation

**Key Methods:**
- `Create(ctx, *CreatePolicyRequest) (*Policy, error)`
- `Evaluate(ctx, *PolicyEvaluationRequest) (*PolicyEvaluationResult, error)`
- `BatchEvaluate(ctx, []PolicyEvaluationRequest) ([]*PolicyEvaluationResult, error)`
- `Test(ctx, tenantID, policyID, testData) (*PolicyTestResult, error)`
- `CreateFromTemplate(ctx, tenantID, templateID, variables, *CreatePolicyRequest) (*Policy, error)`
- `GetTemplates(ctx, *TemplateListOptions) (*PaginatedResponse[PolicyTemplate], error)`
- `GetPolicyUsage(ctx, tenantID, policyID, *TimeRange) (*PolicyUsage, error)`

### 7. LLM Service (`LLMService`)

Provides access to Large Language Models with support for chat, completions, embeddings, and fine-tuning.

**Key Features:**
- Chat completions with streaming
- Text completions
- Embeddings generation
- Content moderation
- Fine-tuning job management
- Model usage tracking

**Key Methods:**
- `CreateChatCompletion(ctx, *ChatCompletionRequest) (*ChatCompletionResponse, error)`
- `CreateChatCompletionStream(ctx, *ChatCompletionRequest) (<-chan *StreamingChatCompletionChunk, error)`
- `CreateCompletion(ctx, *CompletionRequest) (*CompletionResponse, error)`
- `CreateEmbedding(ctx, *EmbeddingRequest) (*EmbeddingResponse, error)`
- `CreateModeration(ctx, *ModerationRequest) (*ModerationResponse, error)`
- `CreateFineTuningJob(ctx, *FineTuningRequest) (*FineTuningJob, error)`
- `GetUsage(ctx, tenantID, *TimeRange) (*LLMUsage, error)`

### 8. Monitoring Service (`MonitoringService`)

Comprehensive monitoring and alerting for system health and performance.

**Key Features:**
- Metrics collection and querying
- Alert rule management
- Dashboard creation and management
- Log querying and analysis
- Distributed tracing
- Health checks

**Key Methods:**
- `PushMetrics(ctx, tenantID, []Metric) error`
- `QueryMetrics(ctx, []MetricQuery) ([]MetricSeries, error)`
- `CreateAlertRule(ctx, tenantID, *CreateAlertRuleRequest) (*AlertRule, error)`
- `ListAlerts(ctx, tenantID, *AlertListOptions) (*PaginatedResponse[Alert], error)`
- `CreateDashboard(ctx, tenantID, *Dashboard) (*Dashboard, error)`
- `GetHealth(ctx, tenantID, []string) (*HealthStatus, error)`
- `QueryLogs(ctx, tenantID, *LogQuery) (*LogResponse, error)`
- `SearchTraces(ctx, tenantID, *TraceSearchOptions) (*PaginatedResponse[Trace], error)`

### 9. WebSocket Service (`WebSocketService`)

Real-time communication through WebSocket connections.

**Key Features:**
- Persistent WebSocket connections
- Event subscription and unsubscription
- Custom message handling
- Connection management
- Broadcasting capabilities
- Automatic reconnection

**Key Methods:**
- `Connect(ctx) (*Connection, error)`
- `ConnectWithAuth(ctx, token) (*Connection, error)`
- `Subscribe(*SubscribeRequest) error`
- `Unsubscribe(*UnsubscribeRequest) error`
- `Send(messageType string, data map[string]interface{}) error`
- `BroadcastEvent(ctx, *BroadcastRequest) error`
- `ListActiveConnections(ctx, tenantID, *ListOptions) (*PaginatedResponse[ConnectionInfo], error)`

## Common Patterns

### Error Handling

All services return structured errors with detailed information:

```go
user, err := client.Users.Get(ctx, userID)
if err != nil {
    var apiErr *sdln.APIError
    if errors.As(err, &apiErr) {
        switch apiErr.Type {
        case sdln.ErrTypeNotFound:
            log.Printf("User not found: %s", userID)
        case sdln.ErrTypeUnauthorized:
            log.Printf("Unauthorized access")
        default:
            log.Printf("API error: %s", apiErr.Message)
        }
        return
    }
    log.Printf("Unexpected error: %v", err)
    return
}
```

### Pagination

List operations support pagination:

```go
users, err := client.Users.List(ctx, &sdln.ListOptions{
    Page:     1,
    PageSize: 20,
    SortBy:   "created_at",
    SortDesc: true,
})
```

### Bulk Operations

Many services support bulk operations for efficiency:

```go
result, err := client.Users.BulkCreate(ctx, userRequests)
if err != nil {
    return err
}

log.Printf("Created %d users, failed %d", len(result.Success), len(result.Failed))
```

### Streaming Operations

Streaming responses for real-time data:

```go
stream, err := client.RAG.QueryStream(ctx, queryRequest)
if err != nil {
    return err
}

for chunk := range stream {
    if chunk.Type == "chunk" {
        fmt.Print(chunk.Content)
    }
}
```

### Concurrent Operations

All services are designed for concurrent use:

```go
var wg sync.WaitGroup
semaphore := make(chan struct{}, 10) // Limit to 10 concurrent operations

for _, docID := range documentIDs {
    wg.Add(1)
    go func(id string) {
        defer wg.Done()
        semaphore <- struct{}{}
        defer func() { <-semaphore }()

        doc, err := client.Documents.Get(ctx, id)
        if err != nil {
            log.Printf("Error processing document %s: %v", id, err)
            return
        }
        processDocument(doc)
    }(docID)
}

wg.Wait()
```

## Configuration

### Client Configuration

```go
config := &sdln.Config{
    BaseURL:      "https://api.sdlc.cc",
    Timeout:      30 * time.Second,
    RetryConfig:  sdln.DefaultRetryConfig(),
    Debug:        false,
}

client, err := sdln.NewClient(config, auth.WithAPIKey("your-api-key"))
```

### Authentication

Multiple authentication methods are supported:

```go
// API Key
client, err := sdln.NewClient(config, auth.WithAPIKey("key"))

// JWT Token
client, err := sdln.NewClient(config, auth.WithJWT("token"))

// OAuth 2.0
client, err := sdln.NewClient(config, auth.WithOAuth(oauthConfig))

// mTLS
client, err := sdln.NewClient(config, auth.WithMTLS(mtlsConfig))
```

## Performance

The SDK is optimized for high-performance scenarios:

- **Connection pooling** with configurable limits
- **Concurrent-safe** operations using goroutine pools
- **Efficient serialization** with minimal allocations
- **Streaming support** for large responses
- **Circuit breaker** pattern for fault tolerance
- **Retry logic** with exponential backoff and jitter

## Security

- **Zero-trust architecture** with secure defaults
- **Encryption in transit** using TLS
- **Key management** with secure storage
- **Input validation** with comprehensive sanitization
- **Audit logging** for compliance
- **Fine-grained permissions** with policy enforcement

## Examples

See the `examples/` directory for comprehensive usage examples:

- `basic/` - Basic SDK usage patterns
- `concurrent/` - High-performance concurrent operations
- `streaming/` - Real-time streaming operations
- `monitoring/` - System monitoring and alerting
- `policies/` - Policy management and evaluation

## Support

- **Documentation**: [https://pkg.go.dev/github.com/SDLC/sdln-sdk-go](https://pkg.go.dev/github.com/SDLC/sdln-sdk-go)
- **Issues**: [GitHub Issues](https://github.com/SDLC/sdln-sdk-go/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SDLC/sdln-sdk-go/discussions)
- **Examples**: [Repository Examples](https://github.com/SDLC/sdln-sdk-go/tree/main/examples)