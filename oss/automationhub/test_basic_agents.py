#!/usr/bin/env python3
"""
Basic agent system tests without full FastAPI dependencies
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

import pytest
from app.agents.base import UPMAgent, Task, TaskType, ExecutionContext, TaskStatus
from app.agents.registry import AgentRegistry
from uuid import uuid4


class MockAgent(UPMAgent):
    """Mock agent for testing"""
    
    async def execute_task(self, task: Task, context: ExecutionContext):
        """Mock task execution"""
        from app.agents.base import TaskResult
        from datetime import datetime
        now = datetime.utcnow()
        return TaskResult(
            task_id=task.id,
            status=TaskStatus.COMPLETED,
            result={"message": "Mock task completed successfully"},
            started_at=now,
            completed_at=now
        )


@pytest.mark.asyncio
async def test_agent_creation():
    """Test basic agent creation"""
    agent = MockAgent(name="TestAgent")
    assert agent.name == "TestAgent"
    assert agent.id is not None
    assert len(agent.capabilities) >= 0


@pytest.mark.asyncio
async def test_agent_registry():
    """Test agent registry functionality"""
    registry = AgentRegistry()
    agent = MockAgent(name="TestRegistryAgent")
    
    # Register agent
    registry.register_agent(agent)
    
    # Test listing agents
    agents = registry.list_agents()
    assert len(agents) >= 1
    
    # Test finding agent
    found_agent = registry.get_agent(agent.id)
    assert found_agent is not None
    assert found_agent.name == "TestRegistryAgent"


@pytest.mark.asyncio
async def test_task_execution():
    """Test basic task execution"""
    agent = MockAgent(name="TestExecutionAgent")
    
    task = Task(
        type=TaskType.CUSTOM,
        name="test_task",
        description="A test task",
        parameters={"test_param": "test_value"}
    )
    
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    assert result.task_id == task.id
    assert result.status == TaskStatus.COMPLETED
    assert result.result is not None


@pytest.mark.asyncio
async def test_agent_health_check():
    """Test agent health check"""
    agent = MockAgent(name="TestHealthAgent")
    health = await agent.health_check()
    
    assert "healthy" in health
    assert "agent_id" in health
    assert "status" in health


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
