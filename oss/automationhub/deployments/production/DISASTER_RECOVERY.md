# UPM.Plus AutomationHub - Disaster Recovery Procedures

**Version**: 1.0
**Last Updated**: November 7, 2024
**Classification**: Critical Infrastructure Document

---

## 🚨 Executive Summary

This document outlines comprehensive disaster recovery (DR) procedures for the UPM.Plus AutomationHub production environment. The DR strategy ensures business continuity, data integrity, and rapid recovery from various failure scenarios with a Recovery Time Objective (RTO) of 4 hours and Recovery Point Objective (RPO) of 15 minutes.

---

## 📊 Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** | 4 hours | Maximum acceptable time to restore services |
| **RPO** | 15 minutes | Maximum acceptable data loss |
| **Availability** | 99.9% | Annual uptime target |
| **Backup Frequency** | Continuous | Real-time replication + daily snapshots |
| **DR Testing** | Monthly | Full DR drill verification |

---

## 🏗️ Infrastructure Architecture

### Production Environment Components
```
Primary Region (us-east-1)
├── Kubernetes Cluster (EKS/GKE)
├── PostgreSQL Primary + Read Replicas
├── Redis HA Cluster
├── Application Services (3+ replicas)
├── Monitoring Stack (Prometheus, Grafana)
├── Load Balancer (NLB/ALB)
└── CDN (CloudFront/Akamai)

Disaster Recovery Region (us-west-2)
├── Standby Kubernetes Cluster
├── PostgreSQL Standby (replication)
├── Redis Standby
├── Application Services (scaled down)
└── Essential Monitoring
```

---

## 🔄 Backup Strategy

### 1. Database Backups

#### PostgreSQL
```bash
# Continuous WAL archiving
archive_mode = on
archive_command = 'aws s3 cp %p s3://upm-plus-backups/wal/%f.gz'

# Daily full backups
0 2 * * * pg_dump -h postgres-primary -U postgres -d upm_plus_prod | gzip > /backups/daily/upm_plus_$(date +%Y%m%d).sql.gz

# Hourly incremental backups
0 * * * * pg_basebackup -h postgres-primary -D /backups/incremental/$(date +%Y%m%d_%H) -Ft -z -P
```

#### Redis
```bash
# RDB snapshots every 15 minutes
save 900 1
save 300 10
save 60 10000

# AOF rewrite on disk
appendonly yes
appendfsync everysec
```

### 2. Application Data Backup

#### Vector Database (ChromaDB)
```bash
# Daily collection backup
0 3 * * * python scripts/backup_chroma.py --output s3://upm-plus-backups/chroma/$(date +%Y%m%d)/

# Continuous snapshots
chroma-server --snapshot-interval 300 --snapshot-path /snapshots/
```

#### File Storage
```bash
# User uploaded files and documents
aws s3 sync s3://upm-plus-user-files s3://upm-plus-backups/user-files/$(date +%Y%m%d)/ --delete

# Configuration files
kubectl get configmaps -n upm-plus-prod -o yaml > /backups/configmaps/$(date +%Y%m%d_%H%M%S).yaml
kubectl get secrets -n upm-plus-prod -o yaml > /backups/secrets/$(date +%Y%m%d_%H%M%S).yaml
```

### 3. Infrastructure Backup

#### Kubernetes Resources
```bash
#!/bin/bash
# backup_k8s_resources.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/k8s/${DATE}"
mkdir -p "$BACKUP_DIR"

# Backup all resources
kubectl get all -n upm-plus-prod -o yaml > "$BACKUP_DIR/all_resources.yaml"
kubectl get pvc -n upm-plus-prod -o yaml > "$BACKUP_DIR/pvcs.yaml"
kubectl get ingress -n upm-plus-prod -o yaml > "$BACKUP_DIR/ingress.yaml"

# Backup etcd (if self-managed)
ETCDCTL_API=3 etcdctl snapshot save /backups/etcd/etcd-snapshot-${DATE}.db

# Upload to secure storage
aws s3 cp "$BACKUP_DIR" s3://upm-plus-backups/k8s/${DATE}/ --recursive
```

---

## 🚨 Disaster Scenarios & Response Procedures

### Scenario 1: Single Service Failure

#### Detection
- **Monitoring Alerts**: Prometheus alerts on service unavailability
- **Health Checks**: Failed readiness/liveness probes
- **User Impact**: Partial functionality degradation

#### Recovery Steps
1. **Immediate Response** (0-15 minutes)
   ```bash
   # Identify failed pod
   kubectl get pods -n upm-plus-prod

   # Check pod logs
   kubectl logs -f <pod-name> -n upm-plus-prod

   # Restart failed pod
   kubectl delete pod <pod-name> -n upm-plus-prod
   ```

2. **If Pod Won't Start** (15-30 minutes)
   ```bash
   # Check events
   kubectl describe pod <pod-name> -n upm-plus-prod

   # Check resource usage
   kubectl top nodes
   kubectl top pods -n upm-plus-prod

   # Scale deployment
   kubectl scale deployment <deployment-name> --replicas=5 -n upm-plus-prod
   ```

3. **Escalation** (30+ minutes)
   - Review application logs in ELK stack
   - Check for configuration changes
   - Consider rollback to previous version

### Scenario 2: Database Primary Failure

#### Detection
- **Database Alerts**: Connection failures, replication lag
- **Application Errors**: Database connection timeouts
- **Monitoring**: PostgreSQL metrics anomalies

#### Recovery Steps
1. **Automatic Failover** (0-5 minutes)
   ```bash
   # PostgreSQL HA should automatically promote replica
   # Verify new primary
   kubectl exec -it postgres-replica-0 -n upm-plus-prod -- psql -U postgres -c "SELECT pg_is_in_recovery();"
   ```

2. **Manual Failover** (if needed)
   ```bash
   # Promote replica to primary
   kubectl exec -it postgres-replica-0 -n upm-plus-prod -- pg_ctl promote -D /var/lib/postgresql/data

   # Update application configuration
   kubectl patch configmap upm-plus-config -n upm-plus-prod --patch '{"data":{"DATABASE_HOST":"postgres-replica-0"}}'

   # Restart application
   kubectl rollout restart deployment/upm-plus-api -n upm-plus-prod
   ```

3. **Restore Replication** (5-30 minutes)
   ```bash
   # Setup new replica from remaining nodes
   kubectl apply -f deployments/production/postgres.yaml
   ```

### Scenario 3: Complete Region Outage

#### Detection
- **Cloud Provider Alerts**: Region-wide service disruptions
- **External Monitoring**: External health check failures
- **Customer Reports**: Widespread service unavailability

#### Recovery Steps
1. **Activate DR Region** (0-30 minutes)
   ```bash
   # Switch DNS to DR region
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z1EXAMPLE12345 \
     --change-batch file://dr-dns-switch.json

   # Scale up DR services
   kubectl scale deployment upm-plus-api --replicas=5 -n upm-plus-dr
   kubectl scale deployment upm-plus-frontend --replicas=3 -n upm-plus-dr
   ```

2. **Database Recovery** (30-120 minutes)
   ```bash
   # Promote DR database to primary
   kubectl exec -it postgres-dr-0 -n upm-plus-dr -- pg_ctl promote -D /var/lib/postgresql/data

   # Point applications to DR database
   kubectl patch configmap upm-plus-config -n upm-plus-dr \
     --patch '{"data":{"DATABASE_HOST":"postgres-dr-0","DATABASE_REGION":"us-west-2"}}'
   ```

3. **Verify Services** (120-240 minutes)
   ```bash
   # Health checks
   curl https://dr-api.upm.plus/health
   curl https://dr.upm.plus/health

   # Smoke tests
   python scripts/smoke_tests.py --environment=dr
   ```

### Scenario 4: Data Corruption

#### Detection
- **Application Alerts**: Data integrity errors
- **Database Checks**: Constraint violations, corrupted pages
- **User Reports**: Missing or incorrect data

#### Recovery Steps
1. **Immediate Isolation** (0-15 minutes)
   ```bash
   # Stop all writes
   kubectl scale deployment upm-plus-api --replicas=0 -n upm-plus-prod

   # Enable maintenance mode
   kubectl patch configmap upm-plus-config -n upm-plus-prod \
     --patch '{"data":{"MAINTENANCE_MODE":"true"}}'
   ```

2. **Point-in-Time Recovery** (15-180 minutes)
   ```bash
   # Identify corruption time
   # Restore from backup before corruption
   pg_restore -h postgres-temp -U postgres -d upm_plus_prod_restore \
     /backups/daily/upm_plus_20241107.sql.gz

   # Apply transaction logs up to corruption point
   pg_basebackup -h postgres-temp -D /var/lib/postgresql/data -R -W
   ```

3. **Data Validation** (180-240 minutes)
   ```bash
   # Run integrity checks
   python scripts/data_integrity_check.py

   # Compare with backup
   python scripts/compare_with_backup.py --backup-date 20241107
   ```

---

## 🔧 Automation Scripts

### 1. Automated DR Activation

```bash
#!/bin/bash
# activate_dr.sh

set -euo pipefail

DR_REGION="us-west-2"
PRIMARY_REGION="us-east-1"
NAMESPACE="upm-plus-prod"
DR_NAMESPACE="upm-plus-dr"

echo "🚨 Activating Disaster Recovery procedures..."

# 1. Switch DNS to DR region
echo "Switching DNS to DR region..."
aws route53 change-resource-record-sets \
  --hosted-zone-id ${HOSTED_ZONE_ID} \
  --change-batch file://dns-dr-switch.json

# 2. Scale up DR services
echo "Scaling up DR services..."
kubectl scale deployment upm-plus-api --replicas=5 -n ${DR_NAMESPACE}
kubectl scale deployment upm-plus-frontend --replicas=3 -n ${DR_NAMESPACE}
kubectl scale deployment postgres-primary --replicas=1 -n ${DR_NAMESPACE}

# 3. Promote DR database
echo "Promoting DR database..."
kubectl exec -it postgres-primary-0 -n ${DR_NAMESPACE} -- pg_ctl promote -D /var/lib/postgresql/data

# 4. Update configuration
echo "Updating application configuration..."
kubectl patch configmap upm-plus-config -n ${DR_NAMESPACE} \
  --patch '{"data":{"DATABASE_HOST":"postgres-primary","ENVIRONMENT":"production_dr"}}'

# 5. Restart services
echo "Restarting services with new configuration..."
kubectl rollout restart deployment/upm-plus-api -n ${DR_NAMESPACE}

# 6. Verify services
echo "Verifying DR services..."
for i in {1..10}; do
  if curl -f https://dr-api.upm.plus/health; then
    echo "✅ DR services are healthy"
    break
  else
    echo "⏳ Waiting for services to be ready... ($i/10)"
    sleep 30
  fi
done

# 7. Send notification
echo "Sending DR activation notification..."
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🚨 UPM.Plus DR ACTIVATED in '"${DR_REGION}"'"}' \
  ${SLACK_WEBHOOK_URL}

echo "✅ Disaster Recovery activation completed"
```

### 2. Health Check Script

```bash
#!/bin/bash
# health_check.sh

NAMESPACE="upm-plus-prod"
SERVICES=("upm-plus-api" "upm-plus-frontend" "postgres-primary" "postgres-replica" "redis-master")

echo "🔍 Performing comprehensive health check..."

for service in "${SERVICES[@]}"; do
  echo "Checking $service..."

  # Check deployment status
  if kubectl get deployment $service -n $NAMESPACE &>/dev/null; then
    replicas=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    desired=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.spec.replicas}')

    if [[ $replicas -eq $desired ]]; then
      echo "✅ $service: $replicas/$desired replicas ready"
    else
      echo "❌ $service: $replicas/$desired replicas ready"
    fi
  else
    echo "❌ $service: Deployment not found"
  fi

  # Check pod health
  unhealthy_pods=$(kubectl get pods -n $NAMESPACE -l app=$service --field-selector=status.phase!=Running --no-headers | wc -l)
  if [[ $unhealthy_pods -eq 0 ]]; then
    echo "✅ $service: All pods healthy"
  else
    echo "❌ $service: $unhealthy_pods unhealthy pods"
  fi
done

# Check external endpoints
echo "Checking external endpoints..."
if curl -f https://api.upm.plus/health &>/dev/null; then
  echo "✅ API endpoint: Healthy"
else
  echo "❌ API endpoint: Unhealthy"
fi

if curl -f https://upm.plus/health &>/dev/null; then
  echo "✅ Frontend endpoint: Healthy"
else
  echo "❌ Frontend endpoint: Unhealthy"
fi
```

### 3. Backup Verification Script

```bash
#!/bin/bash
# verify_backups.sh

BACKUP_BUCKET="s3://upm-plus-backups"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=30

echo "🔍 Verifying backup integrity..."

# Check PostgreSQL backups
echo "Checking PostgreSQL backups..."
if aws s3 ls ${BACKUP_BUCKET}/postgresql/${DATE}/ | grep -q "sql.gz"; then
  echo "✅ PostgreSQL backup exists"

  # Test restore
  aws s3 cp ${BACKUP_BUCKET}/postgresql/${DATE}/upm_plus_${DATE}.sql.gz /tmp/test_backup.sql.gz
  gunzip -t /tmp/test_backup.sql.gz && echo "✅ PostgreSQL backup integrity verified"
  rm /tmp/test_backup.sql.gz
else
  echo "❌ PostgreSQL backup missing"
fi

# Check Redis backups
echo "Checking Redis backups..."
if aws s3 ls ${BACKUP_BUCKET}/redis/${DATE}/ | grep -q "rdb"; then
  echo "✅ Redis backup exists"
else
  echo "❌ Redis backup missing"
fi

# Check ChromaDB backups
echo "Checking ChromaDB backups..."
if aws s3 ls ${BACKUP_BUCKET}/chroma/${DATE}/ | grep -q "collections"; then
  echo "✅ ChromaDB backup exists"
else
  echo "❌ ChromaDB backup missing"
fi

# Clean old backups
echo "Cleaning old backups (older than ${RETENTION_DAYS} days)..."
aws s3 ls ${BACKUP_BUCKET}/ --recursive | while read -r line; do
  create_date=$(echo $line | awk '{print $1" "$2}')
  file_path=$(echo $line | awk '{print $4}')

  if [[ $(date -d "$create_date" +%s) -lt $(date -d "${RETENTION_DAYS} days ago" +%s) ]]; then
    aws s3 rm ${BACKUP_BUCKET}/${file_path}
    echo "Deleted old backup: $file_path"
  fi
done

echo "✅ Backup verification completed"
```

---

## 📋 Communication Plan

### 1. Incident Notification Matrix

| Severity | Response Time | Notification Channels | Escalation |
|----------|---------------|----------------------|------------|
| **Critical** | 15 minutes | PagerDuty, Slack, Phone call | Senior Management |
| **High** | 30 minutes | Slack, Email | Engineering Lead |
| **Medium** | 1 hour | Email, Slack | Team Lead |
| **Low** | 4 hours | Email | Development Team |

### 2. Stakeholder Communication

#### Internal Communication
- **Engineering Team**: Slack #incidents channel
- **Management**: Email updates every 30 minutes
- **Support Team**: Knowledge base updates

#### External Communication
- **Status Page**: Updates at status.upm.plus
- **Twitter/X**: @upmplus_status
- **Customer Email**: For outages > 30 minutes

### 3. Communication Templates

#### Initial Incident Alert
```
🚨 INCIDENT DECLARED 🚨

Service: UPM.Plus AutomationHub
Severity: CRITICAL
Impact: Users experiencing service disruptions
Started: [TIME]
Investigation: IN PROGRESS

Next update in 30 minutes or when significant changes occur.
Status Page: https://status.upm.plus
```

#### Resolution Notification
```
✅ INCIDENT RESOLVED ✅

Service: UPM.Plus AutomationHub
Duration: [X hours Y minutes]
Impact: [Description of impact]
Resolution: [Description of fix]

We're monitoring for any residual issues.
Post-incident review scheduled for [DATE/TIME].
```

---

## 🧪 Testing & Validation

### 1. Monthly DR Drills

#### Schedule
- **First Tuesday of each month**: 2:00 AM - 6:00 AM UTC
- **Participants**: DevOps, Engineering, Database teams
- **Duration**: 4 hours maximum

#### Drill Scenarios
1. **Service Failover**: Test automatic service recovery
2. **Database Failover**: Test database promotion and replication
3. **Region Failover**: Test full DR region activation
4. **Data Recovery**: Test point-in-time recovery procedures

### 2. Quarterly Full DR Test

#### Scope
- Complete production environment simulation
- End-to-end functionality validation
- Performance testing in DR environment
- Security validation

#### Success Criteria
- RTO < 4 hours achieved
- RPO < 15 minutes achieved
- All critical services functional
- No data corruption or loss
- Performance within 80% of production baseline

### 3. Annual Business Continuity Test

#### Scope
- Multi-region outage simulation
- Extended recovery procedures
- Supply chain dependencies
- Third-party service integrations

---

## 📊 Monitoring & Alerting

### 1. DR-Specific Monitoring

#### Metrics to Monitor
- **Replication Lag**: PostgreSQL replica lag < 1 second
- **Backup Success**: Daily backup completion rates
- **Cross-Region Latency**: DR region response times
- **Resource Utilization**: DR region capacity (target < 50%)

#### Alert Thresholds
```yaml
groups:
- name: disaster-recovery
  rules:
  - alert: PostgreSQLReplicationLag
    expr: pg_replication_lag_seconds > 60
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "PostgreSQL replication lag is high"

  - alert: BackupFailure
    expr: backup_success_rate < 0.95
    for: 5m
    labels:
      severity: high
    annotations:
      summary: "Backup success rate below 95%"

  - alert: DRRegionUnhealthy
    expr: dr_region_health_score < 0.8
    for: 5m
    labels:
      severity: medium
    annotations:
      summary: "DR region health degraded"
```

### 2. Health Dashboards

#### Grafana Dashboard: Disaster Recovery
- **Service Status**: Real-time service health across regions
- **Database Replication**: Replication lag and status
- **Backup Status**: Recent backup jobs and success rates
- **Recovery Time**: Historical RTO metrics
- **Resource Usage**: DR region resource utilization

---

## 📚 Documentation & Training

### 1. Runbook Structure

#### Quick Reference (1-2 pages)
- Emergency contact information
- Critical commands and procedures
- Escalation paths
- Communication templates

#### Detailed Procedures (10-20 pages)
- Step-by-step recovery instructions
- Technical implementation details
- Troubleshooting guides
- Validation procedures

#### Technical Reference (50+ pages)
- Architecture diagrams
- Configuration details
- Security procedures
- Compliance requirements

### 2. Training Program

#### New Team Member Onboarding
- **Week 1**: Overview of DR procedures and tools
- **Week 2**: Hands-on lab exercises
- **Week 3**: Shadow senior engineer during drill
- **Week 4**: Lead a drill scenario

#### Ongoing Training
- **Monthly**: Lunch and learn sessions
- **Quarterly**: Advanced scenario workshops
- **Annually**: Full-day training retreat

### 3. Knowledge Management

#### Documentation Storage
- **Confluence/Wiki**: Primary documentation repository
- **GitHub**: Runbooks and automation scripts
- **Shared Drive**: Diagrams and planning documents

#### Review Process
- **Monthly**: Runbook accuracy review
- **Quarterly**: Documentation audit
- **Annually**: Complete DR plan revision

---

## 🔒 Security Considerations

### 1. Backup Security

#### Encryption
- **At Rest**: AES-256 encryption for all backups
- **In Transit**: TLS 1.3 for backup transfers
- **Key Management**: AWS KMS for encryption keys

#### Access Control
```yaml
# Backup access policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::upm-plus-backups/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
        }
      }
    }
  ]
}
```

### 2. DR Environment Security

#### Network Security
- **VPC Peering**: Secure connectivity between regions
- **Security Groups**: Restrict access to DR resources
- **WAF Rules**: Web Application Firewall in DR region

#### Identity Management
- **IAM Roles**: Separate roles for DR procedures
- **MFA Required**: Multi-factor authentication for all DR actions
- **Audit Logging**: Complete audit trail for DR activities

---

## 📈 Continuous Improvement

### 1. Metrics Collection

#### Key Performance Indicators
- **MTTR (Mean Time To Recover)**: Track and optimize
- **MTBF (Mean Time Between Failures)**: Monitor reliability
- **Backup Success Rate**: Target > 99.9%
- **DR Test Success Rate**: Target 100%

#### Post-Incident Review Process
1. **Timeline Reconstruction**: Detailed incident timeline
2. **Root Cause Analysis**: Identify underlying causes
3. **Impact Assessment**: Quantify business impact
4. **Action Items**: Specific improvement tasks
5. **Follow-up**: Track implementation of improvements

### 2. Regular Plan Updates

#### Review Triggers
- **Architecture Changes**: Major system modifications
- **New Services**: Addition of critical services
- **Incident Learnings**: Insights from real incidents
- **Technology Updates**: New tools and procedures

#### Update Process
1. **Assessment**: Review current DR capabilities
2. **Gap Analysis**: Identify areas for improvement
3. **Planning**: Develop update roadmap
4. **Implementation**: Execute planned changes
5. **Testing**: Validate updated procedures
6. **Documentation**: Update all relevant documentation

---

## 📞 Emergency Contacts

### 1. Internal Contacts

| Role | Name | Phone | Email | Pager |
|------|------|-------|-------|-------|
| **VP Engineering** | [Name] | [Number] | [Email] | [Pager] |
| **Director DevOps** | [Name] | [Number] | [Email] | [Pager] |
| **Lead Engineer** | [Name] | [Number] | [Email] | [Pager] |
| **Database Admin** | [Name] | [Number] | [Email] | [Pager] |
| **Security Officer** | [Name] | [Number] | [Email] | [Pager] |

### 2. External Contacts

| Service | Contact | Phone | Email | SLA |
|---------|---------|-------|-------|-----|
| **Cloud Provider** | AWS Support | [Number] | [Email] | 15min |
| **DNS Provider** | Route53 Support | [Number] | [Email] | 30min |
| **Security** | Incident Response | [Number] | [Email] | 1hour |
| **Legal** | Legal Counsel | [Number] | [Email] | 2hours |

---

## 📋 Appendix

### A. Command Reference

#### Kubernetes Commands
```bash
# Scale services
kubectl scale deployment <name> --replicas=<count> -n <namespace>

# Check rollout status
kubectl rollout status deployment/<name> -n <namespace>

# Get pod logs
kubectl logs -f <pod-name> -n <namespace>

# Describe resources
kubectl describe pod <pod-name> -n <namespace>
```

#### Database Commands
```bash
# Check PostgreSQL replication
SELECT * FROM pg_stat_replication;

# Promote replica to primary
pg_ctl promote -D /var/lib/postgresql/data

# Create base backup
pg_basebackup -h <host> -D /backup/path -Ft -z
```

### B. Configuration Files

#### DNS Switch Configuration
```json
{
  "Comment": "Switch to DR region",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.upm.plus",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [
          {
            "Value": "dr-api-loadbalancer.us-west-2.elb.amazonaws.com"
          }
        ]
      }
    }
  ]
}
```

---

## 📄 Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| **1.0** | 2024-11-07 | Luna Task Planning Agent | Initial DR procedures for production infrastructure |

**Next Review Date**: December 7, 2024
**Review Frequency**: Monthly
**Approved By**: [Name], VP Engineering

---

*This document is classified as CONFIDENTIAL and should be handled according to the company's information security policies.*