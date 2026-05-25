#!/bin/bash

# Quick Production Readiness Check for QuantumBeam

echo "🚀 QuantumBeam Production Readiness Check"
echo "=========================================="
echo ""

PASS=0
FAIL=0

check() {
    if [ -f "$1" ] || [ -d "$1" ]; then
        echo "✓ $2"
        ((PASS++))
    else
        echo "✗ $2 (missing: $1)"
        ((FAIL++))
    fi
}

echo "📦 Backend Production Features:"
check "internal/fraud/production_features.go" "Production wrapper service"
check "internal/fraud/service_production_test.go" "Production integration tests"
check "internal/fraud/health_handlers.go" "Health check handlers"
echo ""

echo "🐳 Docker & Deployment:"
check "Dockerfile.production" "Production Dockerfile"
check "docker-compose.production.yml" "Production Docker Compose"
check ".env.production.example" "Environment template"
check "QUICK_DEPLOY.sh" "Quick deployment script"
echo ""

echo "📚 Documentation:"
check "README_PRODUCTION.md" "Production README"
check "DEPLOYMENT_SUMMARY.md" "Deployment summary"
check "DEPLOY_TO_PRODUCTION.md" "Platform deployment guides"
check "PRODUCTION_READINESS.md" "Production checklist"
echo ""

echo "🌐 Website:"
check "web/marketing" "Marketing website"
check "web/marketing/app/page.tsx" "Homepage component"
check "web/marketing/app/globals.css" "Website styles"
check "web/marketing/QODO_DESIGN_UPDATE.md" "Design documentation"
echo ""

echo "💾 Database:"
check "database" "Database directory"
check "migrations" "Migrations directory"
check "database/init-databases.sh" "Database init script"
echo ""

echo "=========================================="
echo "Results: ✓ $PASS passed, ✗ $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✅ PRODUCTION READY!"
    echo ""
    echo "Deploy with:"
    echo "  ./QUICK_DEPLOY.sh"
    echo ""
    exit 0
else
    echo "⚠️  Some components missing"
    echo "Review failed checks above"
    exit 1
fi
