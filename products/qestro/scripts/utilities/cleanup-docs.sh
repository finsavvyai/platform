#!/bin/bash

# Documentation cleanup script
# This script moves documentation files to the organized docs/ structure
# and removes duplicates and outdated files

echo "🧹 Starting documentation cleanup..."

# Create docs directory structure if it doesn't exist
mkdir -p docs/{getting-started,architecture,deployment,testing,development,security,features,monitoring,integrations,project-management,support}

echo "📁 Created documentation directory structure"

# Files to move to docs/architecture/
echo "📋 Moving architecture documentation..."
[ -f "WEB_RECORDING_ARCHITECTURE.md" ] && mv "WEB_RECORDING_ARCHITECTURE.md" "docs/architecture/web-recording-architecture.md"

# Files to move to docs/deployment/
echo "🚀 Moving deployment documentation..."
[ -f "RENDER_DEPLOYMENT.md" ] && mv "RENDER_DEPLOYMENT.md" "docs/deployment/render-deployment.md"
[ -f "RENDER_DEPLOYMENT_GUIDE.md" ] && mv "RENDER_DEPLOYMENT_GUIDE.md" "docs/deployment/render-deployment-guide.md"
[ -f "DEPLOYMENT_GUIDE.md" ] && mv "DEPLOYMENT_GUIDE.md" "docs/deployment/deployment-guide.md"
[ -f "DEPLOYMENT_CHECKLIST.md" ] && mv "DEPLOYMENT_CHECKLIST.md" "docs/deployment/deployment-checklist.md"
[ -f "DEPLOYMENT_TROUBLESHOOTING.md" ] && mv "DEPLOYMENT_TROUBLESHOOTING.md" "docs/deployment/troubleshooting.md"
[ -f "ENVIRONMENT_SETUP_GUIDE.md" ] && mv "ENVIRONMENT_SETUP_GUIDE.md" "docs/getting-started/environment-setup.md"

# Files to move to docs/testing/
echo "🧪 Moving testing documentation..."
[ -f "BROWSER_TESTING_GUIDE.md" ] && mv "BROWSER_TESTING_GUIDE.md" "docs/testing/browser-testing.md"
[ -f "WEB_TESTING_GUIDE.md" ] && mv "WEB_TESTING_GUIDE.md" "docs/testing/web-testing.md"
[ -f "PERFORMANCE_TESTING_SYSTEM.md" ] && mv "PERFORMANCE_TESTING_SYSTEM.md" "docs/testing/performance-testing.md"
[ -f "PENETRATION_TESTING_SYSTEM.md" ] && mv "PENETRATION_TESTING_SYSTEM.md" "docs/testing/penetration-testing.md"
[ -f "LOCAL_TESTING_GUIDE.md" ] && mv "LOCAL_TESTING_GUIDE.md" "docs/development/local-testing.md"
[ -f "TEST_COVERAGE_REPORT.md" ] && mv "TEST_COVERAGE_REPORT.md" "docs/testing/test-coverage-report.md"

# Files to move to docs/security/
echo "🔒 Moving security documentation..."
[ -f "SECURITY_IMPLEMENTATION_GUIDE.md" ] && mv "SECURITY_IMPLEMENTATION_GUIDE.md" "docs/security/security-implementation.md"
[ -f "SECURITY_SETUP_COMPLETE.md" ] && mv "SECURITY_SETUP_COMPLETE.md" "docs/security/security-setup.md"
[ -f "SECURITY_VERIFICATION_REPORT.md" ] && mv "SECURITY_VERIFICATION_REPORT.md" "docs/security/security-verification.md"

# Files to move to docs/features/
echo "✨ Moving feature documentation..."
[ -f "VOICE_CAPTURE_SYSTEM.md" ] && mv "VOICE_CAPTURE_SYSTEM.md" "docs/features/voice-capture.md"
[ -f "VOICE_EXECUTION_SCHEDULING.md" ] && mv "VOICE_EXECUTION_SCHEDULING.md" "docs/features/voice-execution.md"
[ -f "SUBSCRIPTION_SYSTEM_GUIDE.md" ] && mv "SUBSCRIPTION_SYSTEM_GUIDE.md" "docs/features/subscription-system.md"
[ -f "DESKTOP_INTEGRATION_COMPLETE.md" ] && mv "DESKTOP_INTEGRATION_COMPLETE.md" "docs/features/desktop-integration.md"
[ -f "WORKFLOW_USE_INTEGRATION.md" ] && mv "WORKFLOW_USE_INTEGRATION.md" "docs/features/workflow-integration.md"
[ -f "SEO_IMPLEMENTATION_GUIDE.md" ] && mv "SEO_IMPLEMENTATION_GUIDE.md" "docs/features/seo-implementation.md"

# Files to move to docs/integrations/
echo "🔌 Moving integration documentation..."
[ -f "SUPABASE_SETUP_GUIDE.md" ] && mv "SUPABASE_SETUP_GUIDE.md" "docs/integrations/supabase-setup.md"

# Files to move to docs/support/
echo "🆘 Moving support documentation..."
[ -f "TROUBLESHOOTING_GUIDE.md" ] && mv "TROUBLESHOOTING_GUIDE.md" "docs/support/troubleshooting.md"

# Files to move to docs/project-management/
echo "📊 Moving project management documentation..."
[ -f "IMPLEMENTATION_STATUS.md" ] && mv "IMPLEMENTATION_STATUS.md" "docs/project-management/implementation-status.md"
[ -f "KIRO_PROGRESS_SUMMARY.md" ] && mv "KIRO_PROGRESS_SUMMARY.md" "docs/project-management/kiro-progress-summary.md"

# Files to remove (duplicates and outdated)
echo "🗑️  Removing duplicate and outdated files..."

# Deployment duplicates
rm -f "DEPLOY_NOW.md" "DEPLOY_NOW_QUICK_REFERENCE.md" "DEPLOY_README.md" "DEPLOY_READY.md"
rm -f "DEPLOYMENT_GUIDE_INDEX.md" "DEPLOYMENT_MONITOR.md" "DEPLOYMENT_READY.md"
rm -f "DEPLOYMENT_STATUS.md" "DEPLOYMENT_STEPS.md" "DEPLOYMENT_SUMMARY.md"
rm -f "DEPLOYMENT.md" "DUAL_DOMAIN_DEPLOYMENT.md" "EXISTING_RENDER_SETUP.md"
rm -f "FINAL_DEPLOYMENT_CHECKLIST.md" "MANUAL_RENDER_DEPLOYMENT.md"
rm -f "PRODUCTION_DEPLOYMENT_SUMMARY.md" "PRODUCTION_READINESS_ANALYSIS.md"
rm -f "PRODUCTION_READINESS_CHECKLIST.md" "QUESTRO_DEPLOYMENT_GUIDE.md"
rm -f "QUESTRO_IO_DEPLOYMENT_PREP.md" "QUICK_DEPLOY_GUIDE.md"
rm -f "QUICK_START_DEPLOYMENT.md" "READY_TO_DEPLOY.md" "READY_TO_TEST.md"

# Render-specific duplicates
rm -f "RENDER_BUILD_FIX.md" "RENDER_BUILD_FIXED.md" "RENDER_FIX_COMPLETE.md"
rm -f "RENDER_PATH_FIX.md"

# Status and progress duplicates
rm -f "BUILD_FIX_COMPLETE.md" "DATABASE_CONNECTION_FIX.md" "DESIGN_FIXED_STATUS.md"
rm -f "ESM_IMPORT_FIX_COMPLETE.md" "FULLY_FUNCTIONAL_STATUS.md" "LINKS_WORKING_STATUS.md"
rm -f "PHASE_5_ACTION_PLAN.md" "PHASE_5_COMPLETE.md" "PHASE_5_COMPLETION_REPORT.md"
rm -f "PHASE_5_FINAL_STATUS.md" "PHASE_5_FIX_SESSION_SUMMARY.md" "PHASE_5_PROGRESS_REPORT.md"
rm -f "PHASE_14_IMPLEMENTATION_PLAN.md" "PHASE_14_INFRASTRUCTURE_AUDIT.md"
rm -f "SESSION_COMPLETE.md" "SESSION_SUMMARY.md" "SESSIONS_COMPLETE.md"
rm -f "QUESTRO_ACHIEVEMENT_SUMMARY.md"

# Quick start duplicates
rm -f "QUICK_START.md" "START_HERE.md" "NEXT_SESSION_START_HERE.md"

# Professional/CLI duplicates
rm -f "PROFESSIONAL_CLI.md"

# Urgent/action duplicates
rm -f "URGENT_ACTION_REQUIRED.md"

# README duplicates
rm -f "README_DEPLOY.md"

# Your production setup (likely outdated)
rm -f "YOUR_PRODUCTION_SETUP.md"

# Claude-specific files (development artifacts)
rm -f "CLAUDE.md"

echo "✅ Documentation cleanup complete!"
echo ""
echo "📁 Documentation is now organized in the docs/ directory:"
echo "   📚 docs/getting-started/    - Installation and setup guides"
echo "   🏗️  docs/architecture/       - System architecture documentation"
echo "   🚀 docs/deployment/         - Deployment guides and configuration"
echo "   🧪 docs/testing/            - Testing strategies and guides"
echo "   🔧 docs/development/        - Development workflows and guidelines"
echo "   🔒 docs/security/           - Security implementation and best practices"
echo "   ✨ docs/features/           - Feature-specific documentation"
echo "   🔌 docs/integrations/       - Third-party integrations"
echo "   📊 docs/project-management/ - Project status and progress tracking"
echo "   🆘 docs/support/            - Troubleshooting and support"
echo ""
echo "🎉 Your documentation is now clean and organized!"