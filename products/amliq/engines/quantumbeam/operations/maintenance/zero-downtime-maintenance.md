# Zero-Downtime Maintenance Procedures

This document contains procedures for performing maintenance on QuantumBeam services without causing downtime.

## Table of Contents

1. [Maintenance Planning](#maintenance-planning)
2. [Prerequisites](#prerequisites)
3. [Maintenance Types](#maintenance-types)
4. [Procedures by Service](#procedures-by-service)
5. [Rollback Procedures](#rollback-procedures)
6. [Post-Maintenance Validation](#post-maintenance-validation)

## Maintenance Planning

### Maintenance Window Planning

#### Standard Maintenance Windows
- **Production**: Sunday 02:00-04:00 UTC (weekly)
- **Staging**: As needed with 24-hour notice
- **Development**: As needed with 2-hour notice

#### Emergency Maintenance
- **Critical Security Issues**: Immediate with minimal notice
- **Data Integrity Issues**: Immediate with stakeholder notification
- **Infrastructure Failures**: Immediate

### Maintenance Checklist

#### Pre-Maintenance Checklist
- [ ] Maintenance window approved by stakeholders
- [ ] Backup procedures verified
- [ ] Rollback procedures documented
- [ ] Communication plan prepared
- [ ] Monitoring dashboards ready
- [ ] Team availability confirmed
- [ ] Test environment validation complete
- [ ] Service dependencies identified

#### Communication Templates

**Maintenance Announcement**:
```
🔧 SCHEDULED MAINTENANCE 🔧
Date: [Date]
Time: [Start Time] - [End Time] UTC
Duration: [Duration]
Services: [Affected services]
Impact: [Expected impact]
Details: [Maintenance details]
Contact: [Contact information]
```

**Maintenance Start**:
```
🔧 MAINTENANCE STARTED 🔧
Maintenance: [Maintenance name]
Started: [Time]
Services: [Affected services]
Status: In progress
Next Update: [Time]
```

**Maintenance Complete**:
```
✅ MAINTENANCE COMPLETED ✅
Maintenance: [Maintenance name]
Completed: [Time]
Services: [Affected services]
Status: Successful
Impact: [Actual impact]
```

## Prerequisites

### Tool Requirements
- **kubectl**: Configured and tested
- **helm**: Version 3.0+
- **argocd**: CLI installed and authenticated
- **terraform**: Version 1.0+
- **jq**: JSON processing tool

### Access Requirements
- **Cluster Admin**: Kubernetes cluster admin access
- **Cloud Access**: AWS/Azure/GCP console access
- **Repository Access**: Git repository write access
- **Monitoring Access**: Grafana/Prometheus access

### Backup Requirements
- **Database Backups**: Recent backups verified
- **Configuration Backups**: Current configuration saved
- **State Backups**: Cluster state backed up
- **Recovery Testing**: Recovery procedures tested

## Maintenance Types

### Database Maintenance

#### PostgreSQL Maintenance

**Routine Maintenance**:
```bash
# Check database status
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Check database size
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('quantumbeam'));"

# Check vacuum status
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT * FROM pg_stat_progress_vacuum;"

# Perform maintenance
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "VACUUM ANALYZE;"
```

**Major Version Upgrade**:
```bash
# Pre-upgrade checks
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT version();"

# Create backup
kubectl exec -it postgres-0 -n production -- pg_dump -U postgres quantumbeam > backup.sql

# Update PostgreSQL image
kubectl patch statefulset postgres -n production -p '{"spec":{"template":{"spec":{"containers":[{"name":"postgres","image":"postgres:14.5"}]}}}}'

# Monitor upgrade
kubectl logs -f postgres-0 -n production

# Post-upgrade validation
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT version();"
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT COUNT(*) FROM users;"
```

#### Redis Maintenance

**Memory Optimization**:
```bash
# Check Redis memory usage
kubectl exec -it redis-master-0 -n production -- redis-cli info memory

# Check Redis keys
kubectl exec -it redis-master-0 -n production -- redis-cli info keyspace

# Perform memory cleanup
kubectl exec -it redis-master-0 -n production -- redis-cli MEMORY PURGE

# Restart Redis if needed
kubectl delete pod redis-master-0 -n production
```

**Redis Cluster Scaling**:
```bash
# Add new Redis node
kubectl scale statefulset redis-slave -n production --replicas=4

# Update Redis configuration
kubectl patch configmap redis-config -n production --patch '{"data":{"redis.conf":"cluster-enabled yes\ncluster-node-timeout 5000"}}'

# Rebalance cluster
kubectl exec -it redis-master-0 -n production -- redis-cli --cluster rebalance <cluster-ip>:6379
```

### Application Maintenance

#### API Service Updates

**Zero-Downtime Deployment**:
```bash
# Update using rolling update
kubectl set image deployment/quantumbeam-api api=quantumbeam/api:v2.1.0 -n production

# Monitor deployment progress
kubectl rollout status deployment/quantumbeam-api -n production --timeout=600s

# Check new pods
kubectl get pods -n production -l app=quantumbeam-api

# Validate service health
kubectl exec -it deployment/quantumbeam-api -n production -- curl localhost:8080/health
```

**Configuration Updates**:
```bash
# Update ConfigMap
kubectl patch configmap api-config -n production --patch '{"data":{"config.yaml":"debug: false\nlog_level: info"}}'

# Restart deployment to pick up new config
kubectl rollout restart deployment/quantumbeam-api -n production

# Validate configuration
kubectl exec -it deployment/quantumbeam-api -n production -- cat /app/config/config.yaml
```

#### Fraud Detection Service Updates

**Model Updates**:
```bash
# Copy new model files
kubectl cp new_model.pkl fraud-detection-xxxxx:/models/

# Restart service to load new model
kubectl rollout restart deployment/fraud-detection -n production

# Validate model loading
kubectl logs -f deployment/fraud-detection -n production | grep -i model

# Test model inference
curl -X POST http://fraud-detection.production.svc.cluster.local:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"transaction": {"amount": 100.0, "merchant": "test"}}'
```

### Infrastructure Maintenance

#### Kubernetes Cluster Maintenance

**Node Maintenance**:
```bash
# Identify node to maintain
kubectl get nodes -o wide

# Drain node (zero-downtime)
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data --force

# Perform maintenance on node
# [Maintenance tasks]

# Uncordon node
kubectl uncordon <node-name>

# Verify workload redistribution
kubectl get pods -o wide --all-namespaces
```

**Cluster Upgrades**:
```bash
# Check current version
kubectl version

# Upgrade control plane (managed by cloud provider)
# Follow cloud provider-specific procedures

# Upgrade worker nodes
# Follow rolling upgrade procedure for node pools

# Validate cluster health
kubectl get componentstatuses
kubectl get nodes
kubectl get pods --all-namespaces
```

#### Network Infrastructure Updates

**Load Balancer Updates**:
```bash
# Update load balancer configuration
kubectl patch service quantumbeam-api -n production -p '{"spec":{"type":"LoadBalancer","loadBalancerSourceRanges":["0.0.0.0/0"]}}'

# Update TLS certificates
kubectl create secret tls quantumbeam-tls --cert=path/to/tls.crt --key=path/to/tls.key -n production --dry-run=client -o yaml | kubectl apply -f -

# Validate load balancer
kubectl get service quantumbeam-api -n production -o wide
kubectl describe service quantumbeam-api -n production
```

**DNS Updates**:
```bash
# Update DNS records (via cloud provider CLI or console)
# [Update DNS records]

# Validate DNS resolution
nslookup api.quantumbeam.io
dig api.quantumbeam.io

# Check service endpoints
kubectl get endpoints quantumbeam-api -n production
```

## Procedures by Service

### API Service Maintenance

#### Blue-Green Deployment
```bash
# Deploy to green environment
kubectl apply -f manifests/green/ -n blue-green

# Wait for green deployment to be ready
kubectl wait --for=condition=available deployment/quantumbeam-api-green -n blue-green --timeout=600s

# Run smoke tests on green environment
kubectl run smoke-test --image=quantumbeam/smoke-tests --rm -i --restart=Never -- \
  python smoke_tests.py --target http://quantbeam-api-green.blue-green.svc.cluster.local

# Switch traffic to green
kubectl patch service quantumbeam-api -n production -p '{"spec":{"selector":{"app":"quantumbeam-api","environment":"green"}}}'

# Monitor traffic switch
kubectl logs -f deployment/traffic-router -n blue-green

# Update blue environment
kubectl apply -f manifests/blue/ -n blue-green
```

#### Database Migration
```bash
# Create migration job
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration-$(date +%s)
  namespace: production
spec:
  template:
    spec:
      containers:
      - name: migration
        image: quantumbeam/api:migration
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: url
        command:
        - python
        - manage.py
        - migrate
      restartPolicy: OnFailure
EOF

# Monitor migration
kubectl logs -f job/db-migration-xxxxx -n production

# Validate migration
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

### Fraud Detection Service Maintenance

#### Model Rollout
```bash
# Create model deployment canary
cat <<EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: fraud-detection-canary
  namespace: production
spec:
  replicas: 3
  strategy:
    canary:
      steps:
      - setWeight: 20
      - pause: {duration: 10m}
      - setWeight: 40
      - pause: {duration: 10m}
      - setWeight: 60
      - pause: {duration: 10m}
      - setWeight: 80
      - pause: {duration: 10m}
      - setWeight: 100
  selector:
    matchLabels:
      app: fraud-detection
  template:
    metadata:
      labels:
        app: fraud-detection
    spec:
      containers:
      - name: fraud-detection
        image: quantumbeam/fraud-detection:v2.0.0
        ports:
        - containerPort: 8000
EOF

# Monitor canary rollout
kubectl argo rollouts status rollout/fraud-detection-canary -n production --watch

# Analyze metrics during canary
curl "http://prometheus.observability.svc.cluster.local:9090/api/v1/query?query=rate(fraud_detection_requests_total[5m])"
```

#### Cache Maintenance
```bash
# Flush cache gracefully
kubectl exec -it redis-master-0 -n production -- redis-cli FLUSHDB

# Warm up cache with hot data
kubectl run cache-warmer --image=quantumbeam/cache-warmer --rm -i --restart=Never -- \
  python warm_cache.py

# Validate cache performance
kubectl exec -it redis-master-0 -n production -- redis-cli INFO stats
```

### Monitoring Infrastructure Maintenance

#### Prometheus Updates
```bash
# Update Prometheus configuration
kubectl patch configmap prometheus-config -n observability --patch '{"data":{"prometheus.yml":"[new config]"}}'

# Reload Prometheus configuration
curl -X POST http://prometheus.observability.svc.cluster.local:9090/-/reload

# Validate Prometheus
curl http://prometheus.observability.svc.cluster.local:9090/api/v1/status/config
```

#### Grafana Updates
```bash
# Update Grafana dashboards
kubectl create configmap grafana-dashboards --from-file=dashboards/ -n observability --dry-run=client -o yaml | kubectl apply -f -

# Restart Grafana
kubectl rollout restart deployment/grafana -n observability

# Validate dashboards
curl -u admin:$(kubectl get secret grafana-admin -n observability -o jsonpath='{.data.password}' | base64 -d) \
  http://grafana.observability.svc.cluster.local:3000/api/dashboards/home
```

## Rollback Procedures

### Application Rollback

#### Kubernetes Deployment Rollback
```bash
# Check deployment history
kubectl rollout history deployment/quantumbeam-api -n production

# Rollback to previous revision
kubectl rollout undo deployment/quantumbeam-api -n production

# Rollback to specific revision
kubectl rollout undo deployment/quantumbeam-api -n production --to-revision=2

# Monitor rollback
kubectl rollout status deployment/quantumbeam-api -n production

# Validate rollback
kubectl get pods -n production -l app=quantumbeam-api
curl http://quantum-api.production.svc.cluster.local/health
```

#### Blue-Green Rollback
```bash
# Switch traffic back to blue environment
kubectl patch service quantumbeam-api -n production -p '{"spec":{"selector":{"app":"quantumbeam-api","environment":"blue"}}}'

# Validate traffic switch
kubectl logs -f deployment/traffic-router -n blue-green

# Clean up green environment if needed
kubectl delete deployment quantumbeam-api-green -n blue-green
```

### Database Rollback

#### PostgreSQL Rollback
```bash
# Stop application to prevent new writes
kubectl scale deployment quantumbeam-api -n production --replicas=0

# Restore from backup
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "DROP DATABASE quantumbeam;"
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "CREATE DATABASE quantumbeam;"
kubectl exec -it postgres-0 -n production -- psql -U postgres quantumbeam < backup.sql

# Restart application
kubectl scale deployment quantumbeam-api -n production --replicas=3

# Validate restore
curl http://quantum-api.production.svc.cluster.local/health
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT COUNT(*) FROM users;"
```

#### Redis Rollback
```bash
# Flush current data
kubectl exec -it redis-master-0 -n production -- redis-cli FLUSHALL

# Restore from backup
kubectl cp redis-backup.rdb redis-master-0:/data/dump.rdb -n production

# Restart Redis
kubectl delete pod redis-master-0 -n production

# Validate restore
kubectl exec -it redis-master-0 -n production -- redis-cli INFO keyspace
```

### Infrastructure Rollback

#### Kubernetes Changes Rollback
```bash
# Restore from Git repository
git checkout <previous-commit>
kubectl apply -f manifests/

# Or restore from etcd backup
etcdctl snapshot restore backup.db \
  --data-dir /var/lib/etcd-backup \
  --initial-cluster <cluster-info>

# Restart control plane components
# [Control plane restart procedures]
```

#### Cloud Infrastructure Rollback
```bash
# Restore Terraform state
terraform state pull > terraform.tfstate.backup
git checkout <previous-state-commit>
terraform state push terraform.tfstate

# Apply previous infrastructure
terraform apply -target=module.production

# Validate infrastructure
terraform plan -detailed-exitcode
```

## Post-Maintenance Validation

### Health Checks

#### Service Health
```bash
# Check all deployments
kubectl get deployments -n production
kubectl rollout status deployment --all -n production

# Check pod health
kubectl get pods -n production
kubectl describe pod <pod-name> -n production

# Check service endpoints
kubectl get endpoints -n production

# Test API endpoints
curl http://quantum-api.production.svc.cluster.local/health
curl http://fraud-detection.production.svc.cluster.local/health
```

#### Database Health
```bash
# PostgreSQL health
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT 1;"
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT COUNT(*) FROM users;"

# Redis health
kubectl exec -it redis-master-0 -n production -- redis-cli ping
kubectl exec -it redis-master-0 -n production -- redis-cli INFO server
```

#### Infrastructure Health
```bash
# Node health
kubectl get nodes
kubectl describe node <node-name>

# Network connectivity
kubectl exec -it deployment/quantum-api -n production -- nslookup postgres.database.svc.cluster.local

# Storage health
kubectl get pv,pvc -n production
kubectl describe pvc <pvc-name> -n production
```

### Performance Validation

#### Load Testing
```bash
# Run API load tests
k6 run --vus 100 --duration 5m api-load-test.js

# Check response times
curl "http://prometheus.observability.svc.cluster.local:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))"

# Check error rates
curl "http://prometheus.observability.svc.cluster.local:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])"
```

#### Business Logic Validation
```bash
# Test fraud detection
curl -X POST http://fraud-detection.production.svc.cluster.local:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"transaction": {"amount": 100.0, "merchant": "test"}}'

# Test authentication
curl -X POST http://quantum-api.production.svc.cluster.local/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test"}'

# Test data persistence
curl -X POST http://quantum-api.production.svc.cluster.local/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"amount": 50.0, "description": "test"}'
```

### Monitoring Validation

#### Metrics Validation
```bash
# Check Prometheus targets
curl http://prometheus.observability.svc.cluster.local:9090/api/v1/targets

# Check alert rules
curl http://prometheus.observability.svc.cluster.local:9090/api/v1/rules

# Check AlertManager alerts
curl http://alertmanager.observability.svc.cluster.local:9093/api/v1/alerts
```

#### Dashboard Validation
```bash
# Check Grafana dashboards
curl -u admin:<password> http://grafana.observability.svc.cluster.local:3000/api/health

# Verify dashboard data sources
curl -u admin:<password> http://grafana.observability.svc.cluster.local:3000/api/datasources

# Check specific dashboard
curl -u admin:<password> "http://grafana.observability.svc.cluster.local:3000/api/dashboards/uid/quantumbeam-overview"
```

### Communication Validation

#### Internal Communication
- Update incident channel with maintenance completion
- Send summary to team members
- Document any issues or concerns

#### External Communication
- Update status page if maintenance was visible
- Send customer notification if required
- Update stakeholders with results

### Documentation Updates

#### Runbook Updates
- Update procedures based on lessons learned
- Add new troubleshooting steps
- Document any new tools or commands

#### Architecture Updates
- Update architecture diagrams if changed
- Document any configuration changes
- Update service dependencies

## Emergency Procedures

### Maintenance Failure Recovery

#### Immediate Actions
```bash
# Stop maintenance activities
# Kill any running maintenance scripts

# Restore service immediately
kubectl rollout undo deployment/<service> -n production

# Scale up services if needed
kubectl scale deployment <service> -n production --replicas=<original-replicas>

# Verify service health
curl http://<service>.production.svc.cluster.local/health
```

#### Communication
- Declare incident if needed
- Notify stakeholders of failure
- Provide estimated recovery time

### Data Corruption Recovery

#### Immediate Actions
```bash
# Stop all write operations
kubectl scale deployment <service> -n production --replicas=0

# Switch to read-only mode if possible
kubectl patch deployment <service> -n production -p '{"spec":{"template":{"spec":{"containers":[{"name":"<container>","env":[{"name":"READ_ONLY","value":"true"}]}]}}}}'

# Assess data corruption
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT COUNT(*) FROM <table>;"

# Begin recovery procedures
# [Recovery procedures based on corruption type]
```

## Maintenance Scripts

### Zero-Downtime Deployment Script
```bash
#!/bin/bash
# zero-downtime-deploy.sh

SERVICE=${1:-quantumbeam-api}
NAMESPACE=${2:-production}
NEW_IMAGE=${3:-quantumbeam/api:latest}

echo "Starting zero-downtime deployment of $NEW_IMAGE to $SERVICE in $NAMESPACE"

# Check current deployment
kubectl get deployment $SERVICE -n $NAMESPACE

# Update deployment
kubectl set image deployment/$SERVICE api=$NEW_IMAGE -n $NAMESPACE

# Monitor deployment
kubectl rollout status deployment/$SERVICE -n $NAMESPACE --timeout=600s

# Validate deployment
kubectl get pods -n $NAMESPACE -l app=$SERVICE

# Health check
sleep 30
kubectl exec -it deployment/$SERVICE -n $NAMESPACE -- curl localhost:8080/health

echo "Deployment completed successfully"
```

### Maintenance Validation Script
```bash
#!/bin/bash
# maintenance-validation.sh

echo "Starting post-maintenance validation..."

# Check all deployments
echo "Checking deployments..."
kubectl get deployments -n production
kubectl rollout status deployment --all -n production

# Check services
echo "Checking services..."
kubectl get services -n production
kubectl get endpoints -n production

# Health checks
echo "Performing health checks..."
curl -f http://quantum-api.production.svc.cluster.local/health || exit 1
curl -f http://fraud-detection.production.svc.cluster.local/health || exit 1

# Database checks
echo "Checking database..."
kubectl exec -it postgres-0 -n production -- psql -U postgres -c "SELECT 1;" || exit 1

echo "Validation completed successfully"
```

### Rollback Script
```bash
#!/bin/bash
# emergency-rollback.sh

SERVICE=${1:-quantumbeam-api}
NAMESPACE=${2:-production}

echo "Emergency rollback for $SERVICE in $NAMESPACE"

# Get current revision
CURRENT_REVISION=$(kubectl rollout history deployment/$SERVICE -n $NAMESPACE --template='{{range .items}}{{.revision}} {{end}}' | tail -1)

if [ "$CURRENT_REVISION" -gt 1 ]; then
    # Rollback to previous revision
    kubectl rollout undo deployment/$SERVICE -n $NAMESPACE

    # Wait for rollback
    kubectl rollout status deployment/$SERVICE -n $NAMESPACE --timeout=300s

    echo "Rollback completed"
else
    echo "No previous revision to rollback to"
    exit 1
fi
```

This comprehensive zero-downtime maintenance guide ensures that all maintenance activities can be performed without impacting service availability. Each procedure includes detailed steps, validation checks, and rollback procedures to maintain system reliability.