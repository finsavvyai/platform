#!/bin/bash

echo "🚀 Questro Cloud Deployment Script"
echo "=================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Step 1: Code is already pushed to GitHub ✅${NC}"
echo -e "${BLUE}Repository: https://github.com/finsavvyai/questro${NC}"

echo -e "\n${YELLOW}Step 2: Deploy to Render.com${NC}"
echo "1. Go to: https://render.com"
echo "2. Click 'New +' → 'Blueprint'"
echo "3. Connect GitHub repository: finsavvyai/questro"
echo "4. Click 'Apply' to deploy all services"

echo -e "\n${YELLOW}Step 3: Add Environment Variables${NC}"
echo "After deployment, add these in Render dashboard:"
echo ""
echo "Backend Service (questro-backend-api):"
echo "- JWT_SECRET: [generate 32-char random string]"
echo "- OPENAI_API_KEY: [your OpenAI API key]"
echo "- LEMONSQUEEZY_API_KEY: [your LemonSqueezy API key]"
echo "- LEMONSQUEEZY_STORE_ID: [your store ID]"
echo "- LEMONSQUEEZY_WEBHOOK_SECRET: [your webhook secret]"

echo -e "\n${GREEN}Step 4: Your URLs After Deployment${NC}"
echo "🎬 Recording Studio: https://questro-app-frontend.onrender.com/recording-studio"
echo "🏠 Main App: https://questro-app-frontend.onrender.com"
echo "📊 Backend API: https://questro-backend-api.onrender.com"
echo "🌐 Marketing: https://questro-io-marketing.onrender.com"

echo -e "\n${YELLOW}Step 5: Test Your Deployment${NC}"
echo "1. Wait 5-10 minutes for deployment to complete"
echo "2. Visit the Recording Studio URL above"
echo "3. Test the recording functionality"

echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo "Your Questro application is now live in the cloud!"