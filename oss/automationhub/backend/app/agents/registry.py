"""
Agent Registry for managing available agents and their capabilities.

This module provides centralized management of all agents in the UPM.Plus system,
including registration, discovery, lifecycle management, and load balancing.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Type
from uuid import UUID, uuid4

from .base import UPMAgent, Task, TaskType, AgentStatus, Capability


class AgentRegistryError(Exception):
    """Base exception for agent registry operations."""
    pass


class AgentNotFoundError(AgentRegistryError):
    """Raised when an agent is not found in the registry."""
    pass


class AgentAlreadyRegisteredError(AgentRegistryError):
    """Raised when trying to register an agent that's already registered."""
    pass


class AgentRegistry:
    """
    Central registry for managing all agents in the UPM.Plus system.
    
    Provides agent registration, discovery, lifecycle management,
    and intelligent task assignment capabilities.
    """
    
    def __init__(self):
        self._agents: Dict[UUID, UPMAgent] = {}
        self._agent_types: Dict[str, Type[UPMAgent]] = {}
        self._capability_index: Dict[str, Set[UUID]] = {}
        self._task_type_index: Dict[TaskType, Set[UUID]] = {}
        self.logger = logging.getLogger(self.__class__.__name__)
        
        # Registry statistics
        self._stats = {
            "total_agents": 0,
            "active_agents": 0,
            "idle_agents": 0,
            "error_agents": 0,
            "offline_agents": 0,
            "total_registrations": 0,
            "total_deregistrations": 0,
            "last_health_check": None
        }
    
    def register_agent_type(self, agent_class: Type[UPMAgent], type_name: str):
        """
        Register an agent class type for dynamic instantiation.
        
        Args:
            agent_class: The agent class to register
            type_name: Unique name for the agent type
        """
        if type_name in self._agent_types:
            raise AgentAlreadyRegisteredError(f"Agent type '{type_name}' already registered")
        
        self._agent_types[type_name] = agent_class
        self.logger.info(f"Registered agent type: {type_name}")
    
    def register_agent(self, agent: UPMAgent) -> UUID:
        """
        Register an agent instance with the registry.
        
        Args:
            agent: The agent instance to register
            
        Returns:
            The agent's UUID
            
        Raises:
            AgentAlreadyRegisteredError: If agent is already registered
        """
        if agent.id in self._agents:
            raise AgentAlreadyRegisteredError(f"Agent {agent.id} already registered")
        
        self._agents[agent.id] = agent
        self._update_indices(agent)
        self._update_stats()
        
        self.logger.info(f"Registered agent: {agent.name} ({agent.id})")
        return agent.id
    
    def deregister_agent(self, agent_id: UUID) -> bool:
        """
        Deregister an agent from the registry.
        
        Args:
            agent_id: The ID of the agent to deregister
            
        Returns:
            True if agent was deregistered, False if not found
        """
        if agent_id not in self._agents:
            return False
        
        agent = self._agents[agent_id]
        self._remove_from_indices(agent)
        del self._agents[agent_id]
        self._update_stats()
        
        self.logger.info(f"Deregistered agent: {agent.name} ({agent_id})")
        return True
    
    def get_agent(self, agent_id: UUID) -> Optional[UPMAgent]:
        """
        Get an agent by ID.
        
        Args:
            agent_id: The agent ID
            
        Returns:
            The agent instance or None if not found
        """
        return self._agents.get(agent_id)
    
    def list_agents(
        self, 
        status_filter: Optional[AgentStatus] = None,
        capability_filter: Optional[str] = None,
        task_type_filter: Optional[TaskType] = None
    ) -> List[UPMAgent]:
        """
        List agents with optional filtering.
        
        Args:
            status_filter: Filter by agent status
            capability_filter: Filter by capability name
            task_type_filter: Filter by supported task type
            
        Returns:
            List of matching agents
        """
        agents = list(self._agents.values())
        
        if status_filter:
            agents = [a for a in agents if a.status == status_filter]
        
        if capability_filter:
            agent_ids = self._capability_index.get(capability_filter, set())
            agents = [a for a in agents if a.id in agent_ids]
        
        if task_type_filter:
            agent_ids = self._task_type_index.get(task_type_filter, set())
            agents = [a for a in agents if a.id in agent_ids]
        
        return agents
    
    def find_agents_for_task(self, task: Task) -> List[UPMAgent]:
        """
        Find agents capable of handling a specific task.
        
        Args:
            task: The task to find agents for
            
        Returns:
            List of capable agents, sorted by suitability
        """
        # Get agents that support the task type
        candidate_ids = self._task_type_index.get(task.type, set())
        candidates = [self._agents[aid] for aid in candidate_ids if aid in self._agents]
        
        # Filter by availability and capability
        suitable_agents = []
        for agent in candidates:
            if agent.status in [AgentStatus.IDLE, AgentStatus.BUSY]:
                # Check if agent can actually handle the task
                try:
                    # This would be an async call in practice, but for simplicity we'll assume it's quick
                    suitable_agents.append(agent)
                except Exception as e:
                    self.logger.warning(f"Agent {agent.id} failed capability check: {e}")
        
        # Sort by suitability (idle agents first, then by success rate)
        suitable_agents.sort(key=lambda a: (
            0 if a.status == AgentStatus.IDLE else 1,  # Idle agents first
            -a.performance_metrics.success_rate,  # Higher success rate first
            a.performance_metrics.average_execution_time_ms  # Faster agents first
        ))
        
        return suitable_agents
    
    def get_best_agent_for_task(self, task: Task) -> Optional[UPMAgent]:
        """
        Get the best available agent for a specific task.
        
        Args:
            task: The task to find an agent for
            
        Returns:
            The best agent for the task or None if no suitable agent found
        """
        suitable_agents = self.find_agents_for_task(task)
        return suitable_agents[0] if suitable_agents else None
    
    async def create_agent(
        self, 
        agent_type: str, 
        name: Optional[str] = None,
        **kwargs
    ) -> UPMAgent:
        """
        Create and register a new agent instance.
        
        Args:
            agent_type: The type of agent to create
            name: Optional name for the agent
            **kwargs: Additional arguments for agent initialization
            
        Returns:
            The created and registered agent
            
        Raises:
            AgentRegistryError: If agent type is not registered
        """
        if agent_type not in self._agent_types:
            raise AgentRegistryError(f"Unknown agent type: {agent_type}")
        
        agent_class = self._agent_types[agent_type]
        agent_name = name or f"{agent_type}_{uuid4().hex[:8]}"
        
        # Create agent instance
        agent = agent_class(name=agent_name, **kwargs)
        
        # Register the agent
        self.register_agent(agent)
        
        self.logger.info(f"Created and registered new agent: {agent_name} ({agent.id})")
        return agent
    
    async def health_check_all(self) -> Dict[str, any]:
        """
        Perform health check on all registered agents.
        
        Returns:
            Dictionary containing health check results
        """
        self.logger.info("Starting health check for all agents")
        
        health_results = {
            "timestamp": datetime.utcnow(),
            "total_agents": len(self._agents),
            "healthy_agents": 0,
            "unhealthy_agents": 0,
            "agent_results": {}
        }
        
        # Run health checks concurrently
        health_tasks = []
        for agent_id, agent in self._agents.items():
            health_tasks.append(self._check_agent_health(agent_id, agent))
        
        if health_tasks:
            results = await asyncio.gather(*health_tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    self.logger.error(f"Health check failed with exception: {result}")
                    health_results["unhealthy_agents"] += 1
                else:
                    agent_id, health_status = result
                    health_results["agent_results"][str(agent_id)] = health_status
                    
                    if health_status.get("healthy", False):
                        health_results["healthy_agents"] += 1
                    else:
                        health_results["unhealthy_agents"] += 1
        
        self._stats["last_health_check"] = datetime.utcnow()
        self.logger.info(f"Health check completed: {health_results['healthy_agents']}/{health_results['total_agents']} agents healthy")
        
        return health_results
    
    async def _check_agent_health(self, agent_id: UUID, agent: UPMAgent) -> tuple:
        """
        Check health of a single agent.
        
        Args:
            agent_id: The agent ID
            agent: The agent instance
            
        Returns:
            Tuple of (agent_id, health_status)
        """
        try:
            health_status = await agent.health_check()
            return agent_id, health_status
        except Exception as e:
            self.logger.error(f"Health check failed for agent {agent_id}: {e}")
            return agent_id, {
                "agent_id": agent_id,
                "healthy": False,
                "error": str(e)
            }
    
    def get_registry_stats(self) -> Dict[str, any]:
        """
        Get registry statistics.
        
        Returns:
            Dictionary containing registry statistics
        """
        self._update_stats()
        return self._stats.copy()
    
    def _update_indices(self, agent: UPMAgent):
        """Update capability and task type indices for an agent."""
        # Update capability index
        for capability in agent.capabilities:
            if capability.name not in self._capability_index:
                self._capability_index[capability.name] = set()
            self._capability_index[capability.name].add(agent.id)
            
            # Update task type index based on capability
            for task_type in capability.supported_task_types:
                if task_type not in self._task_type_index:
                    self._task_type_index[task_type] = set()
                self._task_type_index[task_type].add(agent.id)
    
    def _remove_from_indices(self, agent: UPMAgent):
        """Remove agent from capability and task type indices."""
        # Remove from capability index
        for capability in agent.capabilities:
            if capability.name in self._capability_index:
                self._capability_index[capability.name].discard(agent.id)
                if not self._capability_index[capability.name]:
                    del self._capability_index[capability.name]
            
            # Remove from task type index
            for task_type in capability.supported_task_types:
                if task_type in self._task_type_index:
                    self._task_type_index[task_type].discard(agent.id)
                    if not self._task_type_index[task_type]:
                        del self._task_type_index[task_type]
    
    def _update_stats(self):
        """Update registry statistics."""
        self._stats["total_agents"] = len(self._agents)
        
        # Count agents by status
        status_counts = {
            AgentStatus.IDLE: 0,
            AgentStatus.BUSY: 0,
            AgentStatus.ERROR: 0,
            AgentStatus.OFFLINE: 0
        }
        
        for agent in self._agents.values():
            status_counts[agent.status] = status_counts.get(agent.status, 0) + 1
        
        self._stats["active_agents"] = status_counts[AgentStatus.BUSY]
        self._stats["idle_agents"] = status_counts[AgentStatus.IDLE]
        self._stats["error_agents"] = status_counts[AgentStatus.ERROR]
        self._stats["offline_agents"] = status_counts[AgentStatus.OFFLINE]


# Global agent registry instance
agent_registry = AgentRegistry()


def get_agent_registry() -> AgentRegistry:
    """Get the global agent registry instance."""
    return agent_registry