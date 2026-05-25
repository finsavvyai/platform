# UDP Google Cloud Platform Deployment

Complete GCP deployment setup for Universal Dependency Platform (UDP) optimized for Google Cloud's free tier.

## 🚀 Quick Start

1. **Prerequisites Setup**:
   ```bash
   # Run the setup script
   ./scripts/setup-gcp.sh
   ```

2. **Deploy UDP**:
   ```bash
   # One-command deployment
   ./scripts/deploy-udp.sh
   ```

3. **Configure teddk**:
   ```bash
   # Get connection details
   ./scripts/get-connection-info.sh
   ```

## 📋 What's Included

### 🔧 Setup Scripts
- `setup-gcp.sh` - GCP account setup and authentication
- `configure-project.sh` - Project creation and API enablement
- `create-service-accounts.sh` - Service account creation with minimal permissions

### 🚀 Deployment
- `deploy-udp.sh` - One-command deployment script
- `cleanup-resources.sh` - Cost control cleanup
- `scale-down.sh` - Scale to minimal resources
- `scale-up.sh` - Scale for production use

### 📊 Monitoring & Cost Control
- `setup-cost-monitoring.sh` - Budget alerts and monitoring
- `check-costs.sh` - Real-time cost checking
- `optimize-resources.sh` - Resource optimization

### 🔗 Integration
- `configure-teddk.sh` - teddk integration setup
- `test-deployment.sh` - End-to-end testing

## 💰 Free Tier Optimization

### Always Free Resources Used:
- **Compute Engine**: 1 f1-micro instance (744 hours/month)
- **Cloud Storage**: 5 GB standard storage
- **Cloud SQL**: 1 db-f1-micro instance (30 GB storage)
- **Container Registry**: Private storage included
- **Cloud Build**: 120 build-minutes/day
- **Networking**: 1 GB egress to North America/month

### $300 Credit Resources:
- **GKE**: 1 node cluster (optimized for cost)
- **Load Balancer**: HTTP(S) load balancing
- **Cloud Monitoring**: Full observability stack
- **Cloud Logging**: Centralized logging

## 📁 Directory Structure

```
src/udp/cloud/gcp/
├── README.md                     # This file
├── scripts/                      # Deployment scripts
│   ├── setup-gcp.sh             # Initial GCP setup
│   ├── configure-project.sh     # Project configuration
│   ├── create-service-accounts.sh # Service accounts
│   ├── deploy-udp.sh            # Main deployment
│   ├── cleanup-resources.sh     # Resource cleanup
│   ├── setup-cost-monitoring.sh # Cost monitoring
│   ├── check-costs.sh           # Cost checking
│   ├── configure-teddk.sh       # teddk integration
│   ├── test-deployment.sh       # Testing
│   ├── scale-down.sh            # Scale down
│   ├── scale-up.sh              # Scale up
│   └── get-connection-info.sh   # Connection details
├── manifests/                    # Kubernetes manifests
│   ├── namespace.yaml           # UDP namespace
│   ├── configmap.yaml           # Configuration
│   ├── secrets.yaml             # Secrets template
│   ├── postgresql.yaml          # PostgreSQL deployment
│   ├── redis.yaml               # Redis deployment
│   ├── udp-api.yaml             # UDP API deployment
│   ├── udp-workers.yaml         # Background workers
│   ├── ingress.yaml             # Load balancer
│   ├── hpa.yaml                 # Horizontal Pod Autoscaler
│   ├── pdb.yaml                 # Pod Disruption Budget
│   └── monitoring.yaml          # Monitoring stack
├── configs/                      # Configuration files
│   ├── cluster-config.yaml      # GKE cluster config
│   ├── cost-monitoring.yaml     # Budget configuration
│   ├── service-account-roles.yaml # IAM roles
│   └── network-policies.yaml    # Network security
└── docs/                        # Documentation
    ├── deployment-guide.md      # Detailed deployment guide
    ├── troubleshooting.md       # Common issues
    ├── cost-optimization.md     # Cost optimization tips
    └── teddk-integration.md     # teddk setup guide
```

## 🛡️ Security Features

- **Least Privilege IAM**: Minimal required permissions
- **Network Policies**: Pod-to-pod communication control
- **Secret Management**: Secure credential handling
- **Pod Security Standards**: Restricted security contexts
- **HTTPS Only**: TLS termination at load balancer

## 📈 Monitoring & Observability

- **Cost Monitoring**: Real-time cost tracking and alerts
- **Health Checks**: Comprehensive application monitoring
- **Log Aggregation**: Centralized logging with Cloud Logging
- **Metrics**: Prometheus-compatible metrics
- **Alerting**: Automated incident response

## 🔄 CI/CD Integration

- **Cloud Build**: Automated builds and deployments
- **Container Registry**: Private image storage
- **GitOps Ready**: Integration with GitOps workflows
- **Environment Promotion**: Dev → Staging → Production

## 📞 Support

For issues or questions:
1. Check `docs/troubleshooting.md`
2. Run diagnostic scripts in `scripts/`
3. Review GCP logs and monitoring

## 🏷️ Resource Tagging

All resources are tagged with:
- `project`: udp
- `environment`: production/staging/development
- `component`: api/database/cache/monitoring
- `cost-center`: engineering
- `auto-shutdown`: true/false

This enables precise cost tracking and automated resource management.