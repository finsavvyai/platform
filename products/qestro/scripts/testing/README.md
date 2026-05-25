# Testing Scripts

Scripts for running tests, validations, and quality assurance.

## Available Scripts

### Test Execution
- **`run-tests.sh`** - Run complete test suite
- **`simple-test.sh`** - Basic functionality tests
- **`test-local.sh`** - Local testing environment

### Browser Testing
- **`run-browser-tests.sh`** - Execute browser automation tests
- **`start-browser-test.sh`** - Start browser testing environment

### Service Testing
- **`backend-test-supabase-connection.sh`** - Test backend database connectivity

## Usage Examples

### Running All Tests
```bash
# Complete test suite
./scripts/testing/run-tests.sh

# Quick functionality check
./scripts/testing/simple-test.sh

# Local environment tests
./scripts/testing/test-local.sh
```

### Browser Testing
```bash
# Start browser test environment
./scripts/testing/start-browser-test.sh

# Run browser automation tests
./scripts/testing/run-browser-tests.sh
```

### Service Testing
```bash
# Test database connection
./scripts/testing/backend-test-supabase-connection.sh
```

## Test Categories

### Unit Tests
- Component-level testing
- Function and method testing
- Isolated unit validation

### Integration Tests
- API endpoint testing
- Database integration
- Service communication

### End-to-End Tests
- Complete user workflows
- Browser automation
- Cross-platform testing

### Performance Tests
- Load testing
- Response time validation
- Resource usage monitoring

## Test Configuration

### Environment Variables
```bash
NODE_ENV=test
TEST_DATABASE_URL=postgresql://...
TEST_REDIS_URL=redis://...
```

### Test Databases
- Separate test database instance
- Automated test data seeding
- Clean state for each test run

### Browser Configuration
- Headless browser testing
- Multiple browser support
- Screenshot capture on failures

## Test Reports

### Coverage Reports
- Line coverage metrics
- Branch coverage analysis
- Function coverage tracking

### Test Results
- JUnit XML format
- HTML reports
- CI/CD integration

### Performance Metrics
- Response time measurements
- Memory usage tracking
- Database query performance

## Continuous Integration

### Pre-commit Hooks
- Lint checking
- Unit test execution
- Code formatting validation

### CI Pipeline
- Automated test execution
- Coverage reporting
- Quality gate enforcement

### Test Environments
- Isolated test environments
- Parallel test execution
- Environment cleanup

## Troubleshooting

### Common Issues
- **Database connection**: Verify test database is running
- **Browser tests**: Check browser driver installation
- **Port conflicts**: Ensure test ports are available
- **Environment**: Validate test environment variables

### Debug Mode
```bash
# Run tests with debug output
DEBUG=test ./scripts/testing/run-tests.sh

# Verbose browser testing
VERBOSE=true ./scripts/testing/run-browser-tests.sh
```

### Test Isolation
- Clean database state between tests
- Reset application state
- Clear cache and temporary files