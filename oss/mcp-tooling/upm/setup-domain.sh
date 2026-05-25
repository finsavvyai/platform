#!/bin/bash

# UDP Platform Domain Setup Script
# This script helps you set up your UDP platform on your own domain

set -e

echo "🌐 UDP Platform Domain Setup"
echo "=============================="

# Your domains
DOMAINS=("upmplus.dev" "upm.plus" "upmplus.ai")
RECOMMENDED="upmplus.dev"

echo "Your available domains:"
for i in "${!DOMAINS[@]}"; do
    echo "  $((i+1)). ${DOMAINS[$i]}"
done

echo ""
echo "Recommended: $RECOMMENDED (perfect for Universal Package Manager Plus)"
echo ""

# Get current IP
CURRENT_IP=$(kubectl get service udp-service -n udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Current UDP Platform IP: $CURRENT_IP"
echo ""

# DNS Configuration
echo "📋 DNS Configuration Required:"
echo "=============================="
echo ""
echo "Add these DNS records to your domain registrar:"
echo ""
echo "Type: A"
echo "Name: @"
echo "Value: $CURRENT_IP"
echo ""
echo "Type: A"
echo "Name: www"
echo "Value: $CURRENT_IP"
echo ""
echo "Type: A"
echo "Name: api"
echo "Value: $CURRENT_IP"
echo ""
echo "Type: A"
echo "Name: platform"
echo "Value: $CURRENT_IP"
echo ""

# SSL Certificate Setup
echo "🔒 SSL Certificate Setup:"
echo "========================="
echo ""
echo "After DNS propagation (5-10 minutes), run:"
echo ""
echo "gcloud compute ssl-certificates create upmplus-ssl \\"
echo "  --domains $RECOMMENDED,www.$RECOMMENDED,api.$RECOMMENDED \\"
echo "  --global"
echo ""

# Test commands
echo "🧪 Testing Commands:"
echo "===================="
echo ""
echo "After DNS propagation, test with:"
echo ""
echo "curl https://$RECOMMENDED/health"
echo "curl https://$RECOMMENDED/"
echo "curl https://api.$RECOMMENDED/health"
echo ""

# TEDDK Configuration
echo "📝 TEDDK Configuration Update:"
echo "==============================="
echo ""
echo "Update your TEDDK project configuration:"
echo ""
echo "File: /Users/shaharsolomon/projects/telia/teddk/udp.yml"
echo ""
echo "udp_platform:"
echo "  base_url: \"https://$RECOMMENDED\""
echo "  api_endpoint: \"https://api.$RECOMMENDED\""
echo "  api_key: \"your-api-key-here\""
echo "  timeout: 30000"
echo "  retry_attempts: 3"
echo ""

echo "✅ Domain setup instructions complete!"
echo ""
echo "Next steps:"
echo "1. Update DNS records in your domain registrar"
echo "2. Wait for DNS propagation (5-10 minutes)"
echo "3. Test the domain with the curl commands above"
echo "4. Update your TEDDK configuration"
echo "5. Set up SSL certificate for HTTPS"
echo ""
echo "Your UDP platform will then be available at:"
echo "🌐 https://$RECOMMENDED"
echo "🔧 https://api.$RECOMMENDED"
echo "📚 https://docs.$RECOMMENDED"
echo ""


