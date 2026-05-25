"""
Collaboration models for agent collaboration framework
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from enum import Enum

from app.core.database import Base


class CollaborationStatus(str, Enum):
    """Collaboration session status"""
    INITIALIZING = "initializing"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageType(str, Enum):
    """Message types for agent communication"""
    TASK_DELEGATION = "task_delegation"
    TASK_RESPONSE = "task_response"
    STATUS_UPDATE = "status_update"
    RESULT_SHARE = "result_share"
    CONSENSUS_REQUEST = "consensus_request"
    CONSENSUS_RESPONSE = "consensus_response"
    COORDINATION = "coordination"
    ERROR = "error"
    HEARTBEAT = "heartbeat"
    DISCOVERY = "discovery"


class MessagePriority(str, Enum):
    """Message priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class CollaborationSession(Base):
    """Collaboration session model for multi-agent collaboration"""

    __tablename__ = "collaboration_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Session configuration
    collaboration_type = Column(String, nullable=False)  # task_delegation, consensus, workflow, etc.
    initiator_agent_id = Column(UUID(as_uuid=True), nullable=False)

    # Participation
    participating_agents = Column(JSON, default=list)  # List of agent IDs
    required_agents = Column(JSON, default=list)  # Agents that must participate
    optional_agents = Column(JSON, default=list)  # Optional participating agents

    # Status and lifecycle
    status = Column(String, default=CollaborationStatus.INITIALIZING)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    timeout_at = Column(DateTime(timezone=True), nullable=True)

    # Configuration
    max_duration_minutes = Column(Integer, default=60)
    consensus_threshold = Column(Float, default=0.7)  # For consensus-based collaboration
    voting_weights = Column(JSON, default=dict)  # Agent-specific voting weights

    # Workflow and task management
    workflow_definition = Column(JSON, default=dict)  # Collaboration workflow steps
    current_step = Column(Integer, default=0)
    total_steps = Column(Integer, default=0)

    # Results and outcomes
    final_result = Column(JSON, nullable=True)
    consensus_result = Column(JSON, nullable=True)
    individual_results = Column(JSON, default=dict)  # Agent-specific results

    # Performance metrics
    total_messages = Column(Integer, default=0)
    total_tasks_delegated = Column(Integer, default=0)
    average_response_time_ms = Column(Float, default=0.0)

    # Additional data
    session_data = Column(JSON, default=dict)
    tags = Column(JSON, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    messages = relationship("CollaborationMessage", back_populates="session", cascade="all, delete-orphan")
    tasks = relationship("CollaborationTask", back_populates="session", cascade="all, delete-orphan")
    votes = relationship("ConsensusVote", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CollaborationSession(id={self.id}, name={self.name}, status={self.status})>"


class CollaborationMessage(Base):
    """Message model for agent communication within collaboration sessions"""

    __tablename__ = "collaboration_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_sessions.id"), nullable=False)

    # Message details
    sender_agent_id = Column(UUID(as_uuid=True), nullable=False)
    recipient_agent_id = Column(UUID(as_uuid=True), nullable=True)  # Null for broadcast
    message_type = Column(String, nullable=False)
    priority = Column(String, default=MessagePriority.NORMAL)

    # Content
    subject = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)  # Structured data

    # Delivery tracking
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    delivery_attempts = Column(Integer, default=0)

    # Response tracking
    requires_response = Column(Boolean, default=False)
    response_deadline = Column(DateTime(timezone=True), nullable=True)
    response_message_id = Column(UUID(as_uuid=True), nullable=True)

    # Message threading
    thread_id = Column(UUID(as_uuid=True), nullable=True)  # For message threading
    parent_message_id = Column(UUID(as_uuid=True), nullable=True)

    # Performance
    processing_time_ms = Column(Float, nullable=True)

    # Metadata
    session_data = Column(JSON, default=dict)

    # Relationships
    session = relationship("CollaborationSession", back_populates="messages")
    response_to = relationship("CollaborationMessage", remote_side=[id])

    def __repr__(self):
        return f"<CollaborationMessage(id={self.id}, type={self.message_type}, sender={self.sender_agent_id})>"


class CollaborationTask(Base):
    """Task model for tasks delegated within collaboration sessions"""

    __tablename__ = "collaboration_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_sessions.id"), nullable=False)

    # Task details
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String, nullable=False)

    # Assignment
    delegating_agent_id = Column(UUID(as_uuid=True), nullable=False)
    assigned_agent_id = Column(UUID(as_uuid=True), nullable=True)

    # Task data
    input_data = Column(JSON, nullable=True)
    requirements = Column(JSON, nullable=True)
    constraints = Column(JSON, nullable=True)

    # Status and lifecycle
    status = Column(String, default="pending")  # pending, assigned, in_progress, completed, failed, cancelled
    priority = Column(Integer, default=5)  # 1-10, 1 being highest

    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)

    # Results
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    success_score = Column(Float, nullable=True)  # 0.0-1.0

    # Performance metrics
    execution_time_ms = Column(Float, nullable=True)
    resource_usage = Column(JSON, nullable=True)

    # Dependencies
    depends_on = Column(JSON, default=list)  # List of task IDs this task depends on
    blocks = Column(JSON, default=list)  # List of task IDs blocked by this task

    # Additional data
    session_data = Column(JSON, default=dict)
    tags = Column(JSON, default=list)

    # Relationships
    session = relationship("CollaborationSession", back_populates="tasks")

    def __repr__(self):
        return f"<CollaborationTask(id={self.id}, type={self.task_type}, status={self.status})>"


class ConsensusVote(Base):
    """Vote model for consensus decision-making"""

    __tablename__ = "consensus_votes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_sessions.id"), nullable=False)

    # Vote details
    proposal_id = Column(String, nullable=False)  # Identifier for the proposal being voted on
    voting_agent_id = Column(UUID(as_uuid=True), nullable=False)

    # Vote content
    vote_value = Column(String, nullable=False)  # approve, reject, abstain, or specific value
    confidence_score = Column(Float, nullable=True)  # 0.0-1.0
    reasoning = Column(Text, nullable=True)

    # Vote data
    vote_data = Column(JSON, nullable=True)  # Additional structured vote data

    # Timing
    cast_at = Column(DateTime(timezone=True), server_default=func.now())
    voting_weight = Column(Float, default=1.0)

    # Consensus calculation
    contributes_to_consensus = Column(Boolean, default=True)

    # Metadata
    session_data = Column(JSON, default=dict)

    # Relationships
    session = relationship("CollaborationSession", back_populates="votes")

    def __repr__(self):
        return f"<ConsensusVote(id={self.id}, agent={self.voting_agent_id}, vote={self.vote_value})>"


class AgentCapability(Base):
    """Agent capability model for dynamic capability matching"""

    __tablename__ = "agent_capabilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), nullable=False)

    # Capability details
    capability_name = Column(String, nullable=False)
    capability_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Capability metrics
    proficiency_level = Column(Float, default=0.5)  # 0.0-1.0
    reliability_score = Column(Float, default=0.5)  # 0.0-1.0
    performance_score = Column(Float, default=0.5)  # 0.0-1.0

    # Capability data
    supported_operations = Column(JSON, default=list)
    input_formats = Column(JSON, default=list)
    output_formats = Column(JSON, default=list)

    # Resource requirements
    cpu_requirement = Column(Float, nullable=True)
    memory_requirement = Column(Float, nullable=True)
    network_requirement = Column(Float, nullable=True)

    # Availability
    is_available = Column(Boolean, default=True)
    last_used = Column(DateTime(timezone=True), nullable=True)
    usage_count = Column(Integer, default=0)

    # Discovery and registration
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Additional data
    session_data = Column(JSON, default=dict)
    tags = Column(JSON, default=list)

    def __repr__(self):
        return f"<AgentCapability(id={self.id}, agent={self.agent_id}, capability={self.capability_name})>"


class CollaborationPattern(Base):
    """Collaboration pattern model for reusable collaboration workflows"""

    __tablename__ = "collaboration_patterns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Pattern details
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    pattern_type = Column(String, nullable=False)  # sequential, parallel, consensus, hierarchical

    # Pattern definition
    workflow_definition = Column(JSON, nullable=False)
    required_capabilities = Column(JSON, default=list)
    optimal_agent_count = Column(Integer, nullable=True)
    min_agent_count = Column(Integer, default=1)
    max_agent_count = Column(Integer, nullable=True)

    # Usage statistics
    usage_count = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    average_completion_time_ms = Column(Float, default=0.0)

    # Pattern metadata
    version = Column(String, default="1.0.0")
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    pattern_applications = relationship("PatternApplication", back_populates="pattern")

    def __repr__(self):
        return f"<CollaborationPattern(id={self.id}, name={self.name}, type={self.pattern_type})>"


class PatternApplication(Base):
    """Record of pattern application in collaboration sessions"""

    __tablename__ = "pattern_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pattern_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_patterns.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_sessions.id"), nullable=False)

    # Application details
    adaptation_notes = Column(Text, nullable=True)
    customizations = Column(JSON, default=dict)

    # Results
    was_successful = Column(Boolean, nullable=True)
    performance_metrics = Column(JSON, nullable=True)

    # Timestamps
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    pattern = relationship("CollaborationPattern", back_populates="pattern_applications")
    session = relationship("CollaborationSession")

    def __repr__(self):
        return f"<PatternApplication(id={self.id}, pattern={self.pattern_id}, session={self.session_id})>"


class CommunicationChannel(Base):
    """Communication channel model for agent-to-agent communication"""

    __tablename__ = "communication_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Channel details
    name = Column(String, nullable=False)
    channel_type = Column(String, nullable=False)  # direct, broadcast, topic_based, hierarchical
    description = Column(Text, nullable=True)

    # Channel configuration
    participants = Column(JSON, default=list)  # Agent IDs that can use this channel
    is_persistent = Column(Boolean, default=False)
    max_message_size = Column(Integer, default=1048576)  # 1MB default

    # Security and access
    requires_authentication = Column(Boolean, default=True)
    encryption_enabled = Column(Boolean, default=True)
    access_permissions = Column(JSON, default=dict)

    # Performance and limits
    rate_limit_per_minute = Column(Integer, default=100)
    message_retention_hours = Column(Integer, default=24)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_activity = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    channel_metrics = relationship("ChannelMetrics", back_populates="channel", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CommunicationChannel(id={self.id}, name={self.name}, type={self.channel_type})>"


class ChannelMetrics(Base):
    """Metrics for communication channels"""

    __tablename__ = "channel_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("communication_channels.id"), nullable=False)

    # Metrics
    messages_sent = Column(Integer, default=0)
    messages_delivered = Column(Integer, default=0)
    messages_failed = Column(Integer, default=0)
    average_latency_ms = Column(Float, default=0.0)

    # Performance
    peak_throughput = Column(Integer, default=0)
    average_throughput = Column(Float, default=0.0)

    # Time period
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)

    # Timestamps
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    channel = relationship("CommunicationChannel", back_populates="channel_metrics")

    def __repr__(self):
        return f"<ChannelMetrics(id={self.id}, channel={self.channel_id}, messages={self.messages_sent})>"