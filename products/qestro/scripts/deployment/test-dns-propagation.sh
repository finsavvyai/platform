#!/bin/bash

echo "🔍 Testing DNS propagation for API subdomains..."
echo "================================================"

echo ""
echo "Testing api.qestro.io:"
dig +short api.qestro.io

echo ""
echo "Testing api.qestro.app:"
dig +short api.qestro.app

echo ""
echo "If you see IP addresses above, the DNS records are working!"
echo "If you see empty results, wait a few more minutes and try again."

echo ""
echo "🚀 Once DNS is working, test your API endpoints:"
echo "curl https://api.qestro.io/health"
echo "curl https://api.qestro.app/health"
