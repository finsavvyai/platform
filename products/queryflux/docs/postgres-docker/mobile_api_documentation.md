# Mobile API Server Documentation

## Overview

The Mobile API Server provides a REST API specifically designed for mobile companion apps to interact with the Ultimate Database Manager. It offers mobile-optimized endpoints for database monitoring, container management, and basic query execution with appropriate security restrictions.

## Base URL

```
http://localhost:8001
```

## Authentication

The API uses JWT (JSON Web Token) authentication. All protected endpoints require a valid Bearer token in the Authorization header.

### Login

**POST** `/auth/login`

Authenticate and receive an access token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### Get Current User

**GET** `/auth/me`

Get information about the currently authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "username": "admin"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Connection Management

### List Connections

**GET** `/connections`

Get all database connections with their current status.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "connection_id": "postgres_main",
        "name": "Main PostgreSQL",
        "db_type": "postgresql",
        "status": "connected",
        "last_ping": "2024-01-15T10:29:45Z",
        "response_time": 0.125,
        "error_message": null
      },
      {
        "connection_id": "mysql_dev",
        "name": "Development MySQL",
        "db_type": "mysql",
        "status": "disconnected",
        "last_ping": "2024-01-15T10:25:30Z",
        "response_time": null,
        "error_message": "Connection timeout"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Get Connection Health

**GET** `/connections/{connection_id}/health`

Get detailed health metrics for a specific connection.

**Parameters:**
- `connection_id` (path): The ID of the connection

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connection_id": "postgres_main",
    "cpu_usage": 25.5,
    "memory_usage": 60.2,
    "active_connections": 1,
    "queries_per_second": 15.3,
    "slow_queries": 2,
    "uptime": "2 days"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Execute Mobile Query

**POST** `/connections/{connection_id}/query`

Execute a SELECT query with mobile-optimized constraints.

**Parameters:**
- `connection_id` (path): The ID of the connection

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "connection_id": "postgres_main",
  "query": "SELECT * FROM users LIMIT 10",
  "limit": 100,
  "timeout": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "data": [
      {"id": 1, "name": "John Doe", "email": "john@example.com"},
      {"id": 2, "name": "Jane Smith", "email": "jane@example.com"}
    ],
    "columns": ["id", "name", "email"],
    "row_count": 2,
    "execution_time": 0.045,
    "truncated": false,
    "error": null
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Security Restrictions:**
- Only SELECT queries are allowed
- Results are limited to a maximum of 1000 rows
- Query timeout is limited to 60 seconds
- Default limit is 100 rows if not specified

## Container Management

### List Containers

**GET** `/containers`

Get all database containers with their status.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "containers": [
      {
        "container_id": "postgres_container_1",
        "name": "postgres_dev",
        "db_type": "postgresql",
        "status": "running",
        "port": 5432,
        "created_at": "2024-01-15T08:00:00Z",
        "uptime": "2 hours"
      },
      {
        "container_id": "mysql_container_1",
        "name": "mysql_test",
        "db_type": "mysql",
        "status": "stopped",
        "port": 3306,
        "created_at": "2024-01-15T07:30:00Z",
        "uptime": null
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Start Container

**POST** `/containers/{container_id}/start`

Start a database container.

**Parameters:**
- `container_id` (path): The ID of the container

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Container postgres_container_1 started successfully"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Stop Container

**POST** `/containers/{container_id}/stop`

Stop a database container.

**Parameters:**
- `container_id` (path): The ID of the container

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Container postgres_container_1 stopped successfully"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Get Container Status

**GET** `/containers/{container_id}/status`

Get detailed status information for a specific container.

**Parameters:**
- `container_id` (path): The ID of the container

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "container_id": "postgres_container_1",
    "status": "running",
    "uptime": "3 hours",
    "cpu_usage": 15.2,
    "memory_usage": 45.8
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Alerts and Notifications

### Get Alerts

**GET** `/alerts`

Get recent alerts for mobile notifications.

**Query Parameters:**
- `limit` (optional): Maximum number of alerts to return (default: 50)

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "connection_id": "postgres_main",
        "type": "error",
        "title": "Connection Lost",
        "message": "Database connection postgres_main is no longer responding",
        "timestamp": "2024-01-15T10:25:00Z",
        "acknowledged": false
      },
      {
        "id": "alert_124",
        "connection_id": "mysql_dev",
        "type": "warning",
        "title": "High CPU Usage",
        "message": "CPU usage is above 80% for mysql_dev",
        "timestamp": "2024-01-15T10:20:00Z",
        "acknowledged": true
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Acknowledge Alert

**POST** `/alerts/{alert_id}/acknowledge`

Mark an alert as acknowledged.

**Parameters:**
- `alert_id` (path): The ID of the alert

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Alert acknowledged"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## System Status

### Health Check

**GET** `/health`

Check API server health (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "features": [
    "mobile_optimized_queries",
    "container_management",
    "real_time_monitoring",
    "push_notifications_ready"
  ]
}
```

### Get System Status

**GET** `/status`

Get overall system status and metrics.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connections": {
      "total": 3,
      "active": 2
    },
    "containers": {
      "total": 5,
      "running": 3
    },
    "alerts": {
      "unacknowledged": 2
    },
    "uptime": "System running",
    "last_updated": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Handling

All endpoints return a consistent error format:

```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `401 Unauthorized`: Invalid or missing authentication token
- `403 Forbidden`: Access denied (e.g., non-SELECT query)
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Invalid request data
- `500 Internal Server Error`: Server error

## Rate Limiting

The API implements basic rate limiting to prevent abuse:
- Maximum 100 requests per minute per IP address
- Query execution is limited to 30-second timeout
- Result sets are limited to 1000 rows maximum

## Security Features

1. **JWT Authentication**: All protected endpoints require valid JWT tokens
2. **Query Restrictions**: Only SELECT queries allowed from mobile devices
3. **Result Limiting**: Automatic limiting of result sets for mobile optimization
4. **Timeout Protection**: Query execution timeouts to prevent long-running queries
5. **CORS Configuration**: Properly configured for mobile app origins
6. **Input Validation**: All inputs are validated using Pydantic models

## Mobile Optimization Features

1. **Lightweight Responses**: Minimal data transfer for mobile networks
2. **Result Pagination**: Automatic result limiting and truncation indicators
3. **Connection Monitoring**: Real-time connection status updates
4. **Alert System**: Push notification-ready alert system
5. **Offline Support**: Cached status information for offline viewing
6. **Battery Optimization**: Efficient polling intervals and background tasks

## Development and Testing

### Running the Server

```bash
cd src/ultimate_db_manager
python mobile_api_server.py
```

The server will start on `http://0.0.0.0:8001` by default.

### Environment Variables

- `MOBILE_API_PORT`: Server port (default: 8001)
- `MOBILE_API_HOST`: Server host (default: 0.0.0.0)
- `MOBILE_API_SECRET_KEY`: JWT secret key (change in production)

### Testing

Run the test suite:

```bash
pytest tests/test_mobile_api_server.py -v
```

### API Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

## Production Deployment

### Security Considerations

1. **Change Default Credentials**: Update the default admin password
2. **Use Strong Secret Key**: Generate a secure JWT secret key
3. **Enable HTTPS**: Use SSL/TLS in production
4. **Configure CORS**: Restrict CORS origins to your mobile app domains
5. **Rate Limiting**: Implement proper rate limiting and DDoS protection
6. **Monitoring**: Set up logging and monitoring for security events

### Scaling

1. **Load Balancing**: Use a load balancer for multiple API server instances
2. **Database**: Replace in-memory storage with Redis or database
3. **Caching**: Implement proper caching for frequently accessed data
4. **Background Tasks**: Use Celery or similar for background processing

### Monitoring

1. **Health Checks**: Regular health check endpoints for load balancers
2. **Metrics**: Prometheus metrics for monitoring
3. **Logging**: Structured logging for debugging and auditing
4. **Alerting**: Set up alerts for API errors and performance issues