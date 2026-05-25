#!/usr/bin/env python3
"""
Basic API tests without full database setup
"""

import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

import pytest
from fastapi.testclient import TestClient


def test_api_import():
    """Test that we can import the basic API components"""
    try:
        from app.core.config import settings
        assert settings is not None
        print(f"✅ Config loaded: {settings.APP_NAME}")
    except Exception as e:
        pytest.fail(f"Failed to import config: {e}")


def test_health_endpoint_structure():
    """Test health endpoint without full app setup"""
    try:
        # Test that we can import the health endpoint
        from app.api.v1.endpoints import health
        assert hasattr(health, 'router')
        print("✅ Health endpoint structure is valid")
    except Exception as e:
        pytest.fail(f"Failed to import health endpoint: {e}")


def test_agent_system_components():
    """Test that agent system components can be imported"""
    try:
        from app.agents import initialize_agents, agent_registry
        from app.services.task_executor import task_executor
        
        assert agent_registry is not None
        assert task_executor is not None
        print("✅ Agent system components imported successfully")
    except Exception as e:
        pytest.fail(f"Failed to import agent components: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
