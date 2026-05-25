# 🧪 UPM Onboarding Testing Guide

## Automated Testing for Onboarding Flow

---

## Overview

This guide explains how to run automated tests for the UPM onboarding flow, including unit tests, integration tests, and end-to-end tests.

---

## Test Structure

### Test Files

1. **`tests/unit/test_onboarding_service.py`**
   - Unit tests for onboarding service logic
   - Progress calculation
   - Tier limits
   - Upgrade prompts

2. **`tests/integration/test_onboarding_integration.py`**
   - Integration tests for onboarding
   - Email integration
   - Analytics integration
   - Upgrade flow integration

3. **`tests/e2e/test_onboarding_flow.py`**
   - End-to-end tests for complete onboarding flow
   - Phase 1: Sign Up & Welcome
   - Phase 2: First Project Setup
   - Phase 3: Feature Discovery
   - Complete flow test

---

## Running Tests

### Quick Start

```bash
# Run all onboarding tests
./scripts/run_onboarding_tests.sh

# Or using pytest directly
pytest tests/ -k onboarding -v
```

### Run Specific Test Suites

```bash
# Unit tests only
pytest tests/unit/test_onboarding_service.py -v

# Integration tests only
pytest tests/integration/test_onboarding_integration.py -v

# E2E tests only
pytest tests/e2e/test_onboarding_flow.py -v
```

### Run by Marker

```bash
# Unit tests
pytest tests/ -m unit -k onboarding -v

# Integration tests
pytest tests/ -m integration -k onboarding -v

# E2E tests
pytest tests/ -m e2e -k onboarding -v
```

### Run Specific Test

```bash
# Run a specific test function
pytest tests/e2e/test_onboarding_flow.py::TestOnboardingFlow::test_phase1_signup_and_welcome -v
```

---

## Test Coverage

### Unit Tests

Tests for:
- ✅ Onboarding progress calculation
- ✅ Next step determination
- ✅ Tier limit checking
- ✅ Upgrade prompt logic
- ✅ Email service
- ✅ Analytics tracking

### Integration Tests

Tests for:
- ✅ Onboarding state management
- ✅ Email integration
- ✅ Analytics integration
- ✅ Upgrade flow integration

### E2E Tests

Tests for:
- ✅ Complete signup flow
- ✅ First project creation
- ✅ First dependency addition
- ✅ Feature discovery
- ✅ Upgrade flows
- ✅ Metrics tracking

---

## Test Data

### Test Users

Tests create temporary users with:
- Random email addresses
- Test passwords
- Test user data

### Test Projects

Tests create temporary projects with:
- Test project names
- Test languages
- Test dependencies

### Cleanup

All test data is automatically cleaned up after tests complete.

---

## Prerequisites

### Required Packages

```bash
pip install pytest pytest-asyncio httpx fastapi sqlalchemy
```

### Environment Variables

```bash
export SECRET_KEY="test-secret-key-for-onboarding-tests"
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
```

### Database

Tests use an in-memory SQLite database (no setup required).

---

## Test Execution

### Manual Execution

```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Set environment variables
export SECRET_KEY="test-secret-key"
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# 3. Run tests
pytest tests/ -k onboarding -v
```

### Automated Execution

```bash
# Run the automated test script
chmod +x scripts/run_onboarding_tests.sh
./scripts/run_onboarding_tests.sh
```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Onboarding Tests
  run: |
    chmod +x scripts/run_onboarding_tests.sh
    ./scripts/run_onboarding_tests.sh
```

---

## Test Results

### Expected Output

```
🚀 Running UPM Onboarding Tests
================================

Running: Unit Tests - Onboarding Service
----------------------------------------
✅ Unit Tests - Onboarding Service - PASSED

Running: Integration Tests - Onboarding Integration
----------------------------------------
✅ Integration Tests - Onboarding Integration - PASSED

Running: End-to-End Tests - Onboarding Flow
----------------------------------------
✅ End-to-End Tests - Onboarding Flow - PASSED

================================
📊 Test Summary
================================
Total Test Suites: 3
Passed: 3
Failed: 0

✅ All onboarding tests passed!
```

---

## Troubleshooting

### Common Issues

#### 1. Import Errors

**Problem**: `ModuleNotFoundError`

**Solution**:
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
```

#### 2. Database Errors

**Problem**: Database connection errors

**Solution**: Tests use in-memory database, no setup needed. If issues persist, check `conftest.py`.

#### 3. Authentication Errors

**Problem**: Token generation errors

**Solution**: Ensure `SECRET_KEY` is set in environment.

#### 4. Async Errors

**Problem**: `RuntimeError: Event loop is closed`

**Solution**: Ensure `pytest-asyncio` is installed and tests use `@pytest.mark.asyncio`.

---

## Adding New Tests

### Unit Test Example

```python
@pytest.mark.unit
def test_new_feature():
    """Test new onboarding feature."""
    # Test implementation
    assert True
```

### Integration Test Example

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_new_integration(client: AsyncClient):
    """Test new integration."""
    response = await client.get("/api/v1/endpoint")
    assert response.status_code == 200
```

### E2E Test Example

```python
@pytest.mark.e2e
@pytest.mark.asyncio
async def test_new_e2e_flow(client: AsyncClient):
    """Test new E2E flow."""
    # Complete flow test
    assert True
```

---

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Clean up test data after tests
3. **Naming**: Use descriptive test names
4. **Documentation**: Add docstrings to tests
5. **Assertions**: Use clear, specific assertions
6. **Mocking**: Mock external services (email, analytics)

---

## Continuous Testing

### Watch Mode

```bash
# Install pytest-watch
pip install pytest-watch

# Run tests in watch mode
ptw tests/ -k onboarding
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
./scripts/run_onboarding_tests.sh
```

---

## Test Metrics

### Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: 80%+ coverage
- **E2E Tests**: Critical paths only

### Performance Goals

- **Unit Tests**: < 1 second
- **Integration Tests**: < 5 seconds
- **E2E Tests**: < 30 seconds

---

## Next Steps

1. ✅ Run tests: `./scripts/run_onboarding_tests.sh`
2. ✅ Review results
3. ✅ Fix any failures
4. ✅ Add new tests as needed
5. ✅ Integrate into CI/CD

---

**Happy Testing! 🧪**
