#!/bin/bash

# UDP Google Cloud Deployment Script
# This script deploys UDP to Google Cloud using the free tier

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
        
        # Add gcloud to PATH in the appropriate shell configuration file
        echo "📝 Adding gcloud to $SHELL_CONFIG..."
        echo 'export PATH="$HOME/google-cloud-sdk/bin:$PATH"' >> "$SHELL_CONFIG"
        
        # Also add to current session PATH
        export PATH="$HOME/google-cloud-sdk/bin:$PATH"
    fi
}

command -v kubectl >/dev/null 2>&1 || {
    echo "❌ kubectl not found. Installing..."
    gcloud components install kubectl
}

# Configuration
REGION="us-central1"
ZONE="us-central1-a"
CLUSTER_NAME="udp-cluster"
NAMESPACE="udp"

# Check if we should use existing project or create new one
if [ -z "$PROJECT_ID" ]; then
    # Try to find existing UDP project
    EXISTING_PROJECT=$(gcloud projects list --filter="name:UDP" --format="value(projectId)" --limit=1 2>/dev/null || echo "")
    if [ ! -z "$EXISTING_PROJECT" ]; then
        PROJECT_ID="$EXISTING_PROJECT"
        echo "📋 Using existing project: $PROJECT_ID"
    else
        # Create new project only if none exists
        PROJECT_ID="udp-project-$(date +%s)"
        echo "📋 Creating new project: $PROJECT_ID"
    fi
else
    echo "📋 Using specified project: $PROJECT_ID"
fi

echo "📋 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Zone: $ZONE"
echo "  Cluster: $CLUSTER_NAME"

# Step 1: Create and setup project
echo "🔧 Setting up Google Cloud project..."

# Check if project exists, create only if it doesn't
PROJECT_EXISTS=$(gcloud projects describe $PROJECT_ID --format="value(projectId)" 2>/dev/null || echo "")
if [ -z "$PROJECT_EXISTS" ]; then
    echo "🆕 Creating new project: $PROJECT_ID"
    gcloud projects create $PROJECT_ID --name="UDP Universal Platform"
else
    echo "✅ Using existing project: $PROJECT_ID"
fi

gcloud config set project $PROJECT_ID

# Enable billing (user needs to do this manually)
echo "💳 IMPORTANT: Please enable billing for project $PROJECT_ID at:"
echo "   https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
read -p "Press Enter once billing is enabled..."

# Step 2: Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable container.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Step 3: Create GKE cluster (free tier optimized)
echo "☸️ Creating GKE cluster..."

# Check if cluster already exists and delete it if it's in error state
EXISTING_CLUSTER=$(gcloud container clusters list --filter="name:$CLUSTER_NAME" --format="value(name)" 2>/dev/null || echo "")
if [ ! -z "$EXISTING_CLUSTER" ]; then
    echo "⚠️  Cluster $CLUSTER_NAME already exists. Checking status..."
    CLUSTER_STATUS=$(gcloud container clusters describe $CLUSTER_NAME --zone=$ZONE --format="value(status)" 2>/dev/null || echo "UNKNOWN")
    if [ "$CLUSTER_STATUS" = "ERROR" ] || [ "$CLUSTER_STATUS" = "UNKNOWN" ]; then
        echo "🗑️  Deleting existing cluster in error state..."
        gcloud container clusters delete $CLUSTER_NAME --zone=$ZONE --quiet
    else
        echo "✅ Using existing healthy cluster..."
        gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE
        # Skip cluster creation and go to deployment
        echo "☸️ Deploying UDP to existing Kubernetes cluster..."
        kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
        # Continue with deployment steps...
        exit 0
    fi
fi
gcloud container clusters create $CLUSTER_NAME \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --num-nodes=1 \
    --enable-autorepair \
    --enable-autoupgrade \
    --disk-size=10GB \
    --disk-type=pd-standard \
    --no-enable-cloud-logging \
    --no-enable-cloud-monitoring

# Get cluster credentials
gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE

# Step 4: Build and push UDP image
echo "🐳 Building UDP Docker image..."
docker build -t gcr.io/$PROJECT_ID/udp:latest .
docker push gcr.io/$PROJECT_ID/udp:latest

# Step 5: Deploy to Kubernetes
echo "☸️ Deploying UDP to Kubernetes..."
kubectl create namespace $NAMESPACE

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
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
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