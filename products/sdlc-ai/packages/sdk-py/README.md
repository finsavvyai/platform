# SDLC.ai Python SDK v3

[![PyPI version](https://badge.fury.io/py/sdlc-sdk.svg)](https://badge.fury.io/py/sdlc-sdk)
[![Python versions](https://img.shields.io/pypi/pyversions/sdlc-sdk.svg)](https://pypi.org/project/sdlc-sdk/)
[![Test coverage](https://codecov.io/gh/sdlc-ai/sdlc-sdk-python/branch/main/graph/badge.svg)](https://codecov.io/gh/sdlc-ai/sdlc-sdk-python)
[![Documentation](https://img.shields.io/badge/docs-latest-brightgreen.svg)](https://sdk.sdlc.ai)

The official Python SDK for the SDLC.ai Secure Data Learning Platform v3 - a Cloudflare-native, zero-trust middleware fabric for secure AI-data interactions.

## Features

- 🚀 **Full API Coverage** - 100% of platform endpoints supported
- 🔒 **Enterprise Security** - Zero-trust architecture with comprehensive security controls
- 🎯 **Type Safe** - Full type hints with Pydantic validation
- ⚡ **High Performance** - Async/await support with connection pooling
- 📊 **Monitoring Ready** - Built-in metrics and logging
- 🧪 **Well Tested** - 95%+ test coverage with comprehensive test suite
- 📚 **Rich Documentation** - Auto-generated API docs with examples

## Quick Start

### Installation

```bash
pip install sdlc-sdk
```

### Basic Usage

```python
import asyncio
from sdlc_sdk import SDLCClient
from sdlc_sdk.auth import APIKeyAuth

# Synchronous client
client = SDLCClient(
    auth=APIKeyAuth(api_key="your-api-key"),
    base_url="https://api.sdlc.ai"
)

# Login
auth_response = client.auth.login_with_api_key()
print(f"Authenticated as: {auth_response.user.email}")

# List users
users = client.users.list()
print(f"Found {len(users)} users")

# Upload a document
with open("document.pdf", "rb") as f:
    document = client.documents.upload(
        file=f,
        name="My Document",
        tenant_id="tenant-123"
    )
print(f"Uploaded document: {document.id}")

# Perform RAG query
result = client.rag.query(
    query="What are the security requirements?",
    tenant_id="tenant-123",
    document_ids=[document.id]
)
print(f"Answer: {result.answer}")
```

### Asynchronous Usage

```python
import asyncio
from sdlc_sdk import AsyncSDLCClient
from sdlc_sdk.auth import OAuthAuth

async def main():
    client = AsyncSDLCClient(
        auth=OAuthAuth(
            client_id="your-client-id",
            client_secret="your-client-secret"
        ),
        base_url="https://api.sdlc.ai"
    )
    
    # OAuth flow
    await client.auth.oauth_flow()
    
    # Parallel operations
    users, tenants = await asyncio.gather(
        client.users.list(),
        client.tenants.list()
    )
    
    print(f"Users: {len(users)}, Tenants: {len(tenants)}")
    
    await client.close()

asyncio.run(main())
```

## Authentication

The SDK supports multiple authentication methods:

### API Key Authentication

```python
from sdlc_sdk import SDLCClient
from sdlc_sdk.auth import APIKeyAuth

client = SDLCClient(
    auth=APIKeyAuth(api_key="your-api-key")
)
```

### OAuth 2.0

```python
from sdlc_sdk.auth import OAuthAuth

auth = OAuthAuth(
    client_id="your-client-id",
    client_secret="your-client-secret",
    redirect_uri="https://your-app.com/callback"
)
```

### mTLS Authentication

```python
from sdlc_sdk.auth import MTLSAuth

auth = MTLSAuth(
    cert_path="path/to/cert.pem",
    key_path="path/to/key.pem"
)
```

## Core Modules

### User Management

```python
# Create user
user = client.users.create(
    email="user@example.com",
    name="John Doe",
    role="member",
    tenant_id="tenant-123"
)

# Bulk operations
users = client.users.bulk_create([
    {"email": "user1@example.com", "name": "User 1"},
    {"email": "user2@example.com", "name": "User 2"},
])

# Update permissions
client.users.update_permissions(
    user_id="user-123",
    permissions=["read:documents", "write:documents"]
)
```

### Document Processing

```python
# Upload with metadata
document = client.documents.upload(
    file=open("doc.pdf", "rb"),
    name="Important Document",
    tenant_id="tenant-123",
    metadata={"category": "legal", "priority": "high"},
    extract_text=True,
    chunk_for_rag=True
)

# Process with AI
processing = client.documents.process_with_ai(
    document_id=document.id,
    operations=["extract_entities", "summarize", "classify"]
)

# Stream processing status
for status in client.documents.stream_processing(document_id=document.id):
    print(f"Status: {status.stage} - {status.progress}%")
```

### RAG Operations

```python
# Query with context
result = client.rag.query(
    query="What are the compliance requirements?",
    tenant_id="tenant-123",
    filters={
        "document_type": "policy",
        "date_range": {"start": "2023-01-01", "end": "2023-12-31"}
    },
    retrieval_config={
        "max_results": 5,
        "similarity_threshold": 0.8,
        "include_citations": True
    }
)

# Hybrid search
results = client.rag.hybrid_search(
    query="security protocols",
    tenant_id="tenant-123",
    semantic_weight=0.7,
    keyword_weight=0.3
)
```

### Vector Search

```python
# Semantic search
results = client.vector.search(
    query_vector=embedding,
    tenant_id="tenant-123",
    top_k=10,
    filters={"category": "technical"}
)

# Batch similarity
similarities = client.vector.batch_similarity(
    query_vectors=[embedding1, embedding2],
    document_ids=["doc1", "doc2", "doc3"]
)
```

### Policy Management

```python
# Create policy
policy = client.policies.create(
    name="Data Retention Policy",
    tenant_id="tenant-123",
    rules=[
        {
            "condition": "document.category == 'PII'",
            "action": "encrypt",
            "priority": 1
        }
    ]
)

# Test policy
test_result = client.policies.test(
    policy_id=policy.id,
    test_data={"document": {"category": "PII", "content": "..."}}
)

# Deploy with versioning
deployment = client.policies.deploy(
    policy_id=policy.id,
    version="1.0.0",
    deployment_strategy="blue_green"
)
```

### LLM Gateway

```python
# Chat completion
response = client.llm.chat(
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Explain quantum computing"}
    ],
    model="gpt-4",
    temperature=0.7,
    max_tokens=1000
)

# Streaming response
async for chunk in client.llm.chat_stream(
    messages=[{"role": "user", "content": "Tell me a story"}],
    model="gpt-3.5-turbo"
):
    print(chunk.content, end="")

# Embeddings
embeddings = client.llm.create_embeddings(
    texts=["text1", "text2", "text3"],
    model="text-embedding-ada-002"
)
```

### Monitoring

```python
# Get metrics
metrics = client.monitoring.get_metrics(
    tenant_id="tenant-123",
    metric_names=["api_requests", "response_time", "error_rate"],
    time_range="1h"
)

# Check health
health = client.monitoring.health_check()
print(f"API Status: {health.status}")

# Get audit logs
logs = client.monitoring.get_audit_logs(
    tenant_id="tenant-123",
    event_types=["user.login", "document.access"],
    limit=100
)
```

## Security Features

The SDK implements enterprise-grade security:

- **Zero-Trust Architecture** - Every request is authenticated and authorized
- **Automatic Token Management** - JWT refresh with secure storage
- **Input Validation** - Pydantic models prevent injection attacks
- **Encryption** - All sensitive data is encrypted at rest and in transit
- **Audit Logging** - All operations are logged for compliance
- **Rate Limiting** - Built-in protection against API abuse

## Error Handling

```python
from sdlc_sdk.exceptions import (
    AuthenticationError,
    RateLimitError,
    ValidationError,
    APIError
)

try:
    result = client.rag.query(query="test", tenant_id="tenant-123")
except AuthenticationError:
    print("Authentication failed - check your credentials")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after} seconds")
except ValidationError as e:
    print(f"Invalid input: {e.errors}")
except APIError as e:
    print(f"API error: {e.message} (code: {e.code})")
```

## Configuration

```python
from sdlc_sdk import SDLCClient
from sdlc_sdk.config import Config

config = Config(
    base_url="https://api.sdlc.ai",
    timeout=30.0,
    max_retries=3,
    retry_backoff=1.0,
    enable_logging=True,
    log_level="INFO",
    cache_ttl=300,
    rate_limit=100  # requests per minute
)

client = SDLCClient(config=config)
```

## Development

### Install for development

```bash
git clone https://github.com/sdlc-ai/sdlc-sdk-python.git
cd sdlc-sdk-python
pip install -e ".[dev]"
```

### Run tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=sdlc_sdk --cov-report=html

# Run specific test categories
pytest -m unit
pytest -m integration
pytest -m security
```

### Code formatting

```bash
black sdlc_sdk tests
ruff check sdlc_sdk tests
mypy sdlc_sdk
```

## Performance

The SDK is optimized for performance:

- API calls: <100ms (p95)
- Authentication: <50ms
- Connection pooling with keep-alive
- Automatic batching for bulk operations
- Lazy loading for large responses
- Streaming support for file uploads/downloads

## Requirements

- Python 3.9+
- httpx
- pydantic>=2.4.0
- tenacity
- structlog
- cryptography

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: [https://sdk.sdlc.ai](https://sdk.sdlc.ai)
- Issues: [GitHub Issues](https://github.com/sdlc-ai/sdlc-sdk-python/issues)
- Email: sdk@sdlc.ai

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.