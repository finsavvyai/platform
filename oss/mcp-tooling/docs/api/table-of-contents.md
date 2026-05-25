# API Documentation Table of Contents

This is the complete table of contents for the MCPOverflow API Documentation.

## 📚 API Documentation Contents

### API Overview

- [API Overview](./overview.md)
  - API architecture and design principles
  - Authentication and authorization
  - Request/response formats
  - HTTP status codes
  - Rate limiting and quotas
  - Error handling patterns

### Authentication

- [Authentication Guide](./authentication.md)
  - Authentication methods overview
  - JWT token authentication
  - API key authentication
  - Session management
  - CSRF protection
  - Token refresh procedures

### Core Endpoints

- [Authentication Endpoints](./endpoints/auth.md)
  - User registration and sign-in
  - Password management
  - Email verification
  - Session management
  - Profile management

- [Connector Endpoints](./endpoints/connectors.md)
  - Connector CRUD operations
  - Connector search and filtering
  - Version management
  - Statistics and analytics
  - Export and download

- [Generation Endpoints](./endpoints/generation.md)
  - Job creation and management
  - Specification validation
  - Progress tracking
  - Result retrieval
  - Error handling

- [Analytics Endpoints](./endpoints/analytics.md)
  - Usage statistics
  - Performance metrics
  - System health
  - User analytics
  - Business metrics

### Reference

- [Complete API Reference](./reference.md)
  - All endpoints with examples
  - Request/response schemas
  - Error code reference
  - Rate limit details
  - SDK examples

### SDK and Integration

- [JavaScript/TypeScript SDK](./sdks/javascript.md)
  - Installation and setup
  - Authentication setup
  - Common usage patterns
  - Error handling
  - Advanced features

- [Python SDK](./sdks/python.md)
  - Installation and setup
  - Authentication setup
  - Common usage patterns
  - Error handling
  - Advanced features

- [cURL Examples](./examples/curl.md)
  - Basic request examples
  - Authentication examples
  - Complex request examples
  - Error handling
  - Best practices

## 🚀 Quick Navigation

### API Consumers

1. Start with [API Overview](./overview.md)
2. Review [Authentication Guide](./authentication.md)
3. Choose your SDK: [JavaScript](./sdks/javascript.md) or [Python](./sdks/python.md)
4. Reference [Complete API Reference](./reference.md)

### Integration Developers

1. Study [API Overview](./overview.md)
2. Implement [Authentication](./authentication.md)
3. Review relevant endpoints:
   - [Connectors](./endpoints/connectors.md)
   - [Generation](./endpoints/generation.md)
   - [Analytics](./endpoints/analytics.md)
4. Use [cURL Examples](./examples/curl.md) for testing

### Mobile Developers

1. Review [Authentication Guide](./authentication.md)
2. Choose appropriate SDK
3. Study rate limiting guidelines
4. Implement error handling
5. Test with [API Reference](./reference.md)

## 🌐 Base URLs

### Production

```
API Base URL: https://api.mcpoverflow.com/v1
Frontend URL: https://app.mcpoverflow.com
Documentation: https://docs.mcpoverflow.com
```

### Development

```
API Base URL: http://localhost:5173/api/v1
Frontend URL: http://localhost:5173
Database: Local Supabase instance
```

### Staging

```
API Base URL: https://staging-api.mcpoverflow.com/v1
Frontend URL: https://staging-app.mcpoverflow.com
```

## 🔐 Authentication Methods

### JWT Bearer Token

```http
Authorization: Bearer <jwt_token>
```

### API Key

```http
X-API-Key: <api_key>
```

### CSRF Token

```http
X-CSRF-Token: <csrf_token>
```

## 📡 Request/Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

## 🚨 Error Codes

### Authentication Errors

- `AUTHENTICATION_ERROR` - Invalid credentials
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `TOKEN_EXPIRED` - Token has expired
- `INVALID_TOKEN` - Invalid token format

### Validation Errors

- `VALIDATION_ERROR` - Request validation failed
- `INVALID_INPUT` - Invalid input format
- `MISSING_REQUIRED_FIELD` - Required field missing
- `INVALID_FORMAT` - Invalid data format

### Resource Errors

- `RESOURCE_NOT_FOUND` - Resource doesn't exist
- `RESOURCE_CONFLICT` - Resource conflict
- `RESOURCE_LIMIT_EXCEEDED` - Resource limit exceeded
- `RESOURCE_ACCESS_DENIED` - Access denied

### System Errors

- `INTERNAL_SERVER_ERROR` - Server error
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `MAINTENANCE_MODE` - System under maintenance

## 🔄 Rate Limiting

### Rate Limits by Endpoint

| Endpoint Category | Limit        | Window     |
| ----------------- | ------------ | ---------- |
| Authentication    | 5 requests   | 15 minutes |
| Generation        | 10 requests  | 1 hour     |
| General API       | 100 requests | 15 minutes |
| Analytics         | 50 requests  | 1 hour     |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635840000
```

### Rate Limit Response

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again in 5 minutes.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "resetTime": "2025-11-02T16:05:00Z",
    "retryAfter": 300
  }
}
```

## 🔧 SDK Examples

### JavaScript/TypeScript

```typescript
import { MCPOverflowAPI } from '@mcpoverflow/client'

const api = new MCPOverflowAPI({
  baseURL: 'https://api.mcpoverflow.com/v1',
  apiKey: 'your-api-key',
})

// List connectors
const connectors = await api.connectors.list({
  status: 'active',
  page: 1,
  limit: 10,
})

// Generate connector
const job = await api.generate.create({
  specUrl: 'https://api.example.com/openapi.json',
  targetRuntime: 'worker-ts',
  connectorName: 'Example API',
})
```

### Python

```python
import mcpoverflow

client = mcpoverflow.Client(
    api_key='your-api-key',
    base_url='https://api.mcpoverflow.com/v1'
)

# List connectors
connectors = client.connectors.list(status='active')

# Generate connector
job = client.generate.create(
    spec_url='https://api.example.com/openapi.json',
    target_runtime='worker-ts',
    connector_name='Example API'
)
```

### cURL

```bash
# List connectors
curl -X GET "https://api.mcpoverflow.com/v1/connectors" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Generate connector
curl -X POST "https://api.mcpoverflow.com/v1/generate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "specUrl": "https://api.example.com/openapi.json",
    "targetRuntime": "worker-ts",
    "connectorName": "Example API"
  }'
```

## 📚 Additional Resources

### User Documentation

For end-user documentation, see the [User Guide](../user-guide/table-of-contents.md)

### Developer Documentation

For technical implementation details, see the [Developer Guide](../developers/table-of-contents.md)

### Operations Documentation

For deployment and monitoring, see the [Operations Documentation](../operations/table-of-contents.md)

## 🆘 API Support

### Getting Help

- **📖 Documentation**: Browse these guides first
- **🐛 Report Issues**: [API Issues](https://github.com/mcpoverflow/mcpoverflow/issues?q=is%3Aissue+is%3Aopen+label%3Aapi)
- **💬 Community**: [API Discussions](https://github.com/mcpoverflow/mcpoverflow/discussions)
- **📧 Email**: api@mcpoverflow.com

### Status Page

- **Service Status**: [status.mcpoverflow.com](https://status.mcpoverflow.com)
- **API Status**: [api-status.mcpoverflow.com](https://api-status.mcpoverflow.com)

### Changelog

- **API Changelog**: [Releases](https://github.com/mcpoverflow/mcpoverflow/releases)
- **Breaking Changes**: Announced 30 days in advance
- **New Features**: Released in regular updates

---

Last updated: November 2, 2025
API version: 1.0
Documentation version: 1.0
