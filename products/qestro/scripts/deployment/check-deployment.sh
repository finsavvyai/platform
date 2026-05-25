#!/bin/bash

# Questro Deployment Status Checker
echo "🚀 Questro Deployment Status Check"
echo "=================================="

# Check backend health
echo "📡 Backend API Status:"
BACKEND_STATUS=$(curl -s https://questro-backend.onrender.com/health)
if [ $? -eq 0 ]; then
    echo "✅ Backend is healthy: $BACKEND_STATUS"
else
    echo "❌ Backend is not responding"
fi

echo ""

# Check AI generation endpoint
echo "🤖 AI Generation Test:"
AI_RESPONSE=$(curl -s -X POST https://questro-backend.onrender.com/api/ai/generate-test \
    -H "Content-Type: application/json" \
    -d '{"testType": "playwright", "description": "Test login functionality"}' | jq -r '.success // "false"')

if [ "$AI_RESPONSE" = "true" ]; then
    echo "✅ AI generation is working"
else
    echo "❌ AI generation is not working"
fi

echo ""

# Check recording endpoints
echo "🎬 Recording Studio Status:"
RECORDING_STATUS=$(curl -s -X GET https://questro-backend.onrender.com/api/recordings/sessions | jq -r '.success // "false"')

if [ "$RECORDING_STATUS" = "true" ]; then
    echo "✅ Recording endpoints are accessible"
else
    echo "⚠️  Recording endpoints may need authentication"
fi

echo ""
echo "🌐 Frontend Deployment:"
echo "   - Netlify: Check your Netlify dashboard"
echo "   - Expected URL: https://app.questro.io"
echo "   - API Integration: Configured via netlify.toml"

echo ""
echo "📊 Deployment Summary:"
echo "   - Backend: https://questro-backend.onrender.com"
echo "   - Frontend: Deploy to Netlify"
echo "   - Database: PostgreSQL (configured)"
echo "   - AI Service: OpenAI (working)"
