#!/bin/bash

# QueryFlux Testing Infrastructure Setup Script
# This script sets up all testing tools and frameworks

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║           QueryFlux Testing Infrastructure Setup                             ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Go installation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Checking Go installation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v go &> /dev/null; then
    echo -e "${GREEN}✅ Go is installed: $(go version)${NC}"
else
    echo -e "${RED}❌ Go is NOT installed - CRITICAL BLOCKER${NC}"
    echo ""
    echo "Please install Go first:"
    echo "  macOS: brew install go"
    echo "  Linux: sudo apt-get install golang-go"
    echo "  Windows: Download from https://go.dev/dl/"
    exit 1
fi

echo ""

# Step 2: Install frontend testing dependencies
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Installing frontend testing tools..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

npm install --save-dev \
  jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @types/jest \
  jest-environment-jsdom \
  ts-jest \
  identity-obj-proxy

echo -e "${GREEN}✅ Frontend testing tools installed${NC}"
echo ""

# Step 3: Install E2E testing framework
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Installing E2E testing framework..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

npm install --save-dev @playwright/test
npx playwright install chromium firefox webkit

echo -e "${GREEN}✅ Playwright installed with browsers${NC}"
echo ""

# Step 4: Create Jest configuration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Creating Jest configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > jest.config.js << 'JESTCONFIG'
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
JESTCONFIG

echo -e "${GREEN}✅ Jest configuration created${NC}"
echo ""

# Step 5: Create test setup file
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Creating test setup file..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > src/setupTests.ts << 'SETUPCONFIG'
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;
SETUPCONFIG

echo -e "${GREEN}✅ Test setup file created${NC}"
echo ""

# Step 6: Update package.json scripts
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Updating package.json test scripts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Add test scripts to package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts.test = 'jest';
pkg.scripts['test:watch'] = 'jest --watch';
pkg.scripts['test:coverage'] = 'jest --coverage';
pkg.scripts['test:ci'] = 'jest --ci --coverage --maxWorkers=2';
pkg.scripts['test:e2e'] = 'playwright test';
pkg.scripts['test:e2e:ui'] = 'playwright test --ui';
pkg.scripts['test:all'] = 'npm run test:coverage && npm run test:e2e';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo -e "${GREEN}✅ Package.json scripts updated${NC}"
echo ""

# Step 7: Download Go backend dependencies
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7: Downloading Go backend dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend
go mod download
go mod tidy
cd ..

echo -e "${GREEN}✅ Go dependencies downloaded${NC}"
echo ""

# Step 8: Run initial tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 8: Running initial tests..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Backend tests:"
cd backend
go test ./... -v 2>&1 | head -50
cd ..

echo ""
echo "Frontend tests (if any exist):"
npm test -- --passWithNoTests 2>&1 | head -20 || true

echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! ✅                                         ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Testing infrastructure is ready!${NC}"
echo ""
echo "Next steps:"
echo "  1. Read: README_TESTING.md"
echo "  2. Read: TESTING_QUICKSTART.md"
echo "  3. Start writing tests following the 16-week roadmap"
echo ""
echo "Test commands:"
echo "  npm test                  # Run frontend tests"
echo "  npm run test:coverage     # Run with coverage report"
echo "  npm run test:e2e          # Run E2E tests"
echo "  cd backend && go test ./...  # Run backend tests"
echo ""
echo "Coverage targets:"
echo "  Backend:  100% (currently ~40%)"
echo "  Frontend:  90% (currently ~5%)"
echo "  Electron:  80% (currently ~15%)"
echo "  Mobile:    85% (currently ~5%)"
echo "  E2E:       50+ flows (currently 1)"
echo ""
echo -e "${YELLOW}⚠️  Production readiness: 16 weeks of intensive testing required${NC}"
echo ""
