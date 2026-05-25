# SDLC Platform Monitoring and Alerting Infrastructure

This directory contains the complete monitoring and alerting infrastructure for the SDLC platform, providing real-time visibility into system performance, health, and business metrics.

## Architecture Overview

The monitoring stack consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Health Checker**: Service health monitoring
- **Node Exporter**: System metrics collection
- **Database Exporters**: PostgreSQL and Redis metrics

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all monitoring services
docker-compose up -d

# Access services
# Grafana: http://localhost:3001 (admin/admin123)
# Prometheus: http://localhost:9090
# AlertManager: http://localhost:9093
# Health Checker: http://localhost:8080/health
```

### Individual Components

#### Health Checker Service
```bash
# Install dependencies
npm install

# Start health checker
npm start

# Health check endpoint
curl http://localhost:8080/health

# Metrics endpoint
curl http://localhost:8080/metrics
```

## Components

### 1. Prometheus Configuration

**Files:**
- `prometheus/prometheus.yml` - Main configuration
- `prometheus/rules/alerts.yml` - Alerting rules

**Features:**
- Multi-target metrics collection
- Alert rule evaluation
- Time-series data storage
- Service discovery
- High availability support

**Key Metrics Collected:**
- HTTP request rates and durations
- System metrics (CPU, memory, disk)
- Database connections and performance
- Custom application metrics
- Health check statuses

### 2. Grafana Dashboards

**Pre-configured Dashboards:**
- **SDLC Platform Overview**: System performance and business metrics
- **Alerts Status**: Active alerts and alert history
- **System Metrics**: Infrastructure health
- **Database Performance**: PostgreSQL and Redis metrics

**Access Information:**
- URL: http://localhost:3001
- Username: admin
- Password: admin123

### 3. AlertManager

**Alert Routing:**
- **Critical Alerts**: Email + Slack to oncall team
- **Warning Alerts**: Email + Slack to team
- **Info Alerts**: Slack notifications only

**Configuration:**
- Email notifications
- Slack integration
- Alert grouping and inhibition
- Escalation policies

### 4. Health Checker Service

**Purpose:**
- Monitors all SDLC platform services
- Provides health status endpoints
- Collects custom application metrics
- Enables proactive issue detection

**Endpoints:**
- `/health` - Overall system health
- `/health/:service` - Specific service health
- `/metrics` - Prometheus metrics
- `/ready` - Readiness probe
- `/live` - Liveness probe

### 5. Application Metrics

**SDLC Landing Page Metrics:**
- HTTP request rates and response times
- Demo request conversion rates
- Page view tracking
- Active user counts
- Error rates by category
- Form submission performance

**Custom Metrics:**
```typescript
// Request tracking
http_requests_total{method, route, status_code}
http_request_duration_ms{method, route, status_code}

// Business metrics
demo_requests_total{status}
page_views_total{page}
active_users_total

// Performance metrics
form_submission_duration_ms{form_type}
error_rate{type}
```

## Alerting Rules

### Critical Alerts
- **High Error Rate**: >10% error rate
- **Service Down**: Service unavailability
- **Low Disk Space**: <10% available
- **Demo Request Failures**: High failure rate

### Warning Alerts
- **High Response Time**: p95 > 500ms
- **High Memory Usage**: >90%
- **High CPU Usage**: >80%
- **Database Connection Issues**

### Business Alerts
- **Low Demo Request Rate**: Low engagement
- **Low Daily Active Users**: User activity drop

## Monitoring Best Practices

### 1. Service Health Checks
- Implement `/health` endpoints for all services
- Include dependencies and external service status
- Provide clear status codes (200=healthy, 503=unhealthy)
- Include response time measurements

### 2. Metrics Collection
- Use Prometheus client libraries
- Include relevant labels for filtering
- Track business metrics, not just technical metrics
- Use appropriate histogram buckets for latency

### 3. Alert Configuration
- Set appropriate thresholds
- Use alert grouping to reduce noise
- Include actionable alert descriptions
- Test alert delivery regularly

### 4. Dashboard Design
- Include system overview and detailed views
- Use consistent time ranges
- Include important business metrics
- Add alert status indicators

## Integration with SDLC Landing Page

### Metrics Middleware
The landing page includes a metrics middleware that tracks:

```typescript
import MetricsMiddleware from './middleware';

export default MetricsMiddleware.middleware();
```

### Health Check API
```typescript
// /api/health endpoint
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 3600,
  "memory": { "used": 128, "total": 256, "usage": 0.5 },
  "services": {
    "database": "connected",
    "external": { "lemonsqueezy": "connected" }
  }
}
```

## Production Deployment

### Security Considerations
- Enable authentication for Grafana
- Use HTTPS for all endpoints
- Configure firewall rules
- Restrict access to sensitive metrics
- Use read-only Prometheus users for Grafana

### Performance Optimization
- Tune Prometheus retention periods
- Optimize Grafana dashboard queries
- Use appropriate scrape intervals
- Monitor monitoring system performance

### High Availability
- Deploy multiple Prometheus instances
- Use Grafana HA configuration
- Configure backup AlertManager
- Implement proper load balancing

## Troubleshooting

### Common Issues

1. **Health Check Failures**
   - Check service connectivity
   - Verify DNS resolution
   - Check firewall rules

2. **Metrics Not Appearing**
   - Verify Prometheus configuration
   - Check scrape intervals
   - Validate metric endpoints

3. **Alerts Not Firing**
   - Check AlertManager configuration
   - Verify alert rules
   - Test notification channels

4. **Grafana Dashboard Issues**
   - Check data source configuration
   - Verify query syntax
   - Check time range settings

### Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metrics collection
curl http://localhost:8080/metrics

# Check health status
curl http://localhost:8080/health

# Test alert rules
curl -X POST http://localhost:9093/api/v1/alerts

# Validate Grafana config
curl -u admin:admin123 http://localhost:3001/api/health
```

## Scaling and Maintenance

### Adding New Services
1. Add service to `docker-compose.yml`
2. Update Prometheus scrape configuration
3. Create health check endpoint
4. Add relevant metrics
5. Update Grafana dashboards

### Updating Alert Rules
1. Modify rules in `prometheus/rules/`
2. Reload Prometheus: `docker-compose restart prometheus`
3. Validate rules: `curl http://localhost:9090/api/v1/rules`

### Backup Configuration
```bash
# Backup Prometheus data
docker exec prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus

# Backup Grafana data
docker exec grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
```

## Documentation

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Node Exporter Documentation](https://github.com/prometheus/node_exporter)

## Support

For monitoring issues:
1. Check logs: `docker-compose logs <service>`
2. Verify configuration: `docker-compose config`
3. Test endpoints manually
4. Check system resources
5. Review alert rule syntax

## Future Enhancements

- [ ] Add custom business metrics
- [ ] Implement log aggregation with Loki
- [ ] Add distributed tracing with Jaeger
- [ ] Create automated monitoring tests
- [ ] Implement chaos engineering tests
- [ ] Add capacity planning dashboards