# SDLC.ai Health Check Endpoints

This document describes all health check endpoints available for monitoring the SDLC.ai platform.

## Public Health Endpoints

### 
- **Method:** GET
- **Description:** Basic health check
- **Response:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2025-11-04T12:00:00Z",
    "version": "1.0.0"
  }
  ```

### 
- **Method:** GET
- **Description:** Detailed system status
- **Response:**
  ```json
  {
    "status": "healthy",
    "services": {
      "api": "healthy",
      "database": "healthy",
      "cache": "healthy",
      "vector_search": "healthy",
      "ai_service": "healthy"
    },
    "metrics": {
      "uptime": 86400,
      "requests_per_second": 1500,
      "error_rate": 0.001
    }
  }
  ```

## Internal Health Endpoints

### 
- **Method:** GET
- **Description:** Database connectivity check
- **Authentication:** Required
- **Response:** Database status and connection metrics

### 
- **Method:** GET
- **Description:** Cache connectivity check
- **Authentication:** Required
- **Response:** Cache status and hit rates

### 
- **Method:** POST
- **Description:** Vector search health check
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "test": "health_check",
    "vector": [0.1, 0.2, 0.3]
  }
  ```

## Synthetic Transactions

### User Login Flow Test
- **Endpoint:** 
- **Frequency:** Every 5 minutes
- **Success Criteria:** HTTP 200, token returned

### Document Upload Test
- **Endpoint:** 
- **Frequency:** Every 10 minutes
- **Success Criteria:** HTTP 200, document ID returned

### AI Generation Test
- **Endpoint:** 
- **Frequency:** Every 15 minutes
- **Success Criteria:** HTTP 200, response generated

## Monitoring Integration

### Prometheus Metrics
Available at  (internal access only):
- `http_requests_total`
- `http_request_duration_seconds`
- `active_users_total`
- `documents_processed_total`
- `ai_tokens_total`

### Cloudflare Analytics
- Real-time analytics via Cloudflare dashboard
- Custom analytics datasets configured
- Export to external monitoring tools

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| P95 Response Time | > 500ms | > 1000ms |
| Database Connections | > 15 | > 18 |
| Cache Hit Rate | < 80% | < 70% |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |

## Runbooks

### Service Down Alert
1. Check service logs in Cloudflare Workers
2. Verify recent deployments
3. Check for configuration changes
4. Restart service if necessary
5. Escalate if not resolved in 5 minutes

### High Error Rate Alert
1. Check error logs for patterns
2. Identify affected endpoints
3. Check recent code changes
4. Rollback if necessary
5. Notify on-call engineer

### Performance Degradation Alert
1. Check resource utilization
2. Analyze slow queries/endpoints
3. Check cache hit rates
4. Scale resources if needed
5. Optimize bottlenecks
