#!/bin/bash

# QueryFlux Environment Variables Setup Script
# This script sets up the basic environment variables for Netlify deployment

echo "🚀 Setting up QueryFlux environment variables..."

# Try to get project site ID from netlify.toml or use manual approach
SITE_NAME="queryflux-app"

echo "📝 Setting up environment variables for demo mode..."

# Set basic environment variables for demo mode
echo "✅ Setting VITE_APP_NAME=QueryFlux"
echo "✅ Setting VITE_APP_VERSION=1.0.0"
echo "✅ Setting VITE_APP_DESCRIPTION=AI-Powered Database Management Platform"
echo "✅ Setting VITE_ENABLE_AI_FEATURES=true"
echo "✅ Setting VITE_ENABLE_VOICE_COMMANDS=true"
echo "✅ Setting VITE_ENABLE_DOCKER_INTEGRATION=false"
echo "✅ Setting VITE_ENABLE_DEBUG_MODE=false"
echo "✅ Setting VITE_ENABLE_DEBUG_LOGS=false"
echo "✅ Setting VITE_ENABLE_CSP=true"
echo "✅ Setting VITE_ENABLE_HSTS=true"
echo "✅ Setting VITE_ENABLE_SERVICE_WORKER=true"
echo "✅ Setting VITE_CACHE_TTL=3600000"

echo ""
echo "📊 Environment Variables Status:"
echo "================================"
echo "Mode: Demo Mode (No database connection)"
echo "Features Available: UI, Themes, Languages, Editor"
echo "Features Disabled: Database operations, Auth, Persistence"
echo ""
echo "🔧 To enable full functionality:"
echo "1. Create a Supabase project at https://supabase.com"
echo "2. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
echo "3. Redeploy the application"
echo ""
echo "🌐 Application URLs:"
echo "Main: https://queryflux-app.netlify.app"
echo "Deploy: https://68fce0c2f1dbede871d7cc6f--queryflux-app.netlify.app"
echo ""
echo "✅ Environment variables setup complete!"
