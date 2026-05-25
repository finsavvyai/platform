# Monitoring & Observability Setup Guide

Complete guide for setting up monitoring, metrics, and dashboards for MCPOverflow.

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Dashboards](#grafana-dashboards)
- [Alert Configuration](#alert-configuration)
- [Production Setup](#production-setup)

## Overview

MCPOverflow uses a comprehensive monitoring stack:

- **Prometheus**: Time-series metrics collection
- **Grafana**: Visualization and dashboards
- **Sentry**: Error tracking (see [SENTRY-SETUP.md](./SENTRY-SETUP.md))
- **Custom metrics**: API, business, and infrastructure metrics

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all services including monitoring
docker-compose up -d prometheus grafana

# Verify services are running
docker-compose ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3002
  - Username: `admin`
  - Password: `mcpoverflow_admin`

- **Prometheus**: http://localhost:9091

### 3. Import Dashboards

Dashboards are automatically provisioned from `docker/grafana/dashboards/`:
- **API Metrics** (`api-metrics.json`) - Request rates, latency, errors
- **Infrastructure** (`infrastructure.json`) - CPU, memory, disk, service health

## Prometheus Setup

### Configuration

Prometheus is configured via `docker/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'mcpoverflow-api'
    static_configs:
      - targets: ['host.docker.internal:8080']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

### Metrics Endpoint

The API service exposes metrics at `/metrics`:

```bash
curl http://localhost:8080/metrics
```

### Custom Metrics

Add custom metrics in your Go code:

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    connectorCreations = promauto.NewCounter(prometheus.CounterOpts{
        Name: "mcpoverflow_connector_creations_total",
        Help: "Total number of connectors created",
    })

    generationDuration = promauto.NewHistogram(prometheus.HistogramOpts{
        Name: "mcpoverflow_generation_duration_seconds",
        Help: "Time spent generating connectors",
        Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
    })
)

// Use in handlers
func (h *Handler) CreateConnector(c *gin.Context) {
    start := time.Now()
    defer func() {
        generationDuration.Observe(time.Since(start).Seconds())
    }()

    // ... handler logic

    connectorCreations.Inc()
}
```

## Grafana Dashboards

### Pre-built Dashboards

#### 1. API Metrics Dashboard
**UID**: `mcpoverflow-api-metrics`

Panels:
- **API Request Rate**: Requests per second by endpoint
- **API Response Time (p95)**: 95th percentile latency
- **API Error Rate**: 5xx errors as percentage
- **HTTP Status Codes**: Distribution of status codes
- **Current Metrics**: Error count, request rate, p50/p99 latency

**Use Cases:**
- Monitor API performance
- Detect latency spikes
- Track error rates
- Identify slow endpoints

#### 2. Infrastructure Dashboard
**UID**: `mcpoverflow-infrastructure`

Panels:
- **CPU Usage**: Per-instance CPU utilization
- **Memory Usage**: RAM consumption
- **Disk Usage**: Storage capacity
- **Redis Connections**: Active connections
- **Service Status**: Health checks for API, Redis, Neo4j

**Use Cases:**
- Monitor resource utilization
- Capacity planning
- Service health monitoring
- Detect infrastructure issues

### Creating Custom Dashboards

1. **Access Grafana**: http://localhost:3001
2. **Create Dashboard**: Dashboards → New Dashboard
3. **Add Panel**: Add visualization
4. **Configure Query**: Use PromQL

Example PromQL queries:

```promql
# Request rate
rate(http_requests_total{job="mcpoverflow-api"}[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Memory usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Active connections
sum(mcpoverflow_active_connections)
```

### Exporting Dashboards

```bash
# Export dashboard JSON
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3001/api/dashboards/uid/mcpoverflow-api-metrics \
  > api-metrics.json

# Import to production
curl -X POST \
  -H "Authorization: Bearer <prod-api-key>" \
  -H "Content-Type: application/json" \
  -d @api-metrics.json \
  https://grafana.prod.mcpoverflow.io/api/dashboards/db
```

## Alert Configuration

### Prometheus Alert Rules

Create `docker/prometheus/alert_rules.yml`:

```yaml
groups:
  - name: mcpoverflow_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High API error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # High latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency detected"
          description: "p95 latency is {{ $value }}s (threshold: 1s)"

      # Service down
      - alert: ServiceDown
        expr: up{job="mcpoverflow-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "Service has been down for more than 1 minute"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}% (threshold: 85%)"

      # Disk space low
      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Disk usage is {{ $value }}% (threshold: 85%)"

      # Redis connection pool exhausted
      - alert: RedisConnectionsHigh
        expr: redis_connected_clients > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Redis connections"
          description: "Redis has {{ $value }} connections (threshold: 80)"
```

Update `prometheus.yml` to load rules:

```yaml
rule_files:
  - "alert_rules.yml"
```

### Grafana Alerts

1. **Open Dashboard**: Navigate to panel
2. **Edit Panel**: Click panel title → Edit
3. **Alert tab**: Create alert rule
4. **Configure**:
   - Condition: `WHEN last() OF query(A) IS ABOVE 0.05`
   - Frequency: `Evaluate every 1m for 5m`
   - Notifications: Select channel

### Alert Notifications

#### Slack Integration

```yaml
# docker/grafana/provisioning/notifiers/slack.yml
notifiers:
  - name: Slack
    type: slack
    uid: slack-mcpoverflow
    org_id: 1
    is_default: true
    settings:
      url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
      recipient: '#alerts'
      username: Grafana
```

#### Email Notifications

Configure in Grafana UI:
1. **Alerting** → **Contact points**
2. **New contact point**
3. Select **Email**
4. Configure SMTP settings

#### PagerDuty

```yaml
notifiers:
  - name: PagerDuty
    type: pagerduty
    uid: pagerduty-mcpoverflow
    settings:
      integrationKey: YOUR_INTEGRATION_KEY
      autoResolve: true
```

## Production Setup

### Cloud Provider Integration

#### AWS CloudWatch

```go
import "github.com/prometheus/client_golang/prometheus/push"

// Push metrics to CloudWatch via Prometheus Pushgateway
func pushMetrics() {
    pusher := push.New("http://pushgateway:9091", "mcpoverflow")
    pusher.Collector(connectorCreations)
    pusher.Push()
}
```

#### Grafana Cloud

```bash
# Remote write to Grafana Cloud
# Add to prometheus.yml
remote_write:
  - url: https://prometheus-prod-10-prod-us-central-0.grafana.net/api/prom/push
    basic_auth:
      username: YOUR_INSTANCE_ID
      password: YOUR_API_KEY
```

### High Availability

#### Prometheus HA Setup

```yaml
# docker-compose.prod.yml
services:
  prometheus-1:
    image: prom/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
      - '--web.external-url=https://prometheus.mcpoverflow.io'

  prometheus-2:
    image: prom/prometheus
    # Same config, different storage

  # Load balancer
  prometheus-lb:
    image: nginx:alpine
    volumes:
      - ./nginx-prometheus.conf:/etc/nginx/nginx.conf
```

#### Grafana HA Setup

```yaml
services:
  grafana-1:
    image: grafana/grafana
    environment:
      GF_DATABASE_TYPE: postgres
      GF_DATABASE_HOST: postgres:5432
      GF_DATABASE_NAME: grafana
      GF_DATABASE_USER: grafana
      GF_DATABASE_PASSWORD: ${GRAFANA_DB_PASSWORD}

  grafana-2:
    # Same config, shared database
```

### Retention & Storage

```yaml
# Prometheus storage retention
command:
  - '--storage.tsdb.retention.time=90d'
  - '--storage.tsdb.retention.size=50GB'

# Use remote storage for long-term retention
remote_write:
  - url: https://long-term-storage/api/v1/write
```

### Security

#### Authentication

```yaml
# Prometheus basic auth
command:
  - '--web.config.file=/etc/prometheus/web-config.yml'

# web-config.yml
basic_auth_users:
  admin: $2y$10$... # bcrypt hash
```

#### TLS/SSL

```yaml
# Enable HTTPS
tls_server_config:
  cert_file: /etc/prometheus/cert.pem
  key_file: /etc/prometheus/key.pem
```

### Backup & Recovery

```bash
# Backup Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz /data

# Backup Grafana dashboards
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3001/api/search?type=dash-db \
  | jq -r '.[] | .uid' \
  | xargs -I {} curl -H "Authorization: Bearer <api-key>" \
    http://localhost:3001/api/dashboards/uid/{} \
    > grafana-backup-{}.json
```

## Monitoring Checklist

### Development
- [x] Prometheus collecting metrics
- [x] Grafana dashboards configured
- [x] API metrics endpoint working
- [ ] Custom business metrics added
- [ ] Alert rules configured

### Staging
- [ ] Metrics from all services
- [ ] Dashboards accessible
- [ ] Alerts firing correctly
- [ ] Notification channels configured
- [ ] Performance baselines established

### Production
- [ ] High availability setup
- [ ] Remote storage configured
- [ ] Backup automated
- [ ] 24/7 monitoring active
- [ ] On-call rotation configured
- [ ] Runbooks documented

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check service connectivity
docker-compose exec prometheus wget -O- http://host.docker.internal:8080/metrics
```

### Grafana Dashboard Not Loading

```bash
# Check provisioning logs
docker-compose logs grafana | grep provisioning

# Verify datasource
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3001/api/datasources
```

### High Cardinality Issues

```promql
# Find high cardinality metrics
topk(10, count by (__name__)({__name__=~".+"}))
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheatsheet](https://promlabs.com/promql-cheat-sheet/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)
- [Best Practices](https://prometheus.io/docs/practices/)

## Support

For monitoring issues:
1. Check service logs: `docker-compose logs prometheus grafana`
2. Verify configuration files
3. Review this documentation
4. Open an issue in the MCPOverflow repository
