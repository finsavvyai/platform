# SDLC Production System E2E Tests

Comprehensive end-to-end integration tests for the SDLC production system using Playwright. This test suite validates the entire system infrastructure, landing page functionality, API endpoints, database operations, and end-to-end workflows.

## 🎯 Test Coverage

### 1. Landing Page Tests (`tests/landing-page/`)
- ✅ Page load performance and accessibility
- ✅ Navigation and interactive elements
- ✅ Demo request form functionality
- ✅ Mobile responsiveness
- ✅ Content validation and SEO metadata
- ✅ Error handling and user experience

### 2. Infrastructure Services Tests (`tests/infrastructure/`)
- ✅ PostgreSQL database connectivity (port 5434)
- ✅ Redis cache operations (port 6381)
- ✅ Kafka message queue functionality (port 9092)
- ✅ Prometheus metrics endpoint (port 9090)
- ✅ Grafana dashboard accessibility (port 3010)
- ✅ Jaeger tracing interface (port 16686)

### 3. API Endpoint Tests (`tests/api/`)
- ✅ Health check endpoints
- ✅ CORS functionality validation
- ✅ Error handling and status codes
- ✅ Authentication and authorization
- ✅ Request/response validation
- ✅ Performance benchmarking

### 4. Database Integration Tests (`tests/database/`)
- ✅ PostgreSQL connection and schema validation
- ✅ pgvector extension operations
- ✅ Vector similarity search functionality
- ✅ CRUD operations performance
- ✅ Transaction handling
- ✅ Data integrity and security

### 5. End-to-End Workflows (`tests/e2e/`)
- ✅ Complete user journeys (landing → demo request)
- ✅ Data persistence workflows
- ✅ Cache and message queue integration
- ✅ Error handling across components
- ✅ Mobile and desktop workflows
- ✅ Performance under realistic usage

### 6. Performance Tests (`tests/performance/`)
- ✅ Page load time optimization
- ✅ Resource loading efficiency
- ✅ Interaction response times
- ✅ Memory usage monitoring
- ✅ Network request optimization
- ✅ Accessibility performance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker (for infrastructure services)
- Access to SDLC production environment

### Installation

```bash
# Navigate to tests directory
cd tests

# Install dependencies
npm install

# Install Playwright browsers
npm run setup
```

### Environment Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your actual configuration:
```env
BASE_URL=https://sdlc.finsavvyai.com
POSTGRES_HOST=localhost
POSTGRES_PORT=5434
REDIS_HOST=localhost
REDIS_PORT=6381
KAFKA_HOST=localhost
KAFKA_PORT=9092
```

### Running Tests

#### Run All Tests
```bash
# Using the test runner
node run-tests.js

# Or directly with Playwright
npm test
```

#### Run Specific Test Categories
```bash
# Landing page tests only
node run-tests.js --landing-page

# Infrastructure connectivity tests
node run-tests.js --infrastructure

# API endpoint tests
node run-tests.js --api

# Database integration tests
node run-tests.js --database

# End-to-end workflow tests
node run-tests.js --e2e

# Performance tests
node run-tests.js --performance
```

#### Advanced Options
```bash
# Run with browser UI (headed mode)
node run-tests.js --headed

# Run in debug mode
node run-tests.js --debug

# Clean previous results before running
node run-tests.js --clean

# Show test report after completion
node run-tests.js --report

# Install/update Playwright browsers
node run-tests.js --install
```

## 📊 Test Reports

### HTML Report
- **Location**: `test-results/html-report/index.html`
- **Features**: Interactive test results, screenshots, videos, traces
- **Access**: `npm run test:report` or `node run-tests.js --report`

### JSON Report
- **Location**: `test-results/results.json`
- **Format**: Machine-readable results for CI/CD integration

### JUnit Report
- **Location**: `test-results/results.xml`
- **Format**: JUnit XML for test result aggregation

### Comprehensive Report
- **Location**: `test-results/comprehensive-report.json`
- **Features**: Detailed metrics, recommendations, file artifacts

### Markdown Summary
- **Location**: `test-results/summary.md`
- **Features**: Human-readable summary with recommendations

## 🏗️ Test Architecture

### Page Object Model
- **LandingPage**: `pages/landing-page.ts` - Landing page interactions and validations

### Test Utilities
- **TestHelpers**: `utils/test-helpers.ts` - Common test utilities and assertions
- **InfrastructureHelpers**: `utils/infrastructure-helpers.ts` - Database and service connectivity

### Test Fixtures
- **Custom fixtures**: Enhanced test context with helper functions
- **Global setup/teardown**: Environment preparation and cleanup

### Configuration
- **Playwright config**: `playwright.config.ts` - Browser configuration and test settings
- **TypeScript config**: `tsconfig.json` - Type checking and path mapping

## 🎯 Test Scenarios

### Landing Page Validation
1. **Load Performance**: Page loads within 5 seconds on desktop, 8 seconds on mobile
2. **Content Verification**: All sections load with proper content
3. **Form Functionality**: Demo request form accepts and validates input
4. **Responsive Design**: Works across mobile, tablet, and desktop viewports
5. **Accessibility**: Meets WCAG 2.1 AA standards (basic checks)

### Infrastructure Health
1. **Database Connectivity**: PostgreSQL with pgvector extension operational
2. **Cache Performance**: Redis operations complete within 100ms
3. **Message Queue**: Kafka topics can be created and messages exchanged
4. **Monitoring Services**: Prometheus and Grafana endpoints accessible
5. **Distributed Tracing**: Jaeger UI available for trace visualization

### API Validation
1. **Health Endpoints**: All services respond to health checks
2. **CORS Configuration**: Proper headers for cross-origin requests
3. **Error Handling**: Appropriate HTTP status codes and error responses
4. **Performance**: API responses under 2 seconds for normal operations
5. **Security**: Authentication required for protected endpoints

### Database Operations
1. **Vector Operations**: pgvector extension with similarity search
2. **CRUD Performance**: Database operations complete efficiently
3. **Data Integrity**: Constraints and validations enforced
4. **Transaction Safety**: ACID properties maintained
5. **Security**: Proper access controls and data sanitization

## 🔧 Configuration Options

### Browser Configuration
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Viewport**: Responsive testing across device sizes
- **Timeout**: Configurable timeouts for different operations
- **Retry**: Automatic retry for flaky tests

### Test Environment
- **Base URL**: Configurable target environment
- **Service URLs**: Configurable infrastructure endpoints
- **Authentication**: Test credentials for protected areas
- **Data Generation**: Automatic test data creation

### Performance Thresholds
- **Page Load**: 5 seconds (desktop), 8 seconds (mobile)
- **API Response**: 2 seconds for normal operations
- **Database Query**: 1 second for standard queries
- **Cache Operations**: 100ms for Redis operations

## 🚨 Troubleshooting

### Common Issues

1. **Browser Installation**
   ```bash
   # Reinstall Playwright browsers
   npm run setup
   # or
   node run-tests.js --install
   ```

2. **Infrastructure Services Not Available**
   ```bash
   # Check Docker services
   docker-compose -f ../docker-compose.prod.yml ps

   # Start services if needed
   docker-compose -f ../docker-compose.prod.yml up -d
   ```

3. **Permission Issues**
   ```bash
   # Fix permissions for test results directory
   chmod -R 755 test-results/
   ```

4. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

### Debug Mode
```bash
# Run tests in debug mode with browser DevTools
node run-tests.js --debug

# Run specific test in debug mode
npx playwright test tests/landing-page/landing-page.spec.ts --debug
```

### Test Trace Analysis
```bash
# Open trace viewer for failed tests
npx playwright show-trace test-results/traces/
```

## 📈 CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd tests
          npm install

      - name: Install Playwright browsers
        run: |
          cd tests
          npx playwright install

      - name: Run E2E tests
        run: |
          cd tests
          node run-tests.js

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: tests/test-results/
```

### Environment Variables for CI
```yaml
env:
  BASE_URL: ${{ secrets.BASE_URL }}
  POSTGRES_HOST: ${{ secrets.POSTGRES_HOST }}
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
  REDIS_HOST: ${{ secrets.REDIS_HOST }}
  KAFKA_HOST: ${{ secrets.KAFKA_HOST }}
```

## 📝 Best Practices

### Test Development
1. **Use Page Object Model**: Separate page interactions from test logic
2. **Descriptive Test Names**: Clear indication of what is being tested
3. **Proper Assertions**: Specific expectations with meaningful error messages
4. **Test Isolation**: Each test should be independent
5. **Data Management**: Clean up test data after each test

### Performance Testing
1. **Realistic Scenarios**: Test typical user workflows
2. **Multiple Viewports**: Test across device sizes
3. **Network Conditions**: Simulate various network speeds
4. **Resource Monitoring**: Track memory and CPU usage
5. **Baseline Metrics**: Establish performance baselines

### Maintenance
1. **Regular Updates**: Keep dependencies and browsers updated
2. **Review Flaky Tests**: Identify and fix unstable tests
3. **Monitor Test Duration**: Optimize slow-running tests
4. **Clean Artifacts**: Regular cleanup of old test results
5. **Documentation**: Keep test documentation current

## 🤝 Contributing

### Adding New Tests
1. Follow existing test patterns and naming conventions
2. Use appropriate test utilities and helpers
3. Include proper assertions and error handling
4. Add documentation for complex test scenarios
5. Update README if adding new test categories

### Test Categories
- **Smoke Tests**: Quick validation of critical functionality
- **Regression Tests**: Comprehensive testing of existing features
- **Performance Tests**: Load time and responsiveness validation
- **Security Tests**: Basic security validation and checks
- **Accessibility Tests**: WCAG compliance and usability

## 📞 Support

For questions or issues with the test suite:
1. Check the troubleshooting section above
2. Review test logs and error messages
3. Examine test results in the HTML report
4. Check infrastructure service status
5. Verify environment configuration

---

**Test Suite Version**: 1.0.0
**Last Updated**: 2025-11-19
**Framework**: Playwright 1.40.0
**Node.js**: 18.0.0+