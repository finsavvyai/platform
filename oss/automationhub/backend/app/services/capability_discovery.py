"""
Agent Capability Discovery and Matching Service

This module provides comprehensive capability discovery, classification,
and intelligent matching algorithms for optimal agent-task pairing.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Union, Any
from uuid import UUID
from dataclasses import dataclass, field
from enum import Enum
import json
import redis.asyncio as redis
from collections import defaultdict
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.agent import Agent
from app.agents.base import UPMAgent, Capability, TaskType, Task


class CapabilityType(str, Enum):
    """Types of agent capabilities."""
    TECHNICAL = "technical"
    BUSINESS = "business"
    CREATIVE = "creative"
    ANALYTICAL = "analytical"
    COMMUNICATION = "communication"
    AUTOMATION = "automation"
    INTEGRATION = "integration"
    SECURITY = "security"


class SkillLevel(str, Enum):
    """Agent skill proficiency levels."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"
    MASTER = "master"


class MatchingAlgorithm(str, Enum):
    """Capability matching algorithms."""
    EXACT_MATCH = "exact_match"
    SEMANTIC_MATCH = "semantic_match"
    HYBRID = "hybrid"
    PERFORMANCE_WEIGHTED = "performance_weighted"
    LEARNING_BASED = "learning_based"


@dataclass
class AgentCapability:
    """Enhanced agent capability definition."""
    name: str
    description: str
    capability_type: CapabilityType
    skill_level: SkillLevel
    version: str = "1.0.0"
    supported_task_types: List[TaskType] = field(default_factory=list)
    required_tools: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, float] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    certifications: List[str] = field(default_factory=list)
    experience_hours: int = 0
    success_rate: float = 0.0
    average_execution_time_ms: float = 0.0
    last_used: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "name": self.name,
            "description": self.description,
            "capability_type": self.capability_type,
            "skill_level": self.skill_level,
            "version": self.version,
            "supported_task_types": [t.value for t in self.supported_task_types],
            "required_tools": self.required_tools,
            "parameters": self.parameters,
            "performance_metrics": self.performance_metrics,
            "tags": self.tags,
            "certifications": self.certifications,
            "experience_hours": self.experience_hours,
            "success_rate": self.success_rate,
            "average_execution_time_ms": self.average_execution_time_ms,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


@dataclass
class TaskRequirement:
    """Task requirement definition."""
    name: str
    description: str
    capability_type: Optional[CapabilityType] = None
    required_skill_level: Optional[SkillLevel] = None
    priority: int = 5  # 1-10, 1 being highest
    optional: bool = False
    alternatives: List[str] = field(default_factory=list)
    estimated_complexity: float = 1.0  # 1.0-10.0
    tags: List[str] = field(default_factory=list)


@dataclass
class CapabilityMatch:
    """Capability match result."""
    agent_id: UUID
    capability_name: str
    requirement_name: str
    match_score: float  # 0.0-1.0
    match_type: str
    skill_gap: Optional[str] = None
    confidence: float = 0.0
    reasoning: str = ""
    performance_prediction: Optional[float] = None


@dataclass
class AgentCapabilityProfile:
    """Complete capability profile for an agent."""
    agent_id: UUID
    agent_name: str
    agent_type: str
    capabilities: List[AgentCapability]
    overall_skill_level: SkillLevel
    specialization_areas: List[str]
    learning_rate: float
    adaptation_score: float
    collaboration_score: float
    reliability_score: float
    last_updated: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": str(self.agent_id),
            "agent_name": self.agent_name,
            "agent_type": self.agent_type,
            "capabilities": [cap.to_dict() for cap in self.capabilities],
            "overall_skill_level": self.overall_skill_level,
            "specialization_areas": self.specialization_areas,
            "learning_rate": self.learning_rate,
            "adaptation_score": self.adaptation_score,
            "collaboration_score": self.collaboration_score,
            "reliability_score": self.reliability_score,
            "last_updated": self.last_updated.isoformat()
        }


class CapabilityDiscoveryService:
    """
    Advanced capability discovery and matching service.

    Provides intelligent capability analysis, automatic discovery,
    semantic matching, and performance-based optimization.
    """

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

        # Capability storage
        self._agent_capabilities: Dict[UUID, List[AgentCapability]] = {}
        self._capability_index: Dict[str, Set[UUID]] = defaultdict(set)
        self._type_index: Dict[CapabilityType, Set[UUID]] = defaultdict(set)
        self._skill_level_index: Dict[SkillLevel, Set[UUID]] = defaultdict(set)

        # Matching components
        self._tfidf_vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=1000,
            ngram_range=(1, 2)
        )
        self._capability_vectors = None
        self._capability_names = []

        # Learning and adaptation
        self._interaction_history: Dict[UUID, List[Dict[str, Any]]] = defaultdict(list)
        self._performance_history: Dict[UUID, List[float]] = defaultdict(list)
        self._feedback_weights: Dict[str, float] = {}

        # Configuration
        self._min_confidence_threshold = 0.3
        self._max_capabilities_per_agent = 50
        self._learning_rate = 0.1
        self._performance_window_size = 100

        # Background tasks
        self._discovery_task: Optional[asyncio.Task] = None
        self._learning_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the capability discovery service."""
        self.logger.info("Starting Capability Discovery Service")

        # Start background tasks
        self._discovery_task = asyncio.create_task(self._discovery_loop())
        self._learning_task = asyncio.create_task(self._learning_loop())

        # Load existing capabilities
        await self._load_capabilities_from_db()

        self.logger.info("Capability Discovery Service started")

    async def stop(self):
        """Stop the capability discovery service."""
        self.logger.info("Stopping Capability Discovery Service")

        # Cancel background tasks
        if self._discovery_task:
            self._discovery_task.cancel()
        if self._learning_task:
            self._learning_task.cancel()

        # Wait for tasks to complete
        await asyncio.gather(
            self._discovery_task,
            self._learning_task,
            return_exceptions=True
        )

        # Save capabilities to database
        await self._save_capabilities_to_db()

        self.logger.info("Capability Discovery Service stopped")

    async def discover_agent_capabilities(
        self,
        agent: UPMAgent,
        auto_classify: bool = True
    ) -> List[AgentCapability]:
        """
        Automatically discover and classify agent capabilities.

        Args:
            agent: The agent to analyze
            auto_classify: Whether to automatically classify capabilities

        Returns:
            List of discovered capabilities
        """
        try:
            discovered_capabilities = []

            # Analyze agent's defined capabilities
            for capability in agent.capabilities:
                enhanced_cap = await self._enhance_capability(
                    agent.id,
                    capability,
                    auto_classify
                )
                discovered_capabilities.append(enhanced_cap)

            # Discover implicit capabilities from agent type
            implicit_caps = await self._discover_implicit_capabilities(agent)
            discovered_capabilities.extend(implicit_caps)

            # Discover capabilities from tools
            tool_caps = await self._discover_tool_capabilities(agent)
            discovered_capabilities.extend(tool_caps)

            # Discover capabilities from configuration
            config_caps = await self._discover_config_capabilities(agent)
            discovered_capabilities.extend(config_caps)

            # Remove duplicates and merge similar capabilities
            merged_capabilities = await self._merge_capabilities(discovered_capabilities)

            # Store capabilities
            await self._store_agent_capabilities(agent.id, merged_capabilities)

            self.logger.info(f"Discovered {len(merged_capabilities)} capabilities for agent {agent.name}")
            return merged_capabilities

        except Exception as e:
            self.logger.error(f"Failed to discover capabilities for agent {agent.id}: {e}")
            return []

    async def match_task_to_agents(
        self,
        task: Task,
        algorithm: MatchingAlgorithm = MatchingAlgorithm.HYBRID,
        top_k: int = 5
    ) -> List[CapabilityMatch]:
        """
        Find the best agent matches for a task.

        Args:
            task: The task to match
            algorithm: Matching algorithm to use
            top_k: Number of top matches to return

        Returns:
            List of capability matches sorted by score
        """
        try:
            # Extract task requirements
            task_requirements = await self._extract_task_requirements(task)

            # Find candidate agents
            candidate_agents = await self._find_candidate_agents(task_requirements)

            # Calculate matches
            matches = []
            for agent_id in candidate_agents:
                agent_matches = await self._calculate_agent_matches(
                    agent_id,
                    task_requirements,
                    algorithm
                )
                matches.extend(agent_matches)

            # Sort and rank matches
            ranked_matches = await self._rank_matches(matches, algorithm)

            # Return top matches
            return ranked_matches[:top_k]

        except Exception as e:
            self.logger.error(f"Failed to match task {task.id} to agents: {e}")
            return []

    async def update_capability_performance(
        self,
        agent_id: UUID,
        capability_name: str,
        success: bool,
        execution_time_ms: float,
        feedback_score: Optional[float] = None
    ):
        """
        Update capability performance metrics.

        Args:
            agent_id: The agent ID
            capability_name: The capability name
            success: Whether the task was successful
            execution_time_ms: Execution time in milliseconds
            feedback_score: Optional feedback score (0.0-1.0)
        """
        try:
            # Get capability
            capability = await self._get_agent_capability(agent_id, capability_name)
            if not capability:
                return

            # Update performance metrics
            total_executions = capability.performance_metrics.get("total_executions", 0) + 1
            successful_executions = capability.performance_metrics.get("successful_executions", 0)
            if success:
                successful_executions += 1

            # Calculate new success rate
            new_success_rate = successful_executions / total_executions

            # Update average execution time
            current_avg = capability.average_execution_time_ms
            if current_avg == 0:
                new_avg = execution_time_ms
            else:
                # Exponential moving average
                alpha = 0.2
                new_avg = alpha * execution_time_ms + (1 - alpha) * current_avg

            # Update capability
            capability.success_rate = new_success_rate
            capability.average_execution_time_ms = new_avg
            capability.last_used = datetime.utcnow()
            capability.updated_at = datetime.utcnow()

            capability.performance_metrics.update({
                "total_executions": total_executions,
                "successful_executions": successful_executions,
                "feedback_scores": capability.performance_metrics.get("feedback_scores", []) + ([feedback_score] if feedback_score else [])
            })

            # Store updated capability
            await self._update_agent_capability(agent_id, capability)

            # Record interaction for learning
            await self._record_interaction(agent_id, capability_name, success, execution_time_ms, feedback_score)

        except Exception as e:
            self.logger.error(f"Failed to update capability performance: {e}")

    async def get_agent_capability_profile(self, agent_id: UUID) -> Optional[AgentCapabilityProfile]:
        """
        Get complete capability profile for an agent.

        Args:
            agent_id: The agent ID

        Returns:
            Agent capability profile or None if not found
        """
        try:
            capabilities = self._agent_capabilities.get(agent_id, [])
            if not capabilities:
                # Try to load from database
                capabilities = await self._load_agent_capabilities_from_db(agent_id)
                if capabilities:
                    self._agent_capabilities[agent_id] = capabilities

            if not capabilities:
                return None

            # Calculate profile metrics
            overall_skill_level = await self._calculate_overall_skill_level(capabilities)
            specialization_areas = await self._identify_specializations(capabilities)
            learning_rate = await self._calculate_learning_rate(agent_id)
            adaptation_score = await self._calculate_adaptation_score(agent_id)
            collaboration_score = await self._calculate_collaboration_score(agent_id)
            reliability_score = await self._calculate_reliability_score(agent_id)

            # Get agent info
            agent_name = "Unknown"
            agent_type = "Unknown"
            if capabilities:
                agent_name = capabilities[0].name.split("_")[0]  # Extract from first capability
                agent_type = await self._get_agent_type_from_db(agent_id)

            return AgentCapabilityProfile(
                agent_id=agent_id,
                agent_name=agent_name,
                agent_type=agent_type,
                capabilities=capabilities,
                overall_skill_level=overall_skill_level,
                specialization_areas=specialization_areas,
                learning_rate=learning_rate,
                adaptation_score=adaptation_score,
                collaboration_score=collaboration_score,
                reliability_score=reliability_score,
                last_updated=datetime.utcnow()
            )

        except Exception as e:
            self.logger.error(f"Failed to get capability profile for agent {agent_id}: {e}")
            return None

    async def find_capability_experts(
        self,
        capability_name: str,
        skill_level: Optional[SkillLevel] = None,
        max_results: int = 10
    ) -> List[Tuple[UUID, float]]:
        """
        Find agents expert in a specific capability.

        Args:
            capability_name: The capability name
            skill_level: Minimum skill level required
            max_results: Maximum number of results

        Returns:
            List of (agent_id, expertise_score) tuples
        """
        try:
            experts = []

            # Find agents with the capability
            candidate_agents = self._capability_index.get(capability_name, set())

            for agent_id in candidate_agents:
                capabilities = self._agent_capabilities.get(agent_id, [])
                for capability in capabilities:
                    if capability.name == capability_name:
                        # Check skill level requirement
                        if skill_level and not self._meets_skill_level(
                            capability.skill_level, skill_level
                        ):
                            continue

                        # Calculate expertise score
                        expertise_score = await self._calculate_expertise_score(capability)
                        experts.append((agent_id, expertise_score))
                        break  # Only consider the best capability per agent

            # Sort by expertise score
            experts.sort(key=lambda x: x[1], reverse=True)

            return experts[:max_results]

        except Exception as e:
            self.logger.error(f"Failed to find capability experts for {capability_name}: {e}")
            return []

    async def recommend_skill_development(self, agent_id: UUID) -> List[Dict[str, Any]]:
        """
        Recommend skill development areas for an agent.

        Args:
            agent_id: The agent ID

        Returns:
            List of skill development recommendations
        """
        try:
            recommendations = []

            # Get agent's current capabilities
            capabilities = self._agent_capabilities.get(agent_id, [])
            if not capabilities:
                return recommendations

            # Analyze performance gaps
            performance_gaps = await self._analyze_performance_gaps(agent_id, capabilities)
            recommendations.extend(performance_gaps)

            # Identify complementary skills
            complementary_skills = await self._identify_complementary_skills(capabilities)
            recommendations.extend(complementary_skills)

            # Market demand analysis
            demand_analysis = await self._analyze_skill_demand()
            for skill, demand_score in demand_analysis.items():
                if not any(cap.name == skill for cap in capabilities):
                    recommendations.append({
                        "type": "market_demand",
                        "skill": skill,
                        "priority": "medium",
                        "reasoning": f"High market demand (score: {demand_score:.2f})",
                        "estimated_effort": await self._estimate_learning_effort(skill)
                    })

            # Sort by priority
            recommendations.sort(key=lambda x: (
                {"high": 3, "medium": 2, "low": 1}.get(x.get("priority", "low"), 1),
                x.get("score", 0)
            ), reverse=True)

            return recommendations[:10]  # Top 10 recommendations

        except Exception as e:
            self.logger.error(f"Failed to recommend skill development for agent {agent_id}: {e}")
            return []

    async def _enhance_capability(
        self,
        agent_id: UUID,
        base_capability: Capability,
        auto_classify: bool
    ) -> AgentCapability:
        """Enhance a base capability with additional information."""
        # Classify capability type and skill level
        capability_type = self._classify_capability_type(base_capability.name)
        skill_level = self._estimate_skill_level(base_capability) if auto_classify else SkillLevel.INTERMEDIATE

        return AgentCapability(
            name=base_capability.name,
            description=base_capability.description,
            capability_type=capability_type,
            skill_level=skill_level,
            supported_task_types=base_capability.supported_task_types,
            required_tools=base_capability.required_tools,
            parameters=base_capability.parameters,
            tags=self._extract_tags_from_name(base_capability.name)
        )

    async def _discover_implicit_capabilities(self, agent: UPMAgent) -> List[AgentCapability]:
        """Discover implicit capabilities from agent type and configuration."""
        implicit_capabilities = []

        agent_type = agent.__class__.__name__.lower()

        # Define implicit capabilities by agent type
        if "browser" in agent_type:
            implicit_capabilities.extend([
                AgentCapability(
                    name="web_navigation",
                    description="Navigate web pages and interact with web elements",
                    capability_type=CapabilityType.TECHNICAL,
                    skill_level=SkillLevel.ADVANCED,
                    supported_task_types=[TaskType.BROWSER_AUTOMATION],
                    tags=["browser", "navigation", "automation"]
                ),
                AgentCapability(
                    name="element_interaction",
                    description="Interact with web elements (click, type, scroll)",
                    capability_type=CapabilityType.TECHNICAL,
                    skill_level=SkillLevel.ADVANCED,
                    tags=["browser", "interaction", "ui"]
                )
            ])
        elif "conversation" in agent_type:
            implicit_capabilities.extend([
                AgentCapability(
                    name="natural_language_processing",
                    description="Process and understand natural language input",
                    capability_type=CapabilityType.COMMUNICATION,
                    skill_level=SkillLevel.ADVANCED,
                    supported_task_types=[TaskType.CONVERSATION],
                    tags=["nlp", "language", "understanding"]
                ),
                AgentCapability(
                    name="context_awareness",
                    description="Maintain and understand conversation context",
                    capability_type=CapabilityType.ANALYTICAL,
                    skill_level=SkillLevel.INTERMEDIATE,
                    tags=["context", "memory", "awareness"]
                )
            ])
        elif "data" in agent_type:
            implicit_capabilities.extend([
                AgentCapability(
                    name="data_processing",
                    description="Process and transform data structures",
                    capability_type=CapabilityType.ANALYTICAL,
                    skill_level=SkillLevel.ADVANCED,
                    supported_task_types=[TaskType.DATA_PROCESSING],
                    tags=["data", "processing", "transformation"]
                ),
                AgentCapability(
                    name="pattern_recognition",
                    description="Identify patterns in data",
                    capability_type=CapabilityType.ANALYTICAL,
                    skill_level=SkillLevel.INTERMEDIATE,
                    tags=["patterns", "analysis", "recognition"]
                )
            ])
        elif "infrastructure" in agent_type:
            implicit_capabilities.extend([
                AgentCapability(
                    name="resource_management",
                    description="Manage infrastructure resources",
                    capability_type=CapabilityType.TECHNICAL,
                    skill_level=SkillLevel.ADVANCED,
                    supported_task_types=[TaskType.INFRASTRUCTURE],
                    tags=["infrastructure", "resources", "management"]
                ),
                AgentCapability(
                    name="system_monitoring",
                    description="Monitor system health and performance",
                    capability_type=CapabilityType.TECHNICAL,
                    skill_level=SkillLevel.INTERMEDIATE,
                    tags=["monitoring", "health", "performance"]
                )
            ])

        return implicit_capabilities

    async def _discover_tool_capabilities(self, agent: UPMAgent) -> List[AgentCapability]:
        """Discover capabilities from agent's registered tools."""
        tool_capabilities = []

        for tool_name in agent.tools.list_tools():
            # Map tool names to capabilities
            capability_mapping = {
                "selenium": "web_automation",
                "playwright": "browser_control",
                "requests": "http_client",
                "sqlalchemy": "database_operations",
                "pandas": "data_analysis",
                "numpy": "numerical_computing",
                "redis": "cache_management",
                "celery": "task_queue_management"
            }

            if tool_name.lower() in capability_mapping:
                cap_name = capability_mapping[tool_name.lower()]
                tool_capabilities.append(
                    AgentCapability(
                        name=cap_name,
                        description=f"Capability derived from {tool_name} tool",
                        capability_type=CapabilityType.TECHNICAL,
                        skill_level=SkillLevel.INTERMEDIATE,
                        tags=["tool", tool_name.lower(), "derived"]
                    )
                )

        return tool_capabilities

    async def _discover_config_capabilities(self, agent: UPMAgent) -> List[AgentCapability]:
        """Discover capabilities from agent configuration."""
        config_capabilities = []

        # Analyze LLM configuration
        if hasattr(agent, 'llm_config') and agent.llm_config:
            config_capabilities.append(
                AgentCapability(
                    name="llm_integration",
                    description="Integration with Large Language Models",
                    capability_type=CapabilityType.TECHNICAL,
                    skill_level=SkillLevel.INTERMEDIATE,
                    tags=["llm", "ai", "integration"]
                )
            )

            # Provider-specific capabilities
            provider = agent.llm_config.provider.lower()
            if provider in ["openai", "anthropic"]:
                config_capabilities.append(
                    AgentCapability(
                        name=f"{provider}_api_integration",
                        description=f"Integration with {provider} API",
                        capability_type=CapabilityType.INTEGRATION,
                        skill_level=SkillLevel.INTERMEDIATE,
                        tags=[provider, "api", "integration"]
                    )
                )

        return config_capabilities

    async def _merge_capabilities(
        self,
        capabilities: List[AgentCapability]
    ) -> List[AgentCapability]:
        """Merge similar capabilities and remove duplicates."""
        if not capabilities:
            return []

        # Group by name (case-insensitive)
        capability_groups = {}
        for cap in capabilities:
            key = cap.name.lower().strip()
            if key not in capability_groups:
                capability_groups[key] = []
            capability_groups[key].append(cap)

        # Merge each group
        merged_capabilities = []
        for group in capability_groups.values():
            if len(group) == 1:
                merged_capabilities.append(group[0])
            else:
                # Merge capabilities
                merged = await self._merge_capability_group(group)
                merged_capabilities.append(merged)

        return merged_capabilities

    async def _merge_capability_group(
        self,
        capabilities: List[AgentCapability]
    ) -> AgentCapability:
        """Merge a group of similar capabilities."""
        if len(capabilities) == 1:
            return capabilities[0]

        # Use the first capability as base
        base = capabilities[0]

        # Merge descriptions
        descriptions = [cap.description for cap in capabilities if cap.description]
        merged_description = " | ".join(set(descriptions))

        # Merge tags
        all_tags = set()
        for cap in capabilities:
            all_tags.update(cap.tags)

        # Merge supported task types
        all_task_types = set()
        for cap in capabilities:
            all_task_types.update(cap.supported_task_types)

        # Merge required tools
        all_tools = set()
        for cap in capabilities:
            all_tools.update(cap.required_tools)

        # Use the highest skill level
        skill_levels = [cap.skill_level for cap in capabilities]
        skill_level_order = [SkillLevel.MASTER, SkillLevel.EXPERT, SkillLevel.ADVANCED,
                           SkillLevel.INTERMEDIATE, SkillLevel.BEGINNER]
        highest_skill = min(skill_levels, key=lambda x: skill_level_order.index(x))

        return AgentCapability(
            name=base.name,
            description=merged_description,
            capability_type=base.capability_type,
            skill_level=highest_skill,
            version=base.version,
            supported_task_types=list(all_task_types),
            required_tools=list(all_tools),
            parameters=base.parameters,
            tags=list(all_tags)
        )

    async def _store_agent_capabilities(
        self,
        agent_id: UUID,
        capabilities: List[AgentCapability]
    ):
        """Store agent capabilities in memory and cache."""
        self._agent_capabilities[agent_id] = capabilities

        # Update indices
        for capability in capabilities:
            self._capability_index[capability.name].add(agent_id)
            self._type_index[capability.capability_type].add(agent_id)
            self._skill_level_index[capability.skill_level].add(agent_id)

        # Store in Redis for persistence
        await self._cache_agent_capabilities(agent_id, capabilities)

    async def _cache_agent_capabilities(
        self,
        agent_id: UUID,
        capabilities: List[AgentCapability]
    ):
        """Cache agent capabilities in Redis."""
        try:
            key = f"agent:capabilities:{agent_id}"
            capabilities_data = [cap.to_dict() for cap in capabilities]
            await redis_client.setex(
                key,
                timedelta(hours=24),
                json.dumps(capabilities_data)
            )
        except Exception as e:
            self.logger.error(f"Failed to cache agent capabilities: {e}")

    def _classify_capability_type(self, capability_name: str) -> CapabilityType:
        """Classify capability type based on name."""
        name_lower = capability_name.lower()

        # Technical capabilities
        technical_keywords = [
            "automation", "api", "database", "server", "deployment",
            "coding", "programming", "testing", "monitoring", "security"
        ]
        if any(keyword in name_lower for keyword in technical_keywords):
            return CapabilityType.TECHNICAL

        # Business capabilities
        business_keywords = [
            "business", "finance", "accounting", "reporting",
            "analysis", "strategy", "planning", "management"
        ]
        if any(keyword in name_lower for keyword in business_keywords):
            return CapabilityType.BUSINESS

        # Creative capabilities
        creative_keywords = [
            "creative", "design", "writing", "content", "art",
            "music", "video", "media", "storytelling"
        ]
        if any(keyword in name_lower for keyword in creative_keywords):
            return CapabilityType.CREATIVE

        # Communication capabilities
        communication_keywords = [
            "communication", "conversation", "chat", "email",
            "messaging", "translation", "language", "speech"
        ]
        if any(keyword in name_lower for keyword in communication_keywords):
            return CapabilityType.COMMUNICATION

        # Analytical capabilities
        analytical_keywords = [
            "analysis", "analytics", "data", "statistics",
            "research", "insights", "pattern", "prediction"
        ]
        if any(keyword in name_lower for keyword in analytical_keywords):
            return CapabilityType.ANALYTICAL

        # Default to technical for unknown capabilities
        return CapabilityType.TECHNICAL

    def _estimate_skill_level(self, capability: Capability) -> SkillLevel:
        """Estimate skill level based on capability properties."""
        # Simple heuristic based on capability complexity
        name_lower = capability.name.lower()
        description_lower = capability.description.lower()

        # Advanced indicators
        advanced_keywords = ["advanced", "expert", "complex", "optimization", "architecture"]
        if any(keyword in name_lower or keyword in description_lower for keyword in advanced_keywords):
            return SkillLevel.ADVANCED

        # Expert indicators
        expert_keywords = ["master", "architect", "lead", "senior", "principal"]
        if any(keyword in name_lower or keyword in description_lower for keyword in expert_keywords):
            return SkillLevel.EXPERT

        # Beginner indicators
        beginner_keywords = ["basic", "simple", "beginner", "introductory", "fundamental"]
        if any(keyword in name_lower or keyword in description_lower for keyword in beginner_keywords):
            return SkillLevel.BEGINNER

        # Default to intermediate
        return SkillLevel.INTERMEDIATE

    def _extract_tags_from_name(self, name: str) -> List[str]:
        """Extract relevant tags from capability name."""
        # Common technical terms that make good tags
        tag_keywords = [
            "api", "web", "browser", "database", "cloud", "security",
            "automation", "testing", "deployment", "monitoring",
            "data", "analytics", "ml", "ai", "nlp", "ui", "ux"
        ]

        name_lower = name.lower()
        tags = []

        for keyword in tag_keywords:
            if keyword in name_lower:
                tags.append(keyword)

        # Extract words that might be good tags
        words = name.split('_')
        for word in words:
            if len(word) > 3 and word not in tags:
                tags.append(word)

        return tags

    def _meets_skill_level(self, current: SkillLevel, required: SkillLevel) -> bool:
        """Check if current skill level meets requirement."""
        level_order = [SkillLevel.BEGINNER, SkillLevel.INTERMEDIATE, SkillLevel.ADVANCED,
                      SkillLevel.EXPERT, SkillLevel.MASTER]
        return level_order.index(current) >= level_order.index(required)

    async def _calculate_expertise_score(self, capability: AgentCapability) -> float:
        """Calculate expertise score for a capability."""
        # Base score from skill level
        skill_scores = {
            SkillLevel.BEGINNER: 0.2,
            SkillLevel.INTERMEDIATE: 0.4,
            SkillLevel.ADVANCED: 0.7,
            SkillLevel.EXPERT: 0.9,
            SkillLevel.MASTER: 1.0
        }
        base_score = skill_scores.get(capability.skill_level, 0.5)

        # Adjust based on performance metrics
        if capability.success_rate > 0:
            performance_factor = capability.success_rate
        else:
            performance_factor = 0.5

        # Adjust based on experience
        experience_factor = min(1.0, capability.experience_hours / 1000)  # 1000 hours = expert level

        # Calculate final score
        expertise_score = base_score * 0.4 + performance_factor * 0.4 + experience_factor * 0.2

        return min(1.0, expertise_score)

    # Additional methods for learning, adaptation, and advanced matching would be implemented here
    # For brevity, I'll include the key method signatures

    async def _extract_task_requirements(self, task: Task) -> List[TaskRequirement]:
        """Extract requirements from task definition."""
        # Implementation would analyze task description, type, and parameters
        return []

    async def _find_candidate_agents(self, requirements: List[TaskRequirement]) -> List[UUID]:
        """Find candidate agents based on requirements."""
        # Implementation would use capability indices to find candidates
        return []

    async def _calculate_agent_matches(
        self,
        agent_id: UUID,
        requirements: List[TaskRequirement],
        algorithm: MatchingAlgorithm
    ) -> List[CapabilityMatch]:
        """Calculate matches between agent and requirements."""
        # Implementation would use various matching algorithms
        return []

    async def _rank_matches(
        self,
        matches: List[CapabilityMatch],
        algorithm: MatchingAlgorithm
    ) -> List[CapabilityMatch]:
        """Rank and sort capability matches."""
        # Implementation would rank based on algorithm-specific criteria
        return matches

    async def _record_interaction(
        self,
        agent_id: UUID,
        capability: str,
        success: bool,
        execution_time: float,
        feedback: Optional[float]
    ):
        """Record agent interaction for learning."""
        # Implementation would update learning models
        pass

    async def _discovery_loop(self):
        """Background loop for continuous capability discovery."""
        while True:
            try:
                # Periodic discovery and updates
                await asyncio.sleep(3600)  # Run every hour
            except asyncio.CancelledError:
                break

    async def _learning_loop(self):
        """Background loop for learning and adaptation."""
        while True:
            try:
                # Periodic learning and model updates
                await asyncio.sleep(1800)  # Run every 30 minutes
            except asyncio.CancelledError:
                break

    # Database and cache operations
    async def _load_capabilities_from_db(self):
        """Load capabilities from database."""
        pass

    async def _save_capabilities_to_db(self):
        """Save capabilities to database."""
        pass

    async def _load_agent_capabilities_from_db(self, agent_id: UUID) -> List[AgentCapability]:
        """Load specific agent capabilities from database."""
        return []

    async def _get_agent_capability(self, agent_id: UUID, capability_name: str) -> Optional[AgentCapability]:
        """Get specific capability for an agent."""
        capabilities = self._agent_capabilities.get(agent_id, [])
        for cap in capabilities:
            if cap.name == capability_name:
                return cap
        return None

    async def _update_agent_capability(self, agent_id: UUID, capability: AgentCapability):
        """Update a specific capability for an agent."""
        capabilities = self._agent_capabilities.get(agent_id, [])
        for i, cap in enumerate(capabilities):
            if cap.name == capability.name:
                capabilities[i] = capability
                break

    async def _get_agent_type_from_db(self, agent_id: UUID) -> str:
        """Get agent type from database."""
        return "Unknown"

    async def _calculate_overall_skill_level(self, capabilities: List[AgentCapability]) -> SkillLevel:
        """Calculate overall skill level for an agent."""
        if not capabilities:
            return SkillLevel.BEGINNER

        # Weight capabilities by experience and performance
        total_score = 0
        total_weight = 0

        for cap in capabilities:
            skill_scores = {
                SkillLevel.BEGINNER: 1,
                SkillLevel.INTERMEDIATE: 2,
                SkillLevel.ADVANCED: 3,
                SkillLevel.EXPERT: 4,
                SkillLevel.MASTER: 5
            }
            score = skill_scores.get(cap.skill_level, 2)
            weight = 1.0

            # Adjust weight based on success rate
            if cap.success_rate > 0:
                weight *= cap.success_rate

            total_score += score * weight
            total_weight += weight

        if total_weight == 0:
            return SkillLevel.BEGINNER

        avg_score = total_score / total_weight

        if avg_score >= 4.5:
            return SkillLevel.MASTER
        elif avg_score >= 3.5:
            return SkillLevel.EXPERT
        elif avg_score >= 2.5:
            return SkillLevel.ADVANCED
        elif avg_score >= 1.5:
            return SkillLevel.INTERMEDIATE
        else:
            return SkillLevel.BEGINNER

    async def _identify_specializations(self, capabilities: List[AgentCapability]) -> List[str]:
        """Identify agent's specialization areas."""
        # Count capabilities by type
        type_counts = {}
        for cap in capabilities:
            type_counts[cap.capability_type] = type_counts.get(cap.capability_type, 0) + 1

        # Identify top specialization areas
        sorted_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
        return [t[0].value for t in sorted_types[:3]]  # Top 3 areas

    async def _calculate_learning_rate(self, agent_id: UUID) -> float:
        """Calculate agent's learning rate."""
        # Implementation would analyze performance improvement over time
        return 0.1

    async def _calculate_adaptation_score(self, agent_id: UUID) -> float:
        """Calculate agent's adaptation score."""
        # Implementation would measure adaptability
        return 0.7

    async def _calculate_collaboration_score(self, agent_id: UUID) -> float:
        """Calculate agent's collaboration score."""
        # Implementation would measure collaboration effectiveness
        return 0.8

    async def _calculate_reliability_score(self, agent_id: UUID) -> float:
        """Calculate agent's reliability score."""
        # Implementation would measure consistency and success rate
        return 0.9

    async def _analyze_performance_gaps(
        self,
        agent_id: UUID,
        capabilities: List[AgentCapability]
    ) -> List[Dict[str, Any]]:
        """Analyze performance gaps and recommend improvements."""
        gaps = []

        for cap in capabilities:
            if cap.success_rate < 0.8:  # Low success rate
                gaps.append({
                    "type": "performance_gap",
                    "skill": cap.name,
                    "priority": "high",
                    "reasoning": f"Low success rate: {cap.success_rate:.2%}",
                    "current_level": cap.skill_level.value,
                    "target_level": "advanced"
                })

        return gaps

    async def _identify_complementary_skills(self, capabilities: List[AgentCapability]) -> List[Dict[str, Any]]:
        """Identify complementary skills that would benefit the agent."""
        complementary_map = {
            "web_automation": ["element_interaction", "page_scraping", "form_filling"],
            "data_analysis": ["statistical_analysis", "visualization", "reporting"],
            "api_integration": ["authentication", "error_handling", "rate_limiting"],
            "database_operations": ["query_optimization", "data_migration", "schema_design"]
        }

        recommendations = []
        existing_skills = {cap.name for cap in capabilities}

        for skill, complements in complementary_map.items():
            if skill in existing_skills:
                for complement in complements:
                    if complement not in existing_skills:
                        recommendations.append({
                            "type": "complementary",
                            "skill": complement,
                            "priority": "medium",
                            "reasoning": f"Complements {skill}",
                            "related_skill": skill
                        })

        return recommendations

    async def _analyze_skill_demand(self) -> Dict[str, float]:
        """Analyze current skill demand in the system."""
        # Implementation would analyze task requirements and agent availability
        return {}

    async def _estimate_learning_effort(self, skill: str) -> str:
        """Estimate learning effort for a skill."""
        # Implementation would return estimated learning time/difficulty
        return "medium"


# Global capability discovery service instance
capability_discovery = CapabilityDiscoveryService()


def get_capability_discovery() -> CapabilityDiscoveryService:
    """Get the global capability discovery service instance."""
    return capability_discovery