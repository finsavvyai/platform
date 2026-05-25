# UPM.Plus Production Deployment Guide

## 🚀 Deploy UPM.Plus to Production (upm.plus)

This guide will walk you through deploying UPM.Plus to production using your domain `upm.plus`.

## 📋 Prerequisites

### Required Tools
- **kubectl** - Kubernetes CLI
- **helm** - Kubernetes package manager
- **docker** - Container runtime
- **kubectl access** to a Kubernetes cluster
- **Domain access** - Ability to configure DNS for `upm.plus`

### Required Resources
- **Kubernetes Cluster** (recommended: 3+ nodes, 8+ GB RAM each)
- **Load Balancer** support in your cluster
- **Persistent Storage** (SSD recommended)
- **Container Registry** access (GitHub Container Registry or similar)

### Required Credentials
- Domain: `upm.plus`
- Database password
- OpenAI API key
- JWT secret key
- Application secret key

## 🏗️ Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   upm.plus      │    │   www.upm.plus  │    │   app.upm.plus   │
│   (Frontend)    │    │   (Frontend)    │    │   (Frontend)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Ingress-Nginx          │
                    │   (SSL + Load Balancer)    │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │       Services              │
                    │  ┌─────────────────────────┐│
                    │  │   Frontend (React)      ││
                    │  │   Backend (FastAPI)     ││
                    │  │   PostgreSQL             ││
                    │  │   Redis                  ││
                    │  │   ChromaDB               ││
                    │  │   Monitoring Stack       ││
                    │  └─────────────────────────┘│
                    └─────────────────────────────┘
```

## 📝 Quick Deployment (One-Command)

If you have all prerequisites ready, you can deploy with a single command:

```bash
# Clone the repository
git clone https://github.com/your-org/upm-plus.git
cd upm-plus

# Run the production deployment script
./deployment/production/deploy-production.sh
```

The script will guide you through the entire deployment process.

## 🔧 Manual Deployment Steps

### Step 1: Prepare Your Environment

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/upm-plus.git
   cd upm-plus
   ```

2. **Verify kubectl Access**
   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```

3. **Check Available Storage Classes**
   ```bash
   kubectl get storageclass
   ```

### Step 2: Build and Push Docker Images

1. **Build Backend Image**
   ```bash
   cd backend
   docker build -t ghcr.io/your-org/upm-plus/backend:latest .
   docker push ghcr.io/your-org/upm-plus/backend:latest
   ```

2. **Build Frontend Image**
   ```bash
   cd frontend
   docker build -t ghcr.io/your-org/upm-plus/frontend:latest .
   docker push ghcr.io/your-org/upm-plus/frontend:latest
   ```

### Step 3: Deploy Infrastructure

1. **Create Namespace**
   ```bash
   kubectl create namespace upm-plus
   ```

2. **Install Cert-Manager**
   ```bash
   helm repo add jetstack https://charts.jetstack.io
   helm repo update
   helm install cert-manager jetstack/cert-manager \
     --namespace cert-manager \
     --create-namespace \
     --version v1.13.0 \
     --set installCRDs=true
   ```

3. **Install Ingress-Nginx**
   ```bash
   helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
   helm repo update
   helm install ingress-nginx ingress-nginx/ingress-nginx \
     --namespace ingress-nginx \
     --create-namespace \
     --set controller.service.type=LoadBalancer
   ```

### Step 4: Create Secrets

1. **Create Production Secrets**
   ```bash
   kubectl create secret generic upm-plus-production-secrets \
     --from-literal=DATABASE_URL="postgresql://upmplus:YOUR_DB_PASSWORD@postgres:5432/upmplus" \
     --from-literal=REDIS_URL="redis://redis:6379/0" \
     --from-literal=OPENAI_API_KEY="YOUR_OPENAI_KEY" \
     --from-literal=SECRET_KEY="YOUR_SECRET_KEY" \
     --from-literal=JWT_SECRET_KEY="YOUR_JWT_SECRET" \
     --namespace=upm-plus
   ```

### Step 5: Deploy Databases

1. **Deploy PostgreSQL**
   ```bash
   kubectl apply -f deployment/kubernetes/postgres.yaml -n upm-plus
   ```

2. **Deploy Redis**
   ```bash
   kubectl apply -f deployment/kubernetes/redis.yaml -n upm-plus
   ```

3. **Deploy ChromaDB**
   ```bash
   kubectl apply -f deployment/kubernetes/chromadb.yaml -n upm-plus
   ```

### Step 6: Deploy Application

1. **Deploy Backend**
   ```bash
   kubectl apply -f deployment/kubernetes/backend.yaml -n upm-plus
   kubectl apply -f deployment/kubernetes/celery-worker.yaml -n upm-plus
   ```

2. **Deploy Frontend**
   ```bash
   kubectl apply -f deployment/kubernetes/frontend.yaml -n upm-plus
   ```

### Step 7: Configure SSL and Ingress

1. **Deploy SSL Certificates**
   ```bash
   kubectl apply -f deployment/production/cert-manager-production.yaml -n upm-plus
   ```

2. **Configure Domain Ingress**
   ```bash
   kubectl apply -f deployment/production/upm.plus-domain.yaml -n upm-plus
   ```

### Step 8: Deploy Monitoring

```bash
kubectl apply -f deployment/kubernetes/monitoring.yaml -n upm-plus
```

### Step 9: Run Database Migrations

```bash
# Get backend pod name
BACKEND_POD=$(kubectl get pods -l app=upm-plus-backend -n upm-plus -o jsonpath='{.items[0].metadata.name}')

# Run migrations
kubectl exec ${BACKEND_POD} -n upm-plus -- alembic upgrade head
```

## 🌐 DNS Configuration

### Get LoadBalancer IP

```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Note the `EXTERNAL-IP` value.

### Configure DNS Records

Create the following DNS records in your domain registrar:

| Hostname | Type | Value |
|----------|------|-------|
| @ | A | [LOAD_BALANCER_IP] |
| www | CNAME | upm.plus |
| api | CNAME | upm.plus |
| app | CNAME | upm.plus |
| dashboard | CNAME | upm.plus |

For detailed DNS configuration instructions, see [deployment/production/dns-configuration.md](deployment/production/dns-configuration.md).

## ✅ Verification

### Check Deployment Status

```bash
# Check all pods
kubectl get pods -n upm-plus

# Check services
kubectl get services -n upm-plus

# Check ingress
kubectl get ingress -n upm-plus

# Check SSL certificate
kubectl get certificate -n upm-plus
```

### Test Application Access

```bash
# Test HTTPS connectivity
curl -I https://upm.plus
curl -I https://api.upm.plus/health
```

### Access Monitoring

```bash
# Access Grafana
kubectl port-forward svc/grafana 3000:3000 -n upm-plus
# Open http://localhost:3000 in your browser

# Access Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n upm-plus
# Open http://localhost:9090 in your browser
```

## 🚨 Troubleshooting

### Common Issues

1. **Pods Not Starting**
   ```bash
   kubectl describe pod [pod-name] -n upm-plus
   kubectl logs [pod-name] -n upm-plus
   ```

2. **SSL Certificate Not Issuing**
   ```bash
   kubectl describe certificate upm-plus-production-wildcard -n upm-plus
   kubectl logs -f deployment/cert-manager -n cert-manager
   ```

3. **DNS Not Resolving**
   - Verify DNS records are configured correctly
   - Check DNS propagation with online tools
   - Ensure LoadBalancer IP is correct

4. **Database Connection Issues**
   ```bash
   kubectl exec -it [postgres-pod] -n upm-plus -- psql -U upmplus -d upmplus
   ```

### Useful Commands

```bash
# Watch pod status
watch kubectl get pods -n upm-plus

# Get shell in a pod
kubectl exec -it [pod-name] -n upm-plus -- /bin/bash

# Port forward to local
kubectl port-forward svc/upm-plus-backend 8000:8000 -n upm-plus

# Check resource usage
kubectl top pods -n upm-plus

# Check events
kubectl get events -n upm-plus --sort-by='.lastTimestamp'
```

## 🔒 Security Configuration

The deployment includes:

- ✅ **HTTPS Only** - All traffic forced to SSL/TLS
- ✅ **Auto SSL Renewal** - Certificates auto-renew via cert-manager
- ✅ **Network Policies** - Restrict pod-to-pod communication
- ✅ **Pod Security Policies** - Enforce secure pod configurations
- ✅ **Rate Limiting** - Prevent abuse and DDoS attacks
- ✅ **Security Headers** - Additional HTTP security headers
- ✅ **Secrets Management** - Secure credential storage

## 📊 Monitoring and Logging

The deployment includes comprehensive monitoring:

- **Prometheus** - Metrics collection
- **Grafana** - Visualization and dashboards
- **AlertManager** - Alerting and notifications
- **Resource Monitoring** - CPU, memory, storage usage
- **Application Metrics** - Custom application metrics
- **Log Aggregation** - Centralized log collection

## 🔄 Backup and Recovery

### Automated Backups

```bash
# Create backup
kubectl create --from-literal=BACKUP_SCHEDULE="0 2 * * *" \
  configmap backup-config -n upm-plus

# Apply backup configuration
kubectl apply -f deployment/backup/
```

### Manual Backup

```bash
# Database backup
kubectl exec [postgres-pod] -n upm-plus -- pg_dump -U upmplus upmplus > backup.sql

# Restore backup
kubectl exec -i [postgres-pod] -n upm-plus -- psql -U upmplus upmplus < backup.sql
```

## 📈 Performance Optimization

### Resource Scaling

The deployment includes auto-scaling:

- **Horizontal Pod Autoscaler** - Scale based on CPU/memory
- **Cluster Autoscaler** - Scale cluster nodes
- **Resource Limits** - Prevent resource exhaustion

### Caching

- **Redis Cache** - Application-level caching
- **Browser Caching** - Static asset optimization
- **CDN Ready** - Easy CDN integration

## 🎯 Next Steps

After successful deployment:

1. **Test All Features** - Verify workflows, knowledge base, chat
2. **Set Up Alerts** - Configure monitoring alerts
3. **Performance Tuning** - Optimize based on usage
4. **Security Audit** - Perform security review
5. **User Onboarding** - Start user onboarding process
6. **Documentation** - Update internal documentation

## 🆘 Support

If you encounter issues:

1. **Check Logs**: `kubectl logs -f [pod-name] -n upm-plus`
2. **Review Events**: `kubectl get events -n upm-plus`
3. **Check Documentation**: [docs/README.md](docs/README.md)
4. **Create Issue**: [GitHub Issues](https://github.com/your-org/upm-plus/issues)

---

**🎉 Congratulations!** Your UPM.Plus instance is now running at https://upm.plus

For additional help, refer to the [troubleshooting guide](docs/troubleshooting.md) or contact support.