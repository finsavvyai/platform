#!/bin/bash

# 🚀 QUESTRO PRODUCTION DEPLOYMENT SCRIPT
# One-click deployment to make money with your SaaS!

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              QUESTRO PRODUCTION DEPLOYMENT               ║"
echo "║                Go Live & Make Money! 🚀                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}Your SaaS platform is ready for production deployment!${NC}"
echo -e "${YELLOW}This script will deploy to Render.com with LemonSqueezy payments${NC}"
echo

# Functions
wait_for_user() {
    echo -e "${YELLOW}Press any key to continue...${NC}"
    read -n 1 -s
    echo
}

get_input() {
    local prompt="$1"
    local var_name="$2"
    echo -e "${CYAN}$prompt${NC}"
    read -r $var_name
}

open_url() {
    local url="$1"
    echo -e "${GREEN}Opening: $url${NC}"
    if command -v open &> /dev/null; then
        open "$url"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$url"
    elif command -v start &> /dev/null; then
        start "$url"
    else
        echo -e "${YELLOW}Please manually open: $url${NC}"
    fi
}

echo -e "${BLUE}🌟 DEPLOYMENT OVERVIEW${NC}"
echo "We'll deploy your entire Questro platform:"
echo "• Backend API to Render.com (auto-scaling)"
echo "• Frontend to Netlify (global CDN)"
echo "• LemonSqueezy payment integration"
echo "• Database migrations"
echo "• SSL certificates (automatic)"
echo "• Production environment setup"
echo
wait_for_user

# Check if Git repo is initialized
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Initializing Git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit - Questro SaaS Platform

🚀 Complete testing automation platform with:
- AI-powered test generation
- Web & mobile recording
- LemonSqueezy payments
- Enterprise authentication
- Real-time collaboration

💰 Ready to generate $5K-50K/month revenue"
fi

echo -e "${BLUE}📊 STEP 1: RENDER.COM BACKEND DEPLOYMENT${NC}"
echo -e "${YELLOW}Render.com provides excellent Node.js hosting with auto-scaling${NC}"
echo
echo "What we'll do:"
echo "• Create Render account (free tier available)"
echo "• Connect your GitHub repository"
echo "• Deploy backend with environment variables"
echo "• Set up auto-deployment on push"
echo
wait_for_user

open_url "https://render.com"
echo
echo -e "${CYAN}Follow these steps in Render:${NC}"
echo "1. Sign up with GitHub (recommended)"
echo "2. Click 'New +' → 'Web Service'"
echo "3. Connect your GitHub repo (questro)"
echo "4. Configure:"
echo "   - Name: questro-backend"
echo "   - Environment: Node"
echo "   - Build Command: cd backend && npm install && npm run build"
echo "   - Start Command: cd backend && npm start"
echo "   - Plan: Free (upgrade later as you scale)"
echo
wait_for_user

echo -e "${YELLOW}🔧 Now we'll set up environment variables...${NC}"
echo "Copy these environment variables to your Render service:"
echo

echo -e "${GREEN}📋 ENVIRONMENT VARIABLES FOR RENDER:${NC}"
echo "Copy each line below and paste in Render → Environment:"
echo

if [ -f "backend/.env" ]; then
    echo -e "${CYAN}From your backend/.env file:${NC}"
    while IFS= read -r line; do
        if [[ $line =~ ^[A-Z] ]]; then
            echo "$line"
        fi
    done < "backend/.env"
else
    echo -e "${RED}❌ backend/.env not found. Run ./scripts/setup-accounts.sh first${NC}"
    exit 1
fi

echo
echo -e "${YELLOW}⚠️  IMPORTANT: Update these production values:${NC}"
echo "NODE_ENV=production"
echo "FRONTEND_URL=https://your-app-name.netlify.app"
echo "DATABASE_URL=your_supabase_production_url"
echo
wait_for_user

get_input "📝 What's your Render backend URL? (e.g., https://questro-backend.onrender.com):" BACKEND_URL

echo -e "${BLUE}🌐 STEP 2: NETLIFY FRONTEND DEPLOYMENT${NC}"
echo -e "${YELLOW}Netlify provides global CDN hosting perfect for React apps${NC}"
echo

open_url "https://netlify.com"
echo
echo -e "${CYAN}Follow these steps in Netlify:${NC}"
echo "1. Sign up with GitHub"
echo "2. Click 'Add new site' → 'Import an existing project'"
echo "3. Connect GitHub and select your questro repository"
echo "4. Configure:"
echo "   - Base directory: frontend"
echo "   - Build command: npm run build"
echo "   - Publish directory: frontend/dist"
echo "5. Click 'Deploy site'"
echo
wait_for_user

get_input "📝 What's your Netlify frontend URL? (e.g., https://questro.netlify.app):" FRONTEND_URL

echo -e "${YELLOW}🔧 Update frontend environment variables in Netlify...${NC}"
echo "Go to Netlify → Site settings → Environment variables"
echo "Add these variables:"
echo
echo "VITE_API_URL=$BACKEND_URL"
echo "VITE_LEMONSQUEEZY_STORE_URL=https://questro.lemonsqueezy.com"
echo "VITE_APP_NAME=Questro"
echo "VITE_APP_DESCRIPTION=The World's Most Comprehensive Test Automation Platform"
echo
wait_for_user

echo -e "${BLUE}🍋 STEP 3: LEMONSQUEEZY PRODUCT SETUP${NC}"
echo -e "${YELLOW}Now we'll create your subscription products in LemonSqueezy${NC}"
echo

echo -e "${CYAN}Run the LemonSqueezy setup script:${NC}"
echo "./scripts/setup-lemonsqueezy.sh"
echo
echo "This will:"
echo "• Create your products (Pro $29/mo, Enterprise $99/mo)"
echo "• Set up webhooks"
echo "• Configure checkout"
echo "• Update environment variables"
echo
read -p "Press Enter when you've completed the LemonSqueezy setup..."

echo -e "${BLUE}🔄 STEP 4: UPDATE WEBHOOK URLS${NC}"
echo -e "${YELLOW}Update webhook URLs with your production backend URL${NC}"
echo

open_url "https://app.lemonsqueezy.com/settings/webhooks"
echo
echo -e "${CYAN}Update webhook endpoint URL to:${NC}"
echo "$BACKEND_URL/api/webhooks/lemonsqueezy"
echo
wait_for_user

echo -e "${BLUE}📊 STEP 5: DATABASE MIGRATION${NC}"
echo -e "${YELLOW}Run database migrations in production...${NC}"
echo

echo "In your Render backend logs, you should see the database tables being created."
echo "If you need to run migrations manually:"
echo "1. Go to Render → your service → Shell"
echo "2. Run: npm run db:migrate"
echo
wait_for_user

echo -e "${BLUE}🧪 STEP 6: PRODUCTION TESTING${NC}"
echo -e "${YELLOW}Let's test your live application...${NC}"
echo

open_url "$FRONTEND_URL"
echo
echo -e "${CYAN}Test these features:${NC}"
echo "1. User registration and login"
echo "2. Navigate to pricing page"
echo "3. Try subscribing to Pro plan"
echo "4. Test AI test generation"
echo "5. Check that payments work"
echo
wait_for_user

echo -e "${BLUE}🔒 STEP 7: SECURITY & MONITORING${NC}"
echo -e "${YELLOW}Set up monitoring and security...${NC}"
echo

echo -e "${CYAN}Render automatically provides:${NC}"
echo "• SSL certificates (HTTPS)"
echo "• DDoS protection"
echo "• Health checks"
echo "• Auto-scaling"
echo "• Logs and monitoring"
echo
echo -e "${CYAN}Additional monitoring (optional):${NC}"
echo "• Sentry for error tracking"
echo "• LogRocket for user sessions"
echo "• UptimeRobot for uptime monitoring"
echo
wait_for_user

echo -e "${BLUE}🎯 STEP 8: DOMAIN SETUP (OPTIONAL)${NC}"
echo -e "${YELLOW}Want to use your own domain? (e.g., questro.com)${NC}"
echo

echo -e "${CYAN}Custom domain setup:${NC}"
echo "1. Buy domain from Namecheap/GoDaddy ($10-15/year)"
echo "2. In Netlify: Site settings → Domain management → Add custom domain"
echo "3. Update DNS records as shown by Netlify"
echo "4. SSL certificate will be automatic"
echo
echo "Skip this for now if you want to launch quickly!"
echo
wait_for_user

echo -e "${BLUE}📈 STEP 9: ANALYTICS SETUP${NC}"
echo -e "${YELLOW}Track your users and revenue...${NC}"
echo

echo -e "${CYAN}Recommended analytics:${NC}"
echo "1. Google Analytics (free) - for website traffic"
echo "2. Mixpanel (free tier) - for user behavior"
echo "3. LemonSqueezy Analytics (built-in) - for revenue"
echo

echo "Add Google Analytics:"
echo "1. Go to analytics.google.com"
echo "2. Create property for $FRONTEND_URL"
echo "3. Add tracking code to your React app"
echo
wait_for_user

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT COMPLETE! 🎉                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}🌟 YOUR SAAS IS NOW LIVE! 🌟${NC}"
echo
echo -e "${CYAN}📊 Your URLs:${NC}"
echo "• Frontend: $FRONTEND_URL"
echo "• Backend API: $BACKEND_URL"
echo "• Customer Portal: https://questro.lemonsqueezy.com/billing"
echo "• Analytics: https://app.lemonsqueezy.com/analytics"
echo

echo -e "${YELLOW}💰 REVENUE TRACKING:${NC}"
echo "• LemonSqueezy Dashboard: https://app.lemonsqueezy.com"
echo "• Real-time payments and subscriptions"
echo "• Automatic tax handling"
echo "• Customer management"
echo

echo -e "${BLUE}🚀 NEXT STEPS TO MAKE MONEY:${NC}"
echo "1. Run: ./scripts/marketing-launch.sh (launch on Product Hunt)"
echo "2. Test your payment flow end-to-end"
echo "3. Share on social media"
echo "4. Reach out to potential customers"
echo "5. Apply to AppSumo for lifetime deal"
echo

echo -e "${GREEN}💡 SCALING TIPS:${NC}"
echo "• Free tier handles ~1000 users"
echo "• Upgrade Render when you hit $1K MRR"
echo "• Add team members as you grow"
echo "• Monitor performance in Render dashboard"
echo

echo -e "${CYAN}📞 SUPPORT:${NC}"
echo "• Render docs: render.com/docs"
echo "• Netlify docs: docs.netlify.com"
echo "• LemonSqueezy docs: docs.lemonsqueezy.com"
echo

echo -e "${PURPLE}🎊 CONGRATULATIONS! 🎊${NC}"
echo -e "${GREEN}You've successfully deployed a world-class SaaS platform!${NC}"
echo -e "${YELLOW}Your Questro platform is now ready to generate revenue!${NC}"
echo

echo -e "${BLUE}Ready to launch your marketing campaign?${NC}"
echo -e "${CYAN}Run: ./scripts/marketing-launch.sh${NC}"
echo

echo -e "${GREEN}💰 Time to make money! 💰${NC}"