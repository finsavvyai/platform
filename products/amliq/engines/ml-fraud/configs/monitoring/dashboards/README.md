# QuantumBeam Monitoring Dashboards

This directory contains comprehensive Grafana dashboards for monitoring the QuantumBeam production environment.

## 📊 Dashboard Overview

### 1. Production Overview Dashboard
**File:** `overview-dashboard.json`
**UID:** `quantumbeam-overview`

Provides a high-level view of the entire system:
- System health status
- Request rates and response times
- Error rates and availability
- Fraud detection metrics
- Model accuracy scores
- System resource usage
- Database connection status

### 2. Fraud Detection Analytics Dashboard
**File:** `fraud-detection-dashboard.json`
**UID:** `quantumbeam-fraud`

Focused on ML and quantum computing performance:
- Total fraud detections per minute
- Model accuracy by type
- Detection latency percentiles
- Confidence level distribution
- Quantum circuit execution metrics
- Detection results breakdown

### 3. Infrastructure Monitoring Dashboard
**File:** `infrastructure-dashboard.json`
**UID:** `quantumbeam-infrastructure`

System resources and infrastructure health:
- CPU, memory, and goroutine usage
- Database connections and query latency
- Cache performance metrics
- HTTP status code distribution
- Resource usage trends
- Memory usage breakdown

### 4. Security Monitoring Dashboard
**File:** `security-dashboard.json`
**UID:** `quantumbeam-security`

Security events and access patterns:
- Security events by type
- Authentication success/failure rates
- API key usage patterns
- SSL certificate expiry monitoring
- Rate limiting metrics
- WAF blocked requests
- Top client IPs analysis

### 5. Distributed Tracing Dashboard
**File:** `trace-analysis-dashboard.json`
**UID:** `quantumbeam-traces`

Application performance tracing:
- Trace search and analysis
- Duration percentiles (P50, P95, P99)
- Error rates by service
- Span analysis by operation
- Hot and slow operations identification

### 6. Alert Management Dashboard
**File:** `alerts-dashboard.json`
**UID:** `quantumbeam-alerts`

Alert system status and metrics:
- Active alerts count and severity
- Alert firing rates
- Resolution time analysis
- Notification channel status
- Silenced alerts management

## 🚀 Deployment

### Prerequisites
- Grafana 8.0+
- Prometheus data source
- Jaeger for distributed tracing
- Loki for log aggregation (optional)

### Kubernetes Deployment

1. **Apply with Kustomize:**
   ```bash
   kubectl apply -k monitoring/dashboards/
   ```

2. **Manual deployment:**
   ```bash
   kubectl create configmap quantumbeam-dashboards \
     --from-file=monitoring/dashboards/grafana/dashboards/ \
     -n monitoring
   ```

### Local Development

1. **Import dashboards into Grafana:**
   - Navigate to Grafana UI
   - Import each dashboard JSON file
   - Select Prometheus as data source

2. **Configure data sources:**
   ```bash
   # Update datasources.yml with your endpoints
   vim monitoring/dashboards/grafana/datasources/datasources.yml
   ```

## 📈 Key Metrics

### Business Metrics
- **Fraud Detection Rate**: `fraud_detections_total`
- **Model Accuracy**: `model_accuracy_score`
- **Transaction Processing**: `transactions_processed_total`
- **API Key Usage**: `api_key_usage_total`
- **Quantum Circuit Executions**: `quantum_circuit_executions_total`

### Infrastructure Metrics
- **HTTP Requests**: `http_requests_total`
- **Response Time**: `http_request_duration_seconds`
- **System Resources**: `cpu_usage_percent`, `memory_usage_bytes`
- **Database**: `db_connections_active`, `db_query_duration_seconds`
- **Cache**: `cache_hits_total`, `cache_misses_total`

### Security Metrics
- **Security Events**: `security_events_total`
- **Auth Failures**: `auth_failures_total`
- **Rate Limiting**: `rate_limit_requests_total`
- **WAF Blocks**: `waf_blocked_requests_total`

## 🎨 Customization

### Theming
- Dark theme optimized for 24/7 operations centers
- Color-coded severity indicators
- Consistent color palette across all dashboards

### Alerting
- Threshold-based alerts with visual indicators
- Color-coded panels (green/yellow/red)
- Configurable alert thresholds per panel

### Variables
- Service selection filters
- Time range controls
- Model type filtering
- Environment selection

## 🔧 Configuration

### Data Sources
Update `datasources.yml` with your environment:
```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
  - name: Jaeger
    type: jaeger
    url: http://jaeger:16686
  - name: Loki
    type: loki
    url: http://loki:3100
```

### Auto-provisioning
Dashboards are automatically provisioned via:
- ConfigMap mounts
- Grafana provisioning configuration
- Kustomize for Kubernetes deployments

## 📋 Maintenance

### Updates
1. Update dashboard JSON files
2. Apply changes: `kubectl apply -k monitoring/dashboards/`
3. Verify dashboards in Grafana UI

### Backup
```bash
kubectl get configmap quantumbeam-dashboards -o yaml > dashboard-backup.yaml
```

### Monitoring Dashboard Health
- Check dashboard loading times
- Monitor data source connectivity
- Verify alert notifications

## 🤝 Contributing

### Adding New Dashboards
1. Create dashboard JSON file
2. Add to kustomization.yaml
3. Update README.md documentation
4. Test in development environment

### Best Practices
- Use consistent naming conventions
- Include descriptive panel titles
- Set appropriate time ranges
- Use meaningful thresholds
- Document custom metrics

## 📞 Support

For dashboard issues:
1. Check data source connectivity
2. Verify metric availability
3. Review Grafana logs
4. Check Prometheus query syntax

---

**Note:** These dashboards are designed for production monitoring and include sensitive system metrics. Ensure proper access controls are in place.