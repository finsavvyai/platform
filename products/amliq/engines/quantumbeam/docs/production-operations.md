# QuantumBeam Production Operations Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Deployment Architecture](#deployment-architecture)
3. [Operational Procedures](#operational-procedures)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Incident Response](#incident-response)
6. [Maintenance Procedures](#maintenance-procedures)
7. [Backup and Recovery](#backup-and-recovery)
8. [Security Operations](#security-operations)
9. [Performance Tuning](#performance-tuning)
10. [Troubleshooting Guide](#troubleshooting-guide)

## System Overview

### Core Components
- **API Server**: Main fraud detection API (Go)
- **Quantum Service**: Quantum processing engine (Python)
- **AI/ML Service**: Machine learning inference (Python)
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Nginx**: Reverse proxy and load balancer
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Visualization dashboards
- **AlertManager**: Alert routing and notification

### Service Dependencies
```
Client → Nginx → API Server → {Quantum Service, AI/ML Service}
                    ↓
                 PostgreSQL
                    ↓
                   Redis
```

## Deployment Architecture

### Production Environment
- **Platform**: Docker containers on Kubernetes (EKS)
- **Load Balancer**: Nginx with SSL termination
- **Database**: PostgreSQL 15 with high availability
- **Cache**: Redis 7 with clustering
- **Monitoring**: Prometheus + Grafana + AlertManager
- **Logging**: Structured JSON logging with ELK stack

### Container Resources
| Service | CPU | Memory | Replicas |
|---------|-----|---------|----------|
| API Server | 0.25 - 0.5 | 256 - 512 MiB | 3 |
| Quantum Service | 0.5 - 1.0 | 512 - 1024 MiB | 2 |
| AI/ML Service | 0.5 - 1.0 | 1024 - 2048 MiB | 2 |
| PostgreSQL | 0.5 - 1.0 | 1024 - 2048 MiB | 1 |
| Redis | 0.25 - 0.5 | 256 - 512 MiB | 1 |

## Operational Procedures

### Daily Checks
1. **System Health Dashboard** (Grafana)
   - Check overall system health
   - Review error rates and latency
   - Monitor resource utilization

2. **Security Monitoring**
   - Review security alerts
   - Check for unusual API usage patterns
   - Verify authentication success rates

3. **Business Metrics**
   - Monitor fraud detection accuracy
   - Track quantum vs classical processing ratio
   - Review API usage and billing metrics

### Weekly Checks
1. **Performance Analysis**
   - Review API response time trends
   - Analyze database query performance
   - Check quantum processing queue depths

2. **Capacity Planning**
   - Review resource utilization trends
   - Plan for scaling based on growth patterns
   - Update capacity forecasts

3. **Security Audit**
   - Review access logs
   - Check for security vulnerabilities
   - Update security configurations as needed

### Monthly Checks
1. **Backup Verification**
   - Test database restore procedures
   - Verify backup retention policies
   - Test disaster recovery procedures

2. **System Updates**
   - Apply security patches
   - Update container images
   - Review and update dependencies

## Monitoring and Alerting

### Key Metrics

#### API Metrics
- **Request Rate**: `http_requests_total`
- **Response Time**: `http_request_duration_seconds`
- **Error Rate**: `http_requests_total{status=~"5.."}`
- **Active Connections**: `http_connections_active`

#### Business Metrics
- **Fraud Detection Accuracy**: `fraud_detection_accuracy`
- **Quantum Processing Rate**: `quantum_processing_total`
- **AI Processing Rate**: `ai_processing_total`
- **Billing Events**: `billing_events_total`

#### Infrastructure Metrics
- **CPU Usage**: `node_cpu_seconds_total`
- **Memory Usage**: `node_memory_MemAvailable_bytes`
- **Disk Usage**: `node_filesystem_avail_bytes`
- **Network I/O**: `node_network_receive_bytes_total`

### Alert Thresholds

#### Critical Alerts
- API server down (> 1 minute)
- Database down (> 1 minute)
- Error rate > 5%
- Memory usage > 90%
- CPU usage > 85%

#### Warning Alerts
- API latency > 500ms (95th percentile)
- Queue depth > 100 items
- Disk space < 20%
- SSL certificate expiring < 30 days

### Dashboards

1. **System Overview**: High-level system health
2. **API Performance**: Request rates, latency, errors
3. **Infrastructure**: Resource utilization
4. **Business Metrics**: Fraud detection accuracy, usage
5. **Security**: Authentication events, failed logins

## Incident Response

### Severity Levels

#### P1 - Critical
- System-wide outage
- Complete service unavailability
- Data loss or security breach
- **Response Time**: 15 minutes
- **Resolution Time**: 4 hours

#### P2 - High
- Significant functionality degraded
- Partial service outage
- Performance severely impacted
- **Response Time**: 30 minutes
- **Resolution Time**: 8 hours

#### P3 - Medium
- Minor functionality issues
- Performance degradation
- Reduced feature availability
- **Response Time**: 2 hours
- **Resolution Time**: 24 hours

#### P4 - Low
- Cosmetic issues
- Documentation updates
- Minor improvements
- **Response Time**: 24 hours
- **Resolution Time**: 72 hours

### Incident Response Process

1. **Detection**
   - Automated monitoring alerts
   - User reports
   - manual checks

2. **Assessment**
   - Verify scope and impact
   - Determine severity level
   - Identify affected systems

3. **Communication**
   - Notify stakeholders
   - Create incident ticket
   - Update status dashboard

4. **Resolution**
   - Implement fix
   - Verify resolution
   - Monitor for recurrence

5. **Post-Mortem**
   - Document root cause
   - Create improvement plan
   - Update monitoring/alerts

### Escalation Contacts

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| On-call Engineer | oncall@quantumbeam.io | Immediate |
| Engineering Lead | eng-lead@quantumbeam.io | 30 minutes |
| CTO | cto@quantumbeam.io | 1 hour |
| CEO | ceo@quantumbeam.io | 2 hours |

## Maintenance Procedures

### Scheduled Maintenance Window
- **Time**: Sundays 2:00 AM - 4:00 AM UTC
- **Notification**: 48 hours advance notice
- **Duration**: Maximum 2 hours

### Maintenance Types

#### Database Maintenance
```bash
# Connect to database
docker exec -it quantumbeam-postgres-prod psql -U quantumbeam -d quantumbeam

# Run VACUUM ANALYZE
VACUUM ANALYZE;

# Check table sizes
SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check indexes
SELECT schemaname,tablename,indexname,pg_size_pretty(pg_relation_size(indexrelid::oid)) as index_size
FROM pg_indexes ORDER BY pg_relation_size(indexrelid::oid) DESC;
```

#### Application Updates
```bash
# Update API service
docker pull quantumbeam/api:latest
docker stop quantumbeam-api-prod
docker rm quantumbeam-api-prod
docker run -d --name quantumbeam-api-prod [OPTIONS] quantumbeam/api:latest

# Update quantum service
docker pull quantumbeam/quantum:latest
docker stop quantumbeam-quantum-prod
docker rm quantumbeam-quantum-prod
docker run -d --name quantumbeam-quantum-prod [OPTIONS] quantumbeam/quantum:latest

# Update AI/ML service
docker pull quantumbeam/ai-ml:latest
docker stop quantumbeam-ai-ml-prod
docker rm quantumbeam-ai-ml-prod
docker run -d --name quantumbeam-ai-ml-prod [OPTIONS] quantumbeam/ai-ml:latest
```

#### System Updates
```bash
# Update Docker images
docker-compose -f docker-compose.production.yml pull

# Restart services
docker-compose -f docker-compose.production.yml up -d

# Verify health
./scripts/deployment-verification.sh
```

### Rolling Updates

#### Kubernetes
```bash
# Update deployment
kubectl set image deployment/quantumbeam-api-deployment api-server=quantumbeam/api:v1.2.0

# Check rollout status
kubectl rollout status deployment/quantumbeam-api-deployment

# Rollback if needed
kubectl rollout undo deployment/quantumbeam-api-deployment
```

#### Docker Compose
```bash
# Update one service at a time
docker-compose -f docker-compose.production.yml up -d --no-deps api

# Wait for health check
sleep 30

# Update next service
docker-compose -f docker-compose.production.yml up -d --no-deps quantum
```

## Backup and Recovery

### Backup Strategy

#### Database Backups
- **Frequency**: Every 6 hours
- **Retention**: 30 days
- **Location**: AWS S3 (cross-region)
- **Encryption**: AES-256 at rest and in transit

```bash
# Create backup
docker exec quantumbeam-postgres-prod pg_dump -U quantumbeam quantumbeam | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d_%H%M%S).sql.gz s3://quantumbeam-backups/database/

# Verify backup
aws s3 ls s3://quantumbeam-backups/database/
```

#### Configuration Backups
- **Frequency**: Daily
- **Retention**: 90 days
- **Location**: Git repository + S3

```bash
# Backup configurations
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/

# Upload to S3
aws s3 cp config_backup_$(date +%Y%m%d).tar.gz s3://quantumbeam-backups/config/
```

### Recovery Procedures

#### Database Recovery
```bash
# Download backup from S3
aws s3 cp s3://quantumbeam-backups/database/backup_20240101_020000.sql.gz ./backup.sql.gz

# Stop application
docker stop quantumbeam-api-prod quantumbeam-quantum-prod quantumbeam-ai-ml-prod

# Restore database
gunzip -c backup.sql.gz | docker exec -i quantumbeam-postgres-prod psql -U quantumbeam -d quantumbeam

# Restart applications
docker start quantumbeam-api-prod quantumbeam-quantum-prod quantumbeam-ai-ml-prod

# Verify recovery
./scripts/deployment-verification.sh
```

#### Full System Recovery
```bash
# Recover from disaster
git clone https://github.com/quantumbeam/infrastructure.git
cd infrastructure

# Deploy infrastructure
terraform apply

# Restore configurations
aws s3 cp s3://quantumbeam-backups/config/latest.tar.gz ./
tar -xzf latest.tar.gz

# Deploy applications
docker-compose -f docker-compose.production.yml up -d

# Verify deployment
./scripts/deployment-verification.sh
```

### Disaster Recovery Testing
- **Frequency**: Quarterly
- **Scope**: Full system restore
- **Documentation**: Update recovery procedures based on test results

## Security Operations

### Security Monitoring

#### Access Control
- Monitor failed authentication attempts
- Track privilege escalation attempts
- Review API key usage patterns
- Audit SSO login activities

#### Network Security
- Monitor for DDoS attacks
- Track unusual traffic patterns
- Review SSL certificate validity
- Monitor for unauthorized access attempts

#### Application Security
- Monitor for injection attacks
- Track data exfiltration attempts
- Review API usage for anomalies
- Monitor for brute force attacks

### Security Procedures

#### Incident Response
1. **Immediate Isolation**: Block malicious IPs
2. **Investigation**: Analyze logs and patterns
3. **Containment**: Limit spread of incident
4. **Eradication**: Remove threats
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update procedures

#### Security Updates
```bash
# Update security patches
apt update && apt upgrade -y

# Update Docker images with security fixes
docker pull quantumbeam/api:latest
docker pull quantumbeam/quantum:latest
docker pull quantumbeam/ai-ml:latest

# Restart services with updated images
docker-compose -f docker-compose.production.yml up -d
```

### Compliance Monitoring

#### GDPR Compliance
- Data access logging
- Right to deletion procedures
- Data breach notification process
- Privacy policy updates

#### SOC 2 Compliance
- Access control reviews
- Security monitoring reports
- Incident response documentation
- Regular security assessments

## Performance Tuning

### Database Optimization

#### Query Optimization
```sql
-- Identify slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM transactions WHERE amount > 1000;

-- Update table statistics
ANALYZE transactions;
```

#### Index Management
```sql
-- Check index usage
SELECT schemaname,tablename,indexname,.idx_scan,idx_tup_read,idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_transactions_amount
ON transactions(amount);

-- Remove unused indexes
DROP INDEX CONCURRENTLY idx_unused_index;
```

### Application Optimization

#### Caching Strategy
- **API Responses**: 5-minute TTL
- **Database Queries**: 1-hour TTL
- **Static Content**: 24-hour TTL
- **AI Model Results**: 30-minute TTL

#### Load Balancing
```nginx
upstream quantumbeam_api {
    least_conn;
    server quantumbeam-api-prod:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Connection pooling
upstream quantumbeam_db {
    server postgres:5432 max_fails=3 fail_timeout=30s;
    keepalive 10;
}
```

### Resource Optimization

#### Memory Management
```bash
# Monitor memory usage
docker stats --no-stream

# Optimize JVM heap size (if applicable)
JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC"

# Optimize Go GC
GOGC=100
```

#### CPU Optimization
```bash
# Set CPU affinity
taskset -c 0-3 docker run [OPTIONS] quantumbeam/api

# Monitor CPU usage
top -p $(pgrep -f quantumbeam)
```

## Troubleshooting Guide

### Common Issues

#### API Server Issues
1. **High Latency**
   - Check database query performance
   - Monitor resource utilization
   - Review external API response times
   - Check network connectivity

2. **High Error Rate**
   - Review application logs
   - Check database connectivity
   - Verify external service availability
   - Monitor authentication failures

3. **Memory Leaks**
   - Monitor memory usage trends
   - Check for goroutine leaks (Go)
   - Review garbage collection metrics
   - Profile memory usage

#### Database Issues
1. **Slow Queries**
   - Identify long-running queries
   - Check index usage
   - Analyze query execution plans
   - Optimize table structures

2. **Connection Issues**
   - Check connection pool settings
   - Monitor connection count
   - Review database locks
   - Check network connectivity

3. **Disk Space Issues**
   - Monitor database size growth
   - Clean up old data
   - Compress large tables
   - Archive historical data

#### Quantum Service Issues
1. **Processing Failures**
   - Check quantum hardware availability
   - Review error logs
   - Monitor queue depths
   - Verify circuit configurations

2. **Performance Degradation**
   - Monitor quantum vs classical processing times
   - Check hardware queue times
   - Review circuit optimization
   - Analyze fallback patterns

### Diagnostic Commands

#### System Health
```bash
# Check container status
docker ps -a

# Check resource usage
docker stats

# Check logs
docker logs quantumbeam-api-prod --tail=100

# Check network connectivity
docker network ls
docker network inspect quantumbeam_quantumbeam-network
```

#### Application Health
```bash
# Check API health
curl -f http://localhost:8080/api/v1/health

# Check metrics
curl http://localhost:8080/metrics

# Check service dependencies
curl http://localhost:8001/health  # Quantum service
curl http://localhost:8002/health  # AI/ML service
```

#### Database Health
```bash
# Check PostgreSQL
docker exec quantumbeam-postgres-prod pg_isready

# Check Redis
docker exec quantumbeam-redis-prod redis-cli ping

# Check database connections
docker exec quantumbeam-postgres-prod psql -U quantumbeam -c "SELECT count(*) FROM pg_stat_activity;"
```

### Log Analysis

#### Structured Logs
```bash
# Filter error logs
docker logs quantumbeam-api-prod | jq 'select(.level == "error")'

# Analyze request patterns
docker logs quantumbeam-api-prod | jq -r '.method + " " + .path + " " + (.status | tostring)'

# Monitor response times
docker logs quantumbeam-api-prod | jq -r '(.duration | tostring) + "ms " + .path'
```

#### Security Logs
```bash
# Check failed authentications
docker logs quantumbeam-api-prod | jq 'select(.event == "auth_failed")'

# Monitor API usage by IP
docker logs quantumbeam-api-prod | jq -r '.remote_addr' | sort | uniq -c | sort -nr

# Check for suspicious patterns
docker logs quantumbeam-api-prod | grep -i "attack\|injection\|xss"
```

## Emergency Procedures

### Complete System Outage

1. **Immediate Actions**
   - Notify all stakeholders
   - Start incident response
   - Assess scope and impact

2. **System Recovery**
   ```bash
   # Stop all services
   docker-compose -f docker-compose.production.yml down

   # Start core services
   docker-compose -f docker-compose.production.yml up -d postgres redis

   # Wait for databases to be ready
   sleep 60

   # Start application services
   docker-compose -f docker-compose.production.yml up -d

   # Verify system health
   ./scripts/deployment-verification.sh
   ```

3. **Communication**
   - Update status page
   - Notify users
   - Provide regular updates

### Security Incident

1. **Immediate Isolation**
   ```bash
   # Block malicious IPs
   iptables -A INPUT -s MALICIOUS_IP -j DROP

   # Disable affected accounts
   docker exec quantumbeam-postgres-prod psql -U quantumbeam -c "UPDATE users SET active = false WHERE email = 'compromised@example.com';"
   ```

2. **Investigation**
   - Preserve logs
   - Analyze attack patterns
   - Identify data exposure

3. **Recovery**
   - Patch vulnerabilities
   - Reset compromised credentials
   - Monitor for recurrence

## Contact Information

### Engineering Team
- **On-call Engineer**: oncall@quantumbeam.io
- **Engineering Lead**: eng-lead@quantumbeam.io
- **CTO**: cto@quantumbeam.io

### External Services
- **AWS Support**: https://console.aws.amazon.com/support/home
- **Quantum Hardware**: quantum-support@quantumbeam.io
- **Monitoring Provider**: monitoring@quantumbeam.io

### Emergency Contacts
- **Security Incident**: security@quantumbeam.io
- **Legal**: legal@quantumbeam.io
- **PR/Comms**: comms@quantumbeam.io

---

This operations guide should be reviewed and updated quarterly or after any major system changes.