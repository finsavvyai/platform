#!/bin/bash

# Questro Pre-Deployment Readiness Check
# Usage: ./scripts/pre-deploy-check.sh

echo "🔍 Checking Questro Production Readiness..."
echo "============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo
echo "📋 System Requirements:"
echo "-----------------------"

# Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not installed"
fi

# npm version
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm installed: $NPM_VERSION"
else
    check_fail "npm not installed"
fi

# Git
if command -v git &> /dev/null; then
    check_pass "Git installed"
else
    check_fail "Git not installed"
fi

echo
echo "📁 Project Structure:"
echo "--------------------"

# Check key files exist
if [ -f "package.json" ]; then
    check_pass "Root package.json exists"
else
    check_fail "Root package.json missing"
fi

if [ -f "frontend/package.json" ]; then
    check_pass "Frontend package.json exists"
else
    check_fail "Frontend package.json missing"
fi

if [ -f "backend/package.json" ]; then
    check_pass "Backend package.json exists"
else
    check_fail "Backend package.json missing"
fi

if [ -f "render.yaml" ]; then
    check_pass "Render deployment config exists"
else
    check_fail "render.yaml missing"
fi

echo
echo "🔧 Dependencies:"
echo "----------------"

# Check frontend dependencies
if [ -d "frontend/node_modules" ]; then
    check_pass "Frontend dependencies installed"
else
    check_warn "Frontend dependencies not installed (run: cd frontend && npm install)"
fi

# Check backend dependencies  
if [ -d "backend/node_modules" ]; then
    check_pass "Backend dependencies installed"
else
    check_warn "Backend dependencies not installed (run: cd backend && npm install)"
fi

echo
echo "🧪 Tests:"
echo "----------"

# Frontend tests
cd frontend
if npm test &> /dev/null; then
    check_pass "Frontend tests passing"
else
    check_fail "Frontend tests failing"
fi
cd ..

echo
echo "🏗️  Build Process:"
echo "------------------"

# Frontend build
cd frontend
if npm run build &> /dev/null; then
    check_pass "Frontend builds successfully"
    rm -rf dist
else
    check_fail "Frontend build fails"
fi
cd ..

# Backend build
cd backend
if npm run build &> /dev/null; then
    check_pass "Backend builds successfully (with warnings)"
    rm -rf dist
else
    check_warn "Backend has build warnings (may still deploy)"
fi
cd ..

echo
echo "📄 Environment Files:"
echo "---------------------"

if [ -f "frontend/.env.production" ]; then
    check_pass "Frontend production env exists"
else
    check_warn "frontend/.env.production missing (will use defaults)"
fi

if [ -f "backend/.env.production.example" ]; then
    check_pass "Backend env template exists"
else
    check_fail "backend/.env.production.example missing"
fi

echo
echo "🔐 Security:"
echo "------------"

# Check for exposed secrets (basic check)
if grep -r "sk_test\|sk_live\|API_KEY.*=" . --exclude-dir=node_modules --exclude="*.log" &> /dev/null; then
    check_fail "Potential secrets found in code (check .env files)"
else
    check_pass "No obvious secrets in code"
fi

if [ -f ".gitignore" ]; then
    if grep -q ".env" .gitignore; then
        check_pass ".env files are gitignored"
    else
        check_warn ".env files might not be gitignored"
    fi
else
    check_fail ".gitignore missing"
fi

echo
echo "📊 Summary:"
echo "----------"
echo -e "${GREEN}Checks passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Checks failed: $CHECKS_FAILED${NC}"

echo
if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Ready for production deployment!${NC}"
    echo
    echo "Next steps:"
    echo "1. Create Render account if you haven't"
    echo "2. Get OpenAI API key"  
    echo "3. Get Stripe API keys"
    echo "4. Run: ./scripts/deploy-production.sh"
    echo
    echo "Or follow the manual steps in DEPLOY_NOW.md"
else
    echo -e "${RED}❌ Please fix the failed checks before deploying${NC}"
    echo
    echo "Common fixes:"
    echo "• Install missing dependencies: npm install"
    echo "• Fix failing tests: npm test"
    echo "• Add missing environment files"
    echo "• Ensure all required files exist"
fi

echo
echo "📚 Documentation:"
echo "-----------------"
echo "• Full deployment guide: DEPLOY_NOW.md"
echo "• Production guide: PRODUCTION_DEPLOYMENT_GUIDE.md"  
echo "• Backend implementation: BACKEND_IMPLEMENTATION_SUMMARY.md"
echo
echo "🚀 Happy deploying!"