# UDP Google Cloud Platform Deployment Package

Complete GCP deployment solution for Universal Dependency Platform (UDP) optimized for Google Cloud's free tier.

## 🚀 Quick Start

```bash
# Navigate to GCP deployment directory
cd src/udp/cloud/gcp

# Run complete deployment (interactive)
./scripts/setup-gcp.sh
./scripts/configure-project.sh
./scripts/create-service-accounts.sh
./scripts/deploy-udp.sh

# Configure teddk integration
./scripts/configure-teddk.sh

# Verify deployment
kubectl get pods -n udp
```

## 📦 Package Contents

### 🔧 Setup Scripts (`scripts/`)

| Script | Purpose | Execution Time |
|--------|---------|----------------|
| `setup-gcp.sh` | Initial GCP setup, authentication, project creation | 5-10 min |
| `configure-project.sh` | Infrastructure setup (VPC, GKE, databases) | 15-20 min |
| `create-service-accounts.sh` | IAM setup with minimal permissions | 5 min |
| `deploy-udp.sh` | Complete application deployment | 20-30 min |
| `configure-teddk.sh` | teddk CLI integration setup | 5 min |

### 📊 Management Scripts

| Script | Purpose |
|--------|---------|
| `check-costs.sh` | Real-time cost monitoring and alerts |
| `scale-down.sh` | Cost optimization (70% savings) |
| `scale-up.sh` | Restore full capacity |
| `cleanup-resources.sh` | Complete resource cleanup |

### 🎯 Kubernetes Manifests (`manifests/`)

| File | Components |
|------|------------|
| `namespace.yaml` | Namespace, network policies, resource quotas |
| `configmap.yaml` | Application configuration, CORS settings |
| `secrets.yaml` | Secret templates for secure credential management |
| `postgresql.yaml` | Cloud SQL proxy, database initialization |
| `redis.yaml` | Redis proxy, monitoring exporter |
| `udp-api.yaml` | Main API deployment, services, backend config |
| `udp-workers.yaml` | Background workers, scheduler |
| `ingress.yaml` | Load balancer, SSL, security policies |
| `hpa.yaml` | Horizontal/vertical pod autoscaling |
| `pdb.yaml` | Pod disruption budgets |
| `monitoring.yaml` | Prometheus, Grafana, alerting rules |

### 📚 Documentation (`docs/`)

| Document | Content |
|----------|---------|
| `deployment-guide.md` | Comprehensive step-by-step deployment guide |
| `cost-optimization.md` | Detailed cost management strategies |
| `teddk-integration.md` | Complete teddk integration guide |
| `troubleshooting.md` | Common issues and solutions |

## 💰 Cost Optimization Features

### Free Tier Maximization

- **Compute**: e2-micro instances (744 hours/month free)
- **Storage**: 5GB Cloud Storage (always free)
- **Database**: db-f1-micro PostgreSQL (always free)
- **Networking**: Optimized for 1GB egress limit

### Cost Control Mechanisms

1. **Automated Scaling**: HPA with aggressive scale-down policies
2. **Scheduled Scaling**: Automatic off-hours scaling (6PM-8AM)
3. **Resource Quotas**: Prevents runaway resource usage
4. **Preemptible Nodes**: 80% cost savings on compute
5. **Storage Lifecycle**: Automatic tiering and cleanup

### Monitoring & Alerts

- Real-time cost tracking with `check-costs.sh`
- Budget alerts at 50%, 80%, and 100% thresholds
- Automatic emergency scaling when costs spike
- Detailed cost breakdowns by service

## 🔒 Security Features

### IAM & Access Control

- **Least Privilege**: Minimal required permissions for each service account
- **Workload Identity**: Secure pod-to-GCP authentication
- **Custom Roles**: Fine-grained access control
- **Secret Management**: Google Secret Manager integration

### Network Security

- **VPC Isolation**: Private networking with controlled ingress
- **Network Policies**: Pod-to-pod communication restrictions
- **Cloud Armor**: DDoS protection and security policies
- **TLS Termination**: HTTPS enforcement at load balancer

### Runtime Security

- **Pod Security Standards**: Restricted security contexts
- **Read-only Root Filesystems**: Container immutability
- **Non-root Users**: All containers run as non-root
- **Resource Limits**: CPU and memory constraints

## 📈 Production-Ready Features

### High Availability

- **Multi-zone Deployment**: Automatic zone distribution
- **Pod Disruption Budgets**: Controlled maintenance windows
- **Health Checks**: Comprehensive liveness/readiness probes
- **Circuit Breakers**: Fault tolerance patterns

### Observability

- **Prometheus Metrics**: Application and infrastructure monitoring
- **Structured Logging**: JSON logs with correlation IDs
- **Distributed Tracing**: OpenTelemetry integration
- **Custom Dashboards**: Grafana dashboards for UDP metrics

### Data Management

- **Automated Backups**: Cloud SQL daily backups
- **Database Migrations**: Alembic integration
- **Storage Lifecycle**: Automated data tiering
- **Disaster Recovery**: Cross-region backup strategies

## 🔗 teddk Integration

### Quick Setup

```bash
# Automatic configuration
./scripts/configure-teddk.sh

# Manual testing
cd /tmp/teddk-sample-project
teddk scan
teddk report --format html
```

### Features

- **Multi-ecosystem Support**: npm, pip, maven, cargo, nuget, go
- **Policy Enforcement**: Custom vulnerability and license policies
- **CI/CD Integration**: GitHub Actions, GitLab CI, Jenkins
- **Workflow Automation**: Integration with UDP's workflow engine

### Helper Scripts

- `~/.teddk/start-udp-tunnel.sh` - Local port forwarding
- `~/.teddk/stop-udp-tunnel.sh` - Stop port forwarding
- `~/.teddk/udp-status.sh` - Check deployment status

## 🎛️ Resource Requirements

### Minimum Configuration (Free Tier)

```
CPU: 1 vCPU (e2-micro)
Memory: 1 GB
Storage: 10 GB SSD
Network: 1 GB egress/month
Estimated Cost: $0-5/month
```

### Recommended Configuration

```
CPU: 2 vCPU
Memory: 4 GB
Storage: 20 GB SSD
Network: 5 GB egress/month
Estimated Cost: $25-40/month
```

### Production Configuration

```
CPU: 4 vCPU
Memory: 8 GB
Storage: 50 GB SSD
Network: 20 GB egress/month
Estimated Cost: $80-120/month
```

## 🛠️ Management Commands

### Daily Operations

```bash
# Check system health
kubectl get pods -n udp
~/.teddk/udp-status.sh

# Monitor costs
./scripts/check-costs.sh

# View logs
kubectl logs -l app=udp,component=api -n udp --tail=100
```

### Scaling Operations

```bash
# Scale down for cost savings
./scripts/scale-down.sh

# Scale up for production load
./scripts/scale-up.sh

# Manual scaling
kubectl scale deployment udp-api --replicas=3 -n udp
```

### Maintenance

```bash
# Update application
kubectl set image deployment/udp-api udp-api=gcr.io/$PROJECT/udp:new-tag -n udp

# Database maintenance
kubectl exec -it deployment/udp-cloudsql-proxy -n udp -- psql -h localhost -U udp -d udp

# Backup creation
gcloud sql export sql udp-postgres gs://$PROJECT-udp-storage/backup-$(date +%Y%m%d).sql
```

## 🆘 Emergency Procedures

### High Costs

```bash
# Immediate scale down
kubectl scale deployment --all --replicas=0 -n udp

# Check what's expensive
./scripts/check-costs.sh

# Emergency cleanup
./scripts/cleanup-resources.sh true
```

### System Failure

```bash
# Check cluster health
gcloud container clusters describe udp-cluster --region=us-central1

# Restart failed pods
kubectl delete pod -l app=udp -n udp

# Full redeployment
./scripts/deploy-udp.sh
```

### Data Recovery

```bash
# Restore from backup
gcloud sql import sql udp-postgres gs://$PROJECT-udp-storage/backup-latest.sql

# Recreate from manifests
kubectl apply -f manifests/
```

## 📋 Deployment Checklist

### Pre-deployment

- [ ] Google Cloud account with $300 credits
- [ ] Billing account configured
- [ ] `gcloud`, `kubectl`, `docker` installed
- [ ] Project quota sufficient for resources

### Deployment

- [ ] Run `setup-gcp.sh` successfully
- [ ] Run `configure-project.sh` successfully
- [ ] Run `create-service-accounts.sh` successfully
- [ ] Run `deploy-udp.sh` successfully
- [ ] Verify pods are running: `kubectl get pods -n udp`
- [ ] Test API health: `curl http://EXTERNAL_IP/health`

### Post-deployment

- [ ] Configure teddk: `./scripts/configure-teddk.sh`
- [ ] Set up cost monitoring: `./scripts/check-costs.sh --setup-alerts`
- [ ] Test full workflow: `teddk scan` in sample project
- [ ] Configure backup schedule
- [ ] Set up CI/CD integration

### Production Readiness

- [ ] Domain name configured and DNS updated
- [ ] SSL certificates installed
- [ ] Monitoring alerts configured
- [ ] Backup and recovery procedures tested
- [ ] Security scanning completed
- [ ] Performance testing completed

## 🎯 Next Steps

1. **Domain Setup**: Configure your domain to point to the load balancer IP
2. **SSL Configuration**: Set up managed SSL certificates
3. **Monitoring**: Configure alerting for your team
4. **CI/CD**: Integrate with your existing pipelines
5. **Scaling**: Optimize for your actual usage patterns

## 📞 Support

- **Documentation**: Complete guides in `docs/` directory
- **Troubleshooting**: Common issues and solutions included
- **Cost Monitoring**: Built-in tools for cost management
- **Community**: GitHub issues for community support

This deployment package provides everything needed to run UDP on GCP cost-effectively while maintaining enterprise-grade reliability and security.