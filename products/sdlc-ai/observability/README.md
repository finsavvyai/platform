# SDLC Platform Observability Infrastructure

This directory contains the comprehensive observability infrastructure for the SDLC.ai platform, providing structured logging, Prometheus metrics collection, OpenTelemetry tracing, log aggregation, alerting, and monitoring dashboards.

## Architecture Overview

The observability infrastructure consists of:

1. **Structured Logging** - JSON-formatted logging with correlation ID propagation
2. **Metrics Collection** - Prometheus metrics for business and technical KPIs
3. **Distributed Tracing** - OpenTelemetry tracing across services
4. **Log Aggregation** - ELK stack (Elasticsearch, Logstash, Kibana)
5. **Alerting** - Prometheus Alertmanager with custom rules
6. **Monitoring Dashboards** - Grafana dashboards for system visibility
7. **Integration Libraries** - Go and Python libraries for services

## Directory Structure

```
observability/
├── logging/                 # Structured logging implementation
│   ├── go/                 # Go structured logger
│   ├── python/             # Python structured logger
│   └── shared/             # Correlation ID propagation
├── metrics/                # Prometheus metrics collection
│   ├── prometheus/         # Prometheus Go client
│   └── custom/             # Custom metrics definitions
├── tracing/                # OpenTelemetry tracing
│   ├── opentelemetry/      # Tracing implementation
│   └── config/             # Tracing configuration
├── alerting/               # Alerting system
│   ├── rules/              # Alert rules
│   └── notifications/      # Notification channels
├── dashboards/             # Grafana dashboards
│   ├── grafana/            # Dashboard definitions
│   └── templates/          # Dashboard templates
├── config/                 # Configuration files
│   ├── docker-compose.observability.yml
│   └── ...
└── libraries/              # Integration libraries
    ├── go/                 # Go observability library
    └── python/             # Python observability library
```

## Quick Start

### 1. Start the Observability Stack

```bash
# Navigate to the observability directory
cd observability

# Start all observability services
docker-compose -f config/docker-compose.observability.yml up -d
```

This will start:
- Elasticsearch (http://localhost:9200)
- Kibana (http://localhost:5601)
- Logstash (http://localhost:5044)
- Prometheus (http://localhost:9090)
- Grafana (http://localhost:3000, admin/admin123)
- Alertmanager (http://localhost:9093)
- Jaeger (http://localhost:16686)

### 2. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin/admin123 |
| Prometheus | http://localhost:9090 | - |
| Kibana | http://localhost:5601 | - |
| Jaeger | http://localhost:16686 | - |
| Alertmanager | http://localhost:9093 | - |

## Integration Guide

### Go Services

```go
import (
    "github.com/sdlc-platform/observability/libraries/go"
)

func main() {
    // Initialize observability
    config := observability.DefaultConfig()
    config.ServiceName = "my-service"
    
    obsManager, err := observability.NewObservabilityManager(config)
    if err != nil {
        log.Fatal(err)
    }
    defer obsManager.Shutdown(context.Background())

    // Start metrics server
    go obsManager.StartMetricsServer()

    // Create HTTP middleware
    middleware := observability.NewObservabilityMiddleware(obsManager)
    
    // Use middleware
    router := mux.NewRouter()
    router.Use(middleware.Middleware)
    
    // Your application code here
}
```

### Python Services

```python
from fastapi import FastAPI
from observability import (
    ObservabilityManager, ObservabilityConfig,
    instrument_fastapi, init_global_observability
)

# Initialize observability
config = ObservabilityConfig(
    service_name="my-service",
    service_version="1.0.0"
)

manager = init_global_observability(config)

# Create FastAPI app
app = FastAPI()

# Instrument with observability
instrument_fastapi(app, manager)

# Your application code here
```

## Configuration

### Logging Configuration

```yaml
logging:
  service: "sdlc-platform"
  version: "1.0.0"
  environment: "development"
  level: "info"
  format: "json"
  output: "stdout"
  enable_tracing: true
  redact_fields:
    - "password"
    - "token"
    - "secret"
```

### Metrics Configuration

```yaml
metrics:
  namespace: "sdlc"
  subsystem: "platform"
  port: 9090
  path: "/metrics"
  common_labels:
    - "service"
    - "version"
    - "environment"
    - "tenant_id"
```

### Tracing Configuration

```yaml
tracing:
  service_name: "sdlc-platform"
  service_version: "1.0.0"
  environment: "development"
  enabled: true
  sampling_rate: 1.0
  exporters:
    - "jaeger"
  jaeger_endpoint: "http://localhost:14268/api/traces"
```

## Metrics

### Business Metrics

- **HTTP Requests**: Total requests, response time, error rate
- **Authentication**: Auth attempts, success/failure rates
- **Documents**: Processing metrics, document sizes
- **RAG Operations**: Query performance, retrieved documents
- **Vector Search**: Search performance, index sizes
- **Tenants**: Active tenants, storage usage per tenant

### System Metrics

- **Resource Usage**: CPU, memory, disk, network I/O
- **Database**: Connection pools, query performance
- **Cache**: Hit rates, memory usage

## Alerting

### Alert Channels

- **Email**: SMTP notifications
- **Slack**: Channel notifications
- **Webhook**: Custom integrations

### Alert Types

- **Critical**: Service downtime, security incidents
- **Warning**: High error rates, performance degradation
- **Info**: Business metric anomalies

### Alert Rules

```yaml
groups:
  - name: sdlc-platform
    rules:
      - alert: ServiceDown
        expr: up{job="sdlc-platform"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.service }} is down"
          description: "Service {{ $labels.service }} has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(sdlc_platform_errors_total[5m]) / rate(sdlc_platform_http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for service {{ $labels.service }}"
```

## Dashboards

### Available Dashboards

1. **SDLC Platform - Overview**: System-wide metrics and health
2. **Service Performance**: Individual service metrics
3. **Business Metrics**: KPIs and business operations
4. **Infrastructure**: Resource utilization
5. **Security**: Authentication and authorization metrics

### Custom Dashboards

Custom dashboards can be added to the `dashboards/grafana/` directory and will be automatically provisioned.

## Development

### Adding New Metrics

```go
// Create a new counter
counter := metricsCollector.CounterVec(
    "new_metric_total",
    "Description of the metric",
    []string{"label1", "label2"},
)

// Use the metric
counter.WithLabelValues("value1", "value2").Inc()
```

### Adding New Spans

```go
// Create a traced operation
helper := opentelemetry.NewBusinessTraceHelper(tracerManager)
err := helper.WithSpan(ctx, "operation-name", func(ctx context.Context) error {
    // Your operation code here
    return nil
})
```

### Adding New Log Fields

```go
// Log with custom fields
logger.Info(ctx, "Operation completed", 
    map[string]interface{}{
        "custom_field": "value",
        "another_field": 123,
    },
)
```

## Production Considerations

### Security

- All observability services should be secured with authentication
- Sensitive data is automatically redacted from logs
- Network access should be restricted to internal services

### Performance

- Log sampling is configurable for high-volume services
- Metrics aggregation reduces storage overhead
- Tracing sampling prevents performance impact

### Scaling

- Elasticsearch cluster configuration for high availability
- Prometheus federation for multi-region deployments
- Load balancing for Grafana and Alertmanager

## Troubleshooting

### Common Issues

1. **Services not appearing in Prometheus**
   - Check service discovery configuration
   - Verify metrics endpoint is accessible
   - Check Prometheus configuration

2. **Logs not appearing in Kibana**
   - Verify Logstash configuration
   - Check Elasticsearch cluster health
   - Review log format and parsing

3. **Missing traces in Jaeger**
   - Verify OpenTelemetry configuration
   - Check sampling rate
   - Review exporter configuration

### Health Checks

All services include health checks:

```bash
# Check service health
curl http://localhost:9200/_cluster/health  # Elasticsearch
curl http://localhost:5601/api/status         # Kibana
curl http://localhost:9090/metrics           # Prometheus
curl http://localhost:3000/api/health        # Grafana
```

## Contributing

When adding new observability features:

1. Follow the existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Consider performance impact
5. Ensure backward compatibility

## Support

For observability-related issues:

1. Check the service logs
2. Review the troubleshooting guide
3. Consult the Grafana/Prometheus documentation
4. Contact the DevOps team

## License

This observability infrastructure is part of the SDLC.ai platform and follows the same licensing terms.