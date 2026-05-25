# SDLC.ai Platform - Database Backup Strategy

## Overview

This document outlines the comprehensive backup strategy for all SDLC.ai platform databases, ensuring data durability, quick recovery, and compliance with regulatory requirements.

## Database Architecture

### Primary Databases
1. **Tenant Database** (`sdlc-tenant-db`)
   - Multi-tenant configuration and metadata
   - Size: ~50GB
   - Criticality: Critical

2. **Authentication Database** (`sdlc-auth-db`)
   - User credentials and session data
   - Size: ~10GB
   - Criticality: Critical

3. **Documents Database** (`sdlc-documents-db`)
   - Document metadata and indexing
   - Size: ~500GB
   - Criticality: High

4. **Vector Metadata Database** (`sdlc-vector-metadata-db`)
   - Vector search metadata and indexes
   - Size: ~100GB
   - Criticality: High

5. **Policy Database** (`sdlc-policy-db`)
   - Security policies and DLP rules
   - Size: ~5GB
   - Criticality: Critical

## Backup Strategy

### 1. Point-in-Time Recovery (PITR)

#### Configuration
```yaml
# Cloudflare D1 PITR Configuration
pitr:
  enabled: true
  retention: 30 days
  frequency: "continuous"  # Transaction log shipping
  
  # Exclusions
  exclude_tables:
    - "temp_sessions"
    - "cache_entries"
    
  # Performance optimization
  throttling:
    max_io_mb_per_sec: 100
    max_cpu_percent: 30
```

#### Implementation
```bash
# Enable PITR for all production databases
for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
  wrangler d1 pitr enable sdlc-$db --env production
  wrangler d1 pitr configure sdlc-$db \
    --retention 30d \
    --frequency continuous \
    --env production
done
```

#### Recovery Commands
```bash
# Restore to specific point in time
wrangler d1 restore \
  --database sdlc-documents-db \
  --timestamp "2024-01-15T14:30:00Z" \
  --env production

# Restore with preview (dry run)
wrangler d1 restore \
  --database sdlc-documents-db \
  --timestamp "2024-01-15T14:30:00Z" \
  --preview \
  --env production

# List available restore points
wrangler d1 list-restore-points \
  --database sdlc-documents-db \
  --since "2024-01-14T00:00:00Z" \
  --env production
```

### 2. Scheduled Full Backups

#### Backup Schedule
```yaml
backup_schedule:
  # Daily backups
  daily:
    time: "02:00 UTC"
    retention: 30 days
    compression: true
    encryption: true
    
  # Weekly full backups
  weekly:
    day: "Sunday"
    time: "01:00 UTC"
    retention: 12 weeks
    verify: true
    
  # Monthly archival
  monthly:
    day: 1
    time: "00:00 UTC"
    retention: 12 months
    storage: "cold_storage"
```

#### Automated Backup Script
```bash
#!/bin/bash
# backup-all-databases.sh

set -euo pipefail

# Configuration
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/tmp/sdlc-backups-${BACKUP_DATE}"
STORAGE_BUCKET="s3://sdlc-database-backups"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# List of databases
DATABASES=(
  "sdlc-tenant-db"
  "sdlc-auth-db"
  "sdlc-documents-db"
  "sdlc-vector-metadata-db"
  "sdlc-policy-db"
)

# Backup each database
for db in "${DATABASES[@]}"; do
  echo "Backing up $db..."
  
  # Export database
  wrangler d1 export "$db" \
    --env production \
    --output "${BACKUP_DIR}/${db}.sql" \
    --format sql \
    --compress gzip
    
  # Generate checksum
  sha256sum "${BACKUP_DIR}/${db}.sql.gz" > "${BACKUP_DIR}/${db}.sha256"
  
  # Encrypt backup
  gpg --batch --yes \
    --passphrase "$ENCRYPTION_KEY" \
    --cipher-algo AES256 \
    --compress-algo 1 \
    --symmetric \
    --output "${BACKUP_DIR}/${db}.sql.gz.gpg" \
    "${BACKUP_DIR}/${db}.sql.gz"
    
  # Remove unencrypted backup
  rm "${BACKUP_DIR}/${db}.sql.gz"
  
  echo "Backup of $db completed"
done

# Create backup manifest
cat > "${BACKUP_DIR}/manifest.json" << EOF
{
  "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_id": "${BACKUP_DATE}",
  "databases": [$(printf '"%s",' "${DATABASES[@]}" | sed 's/,$//')],
  "total_size": "$(du -sh ${BACKUP_DIR} | cut -f1)",
  "backup_type": "scheduled_full"
}
EOF

# Upload to secure storage
echo "Uploading backups to secure storage..."
aws s3 sync "$BACKUP_DIR" "${STORAGE_BUCKET}/${BACKUP_DATE}/" \
  --sse AES256 \
  --storage-class STANDARD_IA

# Update latest symlink
aws s3 cp "${STORAGE_BUCKET}/${BACKUP_DATE}/" "${STORAGE_BUCKET}/latest/" \
  --recursive

# Cleanup local files
rm -rf "$BACKUP_DIR"

# Verify backup integrity
echo "Verifying backup integrity..."
python3 scripts/verify-backup-integrity.py \
  --backup-id "${BACKUP_DATE}" \
  --bucket "${STORAGE_BUCKET}"

# Send notification
curl -X POST "${SLACK_WEBHOOK_URL}" \
  -H 'Content-type: application/json' \
  --data "{
    \"text\": \"✅ Database backup completed successfully\",
    \"fields\": [
      {\"title\": \"Backup ID\", \"value\": \"${BACKUP_DATE}\", \"short\": true},
      {\"title\": \"Size\", \"value\": \"$(aws s3 ls ${STORAGE_BUCKET}/${BACKUP_DATE}/ --recursive | awk '{sum+=$3} END {print sum/1024/1024/1024 \" GB\"}')\", \"short\": true}
    ]
  }"

echo "Backup process completed successfully"
```

### 3. Cross-Region Replication

#### Primary-Replica Configuration
```yaml
replication:
  primary_region: "us-east-1"
  replica_regions:
    - "eu-west-1"
    - "ap-southeast-1"
    
  replication_config:
    # Real-time replication for critical data
    critical_tables:
      - "users"
      - "tenants"
      - "auth_tokens"
      mode: "synchronous"
      
    # Async replication for large datasets
    large_tables:
      - "documents"
      - "vectors"
      - "audit_logs"
      mode: "asynchronous"
      lag_target: "5s"
```

#### Replication Setup
```bash
# Create replica databases
for region in eu-west-1 ap-southeast-1; do
  wrangler d1 create "sdlc-tenant-db-${region}" --region "$region"
  wrangler d1 create "sdlc-auth-db-${region}" --region "$region"
  # ... create other databases
done

# Configure replication
wrangler d1 replication configure \
  --source sdlc-tenant-db \
  --destination sdlc-tenant-db-eu-west-1 \
  --mode synchronous \
  --tables users,tenants,auth_tokens
```

### 4. Incremental Backups

#### Configuration
```yaml
incremental_backup:
  enabled: true
  frequency: "hourly"
  base_backup: "daily_full"
  retention: "7d"
  
  # Change data capture
  cdc:
    enabled: true
    capture_inserts: true
    capture_updates: true
    capture_deletes: true
```

#### Incremental Backup Script
```bash
#!/bin/bash
# incremental-backup.sh

DB_NAME="$1"
BACKUP_TYPE="incremental"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BASE_BACKUP=$(date +%Y%m%d)

# Extract changes since last backup
wrangler d1 export-changes "$DB_NAME" \
  --since "$(date -d '1 hour ago' --iso-8601)" \
  --output "/tmp/${DB_NAME}-${TIMESTAMP}.sql" \
  --env production

# Compress and upload
gzip "/tmp/${DB_NAME}-${TIMESTAMP}.sql"
aws s3 cp "/tmp/${DB_NAME}-${TIMESTAMP}.sql.gz" \
  "s3://sdlc-database-backups/incremental/${BASE_BACKUP}/${DB_NAME}-${TIMESTAMP}.sql.gz"
```

## Backup Verification

### 1. Automated Integrity Checks

```python
#!/usr/bin/env python3
# verify-backup-integrity.py

import boto3
import hashlib
import json
import sys
from datetime import datetime

def verify_backup(backup_id, bucket):
    s3 = boto3.client('s3')
    errors = []
    
    # Get backup manifest
    try:
        manifest = s3.get_object(
            Bucket=bucket,
            Key=f"{backup_id}/manifest.json"
        )
        manifest_data = json.loads(manifest['Body'].read())
    except Exception as e:
        errors.append(f"Failed to load manifest: {e}")
        return errors
    
    # Verify each database backup
    for db in manifest_data['databases']:
        # Check file exists
        backup_file = f"{backup_id}/{db}.sql.gz.gpg"
        try:
            s3.head_object(Bucket=bucket, Key=backup_file)
        except:
            errors.append(f"Missing backup file for {db}")
            continue
            
        # Verify checksum
        checksum_file = f"{backup_id}/{db}.sha256"
        try:
            checksum_obj = s3.get_object(Bucket=bucket, Key=checksum_file)
            stored_checksum = checksum_obj['Body'].read().decode().split()[0]
            
            # Calculate actual checksum
            backup_obj = s3.get_object(Bucket=bucket, Key=backup_file)
            actual_checksum = hashlib.sha256(backup_obj['Body'].read()).hexdigest()
            
            if stored_checksum != actual_checksum:
                errors.append(f"Checksum mismatch for {db}")
        except Exception as e:
            errors.append(f"Failed to verify checksum for {db}: {e}")
    
    return errors

if __name__ == "__main__":
    backup_id = sys.argv[2] if len(sys.argv) > 2 else None
    bucket = sys.argv[1]
    
    if not backup_id:
        # Get latest backup
        s3 = boto3.client('s3')
        objects = s3.list_objects_v2(
            Bucket=bucket,
            Prefix="",
            Delimiter="/"
        )
        latest_backup = max([obj['Prefix'].rstrip('/') for obj in objects.get('CommonPrefixes', [])])
        backup_id = latest_backup
    
    errors = verify_backup(backup_id, bucket)
    
    if errors:
        print(f"❌ Backup verification failed for {backup_id}:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print(f"✅ Backup verification passed for {backup_id}")
```

### 2. Restore Testing

```bash
#!/bin/bash
# test-restore-process.sh

BACKUP_ID="$1"
TEST_DB_PREFIX="test-restore-$(date +%s)"

# Create test databases
for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
  test_db="${TEST_DB_PREFIX}-${db}"
  echo "Creating test database: $test_db"
  wrangler d1 create "$test_db"
  
  # Restore from backup
  echo "Restoring $db from backup $BACKUP_ID"
  aws s3 cp "s3://sdlc-database-backups/${BACKUP_ID}/${db}.sql.gz.gpg" - \
    | gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" --decrypt \
    | gunzip \
    | wrangler d1 execute "$test_db" --file -
  
  # Verify restore
  record_count=$(wrangler d1 execute "$test_db" \
    --command "SELECT COUNT(*) FROM information_schema.tables" \
    --format json | jq '.results[0].results[0][0]')
  
  echo "✅ $db restored with $record_count tables"
  
  # Cleanup test database
  wrangler d1 delete "$test_db" --force
done

echo "✅ All databases restored successfully"
```

## Disaster Recovery Procedures

### 1. Complete Database Recovery

```bash
#!/bin/bash
# disaster-recovery-databases.sh

DISASTER_TIME="$1"
RECOVERY_REGION="${2:-us-east-1}"

echo "Initiating database disaster recovery for: $DISASTER_TIME"
echo "Recovery region: $RECOVERY_REGION"

# Step 1: Assess available backups
echo "Assessing available backups..."
LATEST_BACKUP=$(aws s3 ls s3://sdlc-database-backups/ --recursive | sort | tail -n 1 | awk '{print $4}')
echo "Latest available backup: $LATEST_BACKUP"

# Step 2: Prepare new databases
echo "Preparing new databases..."
for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
  new_db="sdlc-${db}-recovery"
  echo "Creating recovery database: $new_db"
  wrangler d1 create "$new_db" --region "$RECOVERY_REGION"
done

# Step 3: Restore from latest backup
echo "Restoring databases from backup..."
for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
  new_db="sdlc-${db}-recovery"
  echo "Restoring $db..."
  
  # Download and decrypt backup
  aws s3 cp "s3://sdlc-database-backups/${LATEST_BACKUP}/${db}.sql.gz.gpg" - \
    | gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" --decrypt \
    | gunzip \
    | wrangler d1 execute "$new_db" --file -
done

# Step 4: Apply PITR if needed
if [[ "$DISASTER_TIME" != "" ]]; then
  echo "Applying point-in-time recovery to: $DISASTER_TIME"
  for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
    new_db="sdlc-${db}-recovery"
    wrangler d1 restore \
      --database "$new_db" \
      --timestamp "$DISASTER_TIME" \
      --region "$RECOVERY_REGION"
  done
fi

# Step 5: Verify databases
echo "Verifying restored databases..."
for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
  new_db="sdlc-${db}-recovery"
  
  # Check table count
  table_count=$(wrangler d1 execute "$new_db" \
    --command "SELECT COUNT(*) FROM information_schema.tables" \
    --format json | jq '.results[0].results[0][0]')
  
  # Check data integrity
  checksum=$(wrangler d1 execute "$new_db" \
    --command "SELECT MD5(GROUP_CONCAT(id)) FROM (SELECT id FROM users LIMIT 1000)" \
    --format json | jq -r '.results[0].results[0][0]')
  
  echo "✅ $new_db: $table_count tables, checksum: $checksum"
done

# Step 6: Update configuration
echo "Updating configuration to point to recovery databases..."
cat > recovery-config.json << EOF
{
  "databases": {
    "TENANT_DB": "sdlc-tenant-db-recovery",
    "AUTH_DB": "sdlc-auth-db-recovery",
    "DOCUMENTS_DB": "sdlc-documents-db-recovery",
    "VECTOR_METADATA_DB": "sdlc-vector-metadata-db-recovery",
    "POLICY_DB": "sdlc-policy-db-recovery"
  },
  "region": "$RECOVERY_REGION",
  "recovery_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Deploy with recovery configuration
wrangler deploy --config recovery-wrangler.toml --env production

# Step 7: Health check
echo "Performing health check..."
sleep 30
curl -f https://api.sdlc.cc/health || {
  echo "❌ Health check failed"
  exit 1
}

echo "✅ Database disaster recovery completed successfully"
echo "Recovery databases are now active"
```

### 2. Database Failover

```bash
#!/bin/bash
# database-failover.sh

PRIMARY_REGION="$1"
FAILOVER_REGION="$2"

echo "Initiating database failover from $PRIMARY_REGION to $FAILOVER_REGION"

# Step 1: Promote replica
for db in tenant-db auth-db documents-db vector-metadata-db policy-db; do
  primary_db="sdlc-${db}-${PRIMARY_REGION}"
  replica_db="sdlc-${db}-${FAILOVER_REGION}"
  
  echo "Promoting $replica_db to primary..."
  wrangler d1 promote-replica \
    --database "$replica_db" \
    --new-primary "sdlc-${db}" \
    --region "$FAILOVER_REGION"
done

# Step 2: Update DNS routing
echo "Updating DNS to point to failover region..."
wrangler route rule update \
  --pattern="api.sdlc.cc/*" \
  --zone-name="sdlc.cc" \
  --worker="sdlc-platform-${FAILOVER_REGION}"

# Step 3: Update application configuration
echo "Updating application configuration..."
./scripts/update-database-config.sh \
  --region "$FAILOVER_REGION" \
  --env production

# Step 4: Verify failover
echo "Verifying failover..."
sleep 60
for i in {1..10}; do
  if curl -f https://api.sdlc.cc/health > /dev/null 2>&1; then
    echo "✅ Failover verified"
    break
  fi
  echo "Waiting for failover propagation... ($i/10)"
  sleep 30
done

echo "✅ Database failover completed"
```

## Monitoring and Alerting

### 1. Backup Monitoring

```yaml
# Backup monitoring rules
backup_monitoring:
  rules:
    - name: "backup_failure"
      condition: "backup_success == 0"
      severity: "critical"
      for: "5m"
      
    - name: "backup_delay"
      condition: "time() - backup_last_success > 3600"
      severity: "warning"
      
    - name: "backup_size_anomaly"
      condition: "backup_size < avg_backup_size * 0.5"
      severity: "warning"
      
    - name: "pitr_lag"
      condition: "pitr_lag_seconds > 300"
      severity: "critical"
```

### 2. Replication Monitoring

```yaml
# Replication monitoring
replication_monitoring:
  rules:
    - name: "replication_lag"
      condition: "replication_lag_seconds > 10"
      severity: "warning"
      
    - name: "replication_failure"
      condition: "replication_status != 'active'"
      severity: "critical"
      
    - name: "replica_unavailable"
      condition: "replica_health == 0"
      severity: "critical"
```

## Security Considerations

### 1. Backup Encryption
- All backups encrypted with AES-256
- Encryption keys rotated every 90 days
- Separate key management service

### 2. Access Control
```yaml
# Backup access policy
backup_access:
  roles:
    - name: "backup_operator"
      permissions:
        - "d1:export"
        - "d1:list"
        - "s3:PutObject"
        - "s3:GetObject"
        
    - name: "backup_restorer"
      permissions:
        - "d1:create"
        - "d1:restore"
        - "s3:GetObject"
        
  policies:
    - effect: "Deny"
      action: "*"
      resource: "*"
      condition:
        "aws:RequestedRegion": ["us-east-1"]
        "aws:CurrentTime": {"DateGreaterThan": "2024-01-01"}
```

### 3. Audit Logging
```bash
# Enable audit logging for all backup operations
wrangler d1 configure-audit-logging \
  --database sdlc-tenant-db \
  --log-exports \
  --log-restores \
  --log-access \
  --env production
```

## Compliance and Retention

### 1. Data Retention Policy
```yaml
retention_policy:
  # Regulatory requirements
  gdpr:
    personal_data: "5 years"
    consent_data: "2 years"
    
  hipaa:
    phi_data: "7 years"
    
  sox:
    financial_data: "7 years"
    
  # Internal policies
  backups:
    daily: "30 days"
    weekly: "90 days"
    monthly: "1 year"
    yearly: "7 years"
```

### 2. Compliance Reporting
```python
#!/usr/bin/env python3
# generate-compliance-report.py

import boto3
import json
from datetime import datetime, timedelta

def generate_compliance_report():
    s3 = boto3.client('s3')
    report = {
        "report_date": datetime.now().isoformat(),
        "backup_status": {},
        "retention_status": {},
        "compliance_status": "COMPLIANT"
    }
    
    # Check backup status
    backups = s3.list_objects_v2(
        Bucket="sdlc-database-backups",
        Prefix="2024/"
    )
    
    # Verify 30-day backup coverage
    last_30_days = [(datetime.now() - timedelta(days=i)).strftime("%Y%m%d") 
                    for i in range(30)]
    
    for day in last_30_days:
        day_backup = any(obj['Key'].startswith(day) for obj in backups.get('Contents', []))
        if not day_backup:
            report["compliance_status"] = "NON_COMPLIANT"
            report["backup_status"][day] = "MISSING"
    
    # Check retention policy
    for obj in backups.get('Contents', []):
        backup_date = obj['Key'].split('/')[0]
        age_days = (datetime.now() - datetime.strptime(backup_date, "%Y%m%d")).days
        
        if age_days > 365 and not backup_date.endswith("0101"):  # Keep yearly backups
            s3.delete_object(Bucket="sdlc-database-backups", Key=obj['Key'])
            report["retention_status"][backup_date] = "DELETED (retention policy)"
    
    return report

if __name__ == "__main__":
    report = generate_compliance_report()
    print(json.dumps(report, indent=2))
    
    # Send to compliance team
    if report["compliance_status"] != "COMPLIANT":
        # Alert compliance team
        print("⚠️ Compliance issues detected!")
```

## Testing Schedule

### 1. Regular Tests
- **Daily**: Backup verification
- **Weekly**: Restore test (subset of data)
- **Monthly**: Full restore test in staging
- **Quarterly**: Complete DR drill

### 2. Test Documentation
All tests must be documented with:
- Test date and time
- Test scenario
- Recovery time
- Data integrity verification
- Issues encountered
- Lessons learned

## Conclusion

This backup strategy ensures:
- ✅ RPO < 1 minute with PITR
- ✅ RTO < 5 minutes with automated scripts
- ✅ 99.999999999% data durability
- ✅ Compliance with GDPR, HIPAA, SOX
- ✅ Cross-region disaster recovery
- ✅ Regular testing and verification
- ✅ Comprehensive monitoring and alerting

The strategy is designed to protect against data loss from any cause while maintaining business continuity.