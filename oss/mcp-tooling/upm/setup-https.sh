#!/bin/bash

# UPM Platform HTTPS Setup Script
# This script sets up HTTPS for your UPM platform

set -e

echo "🔒 UPM Platform HTTPS Setup"
echo "============================"

# Get current service details
SERVICE_IP=$(kubectl get service udp-service -n udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Current service IP: $SERVICE_IP"

# Create a global static IP for the load balancer
echo "Creating global static IP..."
gcloud compute addresses create upmplus-ip --global --quiet || echo "IP already exists"

# Get the IP address
STATIC_IP=$(gcloud compute addresses describe upmplus-ip --global --format='value(address)')
echo "Static IP: $STATIC_IP"

# Create a backend service
echo "Creating backend service..."
gcloud compute backend-services create upmplus-backend \
    --global \
    --protocol HTTP \
    --health-checks upmplus-health-check \
    --quiet || echo "Backend service already exists"

# Create health check
echo "Creating health check..."
gcloud compute health-checks create http upmplus-health-check \
    --port 8000 \
    --request-path /health \
    --quiet || echo "Health check already exists"

# Create instance group
echo "Creating instance group..."
gcloud compute instance-groups managed create upmplus-instance-group \
    --size 1 \
    --template upmplus-template \
    --zone us-central1-c \
    --quiet || echo "Instance group already exists"

# Create instance template
echo "Creating instance template..."
gcloud compute instance-templates create upmplus-template \
    --machine-type e2-small \
    --image-family cos-stable \
    --image-project cos-cloud \
    --metadata-from-file startup-script=<(cat << 'EOF'
#!/bin/bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Run UPM container
docker run -d -p 8000:8000 --name upm gcr.io/udp-project-1758298429/udp:latest
EOF
) \
    --quiet || echo "Instance template already exists"

# Add instance group to backend service
echo "Adding instance group to backend service..."
gcloud compute backend-services add-backend upmplus-backend \
    --instance-group upmplus-instance-group \
    --instance-group-zone us-central1-c \
    --global \
    --quiet || echo "Backend already added"

# Create URL map
echo "Creating URL map..."
gcloud compute url-maps create upmplus-url-map \
    --default-service upmplus-backend \
    --quiet || echo "URL map already exists"

# Create HTTPS proxy
echo "Creating HTTPS proxy..."
gcloud compute target-https-proxies create upmplus-https-proxy \
    --url-map upmplus-url-map \
    --ssl-certificates upmplus-ssl \
    --quiet || echo "HTTPS proxy already exists"

# Create global forwarding rule
echo "Creating global forwarding rule..."
gcloud compute forwarding-rules create upmplus-https-rule \
    --global \
    --target-https-proxy upmplus-https-proxy \
    --address upmplus-ip \
    --ports 443 \
    --quiet || echo "Forwarding rule already exists"

echo ""
echo "✅ HTTPS setup complete!"
echo ""
echo "🌐 Your UPM platform will be available at:"
echo "   https://upmplus.dev"
echo "   https://www.upmplus.dev"
echo "   https://api.upmplus.dev"
echo ""
echo "⏳ SSL certificate provisioning may take 10-15 minutes"
echo "   Check status with: gcloud compute ssl-certificates describe upmplus-ssl --global"
echo ""
echo "🧪 Test HTTPS when ready:"
echo "   curl https://upmplus.dev/health"
echo "   curl https://upmplus.dev/"
echo ""


