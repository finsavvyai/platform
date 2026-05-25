#!/bin/bash

echo "🚀 Testing BSL Monitor Dashboard on Local Port 9098..."

# Test if the backend is running
echo "Testing backend health check..."
curl -s http://localhost:9098/sanity || echo "❌ Backend not responding on port 9098"

# Test dashboard API (should be accessible for local development)
echo "Testing dashboard API..."
curl -s http://localhost:9098/api/dashboard/status || echo "ℹ️  Dashboard API may require data setup"

echo ""
echo "🌐 Access URLs:"
echo "  Frontend (Development): http://localhost:3000"
echo "  Backend API:           http://localhost:9098"
echo "  Health Check:          http://localhost:9098/sanity"
echo "  Dashboard API:         http://localhost:9098/api/dashboard/status"
echo ""
echo "📊 Management Endpoints:"
echo "  Health:               http://localhost:9098/actuator/health"
echo "  Info:                 http://localhost:9098/actuator/info"
echo ""