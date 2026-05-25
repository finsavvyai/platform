"""
Architecture pattern models for AI-powered recommendations.

This module defines the core models and enums for architecture pattern
recognition, integration patterns, and best practice recommendations.
"""

from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from pydantic import BaseModel, Field


class ArchitecturePattern(str, Enum):
    """Supported architecture patterns."""

    # Integration Patterns
    MICROSERVICES = "microservices"
    MONOLITH = "monolith"
    MODULAR_MONOLITH = "modular_monolith"
    SERVICE_MESH = "service_mesh"
    API_GATEWAY = "api_gateway"
    EVENT_DRIVEN = "event_driven"

    # Cross-Language Integration Patterns
    BRIDGE_PATTERN = "bridge_pattern"
    ADAPTER_PATTERN = "adapter_pattern"
    FACADE_PATTERN = "facade_pattern"
    PROXY_PATTERN = "proxy_pattern"
    TRANSLATOR_PATTERN = "translator_pattern"

    # Data Integration Patterns
    DATA_LAKE = "data_lake"
    DATA_WAREHOUSE = "data_warehouse"
    EVENT_SOURCING = "event_sourcing"
    CQRS = "cqrs"

    # Communication Patterns
    REST_API = "rest_api"
    GRPC = "grpc"
    MESSAGE_QUEUE = "message_queue"
    WEBSOCKET = "websocket"
    GRAPHQL = "graphql"


class IntegrationTechnology(str, Enum):
    """Technologies for cross-language integration."""

    PY4J = "py4j"
    JNI = "jni"
    WEBASSEMBLY = "wasm"
    REST = "rest"
    GRPC = "grpc"
    MESSAGE_BUS = "message_bus"
    SHARED_MEMORY = "shared_memory"
    FILE_BASED = "file_based"


class ComplexityLevel(str, Enum):
    """Complexity levels for recommendations."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


@dataclass
class ProjectArchitecture:
    """Represents the current project architecture."""

    project_id: str
    languages: List[str] = field(default_factory=list)
    frameworks: List[str] = field(default_factory=list)
    dependency_count: int = 0
    cross_language_dependencies: int = 0
    integration_points: List[str] = field(default_factory=list)
    performance_requirements: str = "standard"
    scaling_requirements: str = "standard"
    team_size: int = 1
    complexity_indicators: List[str] = field(default_factory=list)


@dataclass
class PatternMatch:
    """Represents a detected architecture pattern."""

    pattern: ArchitecturePattern
    confidence: float
    evidence: List[str] = field(default_factory=list)
    location: Optional[str] = None
    strength: float = 0.0


@dataclass
class IntegrationPattern:
    """Represents an integration pattern recommendation."""

    pattern: str
    technology: IntegrationTechnology
    description: str
    benefits: List[str] = field(default_factory=list)
    drawbacks: List[str] = field(default_factory=list)
    implementation_complexity: ComplexityLevel = ComplexityLevel.MEDIUM
    performance_impact: str = "low"
    example_code: Optional[str] = None
    configuration: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BestPractice:
    """Represents a best practice recommendation."""

    category: str
    title: str
    description: str
    rationale: str
    implementation_steps: List[str] = field(default_factory=list)
    anti_patterns: List[str] = field(default_factory=list)
    code_examples: Dict[str, str] = field(default_factory=dict)
    resources: List[str] = field(default_factory=list)


@dataclass
class PerformanceRecommendation:
    """Represents a performance optimization recommendation."""

    component: str
    issue: str
    recommendation: str
    expected_improvement: str
    implementation_effort: ComplexityLevel
    priority: str = "medium"
    metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class ArchitectureRecommendation:
    """Complete architecture recommendation result."""

    project_id: str
    detected_patterns: List[PatternMatch] = field(default_factory=list)
    integration_patterns: List[IntegrationPattern] = field(default_factory=list)
    best_practices: List[BestPractice] = field(default_factory=list)
    performance_recommendations: List[PerformanceRecommendation] = field(
        default_factory=list
    )
    anti_patterns: List[str] = field(default_factory=list)
    migration_path: Optional[str] = None
    estimated_effort: Optional[str] = None
    confidence_score: float = 0.0
    generated_at: datetime = field(default_factory=datetime.utcnow)


# Pydantic models for API serialization
class ProjectArchitectureModel(BaseModel):
    """Pydantic model for ProjectArchitecture."""

    project_id: str
    languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    dependency_count: int = 0
    cross_language_dependencies: int = 0
    integration_points: List[str] = Field(default_factory=list)
    performance_requirements: str = "standard"
    scaling_requirements: str = "standard"
    team_size: int = 1
    complexity_indicators: List[str] = Field(default_factory=list)


class PatternMatchModel(BaseModel):
    """Pydantic model for PatternMatch."""

    pattern: ArchitecturePattern
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    strength: float = Field(default=0.0, ge=0.0, le=1.0)


class IntegrationPatternModel(BaseModel):
    """Pydantic model for IntegrationPattern."""

    pattern: str
    technology: IntegrationTechnology
    description: str
    benefits: List[str] = Field(default_factory=list)
    drawbacks: List[str] = Field(default_factory=list)
    implementation_complexity: ComplexityLevel = ComplexityLevel.MEDIUM
    performance_impact: str = "low"
    example_code: Optional[str] = None
    configuration: Dict[str, Any] = Field(default_factory=dict)


class BestPracticeModel(BaseModel):
    """Pydantic model for BestPractice."""

    category: str
    title: str
    description: str
    rationale: str
    implementation_steps: List[str] = Field(default_factory=list)
    anti_patterns: List[str] = Field(default_factory=list)
    code_examples: Dict[str, str] = Field(default_factory=dict)
    resources: List[str] = Field(default_factory=list)


class PerformanceRecommendationModel(BaseModel):
    """Pydantic model for PerformanceRecommendation."""

    component: str
    issue: str
    recommendation: str
    expected_improvement: str
    implementation_effort: ComplexityLevel
    priority: str = "medium"
    metrics: Dict[str, float] = Field(default_factory=dict)


class ArchitectureRecommendationModel(BaseModel):
    """Pydantic model for ArchitectureRecommendation."""

    project_id: str
    detected_patterns: List[PatternMatchModel] = Field(default_factory=list)
    integration_patterns: List[IntegrationPatternModel] = Field(default_factory=list)
    best_practices: List[BestPracticeModel] = Field(default_factory=list)
    performance_recommendations: List[PerformanceRecommendationModel] = Field(
        default_factory=list
    )
    anti_patterns: List[str] = Field(default_factory=list)
    migration_path: Optional[str] = None
    estimated_effort: Optional[str] = None
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
