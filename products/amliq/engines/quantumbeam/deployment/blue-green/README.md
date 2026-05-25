# Blue-Green Deployment Strategy

This directory contains the complete blue-green deployment infrastructure for QuantumBeam, enabling zero-downtime deployments with automated traffic switching, validation, and rollback capabilities.

## Architecture Overview

The blue-green deployment system consists of:

1. **Traffic Router** - Intelligent traffic routing and switching logic
2. **Blue/Green Environments** - Duplicate production environments
3. **Validation Framework** - Comprehensive smoke tests and health checks
4. **Automated Rollback** - Fail-safe rollback mechanisms
5. **Monitoring Integration** - Real-time monitoring and alerting

## Components

### Blue-Green Infrastructure (`blue-green-deployment.yaml`)

Complete Kubernetes infrastructure including:

- **Environment Services**: Separate services for blue and green environments
- **Production Router**: Load balancer that routes traffic to active environment
- **Traffic Router Service**: Automated traffic switching and validation
- **Health Check Framework**: Comprehensive health monitoring
- **Istio Integration**: Advanced traffic routing capabilities (optional)
- **RBAC Configuration**: Proper permissions and security

**Features:**
- Automatic traffic switching with validation
- Health check monitoring for both environments
- Smoke test execution before traffic switch
- Performance baseline comparison
- Automatic rollback on failure
- Gradual traffic splitting support
- Integration with monitoring and alerting

### Traffic Router (`traffic-router.py`)

Python-based traffic router with FastAPI REST API:

**Key Features:**
- Health check validation before traffic switch
- Smoke test execution and monitoring
- Performance test comparison
- Automatic rollback triggers
- Multi-channel notifications (Slack, PagerDuty, Email)
- Configuration management
- Real-time status monitoring

**API Endpoints:**
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /status` - Current deployment status
- `POST /switch-traffic` - Switch traffic to target environment
- `GET /services` - List configured services
- `GET /config` - Get current configuration

### Smoke Test Suite (`smoke-tests.py`)

Comprehensive validation framework for deployments:

**Test Categories:**
- **Basic Tests**: Connectivity, readiness, API endpoints
- **Comprehensive Tests**: Authentication, database, external dependencies
- **API Tests**: CRUD operations, input validation, rate limiting
- **Fraud Detection Tests**: ML models, fraud detection, cache, quantum processing

**Features:**
- Configurable test suites
- Async execution for performance
- Detailed test reporting
- Integration with deployment pipeline
- Environment-specific test configuration

## Deployment and Configuration

### Prerequisites

- Kubernetes cluster (1.20+)
- Istio (optional, for advanced traffic routing)
- Prometheus and Grafana for monitoring
- Slack, PagerDuty accounts for notifications

### Installation

1. **Deploy the infrastructure:**
```bash
kubectl apply -f blue-green-deployment.yaml
```

2. **Build and deploy traffic router:**
```bash
docker build -t quantumbeam/traffic-router:latest .
kubectl set image deployment/traffic-router traffic-router=quantumbeam/traffic-router:latest -n blue-green
```

3. **Build smoke tests image:**
```bash
docker build -t quantumbeam/smoke-tests:latest -f Dockerfile.smoke-tests .
```

4. **Configure services:**
```bash
# Update the traffic-router-config ConfigMap with your service details
kubectl edit configmap traffic-router-config -n blue-green
```

### Configuration

#### Traffic Router Configuration

Key configuration sections in `config.yaml`:

```yaml
router:
  default_environment: "blue"
  traffic_splitting:
    enabled: true
    gradual_rollout:
      enabled: true
      steps: [5, 10, 25, 50, 100]
      step_duration: "5m"

  health_checks:
    enabled: true
    endpoint: "/health"
    interval: "30s"
    failure_threshold: 3

  validation:
    smoke_tests:
      enabled: true
      test_suite: "smoke-tests"
      timeout: "10m"
    performance_tests:
      enabled: true
      baseline_comparison: true

  rollback:
    enabled: true
    automatic_rollback: true
    rollback_triggers:
      health_check_failures: true
      smoke_test_failures: true
      performance_degradation: true
```

#### Service-Specific Configuration

```yaml
services:
  quantumbeam-api:
    port: 80
    health_endpoint: "/health"
    smoke_tests: ["api-connectivity", "basic-crud", "auth-flow"]
    performance_thresholds:
      response_time_p95: "500ms"
      error_rate: "1%"
      throughput_degradation: "5%"
```

#### Notification Configuration

```yaml
notifications:
  enabled: true
  channels:
    slack:
      webhook_url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
      channel: "#deployments"
    pagerduty:
      integration_key: "YOUR_PAGERDUTY_KEY"
    email:
      enabled: true
      recipients: ["ops@quantumbeam.io"]
```

## Usage

### Manual Traffic Switching

1. **Switch traffic to green environment:**
```bash
curl -X POST http://traffic-router.blue-green.svc.cluster.local:8080/switch-traffic \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "quantumbeam-api",
    "target_environment": "green",
    "validation_timeout": 600
  }'
```

2. **Check deployment status:**
```bash
curl http://traffic-router.blue-green.svc.cluster.local:8080/status
```

3. **Get service list:**
```bash
curl http://traffic-router.blue-green.svc.cluster.local:8080/services
```

### Automated Deployment Integration

Integrate with CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Deploy to Green Environment
  run: |
    # Deploy new version to green environment
    kubectl set image deployment/quantumbeam-green api=${{ env.IMAGE_TAG }} -n blue-green

    # Wait for deployment to be ready
    kubectl wait --for=condition=available deployment/quantumbeam-green -n blue-green --timeout=600s

- name: Switch Traffic to Green
  run: |
    curl -X POST http://traffic-router.blue-green.svc.cluster.local:8080/switch-traffic \
      -H "Content-Type: application/json" \
      -d '{
        "service_name": "quantumbeam-api",
        "target_environment": "green"
      }'
```

### Gradual Traffic Splitting

Enable gradual traffic rollout:

```bash
# Update configuration to enable gradual rollout
kubectl patch configmap traffic-router-config -n blue-green --type=merge -p '{
  "data": {
    "config.yaml": "... traffic_splitting:\n    gradual_rollout:\n      enabled: true\n      steps: [5, 10, 25, 50, 100]\n      step_duration: \"5m\" ..."
  }
}'
```

## Monitoring and Observability

### Health Checks

The system provides comprehensive health monitoring:

- **Environment Health**: Health checks for blue and green environments
- **Service Health**: Individual service health monitoring
- **Traffic Router Health**: Traffic router service health
- **Validation Health**: Smoke test and performance test status

### Metrics

Traffic router exposes Prometheus metrics:

- `traffic_router_switches_total` - Total traffic switches performed
- `traffic_router_switches_duration_seconds` - Duration of traffic switches
- `traffic_router_rollback_total` - Total rollbacks triggered
- `traffic_router_health_checks_total` - Total health checks performed

### Grafana Dashboard

Use the provided Grafana dashboard for monitoring:

- Traffic switch history
- Environment health status
- Validation test results
- Performance metrics comparison
- Rollback incidents

### Logging

Structured logging with correlation IDs:

- Traffic switch events
- Health check results
- Validation test execution
- Rollback triggers and reasons
- Notification delivery status

## Testing and Validation

### Local Testing

Test the traffic router locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Run traffic router
python traffic-router.py

# Run smoke tests
python smoke-tests.py
```

### Integration Testing

Test the complete deployment flow:

```bash
# Deploy test infrastructure
kubectl apply -f test-blue-green.yaml

# Run integration tests
python -m pytest tests/integration/
```

### Performance Testing

Validate performance under load:

```bash
# Run load tests
python tests/load_test.py --target-service quantumbeam-api --rps 1000 --duration 300

# Validate performance during traffic switch
python tests/traffic_switch_performance.py
```

## Troubleshooting

### Common Issues

1. **Traffic Switch Fails**
   - Check target environment health
   - Validate smoke test results
   - Review service connectivity
   - Check network policies

2. **Health Check Failures**
   - Verify service endpoints are accessible
   - Check service discovery configuration
   - Review network connectivity
   - Validate service dependencies

3. **Smoke Test Failures**
   - Review smoke test logs
   - Check service configuration
   - Validate external dependencies
   - Test individual endpoints manually

### Debug Commands

```bash
# Check traffic router logs
kubectl logs -n blue-green deployment/traffic-router -f

# Check service status
kubectl get services -n blue-green -l component=deployment

# Check endpoints
kubectl get endpoints -n blue-green

# Test connectivity
kubectl exec -it -n blue-green deployment/traffic-router -- curl http://quantumbeam-api-blue.blue-green.svc.cluster.local/health

# Check smoke test job logs
kubectl logs -n blue-green job/smoke-test-quantumbeam-api-green-<timestamp>
```

### Recovery Procedures

1. **Manual Rollback**
```bash
curl -X POST http://traffic-router.blue-green.svc.cluster.local:8080/switch-traffic \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "quantumbeam-api",
    "target_environment": "blue"
  }'
```

2. **Reset Configuration**
```bash
kubectl patch configmap traffic-router-config -n blue-green --type=merge -p '{
  "data": {
    "config.yaml": "... default_environment: \"blue\" ..."
  }
}'
```

## Best Practices

### Deployment Strategy

1. **Staging Environment**: Test all deployments in staging first
2. **Gradual Rollout**: Use gradual traffic splitting for critical services
3. **Monitoring**: Monitor all metrics during traffic switch
4. **Rollback Plan**: Always have a rollback plan ready

### Configuration Management

1. **Version Control**: Keep all configuration in version control
2. **Environment Separation**: Use different configs for different environments
3. **Validation**: Validate configuration before applying
4. **Documentation**: Document all configuration changes

### Security

1. **RBAC**: Use proper RBAC configuration
2. **Network Policies**: Implement network policies for security
3. **Secrets Management**: Use Kubernetes secrets for sensitive data
4. **Audit Logging**: Enable audit logging for all changes

### Performance

1. **Resource Limits**: Set appropriate resource limits
2. **Health Check Tuning**: Optimize health check intervals
3. **Timeout Configuration**: Set appropriate timeouts
4. **Monitoring**: Monitor resource usage and performance

## Integration with Existing Systems

### ArgoCD Integration

Add to ArgoCD application:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: blue-green-deployment
spec:
  source:
    path: deployment/blue-green
  destination:
    namespace: blue-green
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Prometheus Integration

Add Prometheus monitoring:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: traffic-router
  namespace: blue-green
spec:
  selector:
    matchLabels:
      app: traffic-router
  endpoints:
  - port: http
    path: /metrics
```

### Istio Integration

For advanced traffic routing with Istio:

1. Install Istio in the cluster
2. Enable traffic router Istio integration
3. Configure virtual services and destination rules
4. Use traffic routing features like mirroring and retries

## Contributing

### Adding New Tests

1. Add test method to `SmokeTestSuite`
2. Update configuration to include new test
3. Add test to appropriate test category
4. Update documentation

### Extending Traffic Router

1. Add new API endpoints to FastAPI application
2. Update configuration schema
3. Add corresponding Kubernetes RBAC permissions
4. Update monitoring and logging

### Improving Validation

1. Add new validation checks
2. Improve error handling and reporting
3. Add performance benchmarking
4. Enhance notification system

## License

This blue-green deployment system is part of the QuantumBeam platform and follows the same licensing terms.