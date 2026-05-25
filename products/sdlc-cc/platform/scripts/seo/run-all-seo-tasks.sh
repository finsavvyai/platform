#!/bin/bash

###############################################################################
# Master SEO Automation Script
# Runs all SEO tasks in the correct order
###############################################################################

set -e

echo "🚀 SDLC.ai SEO Automation Master Script"
echo "========================================"
echo ""

SITE_URL="${1:-https://sdlc.cc}"
GA_ID="${2}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "${BLUE}Configuration:${NC}"
echo "  Site URL: $SITE_URL"
echo "  Google Analytics ID: ${GA_ID:-Not provided}"
echo ""

###############################################################################
# Task Menu
###############################################################################

echo "${YELLOW}Select tasks to run:${NC}"
echo ""
echo "1. Generate social media images (og-image.png, twitter-image.png)"
echo "2. Set up Google Analytics tracking"
echo "3. Generate social media posts (LinkedIn, Twitter, HN, Reddit)"
echo "4. Create blog post template"
echo "5. Submit to search engines (create checklist)"
echo "6. Run ALL tasks (1-5)"
echo "7. Quick start (images + social posts)"
echo "8. Exit"
echo ""

read -p "Enter choice (1-8): " choice

###############################################################################
# Functions
###############################################################################

generate_images() {
  echo ""
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo "${GREEN}Task 1: Generate Social Media Images${NC}"
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo ""

  if command -v node &> /dev/null; then
    cd "$SCRIPT_DIR"
    node generate-social-images.js || {
      echo ""
      echo "${YELLOW}⚠️  Canvas module not installed${NC}"
      echo ""
      echo "Quick fix options:"
      echo ""
      echo "Option 1: Install canvas and re-run"
      echo "  npm install canvas"
      echo "  node generate-social-images.js"
      echo ""
      echo "Option 2: Use online tool (5 minutes)"
      echo "  1. Go to https://canva.com (free)"
      echo "  2. Create 1200x630px canvas"
      echo "  3. Purple/blue gradient background"
      echo "  4. Text: 'SDLC.ai - Enterprise AI Compliance'"
      echo "  5. Stats: '90% F500 Blocked | \$50B Market | 100% Test Coverage'"
      echo "  6. Save as: og-image.png, twitter-image.png, investor-og-image.png"
      echo "  7. Upload to: ../../web-app/landing/"
      echo ""
    }
  else
    echo "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
  fi
}

setup_analytics() {
  echo ""
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo "${GREEN}Task 2: Set Up Google Analytics${NC}"
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo ""

  if [ -z "$GA_ID" ]; then
    echo "${YELLOW}Google Analytics Measurement ID required${NC}"
    echo ""
    echo "Steps to get your ID:"
    echo "1. Go to https://analytics.google.com"
    echo "2. Click 'Admin' → 'Create Property'"
    echo "3. Property name: 'SDLC.ai Website'"
    echo "4. Complete wizard and copy Measurement ID"
    echo ""
    read -p "Enter Measurement ID (G-XXXXXXXXXX) or press Enter to skip: " GA_ID

    if [ -z "$GA_ID" ]; then
      echo "Skipping analytics setup"
      return
    fi
  fi

  cd "$SCRIPT_DIR"
  chmod +x setup-analytics.sh
  ./setup-analytics.sh "$GA_ID"
}

generate_social_posts() {
  echo ""
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo "${GREEN}Task 3: Generate Social Media Posts${NC}"
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo ""

  cd "$SCRIPT_DIR"
  chmod +x post-to-social-media.sh
  ./post-to-social-media.sh "$SITE_URL"
}

generate_blog_post() {
  echo ""
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo "${GREEN}Task 4: Create Blog Post Template${NC}"
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo ""

  cd "$SCRIPT_DIR"
  chmod +x generate-blog-post.sh
  ./generate-blog-post.sh
}

submit_to_search_engines() {
  echo ""
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo "${GREEN}Task 5: Submit to Search Engines${NC}"
  echo "${BLUE}═══════════════════════════════════════${NC}"
  echo ""

  cd "$SCRIPT_DIR"
  chmod +x submit-to-search-engines.sh
  ./submit-to-search-engines.sh "$SITE_URL"
}

###############################################################################
# Execute based on choice
###############################################################################

case $choice in
  1)
    generate_images
    ;;
  2)
    setup_analytics
    ;;
  3)
    generate_social_posts
    ;;
  4)
    generate_blog_post
    ;;
  5)
    submit_to_search_engines
    ;;
  6)
    echo ""
    echo "${YELLOW}Running ALL tasks...${NC}"
    generate_images
    setup_analytics
    generate_social_posts
    generate_blog_post
    submit_to_search_engines
    ;;
  7)
    echo ""
    echo "${YELLOW}Running Quick Start (images + social posts)...${NC}"
    generate_images
    generate_social_posts
    ;;
  8)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

###############################################################################
# Summary and Next Steps
###############################################################################

echo ""
echo "${GREEN}═══════════════════════════════════════${NC}"
echo "${GREEN}✨ Tasks Complete!${NC}"
echo "${GREEN}═══════════════════════════════════════${NC}"
echo ""

echo "${YELLOW}📋 Next Steps:${NC}"
echo ""

echo "${BLUE}1. Deploy Changes (if images or analytics added)${NC}"
echo "   cd ../../web-app/landing"
echo "   npx wrangler pages deploy . --project-name=sdlc-landing-page --commit-dirty=true"
echo ""

echo "${BLUE}2. Test Social Media Previews${NC}"
echo "   Facebook: https://developers.facebook.com/tools/debug/"
echo "   Twitter: https://cards-dev.twitter.com/validator"
echo "   LinkedIn: https://www.linkedin.com/post-inspector/"
echo ""

echo "${BLUE}3. Post on Social Media (check ../../social-media-posts/)${NC}"
echo "   • LinkedIn (best time: Tue-Thu, 9am-12pm)"
echo "   • Twitter (best time: Tue-Thu, 9am-12pm PST)"
echo "   • Hacker News (best time: Tue-Thu, 8-10am PST)"
echo "   • Reddit (space out posts over 3 days)"
echo ""

echo "${BLUE}4. Submit to Google Search Console${NC}"
echo "   • Go to: https://search.google.com/search-console"
echo "   • Add property: $SITE_URL"
echo "   • Submit sitemap: $SITE_URL/sitemap.xml"
echo ""

echo "${BLUE}5. Monitor Analytics${NC}"
echo "   • Google Analytics: https://analytics.google.com"
echo "   • Track organic traffic growth"
echo "   • Monitor conversion rates"
echo ""

echo "${YELLOW}📊 Expected Results (Week 1):${NC}"
echo "  • Hacker News: 500-2,000 visitors"
echo "  • Reddit (3 posts): 300-1,000 visitors"
echo "  • LinkedIn: 50-100 visitors"
echo "  • Twitter: 20-50 visitors"
echo "  • TOTAL: 870-3,150 visitors"
echo ""

echo "${YELLOW}📈 Expected Results (Month 3):${NC}"
echo "  • Organic traffic: 500-1,000/month"
echo "  • Ranking for 20+ keywords"
echo "  • 10+ backlinks"
echo "  • Domain Authority: 10-20"
echo ""

echo "${GREEN}Good luck with your launch! 🚀${NC}"
echo ""
