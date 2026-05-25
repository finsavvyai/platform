# QueryFlux API Documentation

## Overview

QueryFlux provides a comprehensive REST API for database management, query execution, real-time monitoring, and team collaboration. This document details all available endpoints, authentication methods, and integration guidelines.

## Base URL

```
Production: https://api.queryflux.com/v1
Development: http://localhost:8080/v1
```

## Authentication

### JWT Token Authentication

All API endpoints (except authentication endpoints) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### Register User

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "company": "Acme Corp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_12345",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "subscription_tier": "free",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_12345",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "subscription_tier": "professional"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400,
    "refresh_token": "refresh_abc123"
  }
}
```

#### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "refresh_abc123"
}
```

#### Logout

```http
POST /auth/logout
Authorization: Bearer <token>
```

## Database Connections

### Get All Connections

```http
GET /connections
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conn_12345",
      "name": "Production PostgreSQL",
      "type": "postgresql",
      "host": "prod-db.example.com",
      "port": 5432,
      "database": "production",
      "username": "app_user",
      "created_at": "2024-01-15T10:30:00Z",
      "last_used": "2024-01-15T14:22:00Z",
      "status": "connected",
      "connection_pool_size": 10
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### Create Connection

```http
POST /connections
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Production PostgreSQL",
  "type": "postgresql",
  "host": "prod-db.example.com",
  "port": 5432,
  "database": "production",
  "username": "app_user",
  "password": "secure_password",
  "ssl_mode": "require",
  "connection_pool_size": 10,
  "timeout": 30,
  "ssh_tunnel": {
    "enabled": true,
    "host": "bastion.example.com",
    "port": 22,
    "username": "ec2-user",
    "key_path": "/path/to/key"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conn_12345",
    "name": "Production PostgreSQL",
    "type": "postgresql",
    "host": "prod-db.example.com",
    "port": 5432,
    "database": "production",
    "username": "app_user",
    "ssl_mode": "require",
    "connection_pool_size": 10,
    "status": "connected",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Test Connection

```http
POST /connections/{connection_id}/test
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "latency_ms": 45,
    "version": "PostgreSQL 14.5",
    "max_connections": 100,
    "active_connections": 25
  }
}
```

### Update Connection

```http
PUT /connections/{connection_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Connection Name",
  "connection_pool_size": 15
}
```

### Delete Connection

```http
DELETE /connections/{connection_id}
Authorization: Bearer <token>
```

## Query Management

### Execute Query

```http
POST /queries/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "connection_id": "conn_12345",
  "query": "SELECT * FROM users WHERE created_at >= '2024-01-01' LIMIT 100",
  "parameters": [],
  "timeout": 30000,
  "explain": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query_id": "qry_12345",
    "status": "completed",
    "execution_time_ms": 245,
    "rows_returned": 87,
    "rows_affected": 0,
    "columns": [
      {"name": "id", "type": "integer", "nullable": false},
      {"name": "name", "type": "varchar", "nullable": false},
      {"name": "email", "type": "varchar", "nullable": false},
      {"name": "created_at", "type": "timestamp", "nullable": false}
    ],
    "rows": [
      [1, "John Doe", "john@example.com", "2024-01-02T10:15:00Z"],
      [2, "Jane Smith", "jane@example.com", "2024-01-03T14:22:00Z"]
    ],
    "explain_plan": null
  }
}
```

### Get Query History

```http
GET /queries/history?connection_id=conn_12345&limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "qry_12345",
      "connection_id": "conn_12345",
      "query": "SELECT * FROM users WHERE created_at >= '2024-01-01' LIMIT 100",
      "execution_time_ms": 245,
      "rows_returned": 87,
      "status": "completed",
      "executed_at": "2024-01-15T14:30:00Z",
      "executed_by": "usr_12345"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1,
    "total_pages": 1
  }
}
```

### Save Query

```http
POST /queries/save
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Active Users Query",
  "description": "Returns all active users from the last 30 days",
  "query": "SELECT * FROM users WHERE last_login >= NOW() - INTERVAL '30 days'",
  "connection_id": "conn_12345",
  "tags": ["users", "reporting", "monthly"],
  "is_public": false
}
```

### Get Saved Queries

```http
GET /queries/saved?tags=users&limit=20
Authorization: Bearer <token>
```

### Explain Query

```http
POST /queries/explain
Authorization: Bearer <token>
Content-Type: application/json

{
  "connection_id": "conn_12345",
  "query": "SELECT u.*, COUNT(o.id) as order_count FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": [
      {
        "node_type": "HashAggregate",
        "cost": 125.34,
        "rows": 1000,
        "description": "Group by u.id",
        "subplans": []
      }
    ],
    "total_cost": 125.34,
    "execution_time_estimate_ms": 15
  }
}
```

## Schema Management

### Get Database Schema

```http
GET /connections/{connection_id}/schema
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "database_name": "production",
    "schema_version": "14.5",
    "tables": [
      {
        "name": "users",
        "schema": "public",
        "type": "table",
        "row_count": 15420,
        "size_bytes": 2048576,
        "columns": [
          {
            "name": "id",
            "type": "integer",
            "nullable": false,
            "primary_key": true,
            "default_value": "nextval('users_id_seq'::regclass)"
          },
          {
            "name": "email",
            "type": "varchar(255)",
            "nullable": false,
            "unique": true
          }
        ],
        "indexes": [
          {
            "name": "users_email_idx",
            "columns": ["email"],
            "type": "btree",
            "unique": true
          }
        ],
        "foreign_keys": [
          {
            "name": "users_company_id_fkey",
            "column": "company_id",
            "references_table": "companies",
            "references_column": "id"
          }
        ]
      }
    ]
  }
}
```

### Get Table Data

```http
GET /connections/{connection_id}/tables/{table_name}/data?limit=100&offset=0&order_by=id&order=asc
Authorization: Bearer <token>
```

## Real-time Monitoring

### WebSocket Connection

Connect to the real-time WebSocket endpoint:

```
ws://localhost:8080/ws?token=<jwt_token>
```

#### Subscribe to Events

```json
{
  "action": "subscribe",
  "channels": ["metrics", "queries", "connections", "alerts"],
  "filters": {
    "connection_id": "conn_12345"
  }
}
```

#### Real-time Events

**Metrics Update:**
```json
{
  "type": "metrics_update",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "connection_id": "conn_12345",
    "active_connections": 25,
    "queries_per_second": 12.5,
    "average_response_time_ms": 45,
    "error_rate": 0.02,
    "cpu_usage": 65.5,
    "memory_usage": 78.2
  }
}
```

**Query Progress:**
```json
{
  "type": "query_progress",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "query_id": "qry_12345",
    "status": "executing",
    "progress_percentage": 45,
    "estimated_completion": "2024-01-15T14:30:15Z",
    "rows_processed": 45000,
    "total_rows": 100000
  }
}
```

**Alert Notification:**
```json
{
  "type": "alert",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "alert_id": "alt_12345",
    "severity": "warning",
    "title": "High Query Latency",
    "message": "Average query response time exceeded threshold",
    "connection_id": "conn_12345",
    "metric_value": 1250,
    "threshold": 1000,
    "actions": ["view_details", "acknowledge"]
  }
}
```

### Get Current Metrics

```http
GET /monitoring/metrics?connection_id=conn_12345&period=1h
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "1h",
    "metrics": {
      "queries_per_second": {
        "current": 12.5,
        "average": 10.2,
        "max": 25.8,
        "min": 2.1
      },
      "response_time_ms": {
        "current": 45,
        "average": 52,
        "p95": 120,
        "p99": 250
      },
      "error_rate": {
        "current": 0.02,
        "average": 0.015,
        "max": 0.08
      },
      "active_connections": {
        "current": 25,
        "max": 32,
        "min": 18
      }
    },
    "timestamps": [
      "2024-01-15T13:30:00Z",
      "2024-01-15T13:31:00Z"
    ]
  }
}
```

## Team Management

### Get Team Members

```http
GET /team/members
Authorization: Bearer <token>
```

### Invite Team Member

```http
POST /team/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "colleague@example.com",
  "role": "developer",
  "message": "Join our team on QueryFlux!"
}
```

### Update Team Member Role

```http
PUT /team/members/{user_id}/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

## Projects

### Get Projects

```http
GET /projects
Authorization: Bearer <token>
```

### Create Project

```http
POST /projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Analytics Dashboard",
  "description": "Queries for the analytics dashboard",
  "connection_ids": ["conn_12345", "conn_67890"],
  "is_public": false
}
```

## Alerts

### Get Alert Configurations

```http
GET /alerts/configurations
Authorization: Bearer <token>
```

### Create Alert

```http
POST /alerts/configurations
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "High Query Latency",
  "description": "Alert when query response time exceeds threshold",
  "metric": "response_time_ms",
  "operator": ">",
  "threshold": 1000,
  "connection_id": "conn_12345",
  "severity": "warning",
  "enabled": true,
  "notification_channels": ["email", "slack"],
  "evaluation_interval": "5m"
}
```

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Bad Request | Check request parameters and format |
| 401 | Unauthorized | Check authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 429 | Too Many Requests | Rate limit exceeded, retry later |
| 500 | Internal Server Error | Server error, try again later |
| 502 | Bad Gateway | Backend service unavailable |
| 503 | Service Unavailable | Maintenance mode |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The 'connection_id' parameter is required",
    "details": {
      "parameter": "connection_id",
      "expected_type": "string"
    }
  }
}
```

## Rate Limiting

- **Default Rate Limit**: 1000 requests per hour per user
- **Professional Tier**: 5000 requests per hour per user
- **Enterprise Tier**: Unlimited requests

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```

## Pagination

List endpoints support pagination with the following parameters:

- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20, max: 100)
- `limit`: Maximum number of items to return
- `offset`: Number of items to skip

## SDKs and Client Libraries

### JavaScript/TypeScript

```bash
npm install @queryflux/client
```

```typescript
import { QueryFluxClient } from '@queryflux/client';

const client = new QueryFluxClient({
  baseURL: 'https://api.queryflux.com/v1',
  token: 'your-jwt-token'
});

const connections = await client.connections.list();
const result = await client.queries.execute({
  connection_id: 'conn_12345',
  query: 'SELECT * FROM users LIMIT 10'
});
```

### Python

```bash
pip install queryflux-python
```

```python
from queryflux import QueryFluxClient

client = QueryFluxClient(
    base_url='https://api.queryflux.com/v1',
    token='your-jwt-token'
)

connections = client.connections.list()
result = client.queries.execute(
    connection_id='conn_12345',
    query='SELECT * FROM users LIMIT 10'
)
```

### Go

```bash
go get github.com/queryflux/go-client
```

```go
package main

import (
    "fmt"
    "github.com/queryflux/go-client"
)

func main() {
    client := queryflux.NewClient("your-jwt-token")

    connections, err := client.Connections.List()
    if err != nil {
        panic(err)
    }

    result, err := client.Queries.Execute(&queryflux.ExecuteQueryRequest{
        ConnectionID: "conn_12345",
        Query:        "SELECT * FROM users LIMIT 10",
    })
    if err != nil {
        panic(err)
    }

    fmt.Printf("Returned %d rows\n", len(result.Rows))
}
```

## Best Practices

### Security

1. **Never expose your JWT token** in client-side code or public repositories
2. **Use HTTPS** for all API communications
3. **Implement proper error handling** to prevent token leakage
4. **Regenerate tokens** regularly and invalidate old ones
5. **Use environment variables** for storing sensitive configuration

### Performance

1. **Use connection pooling** for database connections
2. **Implement pagination** for large result sets
3. **Cache frequently accessed data** when appropriate
4. **Use WebSocket subscriptions** for real-time updates instead of polling
5. **Optimize queries** and use EXPLAIN plans to understand performance

### Error Handling

1. **Check the success field** in all API responses
2. **Implement exponential backoff** for rate-limited requests
3. **Log error details** for debugging purposes
4. **Handle network timeouts** gracefully
5. **Provide meaningful error messages** to users

## Support and Documentation

- **API Documentation**: https://docs.queryflux.com/api
- **Developer Portal**: https://developers.queryflux.com
- **Support Email**: api-support@queryflux.com
- **Status Page**: https://status.queryflux.com
- **GitHub Repository**: https://github.com/queryflux/api

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Authentication and user management
- Database connection management
- Query execution and history
- Real-time WebSocket monitoring
- Team collaboration features
- Alert and notification system

### v1.1.0 (Upcoming)
- AI-powered query optimization
- Advanced analytics endpoints
- Custom alert rules
- Enhanced security features
- Performance improvements