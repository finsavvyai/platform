# AWS Region Failover Playbook

**Playbook ID**: DR-001
**Severity**: Critical
**Expected RTO**: 2-4 hours
**Expected RPO**: 1 hour

---

## Overview

This playbook provides step-by-step procedures for failing over from the primary AWS region (us-east-1) to the secondary region (us-west-2) in the event of a region-wide outage or disaster.

## Prerequisites

### Pre-Failover Requirements
- [ ] Secondary region infrastructure is provisioned and regularly tested
- [ ] DNS failover configuration is validated
- [ ] Cross-region backups are current and verified
- [ ] Team contacts are verified and available
- [ ] Communication channels are tested

### Required Access
- AWS Administrator access to both regions
- Kubernetes cluster admin access
- Route53 DNS management permissions
- S3 access for backup/restore operations

## Alerting and Detection

### Automatic Detection Triggers
- **Health Check Failures**: > 50% of health checks failing for 5 minutes
- **API Endpoints**: All critical API endpoints unresponsive for 3 minutes
- **Infrastructure Status**: AWS Health Dashboard showing region-wide issues
- **Customer Reports**: > 100 simultaneous customer outage reports

### Manual Detection
- Monitoring dashboard anomalies
- AWS Service Health Dashboard alerts
- External monitoring service notifications
- Customer support escalation

---

## Immediate Response (First 15 Minutes)

### 1. Incident Declaration
```bash
# Declare incident
#1. Send emergency notification
echo "🚨 REGION-WIDE OUTAGE DECLARED - Initiating DR failover" | \
    slack-cli send --channel #emergency

#2. Activate DR team
./scripts/activate-dr-team.sh --incident-type=region-failover
```

### 2. Initial Assessment
```bash
# Verify primary region status
aws ec2 describe-region-status --region us-east-1 --query 'RegionStatuses[0].Status'

# Check critical services
aws eks describe-cluster --name quantumbeam-prod --region us-east-1
aws rds describe-db-instances --region us-east-1
aws elasticache describe-replication-groups --region us-east-1

# Verify external monitoring
curl -s https://status.quantumbeam.io/api/health | jq .
```

### 3. Team Coordination
```bash
# Create incident channel
slack-cli create-channel --name incident-$(date +%Y%m%d-%H%M%S)
slack-cli invite-users --users @sarah,@james,@david,@rachel

# Establish command center
zoom-cli start-meeting --topic "DR Command Center"
```

---

## Failover Execution (Minutes 15-120)

### Phase 1: Infrastructure Validation (15-30 minutes)

#### 1.1 Verify Secondary Region Health
```bash
# Check secondary region infrastructure
aws eks describe-cluster --name quantumbeam-prod --region us-west-2
kubectl config use-context arn:aws:eks:us-west-2:123456789012:cluster/quantumbeam-prod

# Verify all nodes are ready
kubectl get nodes --region us-west-2
kubectl get pods -A --region us-west-2

# Check critical services
kubectl get pods -n quantumbeam -l app=quantumbeam-api --region us-west-2
kubectl get pods -n quantumbeam -l app=quantumbeam-db --region us-west-2
```

#### 1.2 Validate Backup Availability
```bash
# Check latest backups in secondary region
aws s3 ls s3://quantumbeam-backups-us-west-2/database/ --recursive | tail -5
aws s3 ls s3://quantumbeam-backups-us-west-2/files/ --recursive | tail -5

# Verify backup integrity
python scripts/verify-backup-integrity.py --region us-west-2
```

#### 1.3 Prepare Configuration
```bash
# Update kubeconfig for secondary region
aws eks update-kubeconfig --region us-west-2 --name quantumbeam-prod

# Apply current configuration
kubectl apply -f kubernetes/secondary-region/
kubectl apply -f configmaps/production/
kubectl apply -f secrets/production/
```

### Phase 2: Data Recovery (30-90 minutes)

#### 2.1 Database Recovery
```bash
# 1. Restore PostgreSQL database
LATEST_BACKUP=$(aws s3 ls s3://quantumbeam-backups-us-west-2/database/ --recursive | \
    grep "postgresql" | sort | tail -1 | awk '{print $4}')

aws s3 cp s3://quantumbeam-backups-us-west-2/$LATEST_BACKUP /tmp/quantumbeam-recovery.dump

# 2. Create new database instance
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier quantumbeam-db-recovered \
    --db-snapshot-identifier $LATEST_BACKUP \
    --db-instance-class db.r5.large \
    --multi-az \
    --region us-west-2

# 3. Wait for database to be available
aws rds wait db-instance-available \
    --db-instance-identifiers quantumbeam-db-recovered \
    --region us-west-2

# 4. Update application configuration
kubectl patch configmap quantumbeam-config -n quantumbeam -p \
    '{"data":{"database_host":"quantumbeam-db-recovered.cluster-xxxx.us-west-2.rds.amazonaws.com"}}'
```

#### 2.2 Cache Recovery
```bash
# 1. Restore Redis cluster
LATEST_REDIS_BACKUP=$(aws s3 ls s3://quantumbeam-backups-us-west-2/redis/ --recursive | \
    sort | tail -1 | awk '{print $4}')

aws s3 cp s3://quantumbeam-backups-us-west-2/$LATEST_REDIS_BACKUP /tmp/redis-backup.rdb

# 2. Create new Redis cluster
aws elasticache create-replication-group \
    --replication-group-id quantumbeam-redis-recovered \
    --primary-cluster-id quantumbeam-redis-primary \
    --cacheNodeType cache.r5.large \
    --num-cache-clusters 3 \
    --region us-west-2

# 3. Wait for Redis to be available
aws elasticache wait replication-group-available \
    --replication-group-id quantumbeam-redis-recovered \
    --region us-west-2

# 4. Update configuration
kubectl patch configmap quantumbeam-config -n quantumbeam -p \
    '{"data":{"redis_host":"quantumbeam-redis-recovered.xxxx.use1.cache.amazonaws.com"}}'
```

#### 2.3 File System Recovery
```bash
# 1. Mount backup storage
aws s3 sync s3://quantumbeam-backups-us-west-2/files/ /tmp/backups/

# 2. Restore application files
kubectl create configmap quantumbeam-files \
    --from-file=app-config=/tmp/backups/config/app-config.yaml \
    --from-file=feature-flags=/tmp/backups/config/feature-flags.json \
    -n quantumbeam

# 3. Restore SSL certificates
kubectl create secret tls quantumbeam-ssl \
    --cert=/tmp/backups/certs/quantumbeam.crt \
    --key=/tmp/backups/certs/quantumbeam.key \
    -n quantumbeam
```

### Phase 3: Service Deployment (60-120 minutes)

#### 3.1 Deploy Application Services
```bash
# 1. Deploy core services
kubectl apply -f kubernetes/deployments/api-deployment.yaml
kubectl apply -f kubernetes/deployments/worker-deployment.yaml
kubectl apply -f kubernetes/deployments/analytics-deployment.yaml

# 2. Wait for deployments to be ready
kubectl rollout status deployment/quantumbeam-api -n quantumbeam --timeout=10m
kubectl rollout status deployment/quantumbeam-worker -n quantumbeam --timeout=10m
kubectl rollout status deployment/quantumbeam-analytics -n quantumbeam --timeout=10m

# 3. Verify pod health
kubectl get pods -n quantumbeam -l app=quantumbeam-api
kubectl get pods -n quantumbeam -l app=quantumbeam-worker
kubectl get pods -n quantumbeam -l app=quantumbeam-analytics
```

#### 3.2 Deploy Ingress and Load Balancer
```bash
# 1. Deploy load balancer
kubectl apply -f kubernetes/ingress/ingress-controller.yaml
kubectl apply -f kubernetes/ingress/ingress-rules.yaml

# 2. Get load balancer endpoint
LOAD_BALANCER_URL=$(kubectl get ingress quantumbeam-ingress -n quantumbeam -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# 3. Update DNS (Phase 4 - see below)
echo "Load balancer URL: $LOAD_BALANCER_URL"
```

### Phase 4: DNS Failover (90-120 minutes)

#### 4.1 Update Route53 Records
```bash
# 1. Update primary records
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1PA6795UKMFR9 \
    --change-batch '{
        "Comment": "DR failover to us-west-2",
        "Changes": [
            {
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": "api.quantumbeam.io",
                    "Type": "CNAME",
                    "TTL": 60,
                    "ResourceRecords": [
                        {
                            "Value": "'$LOAD_BALANCER_URL'"
                        }
                    ]
                }
            }
        ]
    }'

# 2. Update monitoring endpoints
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1PA6795UKMFR9 \
    --change-batch '{
        "Comment": "DR failover monitoring endpoints",
        "Changes": [
            {
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": "monitoring.quantumbeam.io",
                    "Type": "CNAME",
                    "TTL": 60,
                    "ResourceRecords": [
                        {
                            "Value": "'$LOAD_BALANCER_URL'"
                        }
                    ]
                }
            }
        ]
    }'
```

#### 4.2 Verify DNS Propagation
```bash
# Monitor DNS propagation
for i in {1..20}; do
    echo "DNS propagation check $i/20:"
    nslookup api.quantumbeam.io
    sleep 30
done
```

---

## Validation and Testing (Minutes 120-180)

### 1. Service Health Validation
```bash
# 1. API Health Check
curl -f https://api.quantumbeam.io/health || echo "API health check failed"

# 2. Authentication Test
curl -X POST https://api.quantumbeam.io/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@quantumbeam.io","password":"testpassword"}' || echo "Auth test failed"

# 3. Database Connectivity Test
kubectl exec -n quantumbeam deployment/quantumbeam-api -- \
    psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;" || echo "DB test failed"

# 4. Cache Test
kubectl exec -n quantumbeam deployment/quantumbeam-api -- \
    redis-cli -h $REDIS_HOST ping || echo "Cache test failed"
```

### 2. End-to-End Functionality Tests
```bash
# 1. Core API Functionality
python scripts/api-smoke-tests.py --environment=production --region=us-west-2

# 2. Payment Processing Test
python scripts/test-payment-processing.py --test-mode=sandbox

# 3. Analytics Test
python scripts/test-analytics-pipeline.py --test-data-limit=100

# 4. Monitoring Test
curl -f https://monitoring.quantumbeam.io/health || echo "Monitoring test failed"
```

### 3. Performance Validation
```bash
# 1. Load Test
artillery run load-test-config.yaml --target https://api.quantumbeam.io

# 2. Database Performance
kubectl exec -n quantumbeam deployment/quantumbeam-api -- \
    psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# 3. Resource Utilization
kubectl top pods -n quantumbeam
kubectl top nodes
```

---

## Post-Failover Activities

### 1. Monitoring and Stabilization
```bash
# 1. Enable enhanced monitoring
kubectl apply -f monitoring/prometheus-secondary.yaml
kubectl apply -f monitoring/grafana-secondary.yaml

# 2. Set up alerting for secondary region
./scripts/setup-alerting.sh --region us-west-2

# 3. Monitor system metrics for 24 hours
./scripts/monitor-dr-performance.sh --duration=24h
```

### 2. Communication Updates
```bash
# 1. Update status page
./scripts/update-status-page.sh \
    --status="operational" \
    --message="Services have been restored through our secondary data center."

# 2. Send customer notification
./scripts/send-customer-communication.sh \
    --type="resolution" \
    --template="region-failover-resolved"

# 3. Internal team notification
slack-cli send --message="✅ DR failover completed successfully. All services operational in us-west-2."
```

### 3. Documentation and Review
```bash
# 1. Generate incident report
python scripts/generate-incident-report.py \
    --incident-type="region-failover" \
    --start-time="2024-01-15T14:30:00Z" \
    --end-time="2024-01-15T16:45:00Z"

# 2. Document lessons learned
./scripts/document-lessons-learned.sh --incident-id=INC-2024-001

# 3. Update DR procedures
./scripts/update-dr-procedures.sh --based-on="real-incident"
```

---

## Rollback Procedures (If Needed)

### 1. Rollback Decision Criteria
- Primary region recovers and is stable for 2 hours
- Secondary region shows performance issues
- Business decision to return to primary region

### 2. Rollback Execution
```bash
# 1. Prepare primary region
aws eks update-kubeconfig --region us-east-1 --name quantumbeam-prod

# 2. Update primary region infrastructure
kubectl apply -f kubernetes/primary-region/
kubectl apply -f configmaps/production/
kubectl apply -f secrets/production/

# 3. Switch DNS back to primary region
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1PA6795UKMFR9 \
    --change-batch file://rollback-dns.json

# 4. Validate primary region services
./scripts/validate-primary-region.sh

# 5. Decommission secondary region active services
kubectl scale deployment --replicas=0 --all -n quantumbeam --context us-west-2
```

---

## Critical Success Factors

### 1. Team Coordination
- Clear communication channels established
- Defined roles and responsibilities
- Regular status updates every 15 minutes
- Escalation procedures followed

### 2. Technical Requirements
- All team members have proper access credentials
- Backup systems are current and verified
- Network connectivity to secondary region
- Monitoring and alerting systems operational

### 3. Timeline Adherence
- Each phase completed within specified timeframes
- Decision points clearly defined
- Escalation triggers identified
- Progress tracked and documented

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Database Restore Fails
```bash
# Symptoms
ERROR: Database restoration timeout

# Solutions
# 1. Check backup integrity
aws s3 ls s3://quantumbeam-backups-us-west-2/database/

# 2. Try alternative backup
aws s3 ls s3://quantumbeam-backups-us-west-2/database/ | sort | tail -2 | head -1

# 3. Use point-in-time recovery
aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier quantumbeam-db-prod \
    --target-db-instance-identifier quantumbeam-db-pitr \
    --restore-time 2024-01-15T13:30:00Z \
    --region us-west-2
```

#### Issue 2: Load Balancer Not Responding
```bash
# Symptoms
Timeout connecting to load balancer

# Solutions
# 1. Check ingress controller status
kubectl get pods -n ingress-nginx

# 2. Verify load balancer creation
kubectl get svc -n ingress-nginx

# 3. Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxxx
```

#### Issue 3: DNS Propagation Delays
```bash
# Symptoms
DNS records not updating

# Solutions
# 1. Reduce TTL before failover
aws route53 change-resource-record-sets --ttl 10

# 2. Use multiple DNS providers for faster propagation
# 3. Implement client-side failover in applications
```

---

## Post-Incident Review Checklist

### Immediate Actions (First 24 hours)
- [ ] Document timeline of events
- [ ] Record all actions taken
- [ ] Identify root causes
- [ ] Measure recovery time metrics
- [ ] Update contact information

### Short-term Actions (First week)
- [ ] Conduct post-mortem meeting
- [ ] Identify process improvements
- [ ] Update DR documentation
- [ ] Schedule additional training
- [ ] Plan improvements to infrastructure

### Long-term Actions (First month)
- [ ] Implement identified improvements
- [ ] Conduct additional DR testing
- [ ] Review and update RTO/RPO targets
- [ ] Enhance monitoring and alerting
- [ ] Update disaster recovery budget

---

## Appendix

### A. Command Reference

#### AWS CLI Commands
```bash
# Region status
aws ec2 describe-region-status --region us-east-1

# EKS cluster management
aws eks update-kubeconfig --region us-west-2 --name quantumbeam-prod

# RDS management
aws rds describe-db-instances --region us-west-2
aws rds wait db-instance-available --db-instance-identifiers quantumbeam-db

# Route53 management
aws route53 list-hosted-zones
aws route53 change-resource-record-sets --hosted-zone-id Z1PA6795UKMFR9
```

#### Kubernetes Commands
```bash
# Cluster status
kubectl get nodes
kubectl get pods -A

# Application management
kubectl rollout status deployment/quantumbeam-api
kubectl scale deployment quantumbeam-api --replicas=5

# Troubleshooting
kubectl logs deployment/quantumbeam-api -n quantumbeam
kubectl describe pod <pod-name> -n quantumbeam
```

### B. Contact Escalation

| Level | Contact | Phone | Email | Trigger |
|-------|---------|-------|-------|---------|
| L1 | DevOps Team | 24/7 on-call | devops@quantumbeam.io | Standard failover |
| L2 | Engineering Lead | +1-555-0102 | james@quantumbeam.io | Complications > 1 hour |
| L3 | CTO | +1-555-0101 | sarah@quantumbeam.io | Major issues or executive update needed |

### C. Service Dependencies

```
Critical Path for Region Failover:
1. AWS Infrastructure (VPC, EKS, RDS, ElastiCache)
2. DNS Configuration (Route53)
3. Load Balancer (ALB/NLB)
4. Application Services (API, Workers, Analytics)
5. External Dependencies (Payment Gateway, APIs)
```

---

**Playbook Version**: 1.2
**Last Updated**: 2024-02-01
**Next Review**: 2024-05-01
**Approved By**: CTO - Engineering