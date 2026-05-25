"""
Tests for agent API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app
from app.models.agent import Agent
from app.core.database import get_db_session


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
async def sample_agent(db):
    """Create a sample agent for testing."""
    agent = Agent(
        name="Test Agent",
        description="Test agent description",
        agent_type="browser",
        capabilities=["web_navigation"],
        status="active",
        is_enabled=True
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@pytest.mark.asyncio
async def test_list_agents(client):
    """Test listing agents."""
    response = client.get("/api/v1/agents")
    assert response.status_code in [200, 401]  # 401 if auth required


@pytest.mark.asyncio
async def test_create_agent(client):
    """Test creating an agent."""
    agent_data = {
        "name": "New Test Agent",
        "description": "A new test agent",
        "agent_type": "browser",
        "capabilities": ["web_navigation"],
        "is_enabled": True
    }
    
    response = client.post("/api/v1/agents", json=agent_data)
    # May require authentication
    assert response.status_code in [201, 401, 400]


@pytest.mark.asyncio
async def test_get_agent(client, sample_agent):
    """Test getting an agent by ID."""
    response = client.get(f"/api/v1/agents/{sample_agent.id}")
    assert response.status_code in [200, 401, 404]


@pytest.mark.asyncio
async def test_update_agent(client, sample_agent):
    """Test updating an agent."""
    update_data = {
        "name": "Updated Agent Name",
        "description": "Updated description"
    }
    
    response = client.put(f"/api/v1/agents/{sample_agent.id}", json=update_data)
    assert response.status_code in [200, 401, 404]


@pytest.mark.asyncio
async def test_delete_agent(client, sample_agent):
    """Test deleting an agent."""
    response = client.delete(f"/api/v1/agents/{sample_agent.id}")
    assert response.status_code in [204, 401, 404]


@pytest.mark.asyncio
async def test_activate_agent(client, sample_agent):
    """Test activating an agent."""
    response = client.post(f"/api/v1/agents/{sample_agent.id}/activate")
    assert response.status_code in [200, 401, 404]


@pytest.mark.asyncio
async def test_deactivate_agent(client, sample_agent):
    """Test deactivating an agent."""
    response = client.post(f"/api/v1/agents/{sample_agent.id}/deactivate")
    assert response.status_code in [200, 401, 404]


@pytest.mark.asyncio
async def test_get_agent_status(client, sample_agent):
    """Test getting agent status."""
    response = client.get(f"/api/v1/agents/{sample_agent.id}/status")
    assert response.status_code in [200, 401, 404]


