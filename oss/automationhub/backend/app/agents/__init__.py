"""
AI Agent framework for UPM.Plus
"""

from .base import UPMAgent, Task, TaskResult, TaskStatus, TaskType, ExecutionContext, Capability, AgentStatus
from .registry import AgentRegistry, agent_registry
from .enhanced_registry import EnhancedAgentRegistry, RegistrationStatus, LoadBalancingStrategy
from .production_registry import ProductionAgentRegistry, get_production_registry
from .browser_agent import BrowserAgent
from .infrastructure_agent import InfrastructureAgent
from .conversational_agent import ConversationalAgent
from .data_agent import DataAgent

# Global production registry instance
production_registry = get_production_registry()

# Register agent types with the global registry
def initialize_agents():
    """Initialize and register all agent types."""
    agent_registry.register_agent_type(BrowserAgent, "browser")
    agent_registry.register_agent_type(InfrastructureAgent, "infrastructure")
    agent_registry.register_agent_type(ConversationalAgent, "conversational")
    agent_registry.register_agent_type(DataAgent, "data")

# Production registry initialization
async def initialize_production_registry():
    """Initialize the production-grade agent registry."""
    await production_registry.start()

__all__ = [
    "UPMAgent",
    "Task",
    "TaskResult",
    "TaskStatus",
    "TaskType",
    "ExecutionContext",
    "Capability",
    "AgentStatus",
    "AgentRegistry",
    "agent_registry",
    "EnhancedAgentRegistry",
    "RegistrationStatus",
    "LoadBalancingStrategy",
    "ProductionAgentRegistry",
    "production_registry",
    "get_production_registry",
    "BrowserAgent",
    "InfrastructureAgent",
    "ConversationalAgent",
    "DataAgent",
    "initialize_agents",
    "initialize_production_registry"
]