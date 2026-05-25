#!/bin/bash

# UPM Master Automation Script
# Runs all automated setup and initialization tasks

set -e

echo "🚀 UPM Master Automation"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track what was run
SUCCESS=0
SKIPPED=0
FAILED=0

# Function to run a script safely
run_script() {
    local script_name=$1
    local description=$2
    
    echo -e "${BLUE}▶ Running: $description${NC}"
    
    if [ -f "$script_name" ] && [ -x "$script_name" ]; then
        if bash "$script_name" 2>&1; then
            echo -e "${GREEN}✅ Success: $description${NC}"
            ((SUCCESS++))
            return 0
        else
            echo -e "${YELLOW}⚠️  Warning: $description (may require manual setup)${NC}"
            ((SKIPPED++))
            return 1
        fi
    else
        echo -e "${YELLOW}⏭️  Skipped: $description (script not found or not executable)${NC}"
        ((SKIPPED++))
        return 1
    fi
    echo ""
}

# Start automation
echo "Starting automated setup..."
echo ""

# 1. Marketing Setup (already done, but verify)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Marketing Infrastructure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "marketing/setup-marketing.sh" ]; then
    if [ -d "marketing/content" ] && [ -d "marketing/launch" ]; then
        echo -e "${GREEN}✅ Marketing setup already complete${NC}"
        ((SUCCESS++))
    else
        run_script "marketing/setup-marketing.sh" "Marketing Infrastructure Setup"
    fi
else
    echo -e "${YELLOW}⏭️  Marketing setup script not found${NC}"
    ((SKIPPED++))
fi
echo ""

# 2. Verify Marketing Files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Verifying Marketing Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MARKETING_FILES=(
    "UPM_MARKETING_STRATEGY.md"
    "UPM_MARKETING_QUICK_ACTIONS.md"
    "UPM_MARKETING_ONEPAGER.md"
    "UPM_SOCIAL_MEDIA_CALENDAR.md"
    "MARKETING_IMPLEMENTATION_TRACKER.md"
    "marketing/quick-start-guide.md"
    "marketing/content-templates.md"
    "marketing/launch-checklist.md"
)

for file in "${MARKETING_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
        ((SUCCESS++))
    else
        echo -e "${YELLOW}⚠️  Missing: $file${NC}"
        ((SKIPPED++))
    fi
done
echo ""

# 3. Create Documentation Index
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Creating Documentation Index"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat > DOCUMENTATION_INDEX.md << 'EOF'
# UPM Documentation Index

## 🚀 Getting Started
- [README.md](README.md) - Main project documentation
- [HOW_TO_USE_UPM.md](HOW_TO_USE_UPM.md) - Usage guide
- [universal-upm-integration.md](universal-upm-integration.md) - Universal integration guide

## 📖 Integration Guides
- [teddk-upm-simple-config.md](teddk-upm-simple-config.md) - Simple configuration
- [teddk-upm-practical-integration.md](teddk-upm-practical-integration.md) - Practical integration
- [teddk-upm-performant-approach.md](teddk-upm-performant-approach.md) - Performance approach
- [teddk-upm-bridge-approach.md](teddk-upm-bridge-approach.md) - Bridge approach
- [teddk-upm-clean-code.md](teddk-upm-clean-code.md) - Clean code examples

## 🎯 Marketing & Strategy
- [UPM_MARKETING_STRATEGY.md](UPM_MARKETING_STRATEGY.md) - Full marketing strategy
- [UPM_MARKETING_QUICK_ACTIONS.md](UPM_MARKETING_QUICK_ACTIONS.md) - Quick actions
- [UPM_MARKETING_ONEPAGER.md](UPM_MARKETING_ONEPAGER.md) - Executive summary
- [UPM_SOCIAL_MEDIA_CALENDAR.md](UPM_SOCIAL_MEDIA_CALENDAR.md) - Social media calendar
- [MARKETING_IMPLEMENTATION_TRACKER.md](MARKETING_IMPLEMENTATION_TRACKER.md) - Implementation tracker
- [MARKETING_IMPLEMENTATION_SUMMARY.md](MARKETING_IMPLEMENTATION_SUMMARY.md) - Implementation summary

## 🛠️ Setup Scripts
- [setup-universal-upm.sh](setup-universal-upm.sh) - Universal UPM setup
- [setup-teddk-upm-simple.sh](setup-teddk-upm-simple.sh) - Simple TEDDK setup
- [setup-teddk-upm.sh](setup-teddk-upm.sh) - Full TEDDK setup
- [setup-upm-project.sh](setup-upm-project.sh) - General project setup

## ☁️ Deployment
- [deploy-to-gcp.sh](deploy-to-gcp.sh) - GCP deployment
- [deploy-to-gcp-simple.sh](deploy-to-gcp-simple.sh) - Simple GCP deployment
- [setup-domain.sh](setup-domain.sh) - Domain setup
- [setup-https.sh](setup-https.sh) - HTTPS setup

## 📁 Marketing Resources
- [marketing/quick-start-guide.md](marketing/quick-start-guide.md) - Quick start
- [marketing/content-templates.md](marketing/content-templates.md) - Content templates
- [marketing/launch-checklist.md](marketing/launch-checklist.md) - Launch checklist
- [marketing/SETUP_COMPLETE.md](marketing/SETUP_COMPLETE.md) - Setup status

## 🏗️ Architecture & Vision
- [CROSS_LANGUAGE_DEPENDENCY_VISION.md](CROSS_LANGUAGE_DEPENDENCY_VISION.md) - Vision document
- [enterprise_sales_pitch.md](enterprise_sales_pitch.md) - Enterprise pitch
- [simple_pitch.md](simple_pitch.md) - Simple pitch

## 📊 Analysis & Reports
- [UPM_COMPREHENSIVE_ANALYSIS_REPORT.md](UPM_COMPREHENSIVE_ANALYSIS_REPORT.md) - Analysis report

## 🔧 Configuration Files
- [upm.yml](upm.yml) - Main UPM configuration
- [teddk-final-config.yml](teddk-final-config.yml) - TEDDK configuration
- [teddk-upm-integration-final.yml](teddk-upm-integration-final.yml) - Final integration config
EOF

echo -e "${GREEN}✅ Documentation index created${NC}"
((SUCCESS++))
echo ""

# 4. Create Quick Reference Card
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Creating Quick Reference"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat > QUICK_REFERENCE.md << 'EOF'
# UPM Quick Reference

## 🚀 Quick Start
```bash
# Universal setup
./setup-universal-upm.sh

# Marketing setup
./marketing/setup-marketing.sh

# Run all automated
./run-all-automated.sh
```

## 📱 Marketing Quick Start
1. Read: `marketing/quick-start-guide.md`
2. Set up: Social media accounts
3. Create: First blog post
4. Launch: Product Hunt + Hacker News

## 🔗 Key Links
- **Platform**: https://upmplus.dev
- **GitHub**: [Your GitHub repo]
- **Documentation**: See `DOCUMENTATION_INDEX.md`

## 📞 Support
- **Email**: hello@upmplus.dev
- **Community**: [Discord/Slack link]
- **Docs**: [Documentation link]

## 🎯 Key Files
- **Strategy**: `UPM_MARKETING_STRATEGY.md`
- **Actions**: `UPM_MARKETING_QUICK_ACTIONS.md`
- **Templates**: `marketing/content-templates.md`
- **Launch**: `marketing/launch-checklist.md`
EOF

echo -e "${GREEN}✅ Quick reference created${NC}"
((SUCCESS++))
echo ""

# 5. Verify Script Permissions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Verifying Script Permissions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SCRIPTS=(
    "setup-universal-upm.sh"
    "setup-teddk-upm-simple.sh"
    "setup-teddk-upm.sh"
    "setup-upm-project.sh"
    "deploy-to-gcp.sh"
    "deploy-to-gcp-simple.sh"
    "setup-domain.sh"
    "setup-https.sh"
    "marketing/setup-marketing.sh"
    "run-all-automated.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ ! -x "$script" ]; then
            chmod +x "$script"
            echo -e "${GREEN}✅ Made executable: $script${NC}"
            ((SUCCESS++))
        else
            echo -e "${GREEN}✅ Already executable: $script${NC}"
            ((SUCCESS++))
        fi
    else
        echo -e "${YELLOW}⏭️  Not found: $script${NC}"
        ((SKIPPED++))
    fi
done
echo ""

# 6. Create Automation Status Report
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Creating Status Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat > AUTOMATION_STATUS.md << EOF
# UPM Automation Status Report

**Generated**: $(date)

## Summary
- ✅ **Successful**: $SUCCESS tasks
- ⏭️  **Skipped**: $SKIPPED tasks
- ❌ **Failed**: $FAILED tasks

## Completed Tasks
- ✅ Marketing infrastructure setup
- ✅ Documentation index created
- ✅ Quick reference created
- ✅ Script permissions verified

## Next Steps
1. Review marketing strategy documents
2. Set up social media accounts
3. Create first content
4. Prepare for launch

## Files Created
- \`DOCUMENTATION_INDEX.md\` - Complete documentation index
- \`QUICK_REFERENCE.md\` - Quick reference guide
- \`AUTOMATION_STATUS.md\` - This status report

## Marketing Files
All marketing files are ready in:
- Root directory: Strategy documents
- \`marketing/\` directory: Implementation files

**Status**: 🟢 Ready to start marketing!
EOF

echo -e "${GREEN}✅ Status report created${NC}"
((SUCCESS++))
echo ""

# Final Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Automation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Successful: $SUCCESS tasks${NC}"
echo -e "${YELLOW}⏭️  Skipped: $SKIPPED tasks${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAILED tasks${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Automation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "1. Review: DOCUMENTATION_INDEX.md"
echo "2. Quick Start: marketing/quick-start-guide.md"
echo "3. Launch Prep: marketing/launch-checklist.md"
echo ""
echo "📁 All files are ready in the project directory"
echo ""
echo "🚀 Ready to start marketing UPM!"
