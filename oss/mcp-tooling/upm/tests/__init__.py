"""
Universal Dependency Platform - Test Suite.

Comprehensive testing infrastructure for unit tests, functional tests,
integration tests, and performance tests.
"""

import os
import sys
import asyncio
import pytest
import tempfile
import shutil
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Test configuration
TEST_CONFIG = {
    "database_url": "sqlite:///test.db",
    "redis_url": "redis://localhost:6379/1",
    "secret_key": "test-secret-key-for-testing-only",
    "environment": "testing",
    "log_level": "DEBUG"
}

# Test fixtures and utilities
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    temp_path = tempfile.mkdtemp()
    yield temp_path
    shutil.rmtree(temp_path)

@pytest.fixture
def test_config():
    """Provide test configuration."""
    return TEST_CONFIG.copy()

# Test markers
pytest_plugins = []

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "functional: Functional tests")
    config.addinivalue_line("markers", "performance: Performance tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "api: API tests")
    config.addinivalue_line("markers", "ml: Machine learning tests")
    config.addinivalue_line("markers", "monitoring: Monitoring tests")
    config.addinivalue_line("markers", "security: Security tests")