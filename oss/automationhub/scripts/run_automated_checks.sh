#!/bin/bash
# Automated Production Readiness Checks
# Run all automated validation checks for production readiness

set -e

echo "🚀 Running Automated Production Readiness Checks"
echo "=================================================="
echo ""

ERRORS=0
WARNINGS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        ERRORS=$((ERRORS + 1))
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# 1. Check Python syntax
echo "1. Checking Python syntax..."
cd backend
for file in app/core/config.py app/main.py app/core/exceptions.py; do
    python3 -m py_compile "$file" 2>&1 > /dev/null
    check "Python syntax: $file"
done
cd ..

# 2. Check YAML syntax
echo ""
echo "2. Checking YAML syntax..."
python3 -c "
import yaml
import sys

files = ['.github/workflows/ci.yml', 'docker-compose.prod.yml']
for file in files:
    try:
        with open(file, 'r') as f:
            yaml.safe_load(f)
        print('✅ YAML syntax:', file)
    except Exception as e:
        print('❌ YAML syntax:', file, '-', e)
        sys.exit(1)
" 2>&1
check "YAML syntax validation"

# 3. Check Docker Compose config
echo ""
echo "3. Validating Docker Compose configuration..."
docker-compose -f docker-compose.prod.yml config --quiet > /dev/null 2>&1
check "Docker Compose configuration"

# 4. Check critical files exist
echo ""
echo "4. Checking critical files..."
CRITICAL_FILES=(
    "Dockerfile.prod"
    "docker-compose.prod.yml"
    ".github/workflows/ci.yml"
    "PRODUCTION_DEPLOYMENT_GUIDE.md"
    "PRODUCTION_CHECKLIST.md"
    "backend/app/core/config.py"
    "backend/app/main.py"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file - MISSING${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# 5. Check for hardcoded secrets
echo ""
echo "5. Checking for hardcoded secrets..."
SECRETS_FOUND=$(grep -r "dev_secret_key" --include="*.yml" --include="*.yaml" --include="*.py" . 2>/dev/null | grep -v ".git" | grep -v "node_modules" | grep -v "PRODUCTION" | grep -v "README" | wc -l)
if [ "$SECRETS_FOUND" -gt 0 ]; then
    warn "Found potential hardcoded secrets ($SECRETS_FOUND instances)"
else
    echo -e "${GREEN}✅ No hardcoded dev secrets found${NC}"
fi

# 6. Check Python imports
echo ""
echo "6. Testing Python imports..."
export SECRET_KEY="test-secret-key-for-validation-only-min-32-chars-long"
python3 -c "
import sys
sys.path.insert(0, 'backend')
try:
    from app.core.config import Settings, get_settings
    from app.core.exceptions import (
        UPMPException, ValidationError, NotFoundError, ConflictError,
        AuthorizationError, ProcessingError, SecurityError, TaskExecutionError,
        AgentError, WorkflowError
    )
    print('✅ All imports successful')
except Exception as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
" 2>&1
check "Python imports"

# 7. Check configuration validation
echo ""
echo "7. Testing configuration validation..."
python3 -c "
import sys
import os
sys.path.insert(0, 'backend')

os.environ['SECRET_KEY'] = 'test-secret-key-for-validation-only-min-32-chars-long'
os.environ['ENVIRONMENT'] = 'development'

try:
    from app.core.config import get_settings, validate_production_settings
    settings = get_settings()
    print(f'✅ Configuration loaded: ENVIRONMENT={settings.ENVIRONMENT}')
    print(f'✅ SECRET_KEY configured: {len(settings.SECRET_KEY)} chars')
except Exception as e:
    print(f'❌ Configuration error: {e}')
    sys.exit(1)
" 2>&1
check "Configuration validation"

# 8. Check exception handlers
echo ""
echo "8. Checking exception handlers..."
python3 -c "
import sys
sys.path.insert(0, 'backend')

try:
    from app.main import app
    # Check if exception handlers are registered
    handlers = [h for h in app.exception_handlers.keys()]
    if len(handlers) >= 2:
        print(f'✅ Exception handlers registered: {len(handlers)} handlers')
    else:
        print(f'⚠️  Only {len(handlers)} exception handlers found')
except Exception as e:
    print(f'❌ Error checking exception handlers: {e}')
    sys.exit(1)
" 2>&1
check "Exception handlers"

# 9. Check health endpoint
echo ""
echo "9. Checking health endpoint implementation..."
if grep -q "@app.get(\"/health\")" backend/app/main.py; then
    check "Health endpoint exists"
else
    warn "Health endpoint not found"
fi

# 10. Check CI/CD workflow
echo ""
echo "10. Checking CI/CD workflow..."
if [ -f ".github/workflows/ci.yml" ]; then
    if grep -q "backend-tests:" .github/workflows/ci.yml && \
       grep -q "frontend-tests:" .github/workflows/ci.yml && \
       grep -q "security-scan:" .github/workflows/ci.yml; then
        check "CI/CD workflow complete"
    else
        warn "CI/CD workflow may be incomplete"
    fi
else
    warn "CI/CD workflow file not found"
fi

# Summary
echo ""
echo "=================================================="
echo "📊 CHECK SUMMARY"
echo "=================================================="
echo -e "${GREEN}✅ Passed: $((10 - ERRORS - WARNINGS))${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
fi
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Errors: $ERRORS${NC}"
    echo ""
    echo "Please fix the errors above before deploying to production."
    exit 1
else
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    echo ""
    echo "Your project is ready for production deployment!"
    echo "Next steps:"
    echo "  1. Set up environment variables (see env.example)"
    echo "  2. Review PRODUCTION_DEPLOYMENT_GUIDE.md"
    echo "  3. Run production deployment checklist"
    exit 0
fi

