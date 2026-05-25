# Embedding Service

A comprehensive, production-ready embedding generation service for the SDLC.ai platform. This service provides multi-provider support, intelligent caching, batch processing, cost optimization, and quality validation for text embeddings.

## Features

### 🚀 Core Capabilities

- **Multi-Provider Support**: OpenAI, Cohere, and local embedding models with unified interface
- **Intelligent Caching**: Redis-based caching with 24h TTL and 80% hit rate optimization
- **Batch Processing**: Scalable batch processing with queue management and progress tracking
- **Cost Optimization**: Intelligent provider selection with budget management and cost tracking
- **Quality Validation**: Comprehensive embedding quality assessment and validation
- **Metadata Management**: Complete tracking of embedding metadata and audit trails

### 🔧 Advanced Features

- **Provider Abstraction**: Easy switching between embedding providers
- **Circuit Breaker**: Automatic failover and retry logic
- **Compression**: Efficient storage with intelligent compression
- **Real-time Monitoring**: Performance metrics and health checks
- **RESTful API**: Comprehensive API with OpenAPI documentation
- **Multi-tenant**: Complete tenant isolation and resource management

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RESTful API   │    │   Batch Queue   │    │  Cache Manager  │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Provider       │    │  Quality        │    │  Cost           │
│  Manager        │    │  Validator      │    │  Optimizer      │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┴──────────────────────┘
                          ┌─────────────────┐
                          │  Embedding      │
                          │  Providers      │
                          │                 │
                          │  • OpenAI       │
                          │  • Cohere       │
                          │  • Local Models │
                          └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Redis server
- PostgreSQL (optional, for persistent storage)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/embedding
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the service**
   - API: http://localhost:8003
   - Documentation: http://localhost:8003/docs
   - Health Check: http://localhost:8003/health

### Basic Usage

```python
import asyncio
from app.providers.factory import ProviderFactory

async def generate_embeddings():
    # Create OpenAI provider
    provider = ProviderFactory.create_openai_provider(
        api_key="your-openai-key",
        model="text-embedding-3-small"
    )
    
    # Initialize provider
    await provider.initialize()
    
    # Generate single embedding
    result = await provider.generate_embedding(
        "Hello, world!",
        model="text-embedding-3-small"
    )
    
    print(f"Embedding: {result.embedding[:5]}...")  # First 5 dimensions
    print(f"Dimensions: {result.dimensions}")
    print(f"Processing time: {result.processing_time_ms}ms")
    
    # Generate batch embeddings
    texts = [
        "First text",
        "Second text", 
        "Third text"
    ]
    
    batch_result = await provider.generate_batch_embeddings(texts)
    print(f"Generated {len(batch_result.embeddings)} embeddings")
    
    # Cleanup
    await provider.cleanup()

# Run the example
asyncio.run(generate_embeddings())
```

## Configuration

### Environment Variables

```bash
# Application
APP_NAME=Embedding Service
APP_VERSION=1.0.0
DEBUG=false
HOST=0.0.0.0
PORT=8003

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/sdlc
REDIS_URL=redis://localhost:6379/0

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORGANIZATION_ID=your-org-id

# Cohere
COHERE_API_KEY=your-cohere-api-key

# Cache Settings
CACHE_TTL_SECONDS=86400
CACHE_COMPRESSION_ENABLED=true

# Batch Processing
BATCH_MAX_BATCH_SIZE=1000
BATCH_CONCURRENT_BATCHES=5

# Cost Optimization
COST_OPTIMIZATION_ENABLED=true
COST_BUDGET_PER_TENANT=100.0

# Quality Settings
QUALITY_SIMILARITY_THRESHOLD=0.8
QUALITY_CONSISTENCY_THRESHOLD=0.9

# Monitoring
MONITORING_ENABLED=true
MONITORING_METRICS_PORT=9090
```

### Provider Configuration

```python
# OpenAI Provider
openai_provider = ProviderFactory.create_openai_provider(
    api_key="sk-...",
    model="text-embedding-3-small",
    timeout=60,
    max_retries=3
)

# Cohere Provider  
cohere_provider = ProviderFactory.create_cohere_provider(
    api_key="...",
    model="embed-english-v3.0",
    base_url="https://api.cohere.ai/v1"
)

# Local Provider
local_provider = ProviderFactory.create_local_provider(
    models_directory="/app/models",
    device="cpu",  # or "cuda" for GPU
    model="all-MiniLM-L6-v2"
)
```

## API Reference

### Generate Single Embedding

```http
POST /api/v1/embeddings
Content-Type: application/json

{
  "text": "Your text here",
  "provider": "openai",
  "model": "text-embedding-3-small",
  "metadata": {
    "user_id": "user123"
  }
}
```

### Generate Batch Embeddings

```http
POST /api/v1/embeddings/batch
Content-Type: application/json

{
  "texts": ["Text 1", "Text 2", "Text 3"],
  "provider": "openai", 
  "model": "text-embedding-3-small",
  "batch_size": 100
}
```

### Submit Batch Job

```http
POST /api/v1/jobs
Content-Type: application/json

{
  "texts": ["Text 1", "Text 2", ...],
  "provider": "openai",
  "model": "text-embedding-3-small",
  "job_name": "My Batch Job",
  "priority": 5
}
```

### Get Job Status

```http
GET /api/v1/jobs/{job_id}
```

### Get Cache Statistics

```http
GET /api/v1/cache/stats
```

### Get Cost Report

```http
GET /api/v1/costs/report?tenant_id=tenant123&period=30d
```

## Performance Optimization

### Caching Strategy

The service implements intelligent caching with the following strategies:

1. **Content-based Caching**: Cache keys based on text content and model
2. **Compression**: Automatic compression for large embeddings
3. **TTL Management**: 24-hour default TTL with automatic cleanup
4. **Cache Warming**: Pre-populate cache for frequently accessed content

### Batch Processing

1. **Queue Management**: Priority-based job queue with Redis
2. **Parallel Processing**: Configurable concurrent batch processing
3. **Progress Tracking**: Real-time progress updates
4. **Error Handling**: Automatic retry with exponential backoff

### Cost Optimization

1. **Provider Selection**: Intelligent provider selection based on cost/quality
2. **Budget Management**: Per-tenant budget tracking and enforcement
3. **Usage Analytics**: Detailed cost breakdown and forecasting
4. **Dynamic Pricing**: Automatic adaptation to provider pricing changes

## Quality Assurance

### Validation Metrics

- **Similarity Scores**: Cosine similarity validation
- **Consistency Checks**: Cross-provider consistency validation
- **Outlier Detection**: Statistical outlier detection
- **Quality Scoring**: Comprehensive quality assessment

### Monitoring

- **Health Checks**: Provider health monitoring
- **Performance Metrics**: Response time and throughput tracking
- **Error Rates**: Comprehensive error tracking and alerting
- **Resource Usage**: Memory and CPU usage monitoring

## Deployment

### Docker Deployment

```bash
# Build the image
docker build -t embedding-service .

# Run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f embedding-service
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: embedding-service
  template:
    metadata:
      labels:
        app: embedding-service
    spec:
      containers:
      - name: embedding-service
        image: embedding-service:latest
        ports:
        - containerPort: 8003
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: embedding-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Environment Configuration

- **Development**: Local Docker Compose setup
- **Staging**: Kubernetes with staging database
- **Production**: Kubernetes with production-grade configuration

## Monitoring & Observability

### Metrics

The service exposes Prometheus metrics on port 9090:

- `embedding_requests_total`: Total embedding requests
- `embedding_duration_seconds`: Request duration
- `cache_hit_rate`: Cache hit rate
- `provider_errors_total`: Provider error count
- `cost_tracker_total_usd`: Total cost in USD

### Logging

Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "message": "Embedding generated successfully",
  "correlation_id": "abc123",
  "provider": "openai",
  "model": "text-embedding-3-small",
  "duration_ms": 250,
  "token_count": 15
}
```

### Health Checks

```bash
curl http://localhost:8003/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "redis": "healthy",
    "database": "healthy",
    "providers": {
      "openai": "healthy",
      "cohere": "healthy",
      "local": "healthy"
    }
  }
}
```

## Testing

### Running Tests

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Run all tests
pytest tests/ -v

# Run specific test suites
pytest tests/test_providers.py -v
pytest tests/test_cache.py -v
pytest tests/test_batch_processing.py -v

# Run with coverage
pytest --cov=app tests/
```

### Test Coverage

- Unit tests for all core components
- Integration tests for provider interactions
- End-to-end tests for complete workflows
- Performance tests for load testing

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis status
   docker-compose ps redis
   
   # Check Redis logs
   docker-compose logs redis
   ```

2. **OpenAI API Rate Limits**
   ```bash
   # Check rate limit configuration
   grep OPENAI_REQUESTS_PER_MINUTE .env
   
   # Monitor usage in logs
   docker-compose logs embedding-service | grep "rate limit"
   ```

3. **Memory Issues with Local Models**
   ```bash
   # Check available memory
   docker stats embedding-service
   
   # Reduce batch size
   # Update BATCH_MAX_BATCH_SIZE in .env
   ```

### Performance Tuning

1. **Cache Optimization**
   - Increase Redis memory allocation
   - Adjust cache TTL based on usage patterns
   - Enable cache compression for large embeddings

2. **Batch Processing**
   - Tune concurrent batch count based on available resources
   - Adjust batch size for optimal throughput
   - Monitor queue length and processing times

3. **Provider Selection**
   - Use cost optimization for high-volume usage
   - Consider local models for sensitive data
   - Implement provider failover for reliability

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd services/embedding

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt

# Run pre-commit hooks
pre-commit install

# Start development services
docker-compose -f docker-compose.dev.yml up -d redis postgres

# Run tests
pytest tests/ -v
```

## License

This project is licensed under the Business Source License 1.1 - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs.sdlc.ai](https://docs.sdlc.ai)
- **Issues**: [GitHub Issues](https://github.com/sdlc-ai/platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sdlc-ai/platform/discussions)
- **Email**: support@sdlc.ai

---

Built with ❤️ by the SDLC.ai team