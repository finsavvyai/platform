# QuantumBeam Production Operational Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Deployment Procedures](#deployment-procedures)
4. [Operational Procedures](#operational-procedures)
5. [Emergency Procedures](#emergency-procedures)
6. [Configuration Management](#configuration-management)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Backup and Recovery](#backup-and-recovery)
9. [Security Procedures](#security-procedures)
10. [Performance Tuning](#performance-tuning)
11. [Troubleshooting Guide](#troubleshooting-guide)

## System Overview

### Environment Information
- **Environment**: Production
- **Region**: us-west-2 (Primary)
- **DR Region**: us-east-1 (Secondary)
- **Kubernetes Version**: 1.29
- **Infrastructure**: AWS EKS with RDS Aurora PostgreSQL and ElastiCache Redis

### Critical Services
- **API Gateway**: External API entry point with WAF protection
- **API Service**: Core business logic and transaction processing
- **Fraud Detection Service**: Real-time fraud analysis and detection
- **AI/ML Engine**: Machine learning models for fraud pattern recognition
- **Redis Cache**: High-performance caching layer
- **PostgreSQL Database**: Primary data storage with Aurora clustering

### Service Dependencies
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│   API Service   │───▶│  PostgreSQL DB  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   Redis Cache   │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     WAF         │    │Fraud Detection   │    │    Monitoring   │
└─────────────────┘    │   Service        │    │    Stack        │
                        └─────────────────┘    └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   AI/ML Engine  │
                        └─────────────────┘
```

## Architecture

### Infrastructure Components

#### Kubernetes Cluster (EKS)
- **Cluster Name**: quantumbeam-production
- **Node Groups**:
  - System Nodes: m6i.xlarge (2-6 instances)
  - Application Nodes: m6i.2xlarge (3-10 instances)
  - AI/ML Nodes: p4d.24xlarge (1-6 instances)
  - Spot Nodes: Various instance types (0-8 instances)

#### Database Layer
- **Primary**: Aurora PostgreSQL 15.4 (Multi-AZ)
  - Writer Instance: db.r6g.2xlarge
  - Reader Instances: 2x db.r6g.2xlarge
  - Storage: 500GB auto-scaling to 2TB
  - Backup Retention: 35 days
- **Cache Layer**: ElastiCache Redis 7.0 Cluster
  - Primary Cluster: 3x cache.r6g.2xlarge nodes
  - Session Storage: 2x cache.r6g.large nodes
  - Read Cache: 3x cache.r6g.2xlarge nodes

#### Network Configuration
- **VPC CIDR**: 10.0.0.0/16
- **Private Subnets**: 10.0.10.0/24, 10.0.11.0/24, 10.0.12.0/24
- **Public Subnets**: 10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24
- **Database Subnets**: 10.0.20.0/24, 10.0.21.0/24, 10.0.22.0/24

### Security Architecture
- **WAF**: AWS WAF with rate limiting and common attack protection
- **Security Groups**: Least privilege access with network segmentation
- **KMS Encryption**: All data encrypted at rest with customer-managed keys
- **Secrets Manager**: Centralized secret storage with automatic rotation
- **Network Policies**: Kubernetes network policies for pod-to-pod communication

## Deployment Procedures

### Prerequisites
1. **Access Requirements**:
   - AWS CLI configured with production credentials
   - kubectl configured with EKS cluster access
   - Terraform v1.5+ installed
   - Docker access to ECR registry

2. **Permissions Required**:
   - EKS cluster admin access
   - AWS IAM permissions for infrastructure resources
   - Access to GitHub repository with deployment manifests

### Deployment Workflow

#### 1. Infrastructure Deployment
```bash
# Navigate to infrastructure directory
cd infrastructure/terraform/production

# Initialize Terraform
terraform init

# Plan infrastructure changes
terraform plan -var-file="production.tfvars"

# Apply infrastructure changes
terraform apply -var-file="production.tfvars" -auto-approve
```

#### 2. Application Deployment
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name quantumbeam-production

# Deploy applications using Helm
helm upgrade --install quantumbeam ./helm/quantumbeam \
  --namespace production \
  --values ./helm/quantumbeam/values-production.yaml \
  --timeout 15m

# Verify deployment
kubectl get pods -n production
kubectl get services -n production
```

#### 3. Post-Deployment Validation
```bash
# Run health checks
kubectl get pods -n production -o wide
kubectl describe deployment -n production

# Check application health
kubectl port-forward svc/api-service 8080:80 -n production
curl http://localhost:8080/health

# Verify database connectivity
kubectl exec -it deployment/api-service -n production -- psql $DATABASE_URL -c "SELECT 1;"
```

### Blue-Green Deployment Process

#### Prerequisites
- Two target environments (blue/green) configured
- Load balancer capable of traffic switching
- Database migration scripts tested

#### Deployment Steps
1. **Deploy to Green Environment**:
   ```bash
   # Deploy new version to green
   helm upgrade --install quantumbeam-green ./helm/quantumbeam \
     --namespace production-green \
     --values ./helm/quantumbeam/values-green.yaml
   ```

2. **Health Validation**:
   ```bash
   # Run smoke tests
   ./scripts/smoke-tests.sh production-green

   # Validate metrics
   kubectl top pods -n production-green
   ```

3. **Traffic Switching**:
   ```bash
   # Update load balancer target
   kubectl patch service quantumbeam-lb -n production \
     -p '{"spec":{"selector":{"version":"green"}}}'
   ```

4. **Blue Environment Cleanup**:
   ```bash
   # Monitor for issues, then cleanup
   helm uninstall quantumbeam-blue -n production-blue
   ```

## Operational Procedures

### Daily Operations

#### Health Checks
1. **System Health Verification**:
   ```bash
   # Check cluster status
   kubectl get nodes
   kubectl get pods -n production

   # Check resource utilization
   kubectl top nodes
   kubectl top pods -n production
   ```

2. **Database Health**:
   ```bash
   # Check Aurora cluster status
   aws rds describe-db-clusters --db-cluster-identifier quantumbeam-production-cluster

   # Check Redis cluster status
   aws elasticache describe-replication-groups --replication-group-id quantumbeam-production-redis
   ```

3. **Application Health**:
   ```bash
   # Check application endpoints
   curl -f https://api.quantumbeam.io/health
   curl -f https://api.quantumbeam.io/metrics/health
   ```

#### Log Monitoring
1. **Application Logs**:
   ```bash
   # Stream application logs
   kubectl logs -f deployment/api-service -n production

   # Check for errors
   kubectl logs deployment/api-service -n production | grep ERROR
   ```

2. **System Logs**:
   ```bash
   # Check CloudWatch logs
   aws logs tail /aws/eks/quantumbeam-production/cluster --follow
   ```

#### Performance Monitoring
1. **Resource Utilization**:
   ```bash
   # Check CPU/Memory usage
   kubectl top nodes
   kubectl top pods -n production --sort-by=cpu
   kubectl top pods -n production --sort-by=memory
   ```

2. **Database Performance**:
   ```bash
   # Check RDS metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/RDS \
     --metric-name DatabaseConnections \
     --dimensions Name=DBInstanceIdentifier,Value=quantumbeam-production-writer \
     --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 60 \
     --statistics Average
   ```

### Weekly Operations

#### Maintenance Tasks
1. **Security Updates**:
   ```bash
   # Check for security updates
   eksctl utils describe-addon-versions --cluster quantumbeam-production --kubernetes-version 1.29

   # Update add-ons if needed
   eksctl utils update-addon --cluster quantumbeam-production --name vpc-cni
   ```

2. **Backup Verification**:
   ```bash
   # Verify recent backups
   aws rds describe-db-cluster-snapshots --db-cluster-identifier quantumbeam-production-cluster --query 'DBClusterSnapshots[?SnapshotCreateTime>=`$(date -u -v-1d +%Y-%m-%d)`]'

   # Test backup restoration (non-production)
   ./scripts/test-backup-restore.sh
   ```

3. **Performance Review**:
   ```bash
   # Generate performance report
   ./scripts/performance-report.sh weekly
   ```

### Monthly Operations

#### Capacity Planning
1. **Resource Utilization Analysis**:
   ```bash
   # Generate capacity report
   ./scripts/capacity-report.sh monthly

   # Review scaling triggers
   kubectl get hpa -n production
   kubectl get vpa -n production
   ```

2. **Cost Optimization**:
   ```bash
   # Analyze costs
   aws ce get-cost-and-usage \
     --time-period Start=$(date -u -v-1m +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
     --granularity MONTHLY \
     --metrics BlendedCost \
     --group-by Type=DIMENSION,Key=SERVICE
   ```

## Emergency Procedures

### Incident Response Plan

#### Severity Levels
- **Critical**: Service outage, data loss, security breach
- **High**: Significant performance degradation, partial service outage
- **Medium**: Minor issues, degraded performance
- **Low**: Non-critical issues, cosmetic problems

#### Incident Response Process

1. **Detection**:
   - Automated alerts from monitoring systems
   - User reports via support channels
   - Regular health check failures

2. **Assessment**:
   ```bash
   # Quick system health check
   kubectl get pods -n production --field-selector=status.phase!=Running
   kubectl get events -n production --sort-by=.metadata.creationTimestamp
   ```

3. **Containment**:
   - Isolate affected components
   - Scale up healthy services
   - Divert traffic if necessary

4. **Resolution**:
   - Apply fixes or rollbacks
   - Monitor recovery
   - Validate service restoration

5. **Post-Incident**:
   - Document root cause
   - Update monitoring/alerts
   - Implement preventive measures

### Service Outage Procedures

#### Complete Service Outage
1. **Immediate Actions**:
   ```bash
   # Check cluster status
   kubectl get nodes
   kubectl get pods -n production

   # Check load balancer
   kubectl get svc -n production
   kubectl describe svc quantumbeam-lb -n production
   ```

2. **Recovery Steps**:
   - Verify AWS service health (EKS, RDS, ElastiCache)
   - Check network connectivity
   - Restart critical services
   - Validate data integrity

#### Database Outage
1. **Failover Process**:
   ```bash
   # Check Aurora cluster status
   aws rds describe-db-clusters --db-cluster-identifier quantumbeam-production-cluster

   # Manual failover if needed
   aws rds failover-db-cluster --db-cluster-identifier quantumbeam-production-cluster
   ```

2. **Connection Recovery**:
   - Update connection strings if needed
   - Restart application services
   - Verify data consistency

### Security Incident Response

#### Security Breach Procedures
1. **Immediate Containment**:
   - Isolate affected systems
   - Change credentials and access keys
   - Enable additional logging

2. **Investigation**:
   - Analyze CloudTrail logs
   - Review security group rules
   - Check for unauthorized access

3. **Recovery**:
   - Patch vulnerabilities
   - Restore from clean backups
   - Update security policies

## Configuration Management

### Environment Configuration

#### Kubernetes ConfigMaps
```yaml
# Application configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: quantumbeam-config
  namespace: production
data:
  LOG_LEVEL: "INFO"
  METRICS_ENABLED: "true"
  CACHE_TTL: "3600"
  MAX_CONNECTIONS: "100"
```

#### Secrets Management
```bash
# Create application secrets
kubectl create secret generic quantumbeam-secrets \
  --from-literal=database-url="$DATABASE_URL" \
  --from-literal=redis-url="$REDIS_URL" \
  --from-literal=jwt-secret="$JWT_SECRET" \
  -n production
```

### Configuration Updates

#### Rolling Updates
```bash
# Update application configuration
helm upgrade quantumbeam ./helm/quantumbeam \
  --namespace production \
  --values ./helm/quantumbeam/values-production.yaml \
  --set config.newProperty="newValue"

# Monitor rollout
kubectl rollout status deployment/api-service -n production
kubectl rollout history deployment/api-service -n production
```

#### Rollback Procedures
```bash
# Rollback to previous version
helm rollback quantumbeam <revision> -n production

# Kubernetes rollback
kubectl rollout undo deployment/api-service -n production
```

## Monitoring and Alerting

### Monitoring Stack

#### Prometheus Configuration
```yaml
# Key metrics to monitor
- api_http_requests_total
- api_response_duration_seconds
- database_connections_active
- redis_memory_usage_bytes
- fraud_detection_accuracy
```

#### Grafana Dashboards
1. **System Overview**: CPU, memory, network, storage
2. **Application Metrics**: Request rate, response time, error rate
3. **Database Performance**: Connections, queries, latency
4. **Business Metrics**: Transaction volume, fraud detection rate

### Alerting Configuration

#### Critical Alerts
- Service downtime (> 5 minutes)
- Database connection failures
- High error rates (> 5%)
- Security events (unauthorized access)

#### Warning Alerts
- High CPU usage (> 80%)
- Memory pressure (> 90%)
- Slow database queries (> 1 second)
- Disk space usage (> 85%)

### Alert Response Procedures

#### Alert Triage
1. **Acknowledge Alert**: Update ticket with initial assessment
2. **Investigation**: Check logs, metrics, and system status
3. **Resolution**: Apply fixes or escalate if needed
4. **Documentation**: Update knowledge base with resolution steps

## Backup and Recovery

### Backup Strategy

#### Database Backups
- **Automated Backups**: Daily snapshots with 35-day retention
- **Point-in-Time Recovery**: 1-minute recovery window
- **Cross-Region Replication**: Daily replication to us-east-1

#### Application Backups
- **ConfigMaps and Secrets**: Weekly backup to S3
- **Persistent Volumes**: Daily snapshots
- **Model Artifacts**: Version-controlled with model registry

### Recovery Procedures

#### Database Recovery
```bash
# Restore from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier quantumbeam-production-restored \
  --snapshot-identifier quantumbeam-production-snapshot-2024-01-15 \
  --engine aurora-postgresql \
  --db-subnet-group-name quantumbeam-production-db-subnet-group \
  --vpc-security-group-ids sg-xxxxxxxxx

# Update application configuration
kubectl patch secret quantumbeam-secrets -n production \
  -p '{"data":{"database-url":"<new-connection-string>"}}'
```

#### Application Recovery
```bash
# Restore from backup
kubectl apply -f backups/application-backup-2024-01-15.yaml

# Validate recovery
kubectl rollout status deployment/api-service -n production
```

## Security Procedures

### Access Management

#### IAM Policies
- **Principle of Least Privilege**: Minimum required permissions
- **Role-Based Access**: Separation of duties by role
- **Regular Audits**: Quarterly access reviews

#### Network Security
- **Security Groups**: Restrictive rules, regularly reviewed
- **Network Policies**: Kubernetes pod-to-pod communication control
- **WAF Rules**: Web application firewall protection

### Security Monitoring

#### Compliance Monitoring
- **AWS Config**: Continuous compliance checking
- **CloudTrail**: Audit logging for all API calls
- **GuardDuty**: Threat detection and response

#### Vulnerability Management
- **Container Scanning**: Image vulnerability scanning in CI/CD
- **Dependency Scanning**: Automated dependency vulnerability checks
- **Penetration Testing**: Quarterly security assessments

## Performance Tuning

### Database Optimization

#### Query Optimization
```sql
-- Identify slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM transactions WHERE created_at > NOW() - INTERVAL '1 day';
```

#### Connection Pooling
- **Max Connections**: 500 per instance
- **Pool Size**: 50 connections per application
- **Timeout**: 30 seconds

### Application Performance

#### Caching Strategy
- **Redis TTL**: 1 hour for session data
- **Cache Warming**: Preload frequently accessed data
- **Cache Invalidation**: Event-driven invalidation

#### Auto-scaling Configuration
```yaml
# HPA Configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Troubleshooting Guide

### Common Issues

#### Service Unavailable
1. **Check Pod Status**:
   ```bash
   kubectl get pods -n production
   kubectl describe pod <pod-name> -n production
   ```

2. **Check Service Configuration**:
   ```bash
   kubectl get svc -n production
   kubectl describe svc <service-name> -n production
   ```

3. **Check Resource Limits**:
   ```bash
   kubectl describe pod <pod-name> -n production | grep -A 5 Limits
   ```

#### Database Connection Issues
1. **Check Database Status**:
   ```bash
   aws rds describe-db-clusters --db-cluster-identifier quantumbeam-production-cluster
   ```

2. **Test Connectivity**:
   ```bash
   kubectl exec -it <pod-name> -n production -- nc -zv <db-endpoint> 5432
   ```

3. **Check Security Groups**:
   ```bash
   aws ec2 describe-security-groups --group-ids <sg-id>
   ```

#### Performance Issues
1. **Resource Utilization**:
   ```bash
   kubectl top nodes
   kubectl top pods -n production
   ```

2. **Database Performance**:
   ```bash
   # Check active connections
   aws rds describe-db-clusters --db-cluster-identifier quantumbeam-production-cluster --query 'DBClusters[0].DBClusterMembers[*].DBInstanceStatus'

   # Check slow queries
   kubectl exec -it <postgres-pod> -n production -- psql -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"
   ```

### Debugging Tools

#### Pod Debugging
```bash
# Get pod logs
kubectl logs <pod-name> -n production -f

# Execute commands in pod
kubectl exec -it <pod-name> -n production -- /bin/bash

# Port forward for local debugging
kubectl port-forward <pod-name> 8080:80 -n production
```

#### Network Debugging
```bash
# Test service connectivity
kubectl run test-pod --image=busybox --rm -it --restart=Never -- wget -qO- http://<service-name>.<namespace>.svc.cluster.local

# Check DNS resolution
kubectl run test-pod --image=busybox --rm -it --restart=Never -- nslookup kubernetes.default
```

---

## Contact Information

### Emergency Contacts
- **On-call Engineer**: +1-XXX-XXX-XXXX
- **Engineering Manager**: +1-XXX-XXX-XXXX
- **DevOps Team**: devops@quantumbeam.io

### Service Providers
- **AWS Support**: Available 24/7 via AWS Console
- **Managed Services**: contact@quantumbeam.io

### Documentation
- **Latest Version**: https://docs.quantumbeam.io/production
- **Change Log**: https://docs.quantumbeam.io/changelog
- **Knowledge Base**: https://kb.quantumbeam.io

---

**Document Version**: 1.0
**Last Updated**: 2024-01-15
**Next Review**: 2024-02-15
**Approved By**: Production Operations Team