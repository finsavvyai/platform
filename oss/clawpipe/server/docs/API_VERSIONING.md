# API Versioning Strategy

## Overview

FinSavvyAI uses URL-based API versioning to ensure backward compatibility while allowing for future evolution of the API.

## Current Version

- **Version**: v1
- **Status**: Stable
- **Base URL**: `https://api.finsavvyai.com/v1/`

## Supported Versions

| Version | Status | Released | Sunset |
|---------|--------|----------|--------|
| v1 | Stable | 2024-01-01 | TBD |

## Versioning Approach

### URL-Based Versioning

All API endpoints include the version in the URL path:

```
https://api.finsavvyai.com/v1/chat/completions
https://api.finsavvyai.com/v1/models
```

### Version Information Endpoint

Get information about available API versions:

```bash
curl https://api.finsavvyai.com/api/versions
```

Response:
```json
{
  "service": "FinSavvyAI API",
  "current_version": "v1",
  "supported_versions": ["v1"],
  "deprecated_versions": [],
  "versions": [
    {
      "version": "v1",
      "status": "stable",
      "released": "2024-01-01",
      "sunset": null,
      "features": [
        "chat_completions",
        "models_list",
        "intelligent_routing"
      ]
    }
  ],
  "migration_guide": "https://docs.finsavvyai.com/api/versioning"
}
```

## Version Response Headers

Every API response includes versioning headers:

```
X-API-Version: v1
X-API-Supported-Versions: v1
X-API-Latest-Version: v1
```

### Deprecated Version Headers

When a version is deprecated, additional headers are included:

```
Deprecation: true
Sunset: 2025-12-31T23:59:59Z
Link: </v2/>; rel="successor-version"
```

## Client Integration

### Using the OpenAI SDK

```python
import openai

client = openai.OpenAI(
    api_key="your-api-key",
    base_url="https://api.finsavvyai.com/v1"
)

response = client.chat.completions.create(
    model="phi-2",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Using cURL

```bash
curl -X POST https://api.finsavvyai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "phi-2",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Deprecation Policy

1. **Announcement**: Deprecated versions are announced at least 6 months before sunset
2. **Headers**: Deprecation headers appear on all responses for deprecated versions
3. **Documentation**: Migration guides are provided before deprecation
4. **Sunset**: After sunset date, deprecated versions may return 410 Gone

## Best Practices

1. **Use the latest stable version**: Always prefer the latest version
2. **Monitor deprecation headers**: Check for `Deprecation: true` header
3. **Test migrations**: Use the versions endpoint to plan migrations
4. **Pin your client version**: Use explicit version paths, not unversioned URLs

## Unversioned Endpoints

Operational endpoints do not require version prefix:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Service health check |
| `/metrics` | Prometheus metrics |
| `/api/versions` | API version information |
| `/traces` | Distributed tracing (debug) |

## Future Versions

When v2 is released, it will:

1. Coexist with v1 for at least 12 months
2. Be announced via `/api/versions` endpoint
3. Include a migration guide from v1
4. Maintain backward compatibility where possible

## Migration Between Versions

### Example: v1 to v2 (future)

```python
# v1
base_url = "https://api.finsavvyai.com/v1"

# v2 - update base URL
base_url = "https://api.finsavvyai.com/v2"
```

Most breaking changes will be documented in the release notes and migration guide.

## Support

- Documentation: https://docs.finsavvyai.com
- Migration Guide: https://docs.finsavvyai.com/api/versioning
- Issues: https://github.com/finsavvyai/finsavvyai/issues
