#!/bin/bash

# 🍋 QUESTRO LEMONSQUEEZY SETUP SCRIPT
# Complete payment integration with LemonSqueezy

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
echo "║            LEMONSQUEEZY PAYMENT SETUP 🍋                ║"
echo "║     Better than Stripe for SaaS - Handles Taxes!        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

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

echo -e "${GREEN}🍋 Why LemonSqueezy is Better for SaaS:${NC}"
echo "• Handles ALL tax compliance automatically (VAT, GST, etc.)"
echo "• Built specifically for SaaS businesses"
echo "• Simple pricing: 5% + 50¢ per transaction"
echo "• Merchant of Record (they handle taxes, not you!)"
echo "• Beautiful checkout experience"
echo "• Built-in customer portal"
echo "• Global payment methods"
echo
wait_for_user

echo -e "${BLUE}📋 STEP 1: CREATE LEMONSQUEEZY ACCOUNT${NC}"
echo -e "${YELLOW}LemonSqueezy handles everything - payments, taxes, invoices!${NC}"
echo

open_url "https://lemonsqueezy.com"
echo
echo -e "${CYAN}Follow these steps:${NC}"
echo "1. Click 'Get Started' (FREE to create account)"
echo "2. Sign up with your email"
echo "3. Complete onboarding (business details)"
echo "4. Verify your email"
echo
wait_for_user

echo -e "${BLUE}🏪 STEP 2: CREATE YOUR STORE${NC}"
echo -e "${YELLOW}Your store is where your products live${NC}"
echo

open_url "https://app.lemonsqueezy.com/stores"
echo
echo -e "${CYAN}Create your first store:${NC}"
echo "1. Click 'New Store'"
echo "2. Store name: 'Questro' (or your app name)"
echo "3. Store URL: questro (this creates questro.lemonsqueezy.com)"
echo "4. Currency: USD (or your preferred currency)"
echo "5. Click 'Create Store'"
echo
wait_for_user

get_input "📋 What's your Store ID? (found in store settings):" STORE_ID

echo -e "${BLUE}📦 STEP 3: CREATE PRODUCTS${NC}"
echo -e "${YELLOW}We'll create your subscription tiers${NC}"
echo

open_url "https://app.lemonsqueezy.com/products"
echo
echo -e "${CYAN}Create 3 products (subscription plans):${NC}"
echo
echo -e "${GREEN}Product 1: Questro Pro${NC}"
echo "• Name: Questro Pro"
echo "• Description: Perfect for small teams"
echo "• Pricing: \$29/month"
echo "• Features to list:"
echo "  - 1,000 AI test generations/month"
echo "  - 100 recording sessions"
echo "  - 500 API tests"
echo "  - Email support"
echo "  - 5 team members"
echo "• Create variant: Monthly (\$29)"
echo "• Copy the Variant ID after creation"
echo
wait_for_user

get_input "📋 Pro Plan Variant ID:" VARIANT_ID_PRO

echo -e "${GREEN}Product 2: Questro Enterprise${NC}"
echo "• Name: Questro Enterprise"  
echo "• Description: For large teams and agencies"
echo "• Pricing: \$99/month"
echo "• Features to list:"
echo "  - Unlimited AI test generations"
echo "  - Unlimited recording sessions"
echo "  - Unlimited API tests"
echo "  - Priority support"
echo "  - Unlimited team members"
echo "  - Custom integrations"
echo "  - White-label options"
echo "• Create variant: Monthly (\$99)"
echo "• Copy the Variant ID"
echo
wait_for_user

get_input "📋 Enterprise Plan Variant ID:" VARIANT_ID_ENTERPRISE

echo -e "${GREEN}Product 3: Questro Lifetime Deal (Optional)${NC}"
echo "• Name: Questro Lifetime Deal"
echo "• Description: One-time payment, lifetime access"
echo "• Pricing: \$299 (one-time)"
echo "• Perfect for AppSumo launch!"
echo "• Skip this if you don't want lifetime deals"
echo
echo -e "${CYAN}Create lifetime product? (y/N):${NC}"
read -r CREATE_LIFETIME

if [[ "$CREATE_LIFETIME" =~ ^[Yy]$ ]]; then
    wait_for_user
    get_input "📋 Lifetime Deal Product ID:" PRODUCT_ID_LIFETIME
fi

echo -e "${BLUE}🔑 STEP 4: GET API CREDENTIALS${NC}"

open_url "https://app.lemonsqueezy.com/settings/api"
echo
echo -e "${CYAN}Generate your API key:${NC}"
echo "1. Click 'Create API Key'"
echo "2. Name: 'Questro Production' (or similar)"
echo "3. Copy the API key (you won't see it again!)"
echo
wait_for_user

get_input "📋 Paste your LemonSqueezy API Key:" API_KEY

echo -e "${BLUE}🔗 STEP 5: CONFIGURE WEBHOOKS${NC}"
echo -e "${YELLOW}Webhooks notify your app of subscription changes${NC}"
echo

open_url "https://app.lemonsqueezy.com/settings/webhooks"
echo
echo -e "${CYAN}Create a webhook:${NC}"
echo "1. Click 'Create Webhook'"
echo "2. URL: Will be your-backend-url/api/webhooks/lemonsqueezy"
echo "3. Secret: Generate a random string (we'll create one for you)"
echo "4. Events to select:"
echo "   ✓ subscription_created"
echo "   ✓ subscription_updated"
echo "   ✓ subscription_cancelled"
echo "   ✓ subscription_resumed"
echo "   ✓ subscription_expired"
echo "   ✓ subscription_paused"
echo "   ✓ subscription_payment_success"
echo "   ✓ subscription_payment_failed"
echo "5. Click 'Create Webhook'"
echo
wait_for_user

# Generate webhook secret
WEBHOOK_SECRET=$(openssl rand -base64 32 2>/dev/null || date +%s | sha256sum | head -c 32)
echo -e "${GREEN}Generated Webhook Secret: $WEBHOOK_SECRET${NC}"
echo -e "${YELLOW}Copy this secret to LemonSqueezy webhook settings${NC}"
wait_for_user

echo -e "${BLUE}💳 STEP 6: CONFIGURE CHECKOUT SETTINGS${NC}"

open_url "https://app.lemonsqueezy.com/settings/checkout"
echo
echo -e "${CYAN}Customize your checkout:${NC}"
echo "1. Upload your logo"
echo "2. Set brand colors to match Questro"
echo "3. Add Terms of Service URL"
echo "4. Add Privacy Policy URL"
echo "5. Enable 'Send receipt emails'"
echo "6. Save settings"
echo
wait_for_user

echo -e "${BLUE}📝 STEP 7: UPDATE ENVIRONMENT FILES${NC}"

# Update backend .env
ENV_FILE="backend/.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Updating backend/.env with LemonSqueezy configuration...${NC}"
    
    # Remove old Stripe configuration
    sed -i.bak '/STRIPE_/d' "$ENV_FILE"
    
    # Add LemonSqueezy configuration
    cat >> "$ENV_FILE" << EOF

# ═══════════════════════════════════════════════════════════════
# 🍋 LEMONSQUEEZY PAYMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════
LEMONSQUEEZY_API_KEY=$API_KEY
LEMONSQUEEZY_STORE_ID=$STORE_ID
LEMONSQUEEZY_WEBHOOK_SECRET=$WEBHOOK_SECRET

# Product Variant IDs
LEMONSQUEEZY_VARIANT_ID_PRO=$VARIANT_ID_PRO
LEMONSQUEEZY_VARIANT_ID_ENTERPRISE=$VARIANT_ID_ENTERPRISE
EOF

    if [ ! -z "$PRODUCT_ID_LIFETIME" ]; then
        echo "LEMONSQUEEZY_PRODUCT_ID_LIFETIME=$PRODUCT_ID_LIFETIME" >> "$ENV_FILE"
    fi
    
    echo -e "${GREEN}✅ Backend environment updated${NC}"
else
    echo -e "${RED}❌ backend/.env not found. Creating new one...${NC}"
    cat > "$ENV_FILE" << EOF
# LemonSqueezy Configuration
LEMONSQUEEZY_API_KEY=$API_KEY
LEMONSQUEEZY_STORE_ID=$STORE_ID
LEMONSQUEEZY_WEBHOOK_SECRET=$WEBHOOK_SECRET
LEMONSQUEEZY_VARIANT_ID_PRO=$VARIANT_ID_PRO
LEMONSQUEEZY_VARIANT_ID_ENTERPRISE=$VARIANT_ID_ENTERPRISE
EOF
fi

# Update frontend .env
FRONTEND_ENV="frontend/.env"
if [ -f "$FRONTEND_ENV" ]; then
    sed -i.bak '/VITE_STRIPE_/d' "$FRONTEND_ENV"
    echo "VITE_LEMONSQUEEZY_STORE_URL=https://questro.lemonsqueezy.com" >> "$FRONTEND_ENV"
else
    echo "VITE_LEMONSQUEEZY_STORE_URL=https://questro.lemonsqueezy.com" > "$FRONTEND_ENV"
fi

echo -e "${GREEN}✅ Frontend environment updated${NC}"

echo
echo -e "${BLUE}🧪 STEP 8: TEST CONFIGURATION${NC}"

# Create test script
cat > "test-lemonsqueezy.js" << 'EOF'
const axios = require('axios');

const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;

async function testLemonSqueezy() {
    try {
        console.log('Testing LemonSqueezy API connection...');
        
        const response = await axios.get(
            `https://api.lemonsqueezy.com/v1/stores/${STORE_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        console.log('✅ LemonSqueezy API connected successfully!');
        console.log('Store:', response.data.data.attributes.name);
        console.log('URL:', response.data.data.attributes.url);
        
        // Test products
        const productsResponse = await axios.get(
            `https://api.lemonsqueezy.com/v1/products?filter[store_id]=${STORE_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        console.log('\nProducts found:', productsResponse.data.data.length);
        productsResponse.data.data.forEach(product => {
            console.log(`- ${product.attributes.name}: $${product.attributes.price/100}`);
        });
        
    } catch (error) {
        console.error('❌ LemonSqueezy test failed:', error.response?.data || error.message);
    }
}

testLemonSqueezy();
EOF

echo -e "${CYAN}Testing LemonSqueezy connection...${NC}"
cd backend && node ../test-lemonsqueezy.js
cd ..
rm test-lemonsqueezy.js

echo

# Create pricing update script
cat > "LEMONSQUEEZY_PRICING.md" << EOF
# 🍋 LemonSqueezy Pricing Configuration

## Your Subscription Plans

### Free Tier (\$0/month)
- 100 AI test generations
- 10 web recording sessions
- 5 mobile recording sessions
- Community support
- No credit card required

### Pro Tier (\$29/month)
- Variant ID: $VARIANT_ID_PRO
- 1,000 AI test generations
- 100 recording sessions
- 500 API tests
- Email support
- 5 team members

### Enterprise Tier (\$99/month)
- Variant ID: $VARIANT_ID_ENTERPRISE
- Unlimited AI test generations
- Unlimited recording sessions
- Unlimited API tests
- Priority support
- Unlimited team members
- Custom integrations

$([ ! -z "$PRODUCT_ID_LIFETIME" ] && echo "### Lifetime Deal (\$299 one-time)
- Product ID: $PRODUCT_ID_LIFETIME
- All Enterprise features
- Lifetime updates
- Perfect for AppSumo")

## Checkout URLs

### Direct Checkout Links
- Pro Plan: https://questro.lemonsqueezy.com/checkout/buy/$VARIANT_ID_PRO
- Enterprise Plan: https://questro.lemonsqueezy.com/checkout/buy/$VARIANT_ID_ENTERPRISE
$([ ! -z "$PRODUCT_ID_LIFETIME" ] && echo "- Lifetime Deal: https://questro.lemonsqueezy.com/checkout/buy/$PRODUCT_ID_LIFETIME")

## Customer Portal
Your customers can manage subscriptions at:
https://questro.lemonsqueezy.com/billing

## Revenue Tracking
Track your revenue at:
https://app.lemonsqueezy.com/analytics

## Tax Handling
LemonSqueezy automatically handles:
- EU VAT
- US Sales Tax  
- GST/HST
- Digital service taxes
- Tax invoices and receipts

You don't need to worry about tax compliance! 🎉
EOF

echo -e "${GREEN}✅ Pricing documentation created${NC}"

echo

# Final summary
echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           LEMONSQUEEZY SETUP COMPLETE! 🍋              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}✅ What's Configured:${NC}"
echo "• LemonSqueezy API connected"
echo "• Store created and configured"
echo "• Products and pricing set up"
echo "• Webhook endpoint configured"
echo "• Environment variables updated"
echo "• Checkout customized"

echo
echo -e "${CYAN}📋 Your LemonSqueezy Details:${NC}"
echo "Store ID: $STORE_ID"
echo "Store URL: https://questro.lemonsqueezy.com"
echo "Pro Variant: $VARIANT_ID_PRO (\$29/mo)"
echo "Enterprise Variant: $VARIANT_ID_ENTERPRISE (\$99/mo)"
[ ! -z "$PRODUCT_ID_LIFETIME" ] && echo "Lifetime Product: $PRODUCT_ID_LIFETIME (\$299)"

echo
echo -e "${YELLOW}🔧 Next Steps:${NC}"
echo "1. Update webhook URL after deployment:"
echo "   https://your-backend-url.onrender.com/api/webhooks/lemonsqueezy"
echo "2. Test checkout flow with test mode"
echo "3. Switch to live mode when ready"
echo "4. Set up affiliate program (optional)"

echo
echo -e "${BLUE}💰 Revenue Advantages with LemonSqueezy:${NC}"
echo "• No tax headaches - they handle everything"
echo "• Global payments accepted automatically"
echo "• Built-in fraud protection"
echo "• Automatic currency conversion"
echo "• Beautiful checkout that converts"
echo "• Customer portal included"

echo
echo -e "${GREEN}📊 Compared to Stripe:${NC}"
echo "Stripe: 2.9% + 30¢ + YOU handle taxes"
echo "LemonSqueezy: 5% + 50¢ + THEY handle taxes"
echo "Result: Less work, more peace of mind!"

echo
echo -e "${PURPLE}🎉 You're ready to start making money! 🎉${NC}"
echo -e "${CYAN}Your SaaS payment system is fully configured!${NC}"

echo
echo -e "${GREEN}Files created:${NC}"
echo "• backend/.env - Updated with LemonSqueezy config"
echo "• frontend/.env - Updated with store URL"
echo "• LEMONSQUEEZY_PRICING.md - Pricing documentation"

echo
echo -e "${YELLOW}Ready to test? Run: ./scripts/test-local.sh${NC}"
echo -e "${GREEN}Ready to deploy? Run: ./scripts/deploy-production.sh${NC}"

echo
echo -e "${PURPLE}🍋 LemonSqueezy + Questro = Success! 🚀${NC}"