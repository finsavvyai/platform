#!/bin/bash

# Simple UDP Google Cloud Deployment Script
# This script deploys UDP to Google Cloud using existing project

set -e

# Detect shell and set appropriate configuration file
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    SHELL_CONFIG="$HOME/.profile"
fi

echo "🚀 Starting UDP deployment to Google Cloud..."

# Check prerequisites
command -v gcloud >/dev/null 2>&1 || {
    echo "❌ gcloud CLI not found. Checking for existing installation..."
    
    # Check if Google Cloud SDK is installed but not in PATH
    if [ -d "$HOME/google-cloud-sdk" ]; then
        echo "📝 Google Cloud SDK found, adding to PATH..."
        export PATH="$HOME/google-cloud-sdk/bin:$PATH"
    else
        echo "❌ Installing Google Cloud SDK..."
        curl https://sdk.cloud.google.com | bash
        export PATH="$HOME/google-cloud-sdk/bin:$PATH"
    fi
}

# Configuration
PROJECT_ID="${PROJECT_ID:-udp-project-1758298429}"  # Use existing project by default
REGION="us-central1"
ZONE="us-central1-c"  # Try a different zone
CLUSTER_NAME="udp-cluster"
NAMESPACE="udp"

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Zone: $ZONE"
echo "  Cluster: $CLUSTER_NAME"

# Set project
echo "🔧 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable container.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Step 3: Create GKE cluster with minimal configuration
echo "☸️ Creating GKE cluster..."

# Delete existing cluster if it exists and is in error state
EXISTING_CLUSTER=$(gcloud container clusters list --filter="name:$CLUSTER_NAME" --format="value(name)" 2>/dev/null || echo "")
if [ ! -z "$EXISTING_CLUSTER" ]; then
    echo "⚠️  Cluster $CLUSTER_NAME already exists. Deleting it..."
    gcloud container clusters delete $CLUSTER_NAME --zone=$ZONE --quiet || true
fi

# Create cluster with minimal configuration
echo "🆕 Creating new cluster..."
gcloud container clusters create $CLUSTER_NAME \
    --zone=$ZONE \
    --machine-type=e2-small \
    --num-nodes=1 \
    --disk-size=20GB \
    --disk-type=pd-standard \
    --no-enable-cloud-logging \
    --no-enable-cloud-monitoring \
    --no-enable-autorepair \
    --no-enable-autoupgrade

# Get cluster credentials
gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE

# Step 4: Build and push UDP image
echo "🐳 Building UDP Docker image..."
docker build -t gcr.io/$PROJECT_ID/udp:latest .
docker push gcr.io/$PROJECT_ID/udp:latest

# Step 5: Deploy to Kubernetes
echo "☸️ Deploying UDP to Kubernetes..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create basic deployment
cat << EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: udp-api
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: udp-api
  template:
    metadata:
      labels:
        app: udp-api
    spec:
      containers:
      - name: udp-api
        image: gcr.io/$PROJECT_ID/udp:latest
        ports:
        - containerPort: 8040
        env:
        - name: DATABASE_URL
          value: "sqlite:///tmp/udp.db"
        - name: REDIS_URL
          value: "redis://localhost:6379"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: udp-service
  namespace: $NAMESPACE
spec:
  selector:
    app: udp-api
  ports:
  - port: 80
    targetPort: 8040
  type: LoadBalancer
EOF

# Step 6: Wait for deployment and get external IP
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/udp-api -n $NAMESPACE

echo "🌐 Getting external IP..."
EXTERNAL_IP=""
while [ -z $EXTERNAL_IP ]; do
  EXTERNAL_IP=$(kubectl get svc udp-service -n $NAMESPACE --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
  [ -z "$EXTERNAL_IP" ] && sleep 10
done

echo "✅ UDP deployed successfully!"
echo "🔗 UDP Service URL: http://$EXTERNAL_IP"
echo "📋 Project ID: $PROJECT_ID"

# Save configuration for teddk
cat > udp-config.env << EOF
UDP_SERVICE_URL=http://$EXTERNAL_IP
UDP_PROJECT_ID=$PROJECT_ID
UDP_CLUSTER_NAME=$CLUSTER_NAME
UDP_REGION=$REGION
EOF

echo "💾 Configuration saved to udp-config.env"
echo "🎯 Next steps:"
echo "1. Test UDP: curl http://$EXTERNAL_IP/health"
echo "2. Configure teddk to use UDP service"
echo "3. Run your first cross-language build!"

# Test the deployment
echo "🧪 Testing UDP deployment..."
if curl -f http://$EXTERNAL_IP/health; then
    echo "✅ UDP is responding correctly!"
else
    echo "❌ UDP deployment may have issues. Check logs with:"
    echo "   kubectl logs -l app=udp-api -n $NAMESPACE"
fi




