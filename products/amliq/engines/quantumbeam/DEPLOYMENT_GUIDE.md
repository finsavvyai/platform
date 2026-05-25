# QuantumBeam Production Readiness Deployment Guide

This guide will help you deploy all the production readiness systems to your Kubernetes cluster.

## 🚀 Quick Start

### Prerequisites
- Kubernetes cluster (EKS, GKE, or minikube for testing)
- kubectl configured to access your cluster
- Docker installed and running
- (Optional) Container registry for pushing images

### Step 1: Build and Deploy All Systems

```bash
# Set your container registry (optional - defaults to local images)
export REGISTRY="your-registry.com"
export VERSION="v1.0.0"

# Run the complete build and deployment
./build-and-deploy-all.sh
```

### Step 2: Configure External Integrations

```bash
# Update Slack and PagerDuty credentials
kubectl edit secret monitoring-secrets -n monitoring

# Update AWS credentials for resource optimization
kubectl edit secret aws-credentials -n operations
```

### Step 3: Access the Services

```bash
# Port forward to access APIs
kubectl port-forward svc/config-validator 8080:80 -n config-validation &
kubectl port-forward svc/anomaly-detector 8080:80 -n monitoring &
kubectl port-forward svc/alert-correlation 8080:80 -n monitoring &
kubectl port-forward svc/resource-optimizer 8080:80 -n operations &

# Test health endpoints
curl http://localhost:8080/health
```

## 📋 Detailed Instructions

### Option 1: Local Development/Testing

For local testing without a container registry:

```bash
# Build images locally
./build-and-deploy-all.sh build

# Deploy using local images
export REGISTRY="localhost:5000"
./build-and-deploy-all.sh deploy
```

### Option 2: Production Deployment

For production deployment with a proper registry:

```bash
# Set your production registry
export REGISTRY="your-docker-registry.com"
export VERSION="production-v1.0.0"

# Build, push, and deploy
./build-and-deploy-all.sh all
```

## 🔧 Configuration

### Slack Integration

1. Create a Slack webhook URL
2. Update the secret:
```bash
kubectl create secret generic monitoring-secrets \
  --from-literal=slack-webhook="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
  --from-literal=pagerduty-key="YOUR_PAGERDUTY_KEY" \
  -n monitoring --dry-run=client -o yaml | kubectl apply -f -
```

### PagerDuty Integration

1. Get your PagerDuty integration key
2. Add it to the monitoring secrets (see above)

### AWS Integration (Resource Optimization)

1. Create AWS IAM user with appropriate permissions
2. Update AWS credentials:
```bash
kubectl create secret generic aws-credentials \
  --from-literal=access-key-id="YOUR_ACCESS_KEY" \
  --from-literal=secret-access-key="YOUR_SECRET_KEY" \
  -n operations --dry-run=client -o yaml | kubectl apply -f -
```

## 📊 Monitoring and Verification

### Check Deployment Status

```bash
# Check all pods
kubectl get pods -n config-validation,monitoring,operations,observability

# Check services
kubectl get services -n config-validation,monitoring,operations,observability

# Check logs
kubectl logs -n config-validation deployment/config-validator
kubectl logs -n monitoring deployment/anomaly-detector
kubectl logs -n monitoring deployment/alert-correlation
kubectl logs -n operations deployment/resource-optimizer
```

### Access Dashboards

```bash
# Jaeger Tracing UI
kubectl port-forward svc/jaeger-query 16686:16686 -n observability
# Open http://localhost:16686 in your browser

# Prometheus Metrics
# Access via your existing Prometheus installation
# New services should be automatically discovered

# API Endpoints
curl http://localhost:8080/health
curl http://localhost:8000/metrics
```

## 🧪 Testing the Systems

### Configuration Validation

```bash
# Test validation API
curl -X POST "http://localhost:8080/validation/validate/production" \
  -H "Content-Type: application/json"

# Get violations
curl "http://localhost:8080/validation/violations/production"
```

### Anomaly Detection

```bash
# Test anomaly detection
curl -X POST "http://localhost:8080/detect" \
  -H "Content-Type: application/json" \
  -d '{"metrics": {"cpu": 80, "memory": 90}}'
```

### Resource Optimization

```bash
# Get optimization recommendations
curl "http://localhost:8080/recommendations"

# Get current status
curl "http://localhost:8080/status"
```

### Alert Correlation

```bash
# Test alert correlation
curl -X POST "http://localhost:8080/correlate" \
  -H "Content-Type: application/json" \
  -d '{"alerts": [{"name": "HighCPU", "severity": "warning"}]}'
```

## 🔒 Security Considerations

1. **Network Policies**: All deployments include network policies for security
2. **RBAC**: Service accounts with minimal required permissions
3. **Secrets Management**: Sensitive data stored in Kubernetes secrets
4. **Container Security**: Non-root users, read-only filesystems, dropped capabilities

## 🚨 Troubleshooting

### Common Issues

1. **Pods not starting**:
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   kubectl logs <pod-name> -n <namespace>
   ```

2. **Image pull errors**:
   - Verify registry credentials
   - Check image names and tags
   - Ensure images are pushed to registry

3. **Permission errors**:
   - Verify RBAC permissions
   - Check service account bindings

4. **External integration failures**:
   - Verify secret values
   - Check network connectivity
   - Review API keys and tokens

### Reset/Redeploy

```bash
# Delete all deployments
kubectl delete -f deployment/config-validation/
kubectl delete -f monitoring/
kubectl delete -f observability/
kubectl delete -f operations/

# Redeploy
./build-and-deploy-all.sh all
```

## 📈 Production Readiness Checklist

- [ ] All pods are running and healthy
- [ ] Health endpoints return 200 OK
- [ ] Metrics are being collected by Prometheus
- [ ] Slack/PagerDuty integrations are working
- [ ] Configuration validation is running
- [ ] Anomaly detection models are trained
- [ ] Resource optimization recommendations are generated
- [ ] Alert correlation is reducing noise
- [ ] Jaeger tracing is collecting data
- [ ] All secrets are properly configured

## 🆘 Support

If you encounter issues:

1. Check the logs of the affected service
2. Verify network connectivity and DNS resolution
3. Check resource constraints (CPU/memory)
4. Review RBAC permissions
5. Validate external service configurations

For additional support, refer to the individual service documentation in their respective directories.