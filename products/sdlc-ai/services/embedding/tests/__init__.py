"""
Test suite for embedding service.

This package contains comprehensive tests for all components of the
embedding service including unit tests, integration tests, and end-to-end tests.
"""

# Test configuration
TEST_CONFIG = {
    "database_url": "sqlite+asyncpg:///:memory:",
    "redis_url": "redis://localhost:6379/15",
    "test_openai_api_key": "test-key",
    "test_cohere_api_key": "test-key",
}
