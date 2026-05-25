# UDP GCP Cost Optimization Guide

Comprehensive guide for minimizing costs while running UDP on Google Cloud Platform.

## Table of Contents

1. [Free Tier Strategy](#free-tier-strategy)
2. [Resource Optimization](#resource-optimization)
3. [Automated Cost Controls](#automated-cost-controls)
4. [Monitoring and Alerts](#monitoring-and-alerts)
5. [Emergency Procedures](#emergency-procedures)
6. [Long-term Strategies](#long-term-strategies)

## Free Tier Strategy

### Always Free Tier Resources

Google Cloud provides always-free resources that never expire:

#### Compute Engine
- **1 f1-micro instance** per month (US regions only)
- **30 GB HDD persistent disk**
- **5 GB snapshot storage**

#### Cloud Storage
- **5 GB standard storage** per month
- **5 GB Cloud Storage** (regional, US regions only)
- **1 GB egress** per month (to North America)

#### Cloud SQL
- **1 db-f1-micro instance** per month
- **30 GB storage**
- **7 backup storage**

#### Networking
- **1 GB egress** per month (to North America)
- **5 million queries** to Cloud DNS
- **HTTP(S) Load Balancing** (no charge for forwarding rules)

### $300 Credit Optimization

Use your $300 credit strategically:

1. **GKE Clusters**: Primary cost driver
2. **Redis**: Use Basic tier for cost savings
3. **Load Balancers**: Essential for production access
4. **Monitoring**: Full observability stack

### Cost Breakdown Example

```
Monthly costs (optimized):
┌─────────────────────┬──────────┬─────────┐
│ Service             │ Cost     │ Tier    │
├─────────────────────┼──────────┼─────────┤
│ GKE (1 e2-micro)    │ $24.27   │ Paid    │
│ Cloud SQL (f1-micro)│ $7.67    │ Free    │
│ Redis (1GB Basic)   │ $35.04   │ Paid    │
│ Load Balancer       │ $18.00   │ Paid    │
│ Storage (5GB)       │ $0.00    │ Free    │
│ Networking          │ $5.00    │ Partial │
├─────────────────────┼──────────┼─────────┤
│ Total               │ $89.98   │         │
└─────────────────────┴──────────┴─────────┘
```

## Resource Optimization

### Container Resource Limits

Optimize container resources to minimize costs:

```yaml
# API Container (optimized)
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "300m"

# Worker Container (minimal)
resources:
  requests:
    memory: "128Mi"
    cpu: "50m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### Cluster Optimization

```bash
# Use e2-micro instances (cheapest)
gcloud container clusters create udp-cluster \
  --machine-type=e2-micro \
  --num-nodes=1 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=2 \
  --preemptible

# Enable cluster autoscaling
gcloud container clusters update udp-cluster \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=2
```

### Storage Optimization

```bash
# Use standard storage class
kubectl patch storageclass standard \
  -p '{"allowVolumeExpansion": true}'

# Set up lifecycle policies
gsutil lifecycle set lifecycle.json gs://your-bucket
```

Example lifecycle policy:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
```

## Automated Cost Controls

### Horizontal Pod Autoscaling

Configure aggressive scaling policies:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: udp-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: udp-api
  minReplicas: 1  # Start minimal
  maxReplicas: 2  # Limit maximum
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80  # Higher threshold
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 60  # Quick scale down
```

### Scheduled Scaling

Automatically scale during off-hours:

```yaml
# Evening scale-down (6 PM)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: evening-scaledown
spec:
  schedule: "0 18 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: scaler
            image: bitnami/kubectl
            command:
            - kubectl
            - scale
            - deployment
            - udp-api
            - --replicas=0
```

### Resource Quotas

Prevent resource sprawl:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: udp-quota
spec:
  hard:
    requests.cpu: "1"
    requests.memory: 2Gi
    limits.cpu: "2"
    limits.memory: 4Gi
    persistentvolumeclaims: "3"
    pods: "10"
```

### Cluster Autoscaling

Configure aggressive node scaling:

```bash
# Update cluster for aggressive scaling
gcloud container clusters update udp-cluster \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=2 \
  --enable-autorepair \
  --enable-autoupgrade
```

## Monitoring and Alerts

### Cost Monitoring Script

Use the provided cost monitoring:

```bash
# Check current costs
./scripts/check-costs.sh

# Set up alerts
./scripts/check-costs.sh --setup-alerts

# Generate reports
./scripts/check-costs.sh --report-only
```

### Budget Alerts

Set up budget alerts in Google Cloud Console:

1. Navigate to **Billing > Budgets & alerts**
2. Create budget with these thresholds:
   - 50% of budget: Email alert
   - 80% of budget: Email + Slack alert
   - 100% of budget: Email + automatic scale-down

### Real-time Monitoring

Monitor costs in real-time:

```bash
# Custom monitoring script
#!/bin/bash
THRESHOLD=50.00
CURRENT_COST=$(gcloud beta billing projects describe $PROJECT --format="value(billingAccountName)" | xargs gcloud beta billing accounts describe --format="value(currentSpend.amount)")

if (( $(echo "$CURRENT_COST > $THRESHOLD" | bc -l) )); then
  echo "ALERT: Current costs ($CURRENT_COST) exceed threshold ($THRESHOLD)"
  # Scale down immediately
  kubectl scale deployment --all --replicas=0 -n udp
fi
```

## Emergency Procedures

### Immediate Cost Reduction

If costs spike unexpectedly:

```bash
# 1. Scale to zero immediately
kubectl scale deployment --all --replicas=0 -n udp

# 2. Check what's consuming resources
kubectl top nodes
kubectl top pods --all-namespaces

# 3. Delete expensive resources
kubectl delete hpa --all -n udp
kubectl delete pvc --all -n udp

# 4. Scale cluster to minimum
gcloud container clusters resize udp-cluster --num-nodes=1
```

### Emergency Cleanup

Complete resource cleanup:

```bash
# Use the cleanup script with force flag
./scripts/cleanup-resources.sh true
```

### Partial Cleanup

Remove only expensive components:

```bash
# Delete Redis (most expensive)
gcloud redis instances delete udp-redis --region=us-central1

# Delete load balancer
kubectl delete ingress udp-ingress -n udp

# Use NodePort for temporary access
kubectl patch service udp-api-service -n udp -p '{"spec":{"type":"NodePort"}}'
```

## Long-term Strategies

### Committed Use Discounts

For sustained workloads (after free credits):

```bash
# Purchase 1-year committed use discount
gcloud compute commitments create udp-commitment \
  --plan=12-month \
  --resources=vcpu=1,memory=1GB \
  --region=us-central1
```

### Preemptible Instances

Use preemptible instances for fault-tolerant workloads:

```bash
# Create preemptible node pool
gcloud container node-pools create preemptible-pool \
  --cluster=udp-cluster \
  --machine-type=e2-micro \
  --preemptible \
  --num-nodes=1 \
  --enable-autoscaling \
  --min-nodes=0 \
  --max-nodes=2
```

### Multi-region Strategy

Optimize by region:

```bash
# Use cheapest regions
REGIONS=("us-central1" "us-east1" "us-west1")

# Deploy to cheapest available region
for region in "${REGIONS[@]}"; do
  if gcloud compute zones list --filter="region:$region" --limit=1 &>/dev/null; then
    echo "Using region: $region"
    export GOOGLE_CLOUD_REGION=$region
    break
  fi
done
```

### Storage Tiering

Implement intelligent storage tiering:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90, "matchesStorageClass": ["NEARLINE"]}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"},
        "condition": {"age": 365, "matchesStorageClass": ["COLDLINE"]}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 2555}  # 7 years
      }
    ]
  }
}
```

### Network Optimization

Minimize egress costs:

```bash
# Use regional load balancers
gcloud compute addresses create udp-regional-ip \
  --region=us-central1

# Configure CDN for static content
gcloud compute backend-buckets create udp-static-content \
  --gcs-bucket-name=udp-static-assets

# Enable compression
kubectl annotate ingress udp-ingress -n udp \
  cloud.google.com/backend-config='{"default": "udp-backend-config"}'
```

### Development vs Production

Separate environments for cost control:

```bash
# Development environment (minimal)
./scripts/deploy-udp.sh --environment=development --replicas=1

# Production environment (scaled)
./scripts/deploy-udp.sh --environment=production --replicas=3
```

### Automated Cleanup

Set up automated cleanup for abandoned resources:

```yaml
# Cleanup CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: resource-cleanup
spec:
  schedule: "0 2 * * SUN"  # Weekly cleanup
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: google/cloud-sdk:alpine
            command:
            - /bin/bash
            - -c
            - |
              # Delete old images
              gcloud container images list-tags gcr.io/$PROJECT_ID/udp \
                --limit=999999 --sort-by=~TIMESTAMP \
                --format="get(digest)" --filter="timestamp.datetime < -P30D" \
                | xargs -I {} gcloud container images delete "gcr.io/$PROJECT_ID/udp@{}" --quiet

              # Clean up old snapshots
              gcloud compute snapshots list --filter="creationTimestamp < -P7D" \
                --format="value(name)" | xargs -r gcloud compute snapshots delete --quiet
```

### Cost Optimization Checklist

Daily:
- [ ] Check current spend: `./scripts/check-costs.sh`
- [ ] Review resource usage: `kubectl top nodes && kubectl top pods -n udp`
- [ ] Verify autoscaling is working: `kubectl get hpa -n udp`

Weekly:
- [ ] Review billing dashboard
- [ ] Clean up unused resources
- [ ] Optimize container resource requests
- [ ] Check for new free tier offerings

Monthly:
- [ ] Analyze cost trends
- [ ] Review committed use discounts
- [ ] Optimize storage lifecycle policies
- [ ] Update cost monitoring thresholds

This guide ensures you can run UDP cost-effectively while maintaining production-ready capabilities.