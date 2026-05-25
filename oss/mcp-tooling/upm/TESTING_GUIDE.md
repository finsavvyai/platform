# Testing Guide for Junior Developers

## Overview

This guide explains how to use the testing system in the Universal Dependency Platform (UPM). The project uses pytest with comprehensive fixtures and utilities to make testing easier and more effective.

## Quick Start

### 1. Running Tests

```bash
# Run all tests
poetry run python -m pytest tests/ -v --tb=short

# Run tests with coverage
poetry run python -m pytest tests/ -v --tb=short --cov=src/udp --cov-report=term-missing

# Run specific test file
poetry run python -m pytest tests/unit/test_basic.py -v

# Run tests by marker
poetry run python -m pytest -m unit         # Unit tests only
poetry run python -m pytest -m integration  # Integration tests only
poetry run python -m pytest -m performance  # Performance tests only

# Run tests matching a pattern
poetry run python -m pytest -k "test_basic"

# Run a single test method
poetry run python -m pytest tests/unit/test_basic.py::TestBasicFunctionality::test_basic_math -v
```

### 2. Test Structure

```
tests/
├── conftest.py              # Shared fixtures and configuration
├── unit/                    # Unit tests (test individual components)
│   ├── test_basic.py        # Basic functionality tests
│   ├── test_models.py       # Database model tests
│   ├── test_api_routes.py   # API endpoint tests
│   └── services/            # Service layer tests
├── integration/             # Integration tests (test component interactions)
│   ├── test_workflow_integration.py
│   └── test_complete_workflow_integration.py
├── functional/              # Functional tests (test end-to-end features)
│   ├── test_api_endpoints.py
│   └── test_analytics_api.py
└── performance/             # Performance and load tests
    └── test_performance.py
```

## Writing Tests

### 1. Basic Test Structure

```python
"""
Test module for [component name].

Brief description of what this module tests.
"""

import pytest
from unittest.mock import Mock, AsyncMock

# Import the component you're testing
from udp.core.models import Dependency


class TestDependency:
    """Test the Dependency model."""

    def test_dependency_creation(self):
        """Test creating a new dependency."""
        # Arrange - set up test data
        data = {
            "name": "requests",
            "version": "2.28.1",
            "ecosystem": "pypi"
        }

        # Act - perform the action
        dependency = Dependency(**data)

        # Assert - verify the results
        assert dependency.name == "requests"
        assert dependency.version == "2.28.1"
        assert dependency.ecosystem == "pypi"

    def test_dependency_validation(self):
        """Test dependency validation."""
        with pytest.raises(ValueError, match="Invalid version"):
            Dependency(name="test", version="", ecosystem="pypi")
```

### 2. Using Fixtures

Fixtures provide reusable test data and setup. They're defined in `conftest.py` and can be used in any test:

```python
def test_with_mock_user(mock_user):
    """Test using the mock_user fixture."""
    assert mock_user["username"] == "testuser"
    assert mock_user["email"] == "test@example.com"

def test_with_mock_organization(mock_organization):
    """Test using the mock_organization fixture."""
    assert mock_organization["name"] == "Test Organization"
    assert mock_organization["plan"] == "enterprise"

def test_with_temp_directory(temp_dir):
    """Test using temporary directory."""
    # temp_dir is automatically created and cleaned up
    test_file = Path(temp_dir) / "test.txt"
    test_file.write_text("Hello, World!")
    assert test_file.exists()
```

### 3. Async Tests

For testing async functions:

```python
import pytest

class TestAsyncFunctions:
    """Test async functionality."""

    @pytest.mark.asyncio
    async def test_async_function(self):
        """Test an async function."""
        result = await some_async_function()
        assert result == expected_value

    @pytest.mark.asyncio
    async def test_with_async_fixture(self, test_db_manager):
        """Test using async fixtures."""
        if test_db_manager:
            result = await test_db_manager.get_user("test-id")
            assert result is not None
```

### 4. Parametrized Tests

Test the same function with multiple inputs:

```python
import pytest

class TestParametrized:
    """Test parametrized functionality."""

    @pytest.mark.parametrize("input_value,expected", [
        ("hello", "HELLO"),
        ("world", "WORLD"),
        ("test", "TEST"),
    ])
    def test_string_upper(self, input_value, expected):
        """Test string upper conversion with multiple inputs."""
        assert input_value.upper() == expected

    @pytest.mark.parametrize("a,b,expected", [
        (1, 1, 2),
        (2, 3, 5),
        (10, 20, 30),
        (0, 0, 0),
        (-1, 1, 0),
    ])
    def test_addition(self, a, b, expected):
        """Test addition with multiple inputs."""
        assert a + b == expected
```

### 5. Mocking External Dependencies

Use mocks for external services and dependencies:

```python
from unittest.mock import Mock, patch, AsyncMock

class TestExternalServices:
    """Test with mocked external services."""

    @patch('udp.services.external_service.requests.get')
    def test_api_call_with_mock(self, mock_get):
        """Test API call with mocked requests."""
        # Arrange
        mock_response = Mock()
        mock_response.json.return_value = {"status": "success"}
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        # Act
        result = call_external_api()

        # Assert
        assert result["status"] == "success"
        mock_get.assert_called_once()

    def test_with_mock_redis(self, mock_redis_client):
        """Test using mock Redis client."""
        mock_redis_client.get.return_value = "cached_value"

        result = get_from_cache("key")

        assert result == "cached_value"
        mock_redis_client.get.assert_called_with("key")
```

## Available Fixtures

### Core Fixtures

- `mock_user` - A test user object
- `mock_organization` - A test organization object
- `mock_project` - A test project object
- `mock_dependency` - A test dependency object
- `temp_dir` - Temporary directory (auto-cleaned)
- `test_settings` - Test configuration settings

### Service Fixtures

- `mock_http_client` - Mocked HTTP client
- `mock_redis_client` - Mocked Redis client
- `mock_ml_model` - Mocked ML model
- `test_db_manager` - Test database manager

### Sample Data Fixtures

- `sample_package_data` - Package information
- `sample_vulnerability_data` - Vulnerability information
- `sample_workflow_data` - Workflow configuration
- `sample_monitoring_metrics` - Monitoring metrics

### Utility Fixtures

- `test_utils` - Helper functions for creating test data
- `performance_timer` - Timer for performance tests
- `mock_external_services` - All external services mocked

## Test Markers

Use markers to categorize tests:

```python
@pytest.mark.unit
def test_unit_functionality():
    """Unit test - tests individual component."""
    pass

@pytest.mark.integration
async def test_integration_functionality():
    """Integration test - tests component interactions."""
    pass

@pytest.mark.performance
def test_performance_functionality():
    """Performance test - tests speed/efficiency."""
    pass

@pytest.mark.security
def test_security_functionality():
    """Security test - tests security features."""
    pass
```

## Common Testing Patterns

### 1. Testing Database Models

```python
def test_user_model_creation(test_settings):
    """Test user model creation."""
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "full_name": "Test User"
    }

    user = User(**user_data)
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.is_active is True  # Default value
```

### 2. Testing API Endpoints

```python
@pytest.mark.asyncio
async def test_api_endpoint(async_test_client):
    """Test API endpoint."""
    response = await async_test_client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
```

### 3. Testing Error Handling

```python
def test_error_handling():
    """Test proper error handling."""
    with pytest.raises(ValueError, match="Invalid input"):
        validate_input("")

    with pytest.raises(FileNotFoundError):
        load_nonexistent_file("missing.txt")
```

### 4. Testing Performance

```python
def test_performance_requirements(performance_timer):
    """Test that function meets performance requirements."""
    performance_timer.start()

    result = expensive_operation()

    performance_timer.stop()

    # Should complete within 1 second
    assert performance_timer.duration < 1.0
    assert result is not None
```

## Configuration Issues

If tests fail with configuration errors, check:

1. **Missing Environment Variables**: Some tests require environment variables. Check `conftest.py` for required settings.

2. **Secret Key Error**: If you see "secret_key Field required", create a `.env` file:
   ```bash
   SECRET_KEY=test-secret-key-for-testing-only
   DATABASE_URL=sqlite:///test.db
   REDIS_URL=redis://localhost:6379/1
   ```

3. **Missing Dependencies**: If imports fail, ensure all dependencies are installed:
   ```bash
   poetry install
   ```

## Debugging Tests

### 1. Verbose Output

```bash
# Show detailed test output
poetry run python -m pytest tests/unit/test_basic.py -v -s

# Show even more detail
poetry run python -m pytest tests/unit/test_basic.py -vvv -s
```

### 2. Debug with Print Statements

```python
def test_debug_example():
    """Test with debug output."""
    data = {"key": "value"}
    print(f"Debug: data = {data}")  # Will show with -s flag
    assert data["key"] == "value"
```

### 3. Using pytest.set_trace()

```python
def test_with_debugger():
    """Test with debugger."""
    data = process_data()
    pytest.set_trace()  # Drops into debugger
    assert data is not None
```

## Best Practices

### 1. Test Naming

- Use descriptive test names: `test_user_creation_with_valid_data`
- Follow pattern: `test_[what]_[when]_[expected]`

### 2. Test Organization

- One test class per component
- Group related tests in the same class
- Use descriptive class names: `TestUserAuthentication`

### 3. Assertions

- Use specific assertions: `assert result == expected` not `assert result`
- Include helpful messages: `assert len(users) == 2, f"Expected 2 users, got {len(users)}"`

### 4. Test Data

- Use fixtures for common test data
- Keep test data minimal and focused
- Use factories for complex objects

### 5. Mocking

- Mock external dependencies, not internal logic
- Use specific return values, not generic mocks
- Verify mock calls when important

## Troubleshooting

### Common Issues

1. **ImportError**: Module not found
   - Solution: Ensure proper PYTHONPATH or use `poetry run`

2. **Configuration Errors**: Missing settings
   - Solution: Check environment variables and `.env` file

3. **Async Test Issues**: Event loop problems
   - Solution: Use `@pytest.mark.asyncio` decorator

4. **Fixture Not Found**:
   - Solution: Check `conftest.py` or import the fixture

### Getting Help

1. Check the existing tests for examples
2. Look at `conftest.py` for available fixtures
3. Use `pytest --fixtures` to see all available fixtures
4. Run `pytest --markers` to see all available markers

## Example Test File

```python
"""
Example test file showing common patterns.
"""

import pytest
from unittest.mock import Mock, patch
from udp.core.models import User


class TestUserManagement:
    """Test user management functionality."""

    def test_user_creation(self, test_utils):
        """Test creating a new user."""
        user_data = test_utils.create_test_user(
            username="newuser",
            email="new@example.com"
        )

        user = User(**user_data)
        assert user.username == "newuser"
        assert user.email == "new@example.com"

    @pytest.mark.parametrize("username,valid", [
        ("validuser", True),
        ("", False),
        ("ab", False),  # Too short
        ("verylongusernamethatexceedslimit", False),
    ])
    def test_username_validation(self, username, valid):
        """Test username validation with various inputs."""
        if valid:
            user = User(username=username, email="test@example.com")
            assert user.username == username
        else:
            with pytest.raises(ValueError):
                User(username=username, email="test@example.com")

    @pytest.mark.asyncio
    async def test_user_authentication(self, test_db_manager):
        """Test user authentication."""
        if test_db_manager:
            # Test with async database operations
            user = await test_db_manager.authenticate_user(
                username="testuser",
                password="testpass"
            )
            assert user is not None

    def test_user_permissions(self, mock_user):
        """Test user permission checking."""
        user = User(**mock_user)

        assert not user.is_admin
        assert user.can_read_organization()
        assert not user.can_delete_organization()
```

This guide should help you write effective tests for the UPM project. Remember to start with simple tests and gradually add more complex scenarios as you become more comfortable with the testing framework.