# UPM.Plus Enterprise API Gateway

## Overview

The UPM.Plus Enterprise API Gateway is a comprehensive, production-grade API gateway that provides security, rate limiting, transformation, and monitoring capabilities for the UPM.Plus AutomationHub platform.

## Features

### 🔐 Security & Authentication
- **API Key Authentication**: Secure API key management with scoped permissions
- **JWT Token Support**: Integration with existing JWT authentication system
- **Multi-Factor Authentication (MFA)**: Support for MFA verification
- **RBAC Integration**: Seamless integration with existing Role-Based Access Control
- **IP Whitelisting/Blacklisting**: granular IP-based access control
- **Origin Validation**: CORS and origin-based security

### ⚡ Rate Limiting & Quotas
- **Multiple Rate Limiting Algorithms**: Sliding window, token bucket, fixed window
- **Granular Rate Limits**: Per-key, per-user, per-organization, per-IP, and global limits
- **Redis-Based Distributed Limiting**: Scalable rate limiting across multiple instances
- **Configurable Policies**: Dynamic rate limit configuration and policies
- **Rate Limit Analytics**: Real-time monitoring and reporting

### 🔄 Request/Response Transformation
- **Data Sanitization**: HTML, SQL, and XSS protection
- **Data Masking**: Sensitive data masking (emails, phones, credit cards, etc.)
- **Format Conversion**: JSON, XML, YAML format support
- **Field Mapping**: Dynamic field transformation and mapping
- **Compression**: Automatic response compression
- **Content Negotiation**: Client capability-based content adaptation

### 📊 API Versioning
- **Multiple Versioning Strategies**: URL-based, header-based, query parameter, content-type
- **Version Lifecycle Management**: Version deprecation, migration, and sunset support
- **Backward Compatibility**: Graceful version transitions
- **Version-Specific Policies**: Different configurations per API version

### 🔌 WebSocket Proxy
- **WebSocket Authentication**: Secure WebSocket connection management
- **Connection Tracking**: Real-time connection monitoring and analytics
- **Message Filtering**: Configurable message filtering and routing
- **Connection Rate Limiting**: WebSocket-specific rate limiting
- **Graceful Shutdown**: Clean connection termination

### 📈 Analytics & Monitoring
- **Real-time Usage Tracking**: Comprehensive API usage analytics
- **Performance Metrics**: Response time, throughput, error rates
- **User/Organization Analytics**: Usage statistics per user and organization
- **Error Analysis**: Detailed error tracking and analysis
- **Custom Reports**: Configurable usage reports and alerts

## Architecture

The API Gateway follows a modular, microservices architecture with the following key components:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   API Gateway                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Security   │  │ Rate        │  │ Request/Response    │   │
│  │ Middleware  │  │ Limiting    │  │ Transformation      │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   API       │  │  WebSocket  │  │    Analytics        │   │
│  │ Versioning  │  │   Proxy     │  │    Engine           │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Backend Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Users     │  │  Workflows  │  │      Agents         │   │
│  │   Auth      │  │  Documents  │  │   Infrastructure    │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Installation & Setup

### Prerequisites

- Python 3.9+
- Redis server
- PostgreSQL database
- Existing UPM.Plus authentication and RBAC systems

### Configuration

The gateway is configured through environment variables and configuration files:

```python
# app/core/config.py
class Settings(BaseSettings):
    # Gateway Configuration
    GATEWAY_ENABLED: bool = True
    GATEWAY_RATE_LIMITING: bool = True
    GATEWAY_AUTH_REQUIRED: bool = True

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security Configuration
    SECRET_KEY: str
    CORS_ORIGINS: List[str] = ["*"]

    # API Key Configuration
    API_KEY_DEFAULT_LIMIT_PER_MINUTE: int = 1000
    API_KEY_DEFAULT_LIMIT_PER_HOUR: int = 50000
    API_KEY_DEFAULT_LIMIT_PER_DAY: int = 1000000
```

### Database Setup

Create the necessary database tables for gateway functionality:

```sql
-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(100) UNIQUE NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    permissions TEXT[],
    allowed_endpoints TEXT[],
    denied_endpoints TEXT[],
    rate_limit_per_minute INTEGER DEFAULT 1000,
    rate_limit_per_hour INTEGER DEFAULT 50000,
    rate_limit_per_day INTEGER DEFAULT 1000000,
    status VARCHAR(20) DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Usage Logs
CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(100) UNIQUE NOT NULL,
    api_key_id UUID REFERENCES api_keys(id),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    status_code INTEGER NOT NULL,
    response_size_bytes BIGINT,
    response_time_ms FLOAT,
    rate_limited BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WebSocket Connections
CREATE TABLE websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    endpoint VARCHAR(500) NOT NULL,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    message_count BIGINT DEFAULT 0,
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);
```

## Usage

### API Key Management

#### Create an API Key

```bash
curl -X POST "http://localhost:8000/api/v1/gateway/api-keys" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "description": "Key for production API access",
    "scope": "read_write",
    "permissions": ["users:read", "workflows:write"],
    "expires_at": "2024-12-31T23:59:59Z",
    "rate_limit_per_minute": 5000,
    "allowed_ip_addresses": ["192.168.1.0/24"]
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key_id": "key_1a2b3c4d",
  "key_prefix": "upm_12345678",
  "key": "upm_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3",
  "name": "Production API Key",
  "scope": "read_write",
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Using an API Key

```bash
curl -X GET "http://localhost:8000/api/v1/users" \
  -H "X-API-Key: upm_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3"
```

Or using Authorization header:
```bash
curl -X GET "http://localhost:8000/api/v1/users" \
  -H "Authorization: Bearer upm_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3"
```

### Rate Limiting

The gateway automatically applies rate limits based on:
- API key configuration
- User tier (free, pro, enterprise)
- Organization policies
- Global system limits

#### Rate Limit Response Headers

When rate limits are applied, the following headers are included:
- `X-RateLimit-Limit`: The rate limit ceiling
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when the limit resets
- `Retry-After`: Seconds to wait before retrying (when limited)

#### Rate Limit Exceeded Response

```json
{
  "error": "Rate limit exceeded",
  "limit": 1000,
  "remaining": 0,
  "reset_time": "2024-01-01T12:01:00Z",
  "retry_after": 60
}
```

### API Versioning

#### URL-based Versioning

```bash
curl -X GET "http://localhost:8000/api/v1/users"
curl -X GET "http://localhost:8000/api/v2/users"
```

#### Header-based Versioning

```bash
curl -X GET "http://localhost:8000/api/users" \
  -H "Accept-Version: v1"
```

#### Query Parameter Versioning

```bash
curl -X GET "http://localhost:8000/api/users?version=v1"
```

### WebSocket Connections

#### Connect to WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/agents');

// Authenticate with API key
ws.onopen = function() {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'upm_your_api_key_here'
  }));
};
```

#### WebSocket with Query Parameter

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/agents?api_key=upm_your_api_key_here');
```

### Analytics & Monitoring

#### Get Gateway Statistics

```bash
curl -X GET "http://localhost:8000/api/v1/gateway/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Generate Usage Report

```bash
curl -X POST "http://localhost:8000/api/v1/gateway/analytics/report" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-01-31T23:59:59Z",
    "format": "json"
  }'
```

#### Get Health Status

```bash
curl -X GET "http://localhost:8000/api/v1/gateway/health"
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "components": {
    "gateway": {
      "initialized": true,
      "uptime": 86400,
      "total_requests": 150000,
      "error_rate": 0.02,
      "rate_limiting_enabled": true
    },
    "rate_limiter": "healthy",
    "redis": "healthy",
    "database": "healthy"
  }
}
```

## Configuration

### Gateway Policies

#### Rate Limiting Configuration

```python
# Rate limiting policies per tier
RATE_LIMIT_POLICIES = {
    "free": {
        "requests_per_minute": 100,
        "requests_per_hour": 5000,
        "requests_per_day": 100000
    },
    "pro": {
        "requests_per_minute": 1000,
        "requests_per_hour": 50000,
        "requests_per_day": 1000000
    },
    "enterprise": {
        "requests_per_minute": 10000,
        "requests_per_hour": 500000,
        "requests_per_day": 10000000
    }
}
```

#### Security Headers Configuration

```python
SECURITY_HEADERS_CONFIG = {
    "enable_hsts": True,
    "hsts_max_age": 31536000,
    "hsts_include_subdomains": True,
    "enable_csp": True,
    "csp_policy": "default-src 'self'; script-src 'self' 'unsafe-inline'",
    "enable_x_frame_options": True,
    "x_frame_options": "DENY",
    "enable_x_content_type_options": True,
    "enable_x_xss_protection": True
}
```

#### CORS Configuration

```python
CORS_CONFIG = {
    "allow_origins": ["https://app.upm.plus", "https://admin.upm.plus"],
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Authorization", "X-API-Key", "Content-Type"],
    "allow_credentials": True,
    "max_age": 600
}
```

## Security Considerations

### API Key Security

1. **Secure Storage**: Store API keys securely using environment variables or secret management systems
2. **Key Rotation**: Implement regular API key rotation policies
3. **Limited Scope**: Use minimum required permissions for each API key
4. **IP Restrictions**: Restrict API keys to specific IP addresses when possible
5. **Expiration**: Set reasonable expiration dates for API keys

### Rate Limiting Bypass Prevention

1. **Multiple Headers**: Check for API keys in multiple header locations
2. **IP-based Tracking**: Track usage by IP address to prevent key sharing
3. **Behavioral Analysis**: Monitor for unusual usage patterns
4. **Progressive Penalties**: Apply stricter limits for repeat offenders

### Data Protection

1. **Input Sanitization**: All input data is sanitized for XSS and SQL injection
2. **Sensitive Data Masking**: Automatically mask sensitive data in logs and responses
3. **Encryption**: Use HTTPS/TLS for all gateway communications
4. **Audit Logging**: Comprehensive logging of all gateway activities

## Performance & Scalability

### Redis Configuration

For production deployments, configure Redis with appropriate settings:

```redis
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Load Balancing

The gateway supports horizontal scaling:
1. **Stateless Design**: All components are designed for horizontal scaling
2. **Shared Redis**: Multiple gateway instances share Redis for rate limiting
3. **Database Sharding**: Consider database sharding for high-volume deployments
4. **Caching**: Implement comprehensive caching strategies

### Monitoring

Monitor key metrics:
- Request rate and response times
- Error rates and types
- Rate limiting statistics
- Redis performance
- Database connection health
- Memory and CPU usage

## Troubleshooting

### Common Issues

#### API Key Not Working

1. Verify the key is correctly formatted (starts with "upm_")
2. Check if the key is active and not expired
3. Ensure the key has required permissions for the endpoint
4. Verify IP restrictions if configured

#### Rate Limiting Issues

1. Check rate limit headers in responses
2. Verify Redis connectivity
3. Review rate limit configuration
4. Check for distributed key collisions

#### Performance Issues

1. Monitor Redis performance
2. Check database query performance
3. Review transformation rules complexity
4. Analyze request patterns for bottlenecks

### Debug Logging

Enable debug logging for troubleshooting:

```python
import logging
logging.getLogger("app.gateway").setLevel(logging.DEBUG)
```

## Integration with Existing Systems

### Authentication Integration

The gateway integrates seamlessly with the existing UPM.Plus authentication:

```python
# Existing user authentication
existing_user = await authenticate_user(email, password)

# Gateway automatically respects user permissions
if existing_user.role == "admin":
    # Higher rate limits and broader access
elif existing_user.role == "user":
    # Standard rate limits and user-specific access
```

### RBAC Integration

The gateway leverages the existing RBAC system:

```python
# Permission checking in gateway
permission_check = await rbac_service.check_permissions(
    user_id=user.id,
    required_permissions=["users:read"],
    resource_type="user",
    resource_id=resource.id
)
```

### Database Integration

Gateway uses the existing database connection and models:

```python
# Shared database session
async for db in get_db():
    # Gateway operations use existing database
    user = await db.get(User, user_id)
    api_key = await db.get(APIKey, key_id)
```

## API Reference

### Gateway Management Endpoints

#### Authentication
- `POST /api/v1/gateway/api-keys` - Create API key
- `GET /api/v1/gateway/api-keys` - List API keys
- `GET /api/v1/gateway/api-keys/{id}` - Get API key details
- `PUT /api/v1/gateway/api-keys/{id}` - Update API key
- `DELETE /api/v1/gateway/api-keys/{id}` - Revoke API key

#### Analytics
- `GET /api/v1/gateway/stats` - Get gateway statistics
- `GET /api/v1/gateway/analytics/endpoints` - Endpoint analytics
- `GET /api/v1/gateway/analytics/users` - User analytics
- `POST /api/v1/gateway/analytics/report` - Generate usage report

#### Configuration
- `GET /api/v1/gateway/config` - Get gateway configuration (admin only)
- `PUT /api/v1/gateway/config` - Update gateway configuration (admin only)

#### Health & Monitoring
- `GET /api/v1/gateway/health` - Health check
- `GET /api/v1/gateway/info` - Gateway information

#### Rate Limiting
- `GET /api/v1/gateway/rate-limits/status` - Get rate limit status
- `DELETE /api/v1/gateway/rate-limits/{identifier}` - Clear rate limits (admin only)

## License

This API Gateway is part of the UPM.Plus AutomationHub platform and is released under the same license terms as the main project.

## Support

For support and questions:
- Create an issue in the project repository
- Contact the development team
- Review the documentation and troubleshooting guide

---

*Last Updated: January 6, 2025*