# UDP Google Cloud Platform Deployment Guide

Complete step-by-step guide for deploying Universal Dependency Platform (UDP) on Google Cloud Platform, optimized for the free tier and cost-effective operation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Cost Optimization](#cost-optimization)
5. [teddk Integration](#teddk-integration)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Google Cloud SDK (gcloud)**: Latest version
  ```bash
  curl https://sdk.cloud.google.com | bash
  exec -l $SHELL
  gcloud init
  ```

- **kubectl**: Kubernetes command-line tool
  ```bash
  gcloud components install kubectl
  ```

- **Docker**: For building container images
  ```bash
  # Install Docker Desktop or Docker Engine
  # Verify installation
  docker --version
  ```

### Google Cloud Account

1. **Create GCP Account**: Visit [cloud.google.com](https://cloud.google.com)
2. **Activate Free Tier**: Get $300 free credits + always-free tier
3. **Billing Account**: Set up billing (required even for free tier)

### Local Environment

- **Operating System**: Linux, macOS, or Windows (with WSL2)
- **RAM**: Minimum 4GB, recommended 8GB
- **Disk Space**: At least 10GB free
- **Network**: Stable internet connection

## Quick Start

For experienced users who want to deploy immediately:

```bash
# Clone the repository
git clone <repository-url>
cd UPM/src/udp/cloud/gcp

# Make scripts executable
chmod +x scripts/*.sh

# Run complete setup (interactive)
./scripts/setup-gcp.sh
./scripts/configure-project.sh
./scripts/create-service-accounts.sh
./scripts/deploy-udp.sh

# Configure teddk integration
./scripts/configure-teddk.sh

# Check deployment
kubectl get pods -n udp
```

## Detailed Setup

### Step 1: Initial GCP Setup

Run the GCP setup script:

```bash
./scripts/setup-gcp.sh
```

This script will:
- Authenticate with Google Cloud
- Create or select a project
- Enable required APIs
- Set up billing configuration
- Configure default settings

**Expected time**: 5-10 minutes

### Step 2: Infrastructure Configuration

Configure the GCP infrastructure:

```bash
./scripts/configure-project.sh
```

This creates:
- VPC network and subnets
- GKE cluster (free tier optimized)
- Cloud SQL PostgreSQL instance
- Redis instance
- Cloud Storage bucket
- Networking and security rules

**Expected time**: 15-20 minutes

### Step 3: Service Accounts and IAM

Set up service accounts with minimal permissions:

```bash
./scripts/create-service-accounts.sh
```

This configures:
- Service accounts for API, workers, monitoring, backup
- IAM roles with least privilege
- Workload Identity bindings
- Kubernetes service accounts
- Application secrets

**Expected time**: 5 minutes

### Step 4: Application Deployment

Deploy the UDP application:

```bash
./scripts/deploy-udp.sh
```

This process:
- Builds and pushes container images
- Creates Kubernetes secrets from Google Secret Manager
- Deploys all application components
- Sets up ingress and load balancing
- Configures monitoring
- Runs health checks

**Expected time**: 20-30 minutes

### Step 5: teddk Integration

Configure teddk to use your UDP deployment:

```bash
./scripts/configure-teddk.sh
```

This sets up:
- teddk CLI configuration
- Authentication tokens
- Sample project for testing
- Integration scripts
- Local tunneling (if needed)

**Expected time**: 5 minutes

## Cost Optimization

### Free Tier Limits

The deployment is designed to stay within Google Cloud's free tier:

- **Compute Engine**: 1 f1-micro instance per month
- **Cloud Storage**: 5 GB standard storage
- **Cloud SQL**: 1 db-f1-micro instance
- **Network Egress**: 1 GB per month (North America)
- **Container Registry**: Private repository storage
- **Cloud Build**: 120 build-minutes per day

### Cost Monitoring

Monitor your costs regularly:

```bash
# Check current costs and usage
./scripts/check-costs.sh

# Set up billing alerts
./scripts/check-costs.sh --setup-alerts

# Generate detailed cost report
./scripts/check-costs.sh --report-only
```

### Scaling for Cost Savings

Scale down during development/testing:

```bash
# Reduce to minimal resources
./scripts/scale-down.sh

# Scale back up when needed
./scripts/scale-up.sh
```

### Automatic Cost Controls

The deployment includes automatic cost controls:

- **Scheduled Scaling**: Scales down evenings and weekends
- **Resource Quotas**: Prevents runaway resource usage
- **Cluster Autoscaling**: Automatically adjusts node count
- **Preemptible Instances**: Uses cheaper preemptible VMs

## teddk Integration

### Configuration

After running `configure-teddk.sh`, your teddk configuration will be at `~/.teddk/config.yaml`:

```yaml
api:
  endpoint: "http://your-udp-endpoint"
  version: "v1"
  timeout: 30

auth:
  type: "bearer"
  token: "your-api-token"

project:
  name: "My UDP Project"
  organization: "default"

policies:
  vulnerability:
    fail_on_critical: true
    fail_on_high: false
```

### Usage Examples

```bash
# Scan current directory
teddk scan

# Scan specific package file
teddk scan --file package.json

# Generate detailed report
teddk report --format html --output report.html

# Check policy compliance
teddk policy check

# List vulnerabilities only
teddk scan --vuln-only
```

### Local Development

For local development, use port forwarding:

```bash
# Start tunnel to UDP API
~/.teddk/start-udp-tunnel.sh

# Use teddk normally
teddk scan

# Stop tunnel
~/.teddk/stop-udp-tunnel.sh
```

## Monitoring & Maintenance

### Health Monitoring

Check deployment health:

```bash
# Overall status
kubectl get pods -n udp

# Detailed pod information
kubectl describe pods -n udp

# View logs
kubectl logs -l app=udp,component=api -n udp --tail=100

# Check ingress status
kubectl get ingress -n udp
```

### Performance Monitoring

Monitor resource usage:

```bash
# Pod resource usage
kubectl top pods -n udp

# Node resource usage
kubectl top nodes

# Horizontal Pod Autoscaler status
kubectl get hpa -n udp
```

### Database Maintenance

```bash
# Connect to PostgreSQL
kubectl exec -it deployment/udp-cloudsql-proxy -n udp -- \
  psql -h localhost -U udp -d udp

# Check database size
kubectl exec -it deployment/udp-cloudsql-proxy -n udp -- \
  psql -h localhost -U udp -d udp -c "SELECT pg_size_pretty(pg_database_size('udp'));"

# Run database migrations
kubectl exec -it deployment/udp-api -n udp -- alembic upgrade head
```

### Backup and Recovery

```bash
# Create database backup
gcloud sql export sql udp-postgres gs://your-project-udp-storage/backup-$(date +%Y%m%d).sql --database=udp

# Create cluster backup
gcloud container clusters describe udp-cluster --region=us-central1 > cluster-backup.yaml

# Export Kubernetes resources
kubectl get all -n udp -o yaml > udp-resources-backup.yaml
```

### Updates and Upgrades

```bash
# Update container image
kubectl set image deployment/udp-api udp-api=gcr.io/your-project/udp:new-tag -n udp

# Rolling restart
kubectl rollout restart deployment/udp-api -n udp

# Check rollout status
kubectl rollout status deployment/udp-api -n udp

# Rollback if needed
kubectl rollout undo deployment/udp-api -n udp
```

## Troubleshooting

### Common Issues

#### 1. Pod Stuck in Pending State

```bash
# Check node resources
kubectl describe nodes

# Check events
kubectl get events -n udp --sort-by='.lastTimestamp'

# Solution: Scale down or add nodes
kubectl scale deployment udp-api --replicas=1 -n udp
```

#### 2. Database Connection Issues

```bash
# Check Cloud SQL proxy
kubectl logs deployment/udp-cloudsql-proxy -n udp

# Check secrets
kubectl get secrets -n udp

# Test database connection
kubectl exec -it deployment/udp-cloudsql-proxy -n udp -- \
  pg_isready -h localhost -p 5432
```

#### 3. High Costs

```bash
# Check resource usage
./scripts/check-costs.sh

# Scale down immediately
./scripts/scale-down.sh

# Emergency cleanup
./scripts/cleanup-resources.sh
```

#### 4. Load Balancer Issues

```bash
# Check ingress status
kubectl describe ingress udp-ingress -n udp

# Check backend services
gcloud compute backend-services list

# Check firewall rules
gcloud compute firewall-rules list --filter="name~udp"
```

### Diagnostic Commands

```bash
# Complete system status
~/.teddk/udp-status.sh

# Resource usage summary
kubectl describe nodes | grep -A 5 "Allocated resources"

# Network connectivity test
kubectl run test-pod --image=busybox --rm -it -- \
  nslookup udp-api-service.udp.svc.cluster.local

# Certificate and TLS issues
kubectl describe ingress udp-ingress -n udp | grep -A 10 "Events"
```

### Getting Help

1. **Check Logs**: Always start with application and system logs
2. **Resource Constraints**: Verify CPU, memory, and storage limits
3. **Network Issues**: Test connectivity between components
4. **Permissions**: Verify IAM roles and service account permissions
5. **Quotas**: Check if you've hit GCP quotas or limits

### Support Resources

- **GCP Documentation**: [cloud.google.com/docs](https://cloud.google.com/docs)
- **Kubernetes Documentation**: [kubernetes.io/docs](https://kubernetes.io/docs)
- **UDP GitHub Issues**: [Repository Issues](https://github.com/your-repo/issues)
- **GCP Support**: Available with paid support plans

### Emergency Procedures

#### Complete System Failure

```bash
# 1. Check cluster status
gcloud container clusters describe udp-cluster --region=us-central1

# 2. Recreate from backup
kubectl apply -f udp-resources-backup.yaml

# 3. Restore database
gcloud sql import sql udp-postgres gs://your-project-udp-storage/backup-latest.sql --database=udp

# 4. Verify deployment
kubectl get pods -n udp
```

#### Cost Emergency

```bash
# Immediate scale down
kubectl scale deployment --all --replicas=0 -n udp

# Or complete cleanup
./scripts/cleanup-resources.sh true
```

This deployment guide provides a comprehensive foundation for running UDP on Google Cloud Platform with cost optimization and production-ready practices.