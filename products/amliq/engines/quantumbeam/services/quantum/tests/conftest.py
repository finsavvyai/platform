import pytest
import asyncio
import sys
import os
from pathlib import Path

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set test environment variables
os.environ['TESTING'] = 'true'
os.environ['LOG_LEVEL'] = 'DEBUG'


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup test environment before each test"""
    # Ensure we're using test configuration
    os.environ['QUANTUM_ENVIRONMENT'] = 'test'
    yield
    # Cleanup after each test
    os.environ.pop('QUANTUM_ENVIRONMENT', None)


@pytest.fixture
def mock_qiskit_available():
    """Mock Qiskit availability for testing"""
    import sys
    from unittest.mock import patch

    with patch.dict('sys.modules', {'qiskit': None}):
        yield


@pytest.fixture
def mock_redis_available():
    """Mock Redis availability for testing"""
    import sys
    from unittest.mock import Mock, patch

    mock_redis = Mock()
    with patch.dict('sys.modules', {'redis': mock_redis}):
        yield mock_redis


# Custom marks for different test categories
pytest_plugins = []

def pytest_configure(config):
    """Configure custom pytest markers"""
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "quantum: mark test as requiring quantum hardware"
    )
    config.addinivalue_line(
        "markers", "no_qiskit: mark test as not requiring Qiskit"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as a performance test"
    )