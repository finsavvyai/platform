#!/bin/bash

# Quick Questro Backend Fix Deployment
# Run this script to deploy the logger import fixes to your Render service

set -e

echo "🚀 Questro Backend Fix Deployment"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}This script will deploy the logger import fixes to your Render backend service.${NC}"
echo ""

# Check for API key
if [ -z "$RENDER_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  RENDER_API_KEY not found in environment${NC}"
    echo ""
    echo "Please set your Render API key:"
    echo "  export RENDER_API_KEY=rnd_your_api_key_here"
    echo ""
    echo "Get your API key from: https://dashboard.render.com → Account Settings → API Keys"
    echo ""
    read -p "Press Enter to continue once you've set your API key, or Ctrl+C to exit..."

    if [ -z "$RENDER_API_KEY" ]; then
        echo -e "${RED}❌ RENDER_API_KEY is still required${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ RENDER_API_KEY is set${NC}"
echo ""

# Build the backend
echo -e "${BLUE}🔨 Building backend application...${NC}"
cd backend
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

cd ..
echo ""

# Get service info
echo -e "${BLUE}🔍 Looking for Questro backend services...${NC}"
SERVICES_RESPONSE=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" "https://api.render.com/v1/services")

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to connect to Render API. Check your API key.${NC}"
    exit 1
fi

# Find questro-backend service
QUESTRO_SERVICE=$(echo "$SERVICES_RESPONSE" | jq -r '.[] | select(.name | contains("questro-backend")) | {id, name, url, status}')

if [ -z "$QUESTRO_SERVICE" ]; then
    echo -e "${YELLOW}⚠️  No 'questro-backend' service found${NC}"
    echo ""
    echo "Available services:"
    echo "$SERVICES_RESPONSE" | jq -r '.[] | "  - \(.name) (\(.id)) - \(.status)"'
    echo ""

    # Look for similar services
    SIMILAR_SERVICE=$(echo "$SERVICES_RESPONSE" | jq -r '.[] | select(.name | contains("questro") or .name | contains("backend")) | {id, name, url, status}' | head -1)

    if [ -n "$SIMILAR_SERVICE" ]; then
        echo -e "${BLUE}Found similar service:${NC}"
        echo "$SIMILAR_SERVICE" | jq -r '"  - \(.name) (\(.id))"'
        echo ""
        read -p "Use this service instead? (y/N): " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            SERVICE_ID=$(echo "$SIMILAR_SERVICE" | jq -r '.id')
            SERVICE_NAME=$(echo "$SIMILAR_SERVICE" | jq -r '.name')
        else
            echo -e "${RED}❌ No suitable service found${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ No suitable backend service found${NC}"
        exit 1
    fi
else
    SERVICE_ID=$(echo "$QUESTRO_SERVICE" | jq -r '.id')
    SERVICE_NAME=$(echo "$QUESTRO_SERVICE" | jq -r '.name')
    SERVICE_URL=$(echo "$QUESTRO_SERVICE" | jq -r '.url')
    SERVICE_STATUS=$(echo "$QUESTRO_SERVICE" | jq -r '.status')

    echo -e "${GREEN}✅ Found Questro backend service:${NC}"
    echo "  Name: $SERVICE_NAME"
    echo "  ID: $SERVICE_ID"
    echo "  URL: $SERVICE_URL"
    echo "  Status: $SERVICE_STATUS"
    echo ""
fi

# Trigger deployment
echo -e "${BLUE}🚀 Triggering deployment...${NC}"
DEPLOY_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' \
    "https://api.render.com/v1/services/$SERVICE_ID/deploys")

if [ $? -eq 0 ]; then
    DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | jq -r '.id // empty')
    if [ -n "$DEPLOY_ID" ]; then
        echo -e "${GREEN}✅ Deployment triggered successfully!${NC}"
        echo "  Deployment ID: $DEPLOY_ID"

        # Monitor deployment
        echo ""
        echo -e "${BLUE}⏳ Monitoring deployment progress...${NC}"

        for i in {1..20}; do
            sleep 15
            echo -n "Attempt $i/20: Checking status... "

            STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
                "https://api.render.com/v1/services/$SERVICE_ID/deploys/$DEPLOY_ID")

            CURRENT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
            echo "$CURRENT_STATUS"

            if [ "$CURRENT_STATUS" = "live" ]; then
                echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
                echo ""
                echo -e "${BLUE}📍 Service URL: $SERVICE_URL${NC}"
                echo ""

                # Health check
                echo -e "${BLUE}🏥 Running health check...${NC}"
                sleep 10
                if curl -f -s "$SERVICE_URL/health" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Health check passed!${NC}"
                else
                    echo -e "${YELLOW}⚠️  Health check failed - may still be starting${NC}"
                fi

                break
            elif [ "$CURRENT_STATUS" = "build_failed" ]; then
                echo -e "${RED}❌ Deployment failed!${NC}"
                echo "Check Render dashboard for build logs"
                exit 1
            fi
        done

        if [ $i -eq 20 ]; then
            echo -e "${YELLOW}⏰ Monitoring timeout - deployment may still be in progress${NC}"
            echo "Check the Render dashboard for status"
        fi
    else
        echo -e "${RED}❌ Failed to trigger deployment${NC}"
        echo "Response: $DEPLOY_RESPONSE"
        exit 1
    fi
else
    echo -e "${RED}❌ Failed to trigger deployment${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎊 Deployment process completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Visit: $SERVICE_URL"
echo "2. Check the Render dashboard for detailed logs"
echo "3. Test your backend API endpoints"
echo "4. Set up MCP connectors for ongoing management"
echo ""
echo "MCP Management Setup:"
echo "  cd mcp && npm run render"