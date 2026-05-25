#!/bin/bash

###############################################################################
# Submit to Search Engines Script
# Automates submission to Google, Bing, and other search engines
###############################################################################

set -e

echo "🔍 Search Engine Submission Script"
echo "===================================="
echo ""

SITE_URL="${1:-https://sdlc.cc}"

echo "🌐 Site URL: $SITE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${BLUE}📋 Manual Submission Steps:${NC}"
echo ""

echo "${GREEN}1. Google Search Console${NC}"
echo "   URL: https://search.google.com/search-console"
echo "   Steps:"
echo "   • Click 'Add Property'"
echo "   • Enter: $SITE_URL"
echo "   • Choose verification method (DNS or HTML file)"
echo "   • Submit sitemap: $SITE_URL/sitemap.xml"
echo "   • Request indexing for homepage"
echo ""

echo "${GREEN}2. Bing Webmaster Tools${NC}"
echo "   URL: https://www.bing.com/webmasters"
echo "   Steps:"
echo "   • Click 'Add a site'"
echo "   • Enter: $SITE_URL"
echo "   • Verify with same method as Google (can import from GSC)"
echo "   • Submit sitemap: $SITE_URL/sitemap.xml"
echo ""

echo "${GREEN}3. Yandex Webmaster${NC}"
echo "   URL: https://webmaster.yandex.com/"
echo "   Steps:"
echo "   • Add site: $SITE_URL"
echo "   • Verify ownership"
echo "   • Submit sitemap"
echo ""

echo "${YELLOW}🚀 Automated Index Request (Google)${NC}"
echo ""

# Check if site is already indexed
echo "Checking if $SITE_URL is indexed in Google..."
INDEXED=$(curl -s "https://www.google.com/search?q=site:${SITE_URL}" | grep -o "did not match any documents" || echo "indexed")

if [ "$INDEXED" == "indexed" ]; then
  echo "✅ Site appears to be indexed in Google"
else
  echo "❌ Site not yet indexed in Google"
  echo "   Submit manually via Google Search Console"
fi

echo ""
echo "${BLUE}📊 Index Status Checker${NC}"
echo ""

# Function to check indexing status
check_index() {
  local url=$1
  local engine=$2
  local search_url=$3

  echo "Checking $engine..."
  local result=$(curl -s "$search_url" | grep -o "did not match" || echo "found")

  if [ "$result" == "found" ]; then
    echo "  ✅ Indexed in $engine"
  else
    echo "  ⏳ Not indexed in $engine yet"
  fi
}

check_index "$SITE_URL" "Google" "https://www.google.com/search?q=site:${SITE_URL}"
check_index "$SITE_URL" "Bing" "https://www.bing.com/search?q=site:${SITE_URL}"

echo ""
echo "${BLUE}🌍 Additional Directories to Submit${NC}"
echo ""

directories=(
  "Product Hunt|https://www.producthunt.com/posts/new"
  "Hacker News|https://news.ycombinator.com/submit"
  "Crunchbase|https://www.crunchbase.com/"
  "AngelList|https://angel.co/"
  "AlternativeTo|https://alternativeto.net/"
  "Capterra|https://www.capterra.com/vendors/sign-up"
  "G2|https://www.g2.com/products/new"
  "Slashdot|https://slashdot.org/submission"
  "Reddit|https://www.reddit.com/submit"
  "LinkedIn|https://www.linkedin.com/company/setup/new/"
)

echo "Submit your site to these directories:"
for dir in "${directories[@]}"; do
  IFS='|' read -r name url <<< "$dir"
  echo "  • $name: $url"
done

echo ""
echo "${GREEN}✨ Submission checklist created!${NC}"
echo ""
echo "📝 Save this checklist:"
cat > ../../SEARCH_ENGINE_SUBMISSION_CHECKLIST.md << EOF
# Search Engine Submission Checklist

**Site**: $SITE_URL
**Date**: $(date +%Y-%m-%d)

## Search Engines

- [ ] Google Search Console
  - [ ] Add property
  - [ ] Verify ownership
  - [ ] Submit sitemap ($SITE_URL/sitemap.xml)
  - [ ] Request indexing for homepage

- [ ] Bing Webmaster Tools
  - [ ] Add site
  - [ ] Verify ownership
  - [ ] Submit sitemap

- [ ] Yandex Webmaster
  - [ ] Add site
  - [ ] Verify ownership
  - [ ] Submit sitemap

## Directories & Platforms

- [ ] Product Hunt (schedule for Tuesday-Thursday)
- [ ] Hacker News (Show HN post)
- [ ] Crunchbase (company profile)
- [ ] AngelList (startup profile)
- [ ] AlternativeTo (software listing)
- [ ] Capterra (software listing)
- [ ] G2 (software listing)
- [ ] LinkedIn (company page)
- [ ] GitHub (repo link in README)

## Social Media

- [ ] LinkedIn post announcing launch
- [ ] Twitter/X post announcing launch
- [ ] Reddit posts (r/MachineLearning, r/artificial, r/datascience)

## Verification Files Created

- [ ] Google verification file uploaded
- [ ] Bing verification file uploaded
- [ ] robots.txt accessible
- [ ] sitemap.xml accessible

## Analytics Setup

- [ ] Google Analytics installed
- [ ] Conversion tracking configured
- [ ] UTM parameters for campaigns

## Status Tracking

| Date | Search Engine | Status | Notes |
|------|--------------|--------|-------|
| $(date +%Y-%m-%d) | Google | Pending | Submitted today |
| $(date +%Y-%m-%d) | Bing | Pending | Submitted today |

**Last Updated**: $(date +%Y-%m-%d)
EOF

echo "📄 Checklist saved: ../../SEARCH_ENGINE_SUBMISSION_CHECKLIST.md"
echo ""
echo "🎯 Next actions:"
echo "1. Go to Google Search Console and follow steps above"
echo "2. Monitor indexing status daily"
echo "3. Expected timeline: Indexed in 24-48 hours"
echo ""
